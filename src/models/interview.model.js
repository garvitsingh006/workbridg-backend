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
            required: false,
        },
        mode: {
            type: String,
            enum: ["online", "offline"],
            default: "online",
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
        // requested: freelancer requested a slot (no interviewer yet)
        // reschedule_requested: admin requested the freelancer to pick a new slot
        // pending: generic pending state (legacy)
        // scheduled: interviewer assigned and confirmed
        status: {
            type: String,
            enum: ["requested", "reschedule_requested", "pending", "scheduled", "completed", "cancelled"],
            default: "requested",
        },
        preferredRole: {
            type: String,
            trim: true,
        },
        feedback: {
            type: String,
            default: "",
        },
        ratingDetails: {
            technical: { type: Number, default: 0, min: 0, max: 5 },
            communication: { type: Number, default: 0, min: 0, max: 5 },
            professionalism: { type: Number, default: 0, min: 0, max: 5 },
            speed: { type: Number, default: 0, min: 0, max: 5 },
            pastWork: { type: Number, default: 0, min: 0, max: 5 },
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
