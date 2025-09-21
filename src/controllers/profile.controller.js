import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Profile } from "../models/profile.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const setProfile = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    console.log(userId)
    
    let profile = await Profile.findOne({ user: userId });
    console.log(profile);

    const allowedFields = [
        "location",
        "workField",
        "preferredRole",
        "skills",
        "workExperience",
        "linkedIn",
        "github",
        "bio",
    ];

    // handle resume upload
    let resumeUrl;
    if (req.files && req.files.resume && req.files.resume.length > 0) {
        const uploadResult = await uploadOnCloudinary(req.files.resume[0].path);
        resumeUrl = uploadResult.url;
    }

    // parse workExperience and skills if sent as JSON string
    if (req.body.workExperience) req.body.workExperience = JSON.parse(req.body.workExperience);
    if (req.body.skills) req.body.skills = JSON.parse(req.body.skills);

    const data = {};
    allowedFields.forEach(f => {
        if (req.body[f] !== undefined) data[f] = req.body[f];
    });
    if (resumeUrl) data.resume = resumeUrl;

    if (!profile) {
        profile = new Profile({ user: userId, ...data });
    } else {
        Object.assign(profile, data);
    }

    await profile.save();
    return res.status(200).json(new ApiResponse(200, profile));
});

const getProfile = asyncHandler(async (req, res) => {
    const username = req.params.username;

    const profile = await Profile.findOne()
        .populate({
            path: "user",
            match: { username },
            select: "username role fullName",
        })
        .select(
            "location workField preferredRole skills workExperience linkedIn github bio resume rating ratingCount completedProjects"
        );

    if (!profile || !profile.user) {
        throw new ApiError(404, "Profile not found!");
    }

    const publicProfile = {
        ...profile.toObject(),
        workExperience: profile.workExperience.map(w => ({
            title: w.title,
            company: w.company,
            years: w.years,
        })),
    };

    return res.status(200).json(new ApiResponse(200, publicProfile));
});

export { getProfile, setProfile };
