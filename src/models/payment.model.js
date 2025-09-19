import mongoose, { Schema } from "mongoose";

const paymentSchema = new Schema(
    {
        project: {
            type: Schema.Types.ObjectId,
            ref: "Project",
            required: true,
        },
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        status: {
            type: String,
            enum: ["pending", "completed", "failed"],
            default: "pending",
        },
        transactionId: {
            type: String, // Razorpay
        },
        paidAt: {
            type: Date,
        },
    },
    { timestamps: true }
);

projectSchema.methods.markPaymentCompleted = async function (txnId) {
    this.payment.status = "completed";
    this.paymnet.transactionId = txnId;
    this.paidAt = new Date();
    return await this.save();
};

paymentSchema.methods.updateStatus = async function (newStatus) {
    const allowedStatuses = ["pending", "completed", "failed"]; // whitelist
    if (!allowedStatuses.includes(newStatus)) {
        throw new Error(`Invalid status: ${newStatus}`);
    }

    this.status = newStatus;
    return await this.save();
};

export const Payment = mongoose.model("Payment", paymentSchema);