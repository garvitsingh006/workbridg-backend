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

        // allowed fields based on role
        const allowedFields =
            role === "freelancer"
                ? [
                      "location",
                      "workField",
                      "preferredRole",
                      "skills",
                      "workExperience",
                      "linkedIn",
                      "github",
                      "bio",
                      "resume",
                  ]
                : [
                      "companyName",
                      "companyDescription",
                      "companySize",
                      "industry",
                      "location",
                      "budgetRange",
                      "preferredCommunication",
                      "projectTypes",
                      "website",
                      "linkedIn",
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

        // pick allowed fields
        allowedFields.forEach((f) => {
            if (req.body[f] !== undefined) data[f] = req.body[f];
        });

        // create or update
        if (!profile) {
            profile = new ProfileModel({ user: userId, ...data });
        } else {
            Object.assign(profile, data);
        }

        try {
            await profile.save();
        } catch (error) {
            console.error("Profile save failed:", error);
            return res
                .status(501)
                .json({
                    message: "Inside catch block this is",
                    error: error.message,
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
        return res
            .status(501)
            .json({
                message: "Outside catch block this is",
                error: error.message,
            });
    }
});

const getProfile = asyncHandler(async (req, res) => {
    const username = req.params.username;

    const user = await User.findOne({ username: username });
    if (!user) throw new ApiError(404, "User not found!");

    // find user role first
    const { role } = user;
    const ProfileModel =
        role === "freelancer" ? FreelancerProfile : ClientProfile;

    const profile = await ProfileModel.findOne({ user: user._id }).populate({
        path: "user",
        select: "username role fullName",
    });

    if (!profile || !profile.user) {
        throw new ApiError(404, "Profile not found!");
    }

    let publicProfile = profile.toObject();

    if (role === "freelancer") {
        publicProfile.workExperience = profile.workExperience.map((w) => ({
            title: w.title,
            company: w.company,
            years: w.years,
        }));
    }

    return res.status(200).json(new ApiResponse(200, publicProfile));
});

export { getProfile, setProfile };
