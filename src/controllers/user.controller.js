import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {User} from "../models/user.model.js"
import { Project } from "../models/project.model.js"
import jwt from "jsonwebtoken"

const generateAccessAndRefreshToken = async(userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = await user.generateAccessToken();
        const refreshToken = await user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiError(
            500,
            "Something went wrong while generating access and refresh tokens!"
        );
    }
}

const refreshAccessToken = asyncHandler(async(req,res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized Request")
    }

    const decodedToken = jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_TOKEN_SECRET
    )

    const user = await User.findById(decodedToken?._id)
    if (!user) {
        throw new ApiError(401, "Invalid Refresh Token")
    }

    if (incomingRefreshToken !== user?.refreshToken) {
        throw new ApiError(401, "Refresh token is expired or used")
    }

    const {accessToken, refreshToken} = generateAccessAndRefreshToken(user._id)
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {accessToken, refreshToken},
            "Access Token refreshed successfully!"
        )
    )

})

const registerUser = asyncHandler(async (req, res) => {
    const {username, fullName, email, password, role} = req.body

    // Check if fields are empty
    if (
        [username, fullName, email, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    // Check existing user
    const existingUser = await User.findOne({
        $or: [{email}, {username}]
    })
    if (existingUser) {throw new ApiError(409, "There already exists a user with this username or email")}

    // Creating entry in User table
    const user = await User.create({
        username: username.toLowerCase(),
        fullName,
        email,
        password,
        role
    })

    const createdUser = await User.findById(user._id).select("-password -refreshToken");
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User Created Successfully")
    )

})

const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!(email || password)) {
        throw new ApiError(400, "All fields are required!");
    }

    const user = await User.findOne({ email });
    if (!user) {
        throw new ApiError(404, "User does not exists!");
    }

    const isPasswordValid = user.isPasswordCorrect(password);
    if (!isPasswordValid) {
        throw new ApiError(401, "Invaid User Credentials!");
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)
    const loggedInUser = await User.findById(user._id).select("-password  -refreshToken");

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged in Successfully!"
        )
    )
})

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options  = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken")
    .clearCookie("refreshToken")
    .json(new ApiResponse(200, {}, "User Logged Out Successfully!"))
})

const meUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select("-password -refreshToken")
    if (!user) {throw new ApiError(404, "User not found!")}

    return res
    .status(200)
    .json(
        new ApiResponse(200, user)
    )
})

const getAllUsers = asyncHandler(async (req, res) => {
    // if (req.user.role != 'admin') {
    //     throw new ApiError(403, 'Only admins can fetch all the user details!')
    // }
    const users = await User.find({}, 'fullName username');

    res.status(200).json({
        success: true,
        users,
        message: 'All users fetched successfully',
    });
})

// Get all interviewers (name and username only)
const getInterviewers = asyncHandler(async (req, res) => {
    const interviewers = await User.find({ role: 'interviewer' }, 'fullName username');
    return res
        .status(200)
        .json(new ApiResponse(200, interviewers, 'Interviewers fetched successfully'));
});

const approveProjectForUser = asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin') {
        throw new ApiError(403, "Only admins can accept projects for users");
    }

    const userId = req.params.userId;
    const { projectId } = req.body;

    const user = await User.findById(userId);
    const project = await Project.findById(projectId)
    if (!user) throw new ApiError(404, "User not found");
    if (!project) throw new ApiError(404, "Project not found");

    if(user.approvedProjects.includes(projectId)) {
        throw new ApiError(404, "User is already approved!")
    }

    if (!user.approvedProjects.includes(projectId)) {
        user.approvedProjects.push(projectId);
        user.rejectedProjects = user.rejectedProjects.filter(
            pid => pid.toString() !== projectId
        );
        await user.save();
    }

    res.status(200).json(new ApiResponse(200, user.approvedProjects, "Project accepted"));
});

const rejectProjectForUser = asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin') {
        throw new ApiError(403, "Only admins can reject projects for users");
    }

    const userId = req.params.userId;
    const { projectId } = req.body;

    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, "User not found");

    if (!user.rejectedProjects.includes(projectId)) {
        user.rejectedProjects.push(projectId);
        user.approvedProjects = user.approvedProjects.filter(
            pid => pid.toString() !== projectId
        );
        await user.save();
    }

    res.status(200).json(new ApiResponse(200, user.rejectedProjects, "Project rejected"));
});

// Get accepted projects for a user (populated)
const getApprovedProjects = asyncHandler(async (req, res) => {
    const userId = req.params.userId;

    const user = await User.findById(userId).populate('approvedProjects');
    if (!user) throw new ApiError(404, "User not found");

    res.status(200).json(new ApiResponse(200, user.approvedProjects, "Accepted projects fetched"));
});

// Get rejected projects for a user (populated)
const getRejectedProjects = asyncHandler(async (req, res) => {
    const userId = req.params.userId;

    const user = await User.findById(userId).populate('rejectedProjects');
    if (!user) throw new ApiError(404, "User not found");

    res.status(200).json(new ApiResponse(200, user.rejectedProjects, "Rejected projects fetched"));
});

export { registerUser, loginUser, logoutUser, meUser, getAllUsers, refreshAccessToken, approveProjectForUser,
    rejectProjectForUser,
    getApprovedProjects,
    getRejectedProjects,
    getInterviewers}