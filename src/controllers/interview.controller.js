import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Interview } from "../models/interview.model.js";
import { User } from "../models/user.model.js";
import { Interviewer } from "../models/interviewer.model.js";

const getPendingInterviewsForFreelancer = asyncHandler(async (req, res) => {
    const freelancerId = req.user?._id; // set by verifyJWT

    if (!freelancerId) {
        throw new ApiError(401, "Unauthorized access");
    }

    const pendingInterviews = await Interview.find({
        freelancer: freelancerId,
        status: "scheduled",
    })
        .populate("interviewer", "fullName email") // only show essential fields
        .select(
            "mode platform link dateTime duration timezone status createdAt"
        )
        .sort({ dateTime: 1 }); // upcoming first

    if (!pendingInterviews.length) {
        return res
            .status(200)
            .json(new ApiResponse(200, [], "No pending interviews found"));
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                pendingInterviews,
                "Pending interviews fetched successfully"
            )
        );
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

export {
    getPendingInterviewsForFreelancer,
    getFreelancersWithoutInterview,
    assignInterviewToFreelancer,
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
    const { feedback, rating, status } = req.body;

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

export {
    getAssignedInterviewsForInterviewer,
    updateInterviewStatus,
    submitInterviewFeedback,
};
