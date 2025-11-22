import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Interview } from "../models/interview.model.js";
import { User } from "../models/user.model.js";
import { Interviewer } from "../models/interviewer.model.js";
import { FreelancerProfile } from "../models/profile.model.js";

// Helper: predefined slot start times (IST) for weekdays and weekend
const WEEKDAY_SLOT_STARTS = [
    { h: 16, m: 0 },
    { h: 16, m: 45 },
    { h: 17, m: 30 },
    { h: 18, m: 15 },
    { h: 19, m: 0 },
    { h: 19, m: 45 },
    { h: 20, m: 30 },
    { h: 21, m: 15 },
];

const SATURDAY_SLOT_STARTS = [
    { h: 11, m: 0 },
    { h: 11, m: 45 },
    { h: 12, m: 30 },
    { h: 13, m: 15 },
];

function toISTDate(date) {
    // Input: JS Date (UTC or local). We will treat provided date as local server time and return a Date object.
    return new Date(date);
}

function generateSlots({ daysAhead = 14, includeWeekend = false } = {}) {
    const slots = [];
    const now = new Date();
    for (let d = 0; d < daysAhead; d++) {
        const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
        const weekday = day.getDay(); // 0 Sun .. 6 Sat

        // Weekdays Monday(1) to Friday(5)
        if (weekday >= 1 && weekday <= 5) {
            for (const st of WEEKDAY_SLOT_STARTS) {
                const dt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), st.h, st.m, 0);
                if (dt > now) slots.push({ dateTime: dt, duration: 30 });
            }
        }

        // Saturday
        if (includeWeekend && weekday === 6) {
            for (const st of SATURDAY_SLOT_STARTS) {
                const dt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), st.h, st.m, 0);
                if (dt > now) slots.push({ dateTime: dt, duration: 30 });
            }
        }
    }
    return slots;
}

const getPendingInterviewsForFreelancer = asyncHandler(async (req, res) => {
    const freelancerId = req.user?._id; // set by verifyJWT

    if (!freelancerId) {
        throw new ApiError(401, "Unauthorized access");
    }

    // Return any interviews relevant to the freelancer: requested, reschedule_requested, scheduled
    const statuses = ["requested", "reschedule_requested", "scheduled"];

    const pendingInterviews = await Interview.find({
        freelancer: freelancerId,
        status: { $in: statuses },
    })
        .populate("interviewer", "fullName email") // include interviewer when assigned
        .select(
            "mode platform link dateTime duration timezone status notes preferredRole createdAt"
        )
        .sort({ dateTime: 1 }); // upcoming first

    return res
        .status(200)
        .json(
            new ApiResponse(200, pendingInterviews, "Freelancer interviews fetched successfully")
        );
});

// New: Freelancer requests an interview slot (creates a requested interview)
const createInterviewRequest = asyncHandler(async (req, res) => {
    const freelancerId = req.user?._id;
    if (!freelancerId) throw new ApiError(401, "Unauthorized");

    const { dateTime, preferredRole } = req.body;
    if (!dateTime) throw new ApiError(400, "Preferred slot (dateTime) is required");

    const dt = new Date(dateTime);
    if (Number.isNaN(dt.getTime())) throw new ApiError(400, "Invalid dateTime");

    // Only allow picking from our generated slots (for safety)
    const allowed = generateSlots({ daysAhead: 21, includeWeekend: false }).some(s => Math.abs(s.dateTime.getTime() - dt.getTime()) === 0);
    if (!allowed) {
        throw new ApiError(400, "Selected slot is not an allowed slot");
    }

    // Check if another interview/request exists for the same slot (requested or scheduled)
    const conflict = await Interview.findOne({ dateTime: dt, status: { $in: ["requested", "scheduled"] } });
    if (conflict) {
        throw new ApiError(409, "Slot not available");
    }

    // Ensure the freelancer does not already have an active request or scheduled interview
    const existingForFreelancer = await Interview.findOne({ freelancer: freelancerId, status: { $in: ["requested", "reschedule_requested", "scheduled"] } });
    if (existingForFreelancer) {
        throw new ApiError(400, "You already have an interview request or scheduled interview");
    }

    const interview = await Interview.create({
        freelancer: freelancerId,
        interviewer: null,
        dateTime: dt,
        duration: 30,
        timezone: "Asia/Kolkata",
        status: "requested",
        preferredRole: preferredRole || undefined,
    });

    return res.status(201).json(new ApiResponse(201, interview, "Interview request created"));
});

// New: list available slots (marks unavailable if already requested/scheduled)
const getAvailableSlots = asyncHandler(async (req, res) => {
    // ?days=14 & ?includeWeekend=true
    const days = Math.min(60, Math.max(7, parseInt(req.query.days) || 14));
    const includeWeekend = req.query.includeWeekend === 'true';
    const slots = generateSlots({ daysAhead: days, includeWeekend });

    // Build set of occupied datetimes
    const datetimes = slots.map(s => s.dateTime);
    const interviews = await Interview.find({ dateTime: { $in: datetimes }, status: { $in: ["requested", "scheduled"] } }).select('dateTime status');
    const occupied = new Set(interviews.map(i => String(new Date(i.dateTime).getTime())));

    const result = slots.map(s => ({ dateTime: s.dateTime, duration: s.duration, available: !occupied.has(String(s.dateTime.getTime())) }));
    return res.status(200).json(new ApiResponse(200, result));
});

const getFreelancersWithoutInterview = asyncHandler(async (req, res) => {
    // ensure admin is calling
    if (req.user.role !== "admin") {
        throw new ApiError(403, "Access denied. Admins only.");
    }

    // Find all freelancers
    const freelancers = await User.find({ role: "freelancer" }).select(
        "fullName email skills experience isInterviewed createdAt"
    );

    // Find all freelancer IDs who already have scheduled/pending interviews
    const interviewedFreelancers = await Interview.distinct("freelancer", {
        status: { $in: ["scheduled", "completed"] },
    });

    // Filter out those who already have an interview
    const pendingFreelancers = freelancers.filter(
        (f) => !interviewedFreelancers.includes(f._id.toString())
    );

    // Attach latestInterview (most recent by createdAt) if any exists for the freelancer
    const withLatest = await Promise.all(
        pendingFreelancers.map(async (freelancer) => {
            const latestInterview = await Interview.findOne({
                freelancer: freelancer._id,
            })
                .sort({ createdAt: -1 })
                .select(
                    "status dateTime duration mode platform link timezone notes createdAt"
                )
                .lean();
            return {
                ...freelancer.toObject(),
                latestInterview: latestInterview || null,
            };
        })
    );

    return res.status(200).json(
        new ApiResponse(
            200,
            withLatest,
            "Freelancers without assigned interviews fetched successfully"
        )
    );
});

// New admin: list interview requests (queue)
const getInterviewRequestsForAdmin = asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin') throw new ApiError(403, 'Admins only');

    const requests = await Interview.find({ status: { $in: ['requested', 'reschedule_requested'] } })
        .populate('freelancer', 'username fullName')
        .sort({ dateTime: 1 })
        .lean();

    // detect conflicts per slot
    const slotCounts = {};
    for (const r of requests) {
        const key = String(new Date(r.dateTime).getTime());
        slotCounts[key] = (slotCounts[key] || 0) + 1;
    }

    const scheduled = await Interview.find({ status: 'scheduled' }).select('dateTime').lean();
    for (const s of scheduled) {
        const key = String(new Date(s.dateTime).getTime());
        slotCounts[key] = (slotCounts[key] || 0) + 1;
    }

    const withConflict = requests.map(r => ({
        ...r,
        conflict: (slotCounts[String(new Date(r.dateTime).getTime())] || 0) > 1
    }));

    return res.status(200).json(new ApiResponse(200, withConflict));
});

// New admin action: request reschedule for a given interview request
const adminRequestReschedule = asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin') throw new ApiError(403, 'Admins only');

    const id = req.params.id;
    if (!id) throw new ApiError(400, 'Interview id required');

    const interview = await Interview.findById(id);
    if (!interview) throw new ApiError(404, 'Interview not found');

    interview.status = 'reschedule_requested';
    if (req.body.notes) interview.notes = req.body.notes;
    await interview.save();

    return res.status(200).json(new ApiResponse(200, interview, 'Reschedule requested'));
});

const assignInterviewToFreelancer = asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") {
        throw new ApiError(403, "Access denied. Admins only.");
    }

    const {
        freelancerId,
        interviewerId,
        mode,
        platform,
        link,
        dateTime,
        duration,
    } = req.body;

    // Validate data
    if (!freelancerId || !interviewerId || !dateTime) {
        throw new ApiError(
            400,
            "Freelancer ID, interviewer ID, and date/time are required"
        );
    }

    // Check if freelancer exists
    const freelancer = await User.findById(freelancerId);
    if (!freelancer) throw new ApiError(404, "Freelancer not found");

    // Check if interviewer exists
      const interviewer = await User.findById(interviewerId);
      if (!interviewer || interviewer.role !== "interviewer") {
        throw new ApiError(400, "Invalid interviewer ID");
      }

    const existingInterview = await Interview.findOne({
        freelancer: freelancerId,
        status: "scheduled",
    });
    if (existingInterview) {
        throw new ApiError(400, "Freelancer already has an active interview");
    }

    // Create interview
    const interview = await Interview.create({
        freelancer: freelancerId,
        interviewer: interviewerId,
        mode,
        platform,
        link,
        dateTime,
        duration,
        timezone: "Asia/Kolkata",
        status: "scheduled",
    });
    await interview.populate("interviewer", "fullName email");

    // Optionally mark freelancer as interviewed (for admin dashboard filtering)
      freelancer.isInterviewed = true;
    freelancer.interviews.push(interview._id);
    interview.status = "scheduled";
    await freelancer.save();

    return res
        .status(201)
        .json(
            new ApiResponse(
                201,
                interview,
                "Interview assigned successfully and freelancer updated"
            )
        );
});

// Consolidated exports
export {
    getPendingInterviewsForFreelancer,
    createInterviewRequest,
    getAvailableSlots,
    getFreelancersWithoutInterview,
    getInterviewRequestsForAdmin,
    adminRequestReschedule,
    assignInterviewToFreelancer,
    getAssignedInterviewsForInterviewer,
    updateInterviewStatus,
    submitInterviewFeedback,
};

// ---------------------- INTERVIEWER DASHBOARD & ACTIONS ----------------------

// List interviews assigned to the logged-in interviewer
// Shows interviews that are not completed or cancelled, sorted by upcoming date first
const getAssignedInterviewsForInterviewer = asyncHandler(async (req, res) => {
    const interviewerId = req.user?._id;
    if (!interviewerId) {
        throw new ApiError(401, "Unauthorized access");
    }

    const interviews = await Interview.find({
        interviewer: interviewerId,
        status: { $in: ["pending", "scheduled"] },
    })
        .populate("freelancer", "fullName email")
        .select(
            "mode platform link dateTime duration timezone status notes createdAt"
        )
        .sort({ dateTime: 1 });

    return res.status(200).json(
        new ApiResponse(200, interviews, "Assigned interviews fetched successfully")
    );
});

// Update interview status by interviewer; when marked completed, increment Interviewer.totalInterviews
const updateInterviewStatus = asyncHandler(async (req, res) => {
    const interviewerId = req.user?._id;
    const interviewId = req.params.id;
    const { status } = req.body; // expected one of: pending, scheduled, completed, cancelled

    if (!interviewerId) throw new ApiError(401, "Unauthorized access");
    if (!interviewId) throw new ApiError(400, "Interview id is required");
    if (!status || !["pending", "scheduled", "completed", "cancelled"].includes(status)) {
        throw new ApiError(400, "Invalid status value");
    }

    const interview = await Interview.findById(interviewId);
    if (!interview) throw new ApiError(404, "Interview not found");
    if (String(interview.interviewer) !== String(interviewerId)) {
        throw new ApiError(403, "You are not allowed to update this interview");
    }

    const wasCompleted = interview.status === "completed";
    const willBeCompleted = status === "completed";

    interview.status = status;
    await interview.save();

    // Increment total interviews only on the transition to completed
    if (!wasCompleted && willBeCompleted) {
        await Interviewer.findOneAndUpdate(
            { user: interviewerId },
            { $inc: { totalInterviews: 1 } },
            { upsert: false }
        );
    }

    return res
        .status(200)
        .json(new ApiResponse(200, interview, "Interview status updated"));
});

// Submit feedback and rating by interviewer for the interviewee (freelancer)
// Also allows optionally updating status within same call to align with frontend flow
const submitInterviewFeedback = asyncHandler(async (req, res) => {
    const interviewerId = req.user?._id;
    const interviewId = req.params.id;
    const { feedback, rating, ratingDetails, status } = req.body;

    if (!interviewerId) throw new ApiError(401, "Unauthorized access");
    if (!interviewId) throw new ApiError(400, "Interview id is required");

    const interview = await Interview.findById(interviewId);
    if (!interview) throw new ApiError(404, "Interview not found");
    if (String(interview.interviewer) !== String(interviewerId)) {
        throw new ApiError(403, "You are not allowed to update this interview");
    }

    if (typeof feedback === "string") {
        interview.feedback = feedback.trim();
    }

    if (rating !== undefined) {
        const parsed = Number(rating);
        if (Number.isNaN(parsed) || parsed < 1 || parsed > 5) {
            throw new ApiError(400, "Rating must be a number between 1 and 5");
        }
        interview.rating = parsed;
    }

    if (ratingDetails) {
        const validFields = ['technical', 'communication', 'professionalism', 'speed', 'pastWork'];
        for (const field of validFields) {
            if (ratingDetails[field] !== undefined) {
                const value = Number(ratingDetails[field]);
                if (!Number.isNaN(value) && value >= 0 && value <= 5) {
                    interview.ratingDetails[field] = value;
                }
            }
        }
    }

    let incrementOnComplete = false;
    if (status) {
        if (!["pending", "scheduled", "completed", "cancelled"].includes(status)) {
            throw new ApiError(400, "Invalid status value");
        }
        const wasCompleted = interview.status === "completed";
        const willBeCompleted = status === "completed";
        interview.status = status;
        incrementOnComplete = !wasCompleted && willBeCompleted;
    }

    await interview.save();

    // Update freelancer profile with ratings
    if (ratingDetails && interview.freelancer) {
        const freelancerProfile = await FreelancerProfile.findOne({ user: interview.freelancer });
        if (freelancerProfile) {
            // Update detailed ratings
            const validFields = ['technical', 'communication', 'professionalism', 'speed', 'pastWork'];
            for (const field of validFields) {
                if (ratingDetails[field] !== undefined) {
                    freelancerProfile.ratingDetails[field] = ratingDetails[field];
                }
            }
            // Update overall rating
            if (rating !== undefined) {
                freelancerProfile.rating = rating;
                freelancerProfile.ratingCount = (freelancerProfile.ratingCount || 0) + 1;
            }
            await freelancerProfile.save();
        }
    }

    if (incrementOnComplete) {
        await Interviewer.findOneAndUpdate(
            { user: interviewerId },
            { $inc: { totalInterviews: 1 } },
            { upsert: false }
        );
    }

    return res
        .status(200)
        .json(new ApiResponse(200, interview, "Feedback submitted successfully"));
});

// (exports consolidated above)
