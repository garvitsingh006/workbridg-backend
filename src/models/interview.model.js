import mongoose, { Schema } from "mongoose";

const interviewSchema = new Schema(
    {
        freelancer: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        interviewer: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        mode: {
            type: String,
            enum: ["online", "offline"],
            default: "Online",
        },
        platform: {
            type: String, // e.g., Google Meet, Zoom
            trim: true,
        },
        link: {
            type: String,
            trim: true,
        },
        dateTime: {
            type: Date,
            required: true,
        },
        duration: {
            type: Number, // in minutes
            default: 30,
        },
        timezone: {
            type: String,
            default: "Asia/Kolkata",
        },
        notes: {
            type: String,
            trim: true,
        },
        status: {
            type: String,
            enum: ["pending", "scheduled", "completed", "cancelled"],
            default: "pending",
        },
        feedback: {
            type: String,
            default: "",
        },
        rating: {
            type: Number,
            min: 1,
            max: 5,
            default: null,
        },
    },
    { timestamps: true }
);

export const Interview = mongoose.model("Interview", interviewSchema);
