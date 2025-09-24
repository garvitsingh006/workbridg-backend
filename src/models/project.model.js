import mongoose, { Schema } from "mongoose";

const projectSchema = new Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            required: true,
            trim: true,
        },
        assignedTo: {
            type: Schema.Types.ObjectId,
            ref: "User", // the freelancer
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User", // the client
            required: true,
        },
        status: {
            type: String,
            enum: [
                "unassigned",
                "pending",
                "in-progress",
                "completed",
                "cancelled",
            ],
            default: "unassigned",
        },
        deadline: {
            type: Date,
        },
        remarks: [
            {
                by: {
                    type: Schema.Types.ObjectId,
                    ref: "User",
                    required: true,
                },
                text: { type: String, required: true, trim: true },
                createdAt: { type: Date, default: Date.now },
            },
        ],
        applications: [
            {
                applicant: {
                    type: Schema.Types.ObjectId,
                    ref: "User",
                },
                username: {type: Schema.Types.ObjectId, ref: "User"},
                deadline: String,
                expectedPayment: String,
                appliedAt: Date,
            },
        ],
        payment: {
            type: Schema.Types.ObjectId,
            ref: "Payment",
        },
    },
    { timestamps: true }
);

projectSchema.methods.updateStatus = async function (newStatus) {
    this.status = newStatus;
    return await this.save();
};

projectSchema.methods.markCompleted = async function () {
    this.status = "completed";
    return await this.save(); // for now return here
    // TODO if payment exists, mark it completed too
};

projectSchema.methods.addRemark = async function (userId, text) {
    this.remarks.push({ by: userId, text: text });
    return await this.save();
};

export const Project = mongoose.model("Project", projectSchema);
