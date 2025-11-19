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
        sameSite: "none",
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

    const verificationLink = `${process.env.BACKEND_URL}/api/v1/users/verify?token=${verificationToken}`;
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
        sameSite: "none",
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

// For email verification
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
    res.redirect(`${process.env.FRONTEND_URL}/login?verified=true`);
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

    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) {
        throw new ApiError(401, "Invaid User Credentials!");
    }

    if (!user.refreshToken) {
        console.log("No refresh token found for user");
        throw new ApiError(401, "No refresh token found, please login again");
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
        sameSite: "none",
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
        sameSite: "none",
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
        "_id fullName username role"
    );
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { users: interviewers },
                "Interviewers fetched successfully"
            )
        );
});

const getFreelancers = asyncHandler(async (req, res) => {
    const freelancers = await User.find(
        { role: "freelancer" },
        "_id fullName username role"
    );
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { users: freelancers },
                "Freelancers fetched successfully"
            )
        );
});

const getClients = asyncHandler(async (req, res) => {
    const clients = await User.find(
        { role: "client" },
        "_id fullName username role"
    );
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { users: clients },
                "Clients fetched successfully"
            )
        );
});


const userApplicationChosenByClient = asyncHandler(async (req, res) => { // Client will do this
    const { projectId, userId } = req.params;

    // Find the project
    const project = await Project.findById(projectId);
    if (!project) {
        throw new ApiError(404, "Project not found");
    }

    // Find the application for the given user
    const application = project.applications.find(
        (app) => app.applicant.toString() === userId
    );
    if (!application) {
        throw new ApiError(404, "Application not found for the given user");
    }

    // Update the flag
    application.isChosenByClient = true;

    // Remove all other applications except the chosen one
    // project.applications = project.applications.filter(
    //     (app) => app.applicant.toString() === userId
    // );

    // Also update project status
    project.status = "pending";

    await project.save();

    res.status(200).json(
        new ApiResponse(200, project, "Application selected, others removed, and project set to pending")
    );
});

const approveProjectForUser = asyncHandler(async (req, res) => { // admin will then do this
    if (req.user.role !== "admin") {
        throw new ApiError(403, "Only admins can approve project applications");
    }

    const userId = req.params.userId;
    const { projectId } = req.body;
    console.log("Approving project for user:", userId, projectId);

    const user = await User.findById(userId);
    const project = await Project.findById(projectId);

    console.log("Fetched user and project");
    if (!user) throw new ApiError(404, "User not found");
    console.log("User found");
    if (!project) throw new ApiError(404, "Project not found");
    console.log("Project found");
    if (user.approvedProjects.includes(projectId)) {
        throw new ApiError(404, "User is already approved!");
    }

    console.log("user is not approved yet")

    project.assignedTo = userId;
    project.status = "in-progress";
    await project.save();
    console.log("Status of the project is after changing it to in-progress", project.status)

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
const projectInProgress = asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const project = await Project.findById(projectId);
    if (!project) {
        throw new ApiError(404, "Project not found");
    }

    // Find the chosen freelancer from applications
    // const chosenApplication = project.applications.find(app => app.isChosenByClient);
    // if (!chosenApplication) {
    //     throw new ApiError(400, "No freelancer has been chosen for this project");
    // }

    // project.assignedTo = chosenApplication.applicant; // assign freelancer's ObjectId
    project.status = "in-progress";
    await project.save();

    res.status(200).json(
        new ApiResponse(200, project, "Project status updated to in-progress and freelancer assigned")
    );
});
const rejectProjectForUser = asyncHandler(async (req, res) => { // admin will do this
    if (req.user.role !== "admin") {
        throw new ApiError(403, "Only admins can reject project applications");
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

const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        throw new ApiError(400, "Email is required");
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
        const resetToken = crypto.randomBytes(32).toString("hex");
        const tokenExpiry = Date.now() + 1000 * 60 * 30;

        user.passwordResetToken = resetToken;
        user.passwordResetTokenExpiry = tokenExpiry;
        await user.save({ validateBeforeSave: false });

        const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 465,
            secure: true,
            requireTLS: true,
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD,
            },
        });

        const resetLink = `http://localhost:5173/reset-password/${resetToken}`;

        try {
            await transporter.sendMail({
                from: '"Workbridg" <garvitsingh006@gmail.com>',
                to: email,
                subject: "Reset Your Password",
                html: `
                    <h2>Password Reset Request</h2>
                    <p>You requested to reset your password. Click the link below to reset it:</p>
                    <a href="${resetLink}">Reset Password</a>
                    <p>This link will expire in 30 minutes.</p>
                    <p>If you did not request this, please ignore this email.</p>
                `,
            });
        } catch (error) {
            user.passwordResetToken = null;
            user.passwordResetTokenExpiry = null;
            await user.save({ validateBeforeSave: false });
            throw new ApiError(500, "Error sending password reset email");
        }
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {},
                "If the email exists, a password reset link has been sent"
            )
        );
});

const resetPassword = asyncHandler(async (req, res) => {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!token) {
        throw new ApiError(400, "Reset token is required");
    }

    if (!newPassword || newPassword.trim().length < 6) {
        throw new ApiError(
            400,
            "New password is required and must be at least 6 characters long"
        );
    }

    const user = await User.findOne({
        passwordResetToken: token,
        passwordResetTokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
        throw new ApiError(400, "Invalid or expired password reset token");
    }

    user.password = newPassword;
    user.passwordResetToken = null;
    user.passwordResetTokenExpiry = null;
    user.refreshToken = undefined;
    await user.save();

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {},
                "Password reset successful. Please log in with your new password"
            )
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
    userApplicationChosenByClient,
    projectInProgress,
    getRejectedProjects,
    getInterviewers,
    getFreelancers,
    getClients,
    forgotPassword,
    resetPassword,
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
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
        createdUser._id
    );
    const options = { httpOnly: true, secure: true, sameSite: "none" };
    return res
        .status(201)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
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

    const options = { httpOnly: true, secure: true, sameSite: "none" };
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