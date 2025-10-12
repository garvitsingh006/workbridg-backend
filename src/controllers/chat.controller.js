import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Chat } from "../models/chat.model.js";
import { Project } from "../models/project.model.js";
import { User } from "../models/user.model.js";

const newChat = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { type, otherUserId, project } = req.body; // only otherUserId for individual chats

    if (!type || !["individual", "project"].includes(type)) {
        throw new ApiError(400, "Chat type must be 'individual' or 'project'");
    }

    let participants = [userId]; // sender always included

    if (type === "individual") {
        if (!otherUserId)
            throw new ApiError(
                400,
                "Other user ID is required for individual chats"
            );
        participants.push(otherUserId); // just add it to participants array
    } else if (type === "project") {
        if (req.user.role.toLowerCase() !== "admin") {
            throw new ApiError(403, "Only admin can initiate project chats");
        }
        if (!project)
            throw new ApiError(400, "Project ID is required for project chats");

        const proj = await Project.findById(project);
        if (!proj) throw new ApiError(404, "Project not found");

        participants.push(proj.createdBy.toString());
        if (proj.assignedTo) participants.push(proj.assignedTo.toString());
    }

    // Check if chat already exists
    const chat = await Chat.initiateChat(
        participants,
        type,
        type === "project" ? project : null
    );

    res.status(200).json(
        new ApiResponse(200, chat, "Chat initiated/fetched successfully")
    );
});

const newMessage = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const chatId = req.params.id;
    const { content } = req.body;

    // Validation
    if (!content || content.trim() === "") {
        throw new ApiError(400, "Message content is required");
    }

    // Fetch the chat
    const chat = await Chat.findById(chatId);
    if (!chat) throw new ApiError(404, "Chat not found");

    let isAdmin = req.user.role === "admin";

    // Ensure sender is a participant
    const isParticipant = chat.participants
        .map((p) => p.toString())
        .includes(userId.toString());
    if (!isParticipant) {
        throw new ApiError(403, "You are not a participant of this chat");
    }

    const username = req.user.username;

    const updatedChat = await chat.addMessage({
        sender: { _id: userId, username: username },
        content,
        timestamp: new Date(),
        read: false,
    });

    res.status(200).json(
        new ApiResponse(200, updatedChat, "Message sent successfully")
    );
});

const getAllChats = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    // Fetch all chats where user is a participant
    const chats = await Chat.find({ participants: userId })
        .populate("participants", "username _id") // only fetch username and _id
        .populate("project", "title _id") // optional, for project chats
        .sort({ updatedAt: -1 }); // recent chats first

    res.status(200).json(
        new ApiResponse(200, chats, "Fetched all chats successfully")
    );
});

const markMessagesAsRead = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const chatId = req.params.chatId;

    // Fetch chat
    const chat = await Chat.findById(chatId);
    if (!chat) throw new ApiError(404, "Chat not found");
    // Ensure user is a participant
    const isParticipant = (chat.participants || []).some((p) => {
        if (!p) return false;
        if (typeof p === "string") return p === userId.toString();
        if (p._id) return p._id.toString() === userId.toString(); // populated object
        if (p.toString) return p.toString() === userId.toString(); // ObjectId
        return false;
    });

    if (!isParticipant)
        throw new ApiError(403, "You are not a participant of this chat");

    // Mark all messages not sent by the user as read
    await chat.markMessagesRead(userId);
    res.status(200).json(
        new ApiResponse(200, chat, "All messages marked as read")
    );
});

const addAdminToChat = asyncHandler(async (req, res) => {
    // Only admin can hit this#
    const { chatId } = req.params;
    const { adminId } = req.body;
    const chat = await Chat.addAdminToChat(chatId, adminId);
    res.status(200).json(new ApiResponse(200, chat, "Admin added to chat"));
});

const approveChat = asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") throw new ApiError(403, "Only admin");
    const { chatId } = req.params;
    const chat = await Chat.findById(chatId);
    await chat.save();
    res.status(200).json(new ApiResponse(200, chat, "Chat approved"));
});

const newGroupChat = asyncHandler(async (req, res) => {
    try {
        const projectId = req.body.project;
        const project = await Project.findById(projectId);
        if (!project) throw new ApiError(404, "Project not found");
        const name = project.name || project.title || "Project Chat";
        const description = project.description || "Project Description";

        const participantIds = Array.isArray(req.body.participantIds)
            ? req.body.participantIds
            : [];
        if (req.user.role != "admin" && req.user.role != "client") {
            throw new ApiError(
                403,
                "A group chat can only be created by Admin or Client."
            );
        }
        if (participantIds.length < 2) {
            throw new ApiError(
                400,
                "A group chat needs at least 2 participants."
            );
        }

        const existingChat = await Chat.findOne({ project: projectId, type: "group" });
        if (existingChat) {
            return res.status(400).json(new ApiError(400, "A group chat for this project already exists."));
        }


        const chat = await Chat.create({
            type: "group",
            name,
            description,
            project: projectId,
            createdBy: req.user._id,
            participants: participantIds,
        });
        // System message: group created
        await chat.addSystemMessage(`Group "${name}" created`, "group_created");
        res.status(201).json(new ApiResponse(201, chat, "Group chat created"));
    } catch (error) {
        console.error("Error creating group chat:", error);
        res.status(500).json(new ApiError(500, "Backend wala try catch block"));
    }
});

const addParticipants = asyncHandler(async (req, res) => {
    const { chatId } = req.params;
    const { participantIds } = req.body;
    const chat = await Chat.findById(chatId);
    if (!chat) throw new ApiError(404, "Chat not found");

    for (const userId of participantIds) {
        await chat.addParticipant(userId);
        await chat.addSystemMessage(
            `User ${userId} added to chat`,
            "user_added"
        );
    }
    res.status(200).json(new ApiResponse(200, chat, "Participants added"));
});

const getParticipants = asyncHandler(async (req, res) => {
    const { chatId } = req.params;
    const chat = await Chat.findById(chatId).populate(
        "participants",
        "username _id"
    );
    if (!chat) throw new ApiError(404, "Chat not found");
    res.status(200).json(
        new ApiResponse(200, chat.participants, "Participants fetched")
    );
});

// (Auto-create group on project approval)
// In your project controller, on approving freelancer:
const approveFreelancerAndCreateGroupChat = asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    // Approve freelancer logic...
    // Then auto-create group chat
    const project = await Project.findById(projectId);
    const participantIds = [
        project.createdBy,
        project.assignedTo,
        req.user._id,
    ];
    const chat = await Chat.create({
        type: "group",
        project: projectId,
        name: `Project ${project.title} Group`,
        participants: participantIds,
    });
    await chat.addSystemMessage(
        "Freelancer approved. Group chat started.",
        "freelancer_approved"
    );
    res.status(201).json(
        new ApiResponse(201, chat, "Freelancer approved, group chat created")
    );
});

// controller
const removeParticipant = asyncHandler(async (req, res) => {
    const { chatId, userId } = req.params;
    const chat = await Chat.findById(chatId);
    if (!chat) throw new ApiError(404, "Chat not found");

    chat.participants = chat.participants.filter(
        (p) => p.toString() !== userId.toString()
    );
    await chat.addSystemMessage(
        `${req.user.username} left the chat`,
        "user_removed"
    );
    await chat.save();

    const populated = await Chat.findById(chatId).populate(
        "participants",
        "username _id"
    );
    res.status(200).json(
        new ApiResponse(200, populated, "Participant removed")
    );
});

// Export as needed
export {
    newChat,
    newMessage,
    getAllChats,
    markMessagesAsRead,
    addAdminToChat,
    approveChat,
    newGroupChat,
    addParticipants,
    getParticipants,
    approveFreelancerAndCreateGroupChat,
    removeParticipant,
};
