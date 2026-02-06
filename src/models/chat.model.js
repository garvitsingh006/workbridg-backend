import mongoose, { Schema } from "mongoose";

const messageSchema = new Schema(
    {
        sender: { _id: {type: Schema.Types.ObjectId, ref: "User"}, username: {type: String} },
        content: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        read: { type: Boolean, default: false },
        type: { type: String, enum: ["user", "system"], default: "user" },
        event: { type: String }, // System event like "admin_joined", "user_added"
    },
    { _id: false }
);

const chatSchema = new Schema(
    {
        type: {
            type: String,
            enum: ["individual", "project", "group"],
            required: true,
        },
        name: { type: String }, // Optional for group chats
        description: { type: String }, // Optional
        createdBy: { type: Schema.Types.ObjectId, ref: "User" }, // For group chats
        participants: [
            { type: Schema.Types.ObjectId, ref: "User", required: true },
        ],
        project: { type: Schema.Types.ObjectId, ref: "Project" }, // For project/project group
        messages: [messageSchema],
        adminAdded: { type: Boolean, default: false },
        isLocked: { type: Boolean, default: false },
        status: {
            type: String,
            enum: ["discussion", "committed", "closed"],
            default: "discussion"
        },
    },
    { timestamps: true }
);

// Add participant(s)
chatSchema.methods.addParticipant = async function (userId) {
    if (!this.participants.includes(userId)) {
        this.participants.push(userId);
        await this.save();
    }
    return this;
};

// Add system message
chatSchema.methods.addSystemMessage = async function (content, event) {
    this.messages.push({
        content,
        type: "system",
        event,
        timestamp: new Date(),
    });
    await this.save();
};

// Add to your existing chatSchema definition

// Instance method: Add a message to the chat
chatSchema.methods.addMessage = async function (messageData) {
    this.messages.push(messageData);
    return await this.save();
};

// Instance method: Mark all messages as read for a user (who is not the sender)
chatSchema.methods.markMessagesRead = async function (userId) {
    this.messages.forEach((msg) => {
        // Only mark as read if sender exists and is not the current user
        if (msg.sender && msg.sender.toString() !== userId.toString()) {
            msg.read = true;
        }
        // Optionally, you can decide how to handle system messages here
        // For example, you might want to mark them as read for everyone
        if (!msg.sender) {
            msg.read = true; // or leave as is, depending on your needs
        }
    });
    await this.save();
    return this;
};

// Instance method: Get unread messages for a user
chatSchema.methods.getUnreadMessages = function (userId) {
    return this.messages.filter(
        (msg) => msg.sender.toString() !== userId.toString() && !msg.read
    );
};

// Instance method: Get participants as User IDs
chatSchema.methods.getParticipants = function () {
    return this.participants;
};

// Static method: Find or create a chat between given participants, type, and optional project
chatSchema.statics.initiateChat = async function (
    participants,
    type,
    project = null
) {
    let chat = await this.findOne({
        type,
        participants: { $all: participants, $size: participants.length },
        ...(type === "project" && { project }),
    });
    if (!chat) {
        chat = await this.create({ type, participants, project });
    }
    return chat;
};

// Static method: Find all chats for a user
chatSchema.statics.findChatsByUser = function (userId) {
    return this.find({ participants: userId });
};

// Static method: Find a project chat for exact participants and project
chatSchema.statics.findProjectChat = function (
    projectId,
    freelancerId,
    clientId
) {
    return this.findOne({
        type: "project",
        project: projectId,
        participants: { $all: [freelancerId, clientId], $size: 2 },
    });
};

chatSchema.statics.addAdminToChat = async function (chatId, adminId) {
    const chat = await this.findById(chatId);
    if (!chat) throw new Error("Chat not found");
    if (!chat.participants.includes(adminId)) {
        chat.participants.push(adminId);
        chat.adminAdded = true;
        await chat.save();
    }
    return chat;
};

export const Chat = mongoose.model("Chat", chatSchema);
