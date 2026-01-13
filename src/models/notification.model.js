import mongoose, { Schema } from "mongoose";

const notificationSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        type: {
            type: String,
            enum: ["message", "payment", "project", "system", "application"],
            required: true,
        },
        title: {
            type: String,
            required: true,
        },
        preview: {
            type: String,
            required: true,
        },
        meta: {
            chatId: { type: Schema.Types.ObjectId },
            messageId: { type: Schema.Types.ObjectId },
            projectId: { type: Schema.Types.ObjectId },
            paymentId: { type: Schema.Types.ObjectId },
            applicationId: { type: Schema.Types.ObjectId },
        },
        isRead: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

export const Notification = mongoose.model("Notification", notificationSchema);