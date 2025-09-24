import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Project } from "../models/project.model.js";
import { formatProject } from "../utils/projectFormatter.js";

const newProject = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    if (req.user.role.toLowerCase() !== "client") {
        throw new ApiError(403, "User must be a client!");
    }

    const { title, description } = req.body;

    if (title.trim() === "" || description.trim() === "") {
        throw new ApiError(400, "Title and/or Description are required!");
    }

    const project = await Project.create({
        title,
        description,
        createdBy: userId,
    });

    // Populate user fields
    const populatedProject = await Project.findById(project._id)
        .populate(
            "createdBy",
            "username email fullName role createdAt updatedAt"
        )
        .populate(
            "assignedTo",
            "username email fullName role createdAt updatedAt"
        )
        .populate(
            "remarks.by",
            "username email fullName role createdAt updatedAt"
        );

    const formattedProject = formatProject(populatedProject);

    return res
        .status(200)
        .json(new ApiResponse(200, formattedProject, "Project created!"));
});

const getProject = asyncHandler(async (req, res) => {
    const projectId = req.params.id;
    const project = await Project.findById(projectId)
        .populate(
            "createdBy",
            "username email fullName role createdAt updatedAt"
        )
        .populate(
            "assignedTo",
            "username email fullName role createdAt updatedAt"
        )
        .populate(
            "remarks.by",
            "username email fullName role createdAt updatedAt"
        );

    if (!project) {
        throw new ApiError(404, "Project not found!");
    }

    const formattedProject = formatProject(project);

    res.status(200).json(new ApiResponse(200, formattedProject));
});

const fetchAllUserProjects = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const projects = await Project.find({ createdBy: userId })
        .populate(
            "createdBy",
            "username email fullName role createdAt updatedAt"
        ) // populate all needed fields
        .populate(
            "assignedTo",
            "username email fullName role createdAt updatedAt"
        )
        .populate(
            "remarks.by",
            "username email fullName role createdAt updatedAt"
        );

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
        .populate(
            "createdBy",
            "username email fullName role createdAt updatedAt"
        )
        .populate(
            "assignedTo",
            "username email fullName role createdAt updatedAt"
        )
        .populate(
            "remarks.by",
            "username email fullName role createdAt updatedAt"
        );

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

    if (
        userRole === "client" &&
        project.createdBy.toString() !== req.user._id.toString()
    ) {
        throw new ApiError(
            403,
            "You are not authorized to update this project"
        );
    }

    if (userRole !== "client" && userRole !== "admin") {
        throw new ApiError(403, "Only clients or admins can update projects");
    }

    const { title, description, deadline, status } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (deadline !== undefined) updateData.deadline = deadline;
    if (status !== undefined) updateData.status = status;

    await Project.findByIdAndUpdate(
        projectId,
        { $set: updateData },
        { new: true, runValidators: true }
    );

    const updatedProject = await Project.findById(projectId)
        .populate(
            "createdBy",
            "username email fullName role createdAt updatedAt"
        )
        .populate(
            "assignedTo",
            "username email fullName role createdAt updatedAt"
        )
        .populate(
            "remarks.by",
            "username email fullName role createdAt updatedAt"
        );

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
        .populate(
            "createdBy",
            "username email fullName role createdAt updatedAt"
        )
        .populate(
            "assignedTo",
            "username email fullName role createdAt updatedAt"
        )
        .populate(
            "remarks.by",
            "username email fullName role createdAt updatedAt"
        );

    if (!project) throw new ApiError(404, "Project not found");

    if (project.createdBy._id.toString() !== userId.toString()) {
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
    if (req.user.role.toLowerCase() !== 'freelancer') {
        throw new ApiError(403, "Only freelancers can apply to projects");
    }
    const { projectId } = req.params;
    const { deadline, expectedPayment } = req.body;
    if (!deadline || !expectedPayment) {
        throw new ApiError(400, "Deadline and expected payment are required");
    }

    const project = await Project.findById(projectId);
    if (!project) {
        throw new ApiError(404, "Project not found");
    }

    console.log(project)

    // Assuming project.applications is an array in the project model
    project.applications = project.applications || [];

    // Check if user already applied
    const alreadyApplied = project.applications.some(app => app.applicant.toString() === req.user._id.toString());
    console.log(alreadyApplied)
    if (alreadyApplied) {
        throw new ApiError(400, "You have already applied to this project");
    }


    project.applications.push({
        applicant: req.user._id,
        username: req.user.username,
        deadline,
        expectedPayment,
        appliedAt: new Date(),
    });

    await project.save();

    res.status(200).json(new ApiResponse(200, null, "Application submitted successfully"));
});

const getProjectApplications = asyncHandler(async (req, res) => {
    const { projectId } = req.params;

    // Find project and populate the applicant field in applications with only _id and fullName
    const project = await Project.findById(projectId).populate({
        path: 'applications.applicant',
        select: '_id fullName',
    });

    if (!project) {
        throw new ApiError(404, "Project not found");
    }

    // Format applications as requested
    const applications = (project.applications || []).map(app => ({
        applicant: app.applicant ? { _id: app.applicant._id, fullName: app.applicant.fullName } : null,
        deadline: app.deadline,
        expectedPayment: app.expectedPayment,
        appliedAt: app.appliedAt,
    }));

    res.status(200).json(new ApiResponse(200, applications, "Project applications fetched successfully"));
});

const deleteProjectApplication = asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin') {
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
        app => app.applicant.toString() !== userId
    );

    if (project.applications.length === initialLength) {
        throw new ApiError(404, "Application by this user not found");
    }

    await project.save();

    res.status(200).json(new ApiResponse(200, null, "Application deleted successfully"));
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
    deleteProjectApplication
};
