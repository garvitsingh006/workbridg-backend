import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { Project } from "../models/project.model.js";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import crypto from "crypto";
import nodemailer from "nodemailer";

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = await user.generateAccessToken();
        const refreshToken = await user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(
            500,
            "Something went wrong while generating access and refresh tokens!"
        );
    }
};

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken =
        req.cookies.refreshToken || req.body.refreshToken;
    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized Request");
    }

    const decodedToken = jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);
    if (!user) {
        throw new ApiError(401, "Invalid Refresh Token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
        throw new ApiError(401, "Refresh token is expired or used");
    }

    const { accessToken, refreshToken } = generateAccessAndRefreshToken(
        user._id
    );
    const options = {
        httpOnly: true,
        secure: true,
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                { accessToken, refreshToken },
                "Access Token refreshed successfully!"
            )
        );
});

const setRole = asyncHandler(async (req, res) => {
    try {
        console.log("Setting role", req.user);
        if (!req.user) {
            throw new ApiError(401, "Unauthorized");
        }

        const { role } = req.body;
        if (!role) {
            throw new ApiError(400, "Role is required");
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { role },
            { new: true, select: "-password -refreshToken" }
        );

        if (!updatedUser) {
            throw new ApiError(404, "User not found");
        }

        return res
            .status(200)
            .json(
                new ApiResponse(200, updatedUser, "Role updated successfully")
            );
    } catch (error) {
        console.log("Some error while setting role", error);
        throw error; // asyncHandler will handle it
    }
});

const registerUser = asyncHandler(async (req, res) => {
    const { username, fullName, email, password } = req.body;

    // Check if fields are empty
    if (
        [username, fullName, email, password].some(
            (field) => field?.trim() === ""
        )
    ) {
        throw new ApiError(400, "All fields are required");
    }

    // Check existing user
    const existingUser = await User.findOne({
        $or: [{ email }, { username }],
    });
    if (existingUser) {
        throw new ApiError(
            409,
            "There already exists a user with this username or email"
        );
    }

    // Creating entry in User table
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const tokenExpiry = Date.now() + 1000 * 60 * 30; // 30 minutes

    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        requireTLS: true,
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });

    const verificationLink = `http://localhost:8000/api/v1/users/verify?token=${verificationToken}`;
    try {
        await transporter.sendMail({
            from: '"Workbridg" <garvitsingh006@gmail.com>',
            to: email,
            subject: "Verify your account",
            html: `Click <a href="${verificationLink}">here</a> to verify your account.`
        });
    } catch (error) {
        res.status(500).json({message: "Error sending verification email", success: false});
        return;
    }

    const user = await User.create({
        username: username.toLowerCase(),
        fullName,
        email,
        password,
        verificationToken,
        verificationTokenExpiry: tokenExpiry,
        isVerified: false,
    });

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
        user._id
    );

    const options = {
        httpOnly: true,
        secure: true,
    };




    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );
    return res
        .status(201)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(new ApiResponse(200, createdUser, "User Created Successfully"));
});

const verifyUser = asyncHandler(async (req, res) => {
    const { token } = req.query;
    console.log(token)

    if (!token) {
        throw new ApiError(400, "Verification token is required");
    }

    // Find user with this token
    const user = await User.findOne({
        verificationToken: token,
        verificationTokenExpiry: { $gt: Date.now() } // check not expired
    });

    if (!user) {
        throw new ApiError(400, "Invalid or expired verification token");
    }

    // Mark as verified
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiry = undefined;
    await user.save();

    // Respond or redirect
    res.redirect("http://localhost:5173/login?verified=true");
});


const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!(email || password)) {
        throw new ApiError(400, "All fields are required!");
    }

    const user = await User.findOne({ email });
    if (!user) {
        throw new ApiError(404, "User does not exists!");
    }

    // check email verification
    if (!user.isVerified) {
        throw new ApiError(403, "Email is not verified. Please verify your email to proceed");
    }

    const isPasswordValid = user.isPasswordCorrect(password);
    if (!isPasswordValid) {
        throw new ApiError(401, "Invaid User Credentials!");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
        user._id
    );
    const loggedInUser = await User.findById(user._id).select(
        "-password  -refreshToken"
    );

    const options = {
        httpOnly: true,
        secure: true,
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken,
                },
                "User logged in Successfully!"
            )
        );
});

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined,
            },
        },
        {
            new: true,
        }
    );

    const options = {
        httpOnly: true,
        secure: true,
    };

    return res
        .status(200)
        .clearCookie("accessToken")
        .clearCookie("refreshToken")
        .json(new ApiResponse(200, {}, "User Logged Out Successfully!"));
});

const meUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select(
        "-password -refreshToken"
    );

    if (!user) {
        throw new ApiError(404, "User not found!");
    }

    return res.status(200).json(new ApiResponse(200, user));
});

const getAllUsers = asyncHandler(async (req, res) => {
    // if (req.user.role != 'admin') {
    //     throw new ApiError(403, 'Only admins can fetch all the user details!')
    // }
    const users = await User.find({}, "fullName username");

    res.status(200).json({
        success: true,
        users,
        message: "All users fetched successfully",
    });
});

// Get all interviewers (name and username only)
const getInterviewers = asyncHandler(async (req, res) => {
    const interviewers = await User.find(
        { role: "interviewer" },
        "fullName username"
    );
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                interviewers,
                "Interviewers fetched successfully"
            )
        );
});

const approveProjectForUser = asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") {
        throw new ApiError(403, "Only admins can accept projects for users");
    }

    const userId = req.params.userId;
    const { projectId } = req.body;

    const user = await User.findById(userId);
    const project = await Project.findById(projectId);
    if (!user) throw new ApiError(404, "User not found");
    if (!project) throw new ApiError(404, "Project not found");

    if (user.approvedProjects.includes(projectId)) {
        throw new ApiError(404, "User is already approved!");
    }

    if (!user.approvedProjects.includes(projectId)) {
        user.approvedProjects.push(projectId);
        user.rejectedProjects = user.rejectedProjects.filter(
            (pid) => pid.toString() !== projectId
        );
        await user.save();
    }

    res.status(200).json(
        new ApiResponse(200, user.approvedProjects, "Project accepted")
    );
});

const rejectProjectForUser = asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") {
        throw new ApiError(403, "Only admins can reject projects for users");
    }

    const userId = req.params.userId;
    const { projectId } = req.body;

    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, "User not found");

    if (!user.rejectedProjects.includes(projectId)) {
        user.rejectedProjects.push(projectId);
        user.approvedProjects = user.approvedProjects.filter(
            (pid) => pid.toString() !== projectId
        );
        await user.save();
    }

    res.status(200).json(
        new ApiResponse(200, user.rejectedProjects, "Project rejected")
    );
});

// Get accepted projects for a user (populated)
const getApprovedProjects = asyncHandler(async (req, res) => {
    const userId = req.params.userId;

    const user = await User.findById(userId).populate("approvedProjects");
    if (!user) throw new ApiError(404, "User not found");

    res.status(200).json(
        new ApiResponse(200, user.approvedProjects, "Accepted projects fetched")
    );
});

// Get rejected projects for a user (populated)
const getRejectedProjects = asyncHandler(async (req, res) => {
    const userId = req.params.userId;

    const user = await User.findById(userId).populate("rejectedProjects");
    if (!user) throw new ApiError(404, "User not found");

    res.status(200).json(
        new ApiResponse(200, user.rejectedProjects, "Rejected projects fetched")
    );
});

export {
    registerUser,
    loginUser,
    verifyUser,
    logoutUser,
    meUser,
    getAllUsers,
    refreshAccessToken,
    setRole,
    approveProjectForUser,
    rejectProjectForUser,
    getApprovedProjects,
    getRejectedProjects,
    getInterviewers,
};

// Google OAuth controllers
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleSignup = asyncHandler(async (req, res) => {
    const { token } = req.body;
    if (!token) {
        throw new ApiError(400, "Google token is required");
    }

    const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload?.email?.toLowerCase();
    const fullName = payload?.name;

    if (!email) {
        throw new ApiError(400, "Invalid Google token: email missing");
    }

    const existing = await User.findOne({ email });
    if (existing) {
        throw new ApiError(
            409,
            "User is already registered. Please log in instead."
        );
    }

    // Create a username from email local-part if not provided
    const suggestedUsername = (email.split("@")[0] || "user").toLowerCase();

    const newUser = await User.create({
        username: suggestedUsername,
        fullName: fullName || suggestedUsername,
        email,
        password: jwt.sign({ email }, process.env.JWT_SECRET || "fallback", {
            expiresIn: "1d",
        }),
        isVerified: true,
    });

    const createdUser = await User.findById(newUser._id).select(
        "-password -refreshToken"
    );
    return res
        .status(201)
        .json(
            new ApiResponse(
                201,
                { user: createdUser, isNewUser: true },
                "User registered successfully. Please log in to continue."
            )
        );
});

export const googleLogin = asyncHandler(async (req, res) => {
    const { token } = req.body;
    if (!token) {
        throw new ApiError(400, "Google token is required");
    }

    const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload?.email?.toLowerCase();
    if (!email) {
        throw new ApiError(400, "Invalid Google token: email missing");
    }

    const user = await User.findOne({ email });
    if (!user) {
        throw new ApiError(404, "User not found. Please sign up first.");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
        user._id
    );
    const loggedInUser = await User.findById(user._id).select(
        "-password  -refreshToken"
    );

    const options = { httpOnly: true, secure: true };
    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken,
                    isNewUser: false,
                },
                "User logged in successfully!"
            )
        );
});
