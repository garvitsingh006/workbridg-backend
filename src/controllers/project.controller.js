import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Project } from "../models/project.model.js";

const newProject = asyncHandler(async (req, res) => {
    // check if it is client which is creating the project
    const userId = req.user._id;
    if (req.user.role.toLowerCase() !== "client") {
        throw new ApiError(403, "User must be a client!");
    }

    // Destructure req data
    const { title, description } = req.body;

    // check for empty fields
    if (title.trim() == "" || description.trim() == "") {
        throw new ApiError(400, "Title and/or Description are required!");
    }

    const project = await Project.create({
        title,
        description,
        createdBy: userId,
    });

    return res
        .status(200)
        .json(new ApiResponse(200, project, "Project created!"));
});

const getProject = asyncHandler(async (req, res) => {
    const projectId = req.params.id;
    const project = await Project.findById(projectId);
    if (!project) {throw new  ApiError(404, "Project not found!")}
    return res.status(200).json(new ApiResponse(200, project));
});

const updateProject = asyncHandler(async (req, res) => {
    const projectId = req.params.id;
    const userRole = req.user.role;
    console.log(projectId,  userRole.toLowerCase())

    // Validate project existence
    const project = await Project.findById(projectId);
    if (!project) {
        throw new ApiError(404, "Project not found");
    }

    // Role-based access
    if (
        userRole.toLowerCase() === "client" &&
        project.createdBy.toString() !== req.user._id.toString()
    ) {
        throw new ApiError(
            403,
            "You are not authorized to update this project"
        );
    }

    if (userRole.toLowerCase() !== "client" && userRole !== "admin") {
        throw new ApiError(403, "Only clients or admins can update projects");
    }

    // Define allowed fields for update
    const { title, description, deadline, status } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (deadline !== undefined) updateData.deadline = deadline;
    if (status !== undefined) updateData.status = status;

    const updatedProject = await Project.findByIdAndUpdate(
        projectId,
        { $set: updateData },
        { new: true, runValidators: true }
    );

    res.status(200).json(new ApiResponse(200, updatedProject, "Project updated successfully"));
});

const deleteProject = asyncHandler(async (req, res) => {
    const projectId = req.params.id;
    const userId = req.user._id

    const project = await Project.findById(projectId)
    if (!project) throw new ApiError(404, "Project not found");
    if (project.createdBy.toString() !== userId.toString()) {
        throw new ApiError(403, "Unauthorized request!")
    }

    await Project.findByIdAndDelete(projectId);

    return res
    .status(200)
    .json(new ApiResponse(200, project, "Project deleted successfully!"))
})

export { newProject, getProject, updateProject, deleteProject };