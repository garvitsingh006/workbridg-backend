import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Chat } from "../models/chat.model.js";
import { Project } from "../models/project.model.js";

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

    let isAdmin = req.user.role === 'admin';

    // Only block non-admin users from messaging if chat is 'pending' AND chat type is 'project'
    if (chat.status === "pending" && !isAdmin && chat.type === "project") {
        throw new ApiError(403, "Chat not approved yet");
    }

    if (
        chat.status === "with_admin" &&
        !chat.participants.includes(req.user.id)
    ) {
        throw new ApiError(403, "You're not a participant");
    }

    // Ensure sender is a participant
    const isParticipant = chat.participants
        .map((p) => p.toString())
        .includes(userId.toString());
    if (!isParticipant) {
        throw new ApiError(403, "You are not a participant of this chat");
    }

    const updatedChat = await chat.addMessage({
        sender: userId,
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
    const isParticipant = chat.participants
        .map((p) => p.toString())
        .includes(userId.toString());
    if (!isParticipant)
        throw new ApiError(403, "You are not a participant of this chat");

    // Mark all messages not sent by the user as read
    await chat.markMessagesRead(userId);

    res.status(200).json(
        new ApiResponse(200, chat, "All messages marked as read")
    );
});

const addAdminToChat = asyncHandler(async (req, res) => {
    // Only admin can hit this
    if (req.user.role !== "admin") throw new ApiError(403, "Only admin");
    const { chatId } = req.params;
    const chat = await Chat.addAdminToChat(chatId, req.user.id);
    res.status(200).json(new ApiResponse(200, chat, "Admin added to chat"));
});

const approveChat = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") throw new ApiError(403, "Only admin");
  const { chatId } = req.params;
  const chat = await Chat.findById(chatId);
  chat.status = "approved";
  await chat.save();
  res.status(200).json(new ApiResponse(200, chat, "Chat approved"));
});

export { newChat, newMessage, getAllChats, markMessagesAsRead, addAdminToChat, approveChat };
