import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Project } from "../models/project.model.js";
import { Chat } from "../models/chat.model.js";
import { User } from "../models/user.model.js";
import { formatProject } from "../utils/projectFormatter.js";
import { createNotification } from "./notification.controller.js";

const newProject = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    if (req.user.role.toLowerCase() !== "client") {
        throw new ApiError(403, "User must be a client!");
    }

    const { title, description, deadline, budget, category } = req.body;

    if (title.trim() === "" || description.trim() === "") {
        throw new ApiError(400, "Title and/or Description are required!");
    }

    if (!budget || budget <= 0) {
        throw new ApiError(400, "Budget is required and must be greater than 0!");
    }

    if (!category) {
        throw new ApiError(400, "Category is required!");
    }

    const project = await Project.create({
        title,
        description,
        deadline,
        budget,
        category,
        createdBy: userId,
    });

    // Populate user fields with error handling
    const populatedProject = await Project.findById(project._id)
        .populate({
            path: "createdBy",
            select: "username email fullName role createdAt updatedAt",
            options: { strictPopulate: false }
        })
        .populate({
            path: "assignedTo",
            select: "username email fullName role createdAt updatedAt",
            options: { strictPopulate: false }
        })
        .populate({
            path: "remarks.by",
            select: "username email fullName role createdAt updatedAt",
            options: { strictPopulate: false }
        });

    const formattedProject = formatProject(populatedProject);

    return res
        .status(200)
        .json(new ApiResponse(200, formattedProject, "Project created!"));
});

const getProject = asyncHandler(async (req, res) => {
    const projectId = req.params.id;
    const project = await Project.findById(projectId)
        .populate({
            path: "createdBy",
            select: "username email fullName role createdAt updatedAt",
            options: { strictPopulate: false }
        })
        .populate({
            path: "assignedTo",
            select: "username email fullName role createdAt updatedAt",
            options: { strictPopulate: false }
        })
        .populate({
            path: "remarks.by",
            select: "username email fullName role createdAt updatedAt",
            options: { strictPopulate: false }
        });

    if (!project) {
        throw new ApiError(404, "Project not found!");
    }

    const formattedProject = formatProject(project);

    res.status(200).json(new ApiResponse(200, formattedProject));
});

const fetchAllUserProjects = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const projects = await Project.find({ createdBy: userId })
        .populate({
            path: "createdBy",
            select: "username email fullName role createdAt updatedAt",
            options: { strictPopulate: false }
        })
        .populate({
            path: "assignedTo",
            select: "username email fullName role createdAt updatedAt",
            options: { strictPopulate: false }
        })
        .populate({
            path: "remarks.by",
            select: "username email fullName role createdAt updatedAt",
            options: { strictPopulate: false }
        });

    // Map _id to id and build nested objects
    const formattedProjects = projects.map(formatProject);

    res.status(200).json(
        new ApiResponse(200, formattedProjects, "Projects fetched successfully")
    );
});

const fetchAllProjects = asyncHandler(async (req, res) => {
    if (req.user.role !== "admin" && req.user.role !== "freelancer") {
        throw new ApiError(
            403,
            "Only Admins and Freelancers are allowed to fetch all projects!"
        );
    }

    // Fetch and populate just like your single/fetch endpoints
    const projects = await Project.find({})
        .populate({
            path: "createdBy",
            select: "username email fullName role createdAt updatedAt",
            options: { strictPopulate: false }
        })
        .populate({
            path: "assignedTo",
            select: "username email fullName role createdAt updatedAt",
            options: { strictPopulate: false }
        })
        .populate({
            path: "remarks.by",
            select: "username email fullName role createdAt updatedAt",
            options: { strictPopulate: false }
        });

    // Format every project for the response
    const formattedProjects = projects.map(formatProject);

    res.status(200).json(
        new ApiResponse(
            200,
            formattedProjects,
            "All projects fetched successfully"
        )
    );
});

const updateProject = asyncHandler(async (req, res) => {
    const projectId = req.params.id;
    const userRole = req.user.role.toLowerCase();

    const project = await Project.findById(projectId);

    if (!project) {
        throw new ApiError(404, "Project not found");
    }

    if (userRole !== "client" && userRole != "admin") {
        throw new ApiError(403, "Only clients and admins can update projects");
    }

    if (
        userRole === "client" &&
        project.createdBy.toString() !== req.user._id.toString()
    ) {
        throw new ApiError(
            403,
            "You are not authorized to update this project"
        );
    }

    const { title, description, deadline, status, budget, category } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (deadline !== undefined) updateData.deadline = deadline;
    if (status !== undefined) updateData.status = status;
    if (budget !== undefined) updateData.budget = budget;
    if (category !== undefined) updateData.category = category;

    await Project.findByIdAndUpdate(
        projectId,
        { $set: updateData },
        { new: true, runValidators: true }
    );

    const updatedProject = await Project.findById(projectId)
        .populate({
            path: "createdBy",
            select: "username email fullName role createdAt updatedAt",
            options: { strictPopulate: false }
        })
        .populate({
            path: "assignedTo",
            select: "username email fullName role createdAt updatedAt",
            options: { strictPopulate: false }
        })
        .populate({
            path: "remarks.by",
            select: "username email fullName role createdAt updatedAt",
            options: { strictPopulate: false }
        });

    res.status(200).json(
        new ApiResponse(
            200,
            formatProject(updatedProject),
            "Project updated successfully"
        )
    );
});

const deleteProject = asyncHandler(async (req, res) => {
    const projectId = req.params.id;
    const userId = req.user._id;

    const project = await Project.findById(projectId)
        .populate({
            path: "createdBy",
            select: "username email fullName role createdAt updatedAt",
            options: { strictPopulate: false }
        })
        .populate({
            path: "assignedTo",
            select: "username email fullName role createdAt updatedAt",
            options: { strictPopulate: false }
        })
        .populate({
            path: "remarks.by",
            select: "username email fullName role createdAt updatedAt",
            options: { strictPopulate: false }
        });

    if (!project) throw new ApiError(404, "Project not found");

    if (!project.createdBy || project.createdBy._id.toString() !== userId.toString()) {
        throw new ApiError(403, "Unauthorized request!");
    }

    await Project.findByIdAndDelete(projectId);

    res.status(200).json(
        new ApiResponse(
            200,
            formatProject(project),
            "Project deleted successfully!"
        )
    );
});

const applyToProject = asyncHandler(async (req, res) => {
    if (req.user.role.toLowerCase() !== "freelancer") {
        throw new ApiError(403, "Only freelancers can apply to projects");
    }
    const { projectId } = req.params;
    const { proposalSummary, estimatedDelivery, addOns } = req.body;
    if (!proposalSummary || !estimatedDelivery) {
        throw new ApiError(400, "Proposal summary and estimated delivery are required");
    }

    const project = await Project.findById(projectId);
    if (!project) {
        throw new ApiError(404, "Project not found");
    }

    console.log(project);

    // Assuming project.applications is an array in the project model
    project.applications = project.applications || [];

    // Check if user already applied
    const alreadyApplied = project.applications.some(
        (app) => app.applicant.toString() === req.user._id.toString()
    );
    console.log(alreadyApplied);
    if (alreadyApplied) {
        throw new ApiError(400, "You have already applied to this project");
    }

    project.applications.push({
        applicant: req.user._id,
        username: req.user.username,
        proposalSummary,
        estimatedDelivery,
        addOns: addOns || '',
        appliedAt: new Date(),
    });

    await project.save();

    // Notify the client about the new application
    await createNotification(
        project.createdBy,
        "application",
        "New Application Received",
        `${req.user.fullName || req.user.username} has applied to your project "${project.title}"`,
        { projectId: project._id }
    );

    res.status(200).json(
        new ApiResponse(200, null, "Application submitted successfully")
    );
});
const getProjectApplications = asyncHandler(async (req, res) => {
    const { projectId } = req.params; // Find project and populate the applicant field in applications with only _id and fullName

    const project = await Project.findById(projectId).populate({
        path: "applications.applicant",
        select: "_id fullName",
    });

    if (!project) {
        throw new ApiError(404, "Project not found");
    } // Format applications as requested

    const applications = (project.applications || []).map((app) => ({
        applicant: app.applicant
            ? { _id: app.applicant._id, fullName: app.applicant.fullName }
            : null,
        proposalSummary: app.proposalSummary,
        estimatedDelivery: app.estimatedDelivery,
        addOns: app.addOns,
        appliedAt: app.appliedAt,
    }));

    res.status(200).json(
        new ApiResponse(
            200,
            applications,
            "Project applications fetched successfully"
        )
    );
});
const getChosenApplications = asyncHandler(async (req, res) => {
    const { projectId } = req.params;

    const project = await Project.findById(projectId).populate({
        path: "applications.applicant",
        select: "_id fullName",
    });

    if (!project) {
        throw new ApiError(404, "Project not found");
    }

    // Filter chosen ones
    const chosenApplications = project.applications
        .filter((app) => app.isChosenByClient)
        .map((app) => ({
            applicant: app.applicant
                ? { _id: app.applicant._id, fullName: app.applicant.fullName }
                : null,
            proposalSummary: app.proposalSummary,
            estimatedDelivery: app.estimatedDelivery,
            addOns: app.addOns,
            appliedAt: app.appliedAt,
        }));

    console.log("chosen applicatons: ", chosenApplications);

    res.status(200).json(
        new ApiResponse(
            200,
            chosenApplications,
            "Chosen applications fetched successfully"
        )
    );
});

const deleteProjectApplication = asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") {
        throw new ApiError(403, "Only admins can delete project applications");
    }

    const { projectId, userId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
        throw new ApiError(404, "Project not found");
    }

    const initialLength = project.applications.length;

    // Remove application(s) by userId
    project.applications = project.applications.filter(
        (app) => app.applicant.toString() !== userId
    );

    if (project.applications.length === initialLength) {
        throw new ApiError(404, "Application by this user not found");
    }

    await project.save();

    res.status(200).json(
        new ApiResponse(200, null, "Application deleted successfully")
    );
});

const requestAdminManagement = asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const userId = req.user._id;

    if (req.user.role.toLowerCase() !== "client") {
        throw new ApiError(403, "Only clients can request admin management");
    }

    const project = await Project.findById(projectId);
    if (!project) {
        throw new ApiError(404, "Project not found");
    }

    if (project.createdBy.toString() !== userId.toString()) {
        throw new ApiError(403, "You can only request admin management for your own projects");
    }

    if (project.status !== "in-progress") {
        throw new ApiError(400, "Admin management can only be requested for in-progress projects");
    }

    if (project.hasRequestedAdminManagement) {
        throw new ApiError(400, "Admin management has already been requested for this project");
    }

    // Check if project is within 48 hours of creation
    const projectAge = Date.now() - new Date(project.createdAt).getTime();
    const fortyEightHours = 48 * 60 * 60 * 1000;
    if (projectAge > fortyEightHours) {
        throw new ApiError(400, "Admin management can only be requested within 48 hours of project start");
    }

    // Update project
    project.hasRequestedAdminManagement = true;
    project.adminManagementRequestedAt = new Date();
    await project.save();

    // Find project chat
    const chat = await Chat.findOne({
        project: projectId,
        type: "group"
    });

    if (chat) {
        // Lock the chat
        chat.isLocked = true;
        
        // Find admin user
        const admin = await User.findOne({ role: "admin" });
        if (admin && !chat.participants.includes(admin._id)) {
            chat.participants.push(admin._id);
            chat.adminAdded = true;
        }
        
        // Add system message
        await chat.addSystemMessage(
            "This project is now under admin management. The chat has been locked and only admin can post messages.",
            "admin_management_enabled"
        );
        
        await chat.save();
    }

    const updatedProject = await Project.findById(projectId)
        .populate({
            path: "createdBy",
            select: "username email fullName role createdAt updatedAt",
            options: { strictPopulate: false }
        })
        .populate({
            path: "assignedTo",
            select: "username email fullName role createdAt updatedAt",
            options: { strictPopulate: false }
        });

    res.status(200).json(
        new ApiResponse(200, formatProject(updatedProject), "Admin management requested successfully")
    );
});

export {
    newProject,
    getProject,
    updateProject,
    deleteProject,
    fetchAllUserProjects,
    fetchAllProjects,
    applyToProject,
    getProjectApplications,
    getChosenApplications,
    deleteProjectApplication,
    requestAdminManagement,
};
