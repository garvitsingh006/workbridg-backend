import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { FreelancerProfile, ClientProfile } from "../models/profile.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { User } from "../models/user.model.js";
const setProfile = asyncHandler(async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const userId = req.user._id;
        const role = req.user.role;

        console.log("User ID:", userId, "Role:", role);

        // decide which model to use
        const ProfileModel =
            role === "freelancer" ? FreelancerProfile : ClientProfile;

        let profile = await ProfileModel.findOne({ user: userId });
        console.log("Existing profile:", profile);

        // allowed fields based on role (kept in sync with profile.model.js)
        // Only include fields intended to be set/updated by the user.
        const allowedFields =
            role === "freelancer"
                ? [
                      "location",
                      "workField",
                      "workExperience",
                      "skills",
                      "linkedIn",
                      "github",
                      "preferredRole",
                      "resume",
                      "bio",
                      "pay_per_hour",
                      "hasSeenProjectsOnboarding",
                  ]
                : [
                      "companyName",
                      "companyDescription",
                      "companySize",
                      "industry",
                      "location",
                      "projectTypes",
                      "website",
                      "linkedIn",
                      "budgetRange",
                      "preferredCommunication",
                      "hasSeenProjectsOnboarding",
                  ];

        const data = {};

        // handle resume upload (freelancers only)
        if (
            role === "freelancer" &&
            req.files &&
            req.files.resume &&
            req.files.resume.length > 0
        ) {
            const uploadResult = await uploadOnCloudinary(
                req.files.resume[0].path
            );
            data.resume = uploadResult.url;
        }

        // parse JSON strings if needed
        if (role === "freelancer") {
            if (req.body.workExperience) {
                if (typeof req.body.workExperience === "string") {
                    try {
                        req.body.workExperience = JSON.parse(
                            req.body.workExperience
                        );
                    } catch {
                        // fallback: put single string in array
                        req.body.workExperience = [req.body.workExperience];
                    }
                }
            }

            if (req.body.skills) {
                if (typeof req.body.skills === "string") {
                    try {
                        req.body.skills = JSON.parse(req.body.skills);
                    } catch {
                        req.body.skills = [req.body.skills];
                    }
                }
            }
        }

        if (role === "client" && req.body.projectTypes) {
            if (typeof req.body.projectTypes === "string") {
                try {
                    req.body.projectTypes = JSON.parse(req.body.projectTypes);
                } catch {
                    // fallback: split comma-separated string
                    req.body.projectTypes = req.body.projectTypes
                        .split(",")
                        .map((s) => s.trim());
                }
            }
        }

        // normalize numeric fields for freelancer (e.g., pay_per_hour)
        if (role === "freelancer" && req.body.pay_per_hour !== undefined) {
            const n = Number(req.body.pay_per_hour);
            if (!Number.isNaN(n)) {
                // save normalized number in request body so pick-up works
                req.body.pay_per_hour = n;
            } else {
                // if can't parse, remove to avoid saving invalid data
                delete req.body.pay_per_hour;
            }
        }

        // pick allowed fields
        allowedFields.forEach((f) => {
            if (req.body[f] !== undefined) data[f] = req.body[f];
        });
        console.log(req.body);
        console.log(data);
        // create or update
        if (!profile) {
            profile = new ProfileModel({ user: userId, ...data });
        } else {
            Object.assign(profile, data);
            console.log(profile)
        }

        try {
            await profile.save();
            console.log(profile.toObject())
        } catch (error) {
            console.error("Profile save failed:", error, error.stack);
            return res.status(501).json({
                message: "Inside catch block this is",
                error: error.message,
                stack: error.stack,
            });
        }
        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    profile.toObject ? profile.toObject() : profile
                )
            );
    } catch (error) {
        console.error("Profile update error:", error);
        return res.status(501).json({
            message: "Outside catch block this is",
            error: error.message,
        });
    }
});

const getProfile = asyncHandler(async (req, res) => {
    try {
        const username = req.params.username;

        console.log('getProfile requested username:', username);
        const user = await User.findOne({ username: username });
        if (!user) throw new ApiError(404, "User not found!");

        // find user role first
        const { role } = user;
        const ProfileModel =
            role === "freelancer" ? FreelancerProfile : ClientProfile;

        const profile = await ProfileModel.findOne({ user: user._id }).populate(
            {
                path: "user",
                select: "username role fullName isInterviewed createdAt",
            }
        );

        if (!profile || !profile.user) {
            throw new ApiError(404, "Profile not found!");
        }

        let publicProfile = profile.toObject();

        if (role === "freelancer") {
            publicProfile.workExperience = Array.isArray(profile.workExperience)
                ? profile.workExperience.map((w) => ({
                      title: w.title,
                      company: w.company,
                      years: w.years,
                  }))
                : [];
        }

        return res.status(200).json(new ApiResponse(200, publicProfile));
    } catch (error) {
        console.error('getProfile error:', error);
        const msg = error?.message || 'Failed to load profile';
        return res.status(500).json(new ApiResponse(500, null, msg));
    }
});

// (exports are declared at the end of this file)

const listFreelancerSummaries = asyncHandler(async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 12);
        const skip = (page - 1) * limit;

        const skills = req.query.skills ? String(req.query.skills).split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];
        const minRating = req.query.minRating ? Number(req.query.minRating) : 0;
        const location = req.query.location ? String(req.query.location).trim() : null;
        const workField = req.query.workField ? String(req.query.workField).trim() : null;
        const sortBy = req.query.sortBy || 'rating'; // rating | experience | completed
        const order = req.query.order === 'asc' ? 1 : -1;

        const match = {};
        if (skills.length > 0) match.skills = { $in: skills };
        if (minRating > 0) match.rating = { $gte: minRating };
        if (location) match.location = { $regex: new RegExp(location, 'i') };
        if (workField) match.workField = { $regex: new RegExp(workField, 'i') };

        // Build sort object
        let sortObj = {};
        if (sortBy === 'experience') sortObj.totalYears = order;
        else if (sortBy === 'completed') sortObj.completedProjects = order;
        else sortObj.rating = order;

        const pipeline = [];
        if (Object.keys(match).length > 0) pipeline.push({ $match: match });

        // compute totalYears
        pipeline.push({
            $addFields: {
                totalYears: { $sum: { $map: { input: { $ifNull: ["$workExperience", []] }, as: "w", in: { $ifNull: ["$$w.years", 0] } } } }
            }
        });

        // join user
        pipeline.push({
            $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                as: 'user'
            }
        });
        pipeline.push({ $unwind: '$user' });

        pipeline.push({
            $project: {
                _id: 1,
                user: { username: '$user.username', fullName: '$user.fullName', createdAt: '$user.createdAt' },
                location: 1,
                workField: 1,
                skills: 1,
                rating: 1,
                ratingCount: 1,
                completedProjects: 1,
                isInterviewed: 1,
                pay_per_hour: 1,
                bio: 1,
                totalYears: 1,
                createdAt: 1
            }
        });

        pipeline.push({ $sort: sortObj });

        // facet for pagination
        pipeline.push({
            $facet: {
                metadata: [{ $count: 'total' }],
                data: [{ $skip: skip }, { $limit: limit }]
            }
        });

        const results = await FreelancerProfile.aggregate(pipeline);
        const metadata = results[0]?.metadata[0] || { total: 0 };
        let data = results[0]?.data || [];
        // filter out any entries without a username (defensive)
        data = data.filter(d => d && d.user && d.user.username);

        return res.status(200).json(new ApiResponse(200, { page, limit, total: metadata.total, data }));
    } catch (error) {
        console.error('List freelancers error', error);
        throw new ApiError(500, 'Failed to list freelancer summaries');
    }
});

const getProfileByUserId = asyncHandler(async (req, res) => {
    try {
        const userId = req.params.userId;

        const user = await User.findById(userId);
        if (!user) throw new ApiError(404, "User not found!");

        const { role } = user;
        const ProfileModel = role === "freelancer" ? FreelancerProfile : ClientProfile;

        const profile = await ProfileModel.findOne({ user: userId }).populate({
            path: "user",
            select: "username role fullName isInterviewed createdAt",
        });

        if (!profile || !profile.user) {
            throw new ApiError(404, "Profile not found!");
        }

        let publicProfile = profile.toObject();

        if (role === "freelancer") {
            publicProfile.workExperience = Array.isArray(profile.workExperience)
                ? profile.workExperience.map((w) => ({
                      title: w.title,
                      company: w.company,
                      years: w.years,
                  }))
                : [];
        }

        return res.status(200).json(new ApiResponse(200, publicProfile));
    } catch (error) {
        console.error('getProfileByUserId error:', error);
        const msg = error?.message || 'Failed to load profile';
        return res.status(500).json(new ApiResponse(500, null, msg));
    }
});

export { getProfile, setProfile, listFreelancerSummaries, getProfileByUserId };
