import mongoose, {Schema} from "mongoose";

const messageSchema = new Schema(
  {
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    read: { type: Boolean, default: false },
  },
  { _id: false }
);

const chatSchema = new Schema({
  // Type can be 'individual' (admin <> user) or 'project' (freelancer <> client for a project)
  type: { type: String, enum: ["individual", "project"], required: true },

  // For 'individual' chat, participants are admin + user
  // For 'project' chat, participants are freelancer + client
  participants: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],

  // (only for project chats)
  project: { type: Schema.Types.ObjectId, ref: "Project" },

  messages: [messageSchema],
},
{
  timestamps: true
});

// Add to your existing chatSchema definition

// Instance method: Add a message to the chat
chatSchema.methods.addMessage = async function(messageData) {
  this.messages.push(messageData);
  return await this.save();
};

// Instance method: Mark all messages as read for a user (who is not the sender)
chatSchema.methods.markMessagesRead = async function(userId) {
  this.messages.forEach(msg => {
    if (msg.sender.toString() !== userId.toString()) {
      msg.read = true;
    }
  });
  await this.save();
  return this;
};

// Instance method: Get unread messages for a user
chatSchema.methods.getUnreadMessages = function(userId) {
  return this.messages.filter(
    msg => msg.sender.toString() !== userId.toString() && !msg.read
  );
};

// Instance method: Get participants as User IDs
chatSchema.methods.getParticipants = function() {
  return this.participants;
};

// Static method: Find or create a chat between given participants, type, and optional project
chatSchema.statics.initiateChat = async function(participants, type, project = null) {
  let chat = await this.findOne({
    type, 
    participants: { $all: participants, $size: participants.length },
    ...(type === 'project' && { project })
  });
  if (!chat) {
    chat = await this.create({ type, participants, project });
  }
  return chat;
};

// Static method: Find all chats for a user
chatSchema.statics.findChatsByUser = function(userId) {
  return this.find({ participants: userId });
};

// Static method: Find a project chat for exact participants and project
chatSchema.statics.findProjectChat = function(projectId, freelancerId, clientId) {
  return this.findOne({
    type: 'project',
    project: projectId,
    participants: { $all: [freelancerId, clientId], $size: 2 }
  });
};


export const Chat = mongoose.model("Chat", chatSchema);