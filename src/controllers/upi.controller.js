import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Payment } from "../models/payment.model.js";

const markPaymentAsPaid = asyncHandler(async (req, res) => {
    const { paymentId } = req.params;
    const userId = req.user._id;

    const payment = await Payment.findById(paymentId);
    if (!payment) {
        throw new ApiError(404, "Payment not found");
    }

    // Only client can mark payment as paid
    if (payment.clientId.toString() !== userId.toString()) {
        throw new ApiError(403, "Only the client can mark payment as paid");
    }

    if (payment.total.status !== "pending" && payment.total.status !== "created") {
        throw new ApiError(400, "Payment is not in pending status");
    }

    payment.total.claimedPaid = true;
    payment.total.claimedPaidAt = new Date();
    await payment.save();

    res.status(200).json(
        new ApiResponse(200, payment, "Payment marked as paid successfully")
    );
});

const markPaymentAsReceived = asyncHandler(async (req, res) => {
    const { paymentId } = req.params;
    const userId = req.user._id;

    const payment = await Payment.findById(paymentId);
    if (!payment) {
        throw new ApiError(404, "Payment not found");
    }

    // Only freelancer can mark payment as received (for regular payments)
    // For admin management fees, only admin can mark as received
    if (payment.isAdminManagementFee) {
        if (req.user.role !== "admin") {
            throw new ApiError(403, "Only admin can mark admin management fee as received");
        }
    } else {
        if (!payment.freelancerId || payment.freelancerId.toString() !== userId.toString()) {
            throw new ApiError(403, "Only the freelancer can mark payment as received");
        }
    }

    if (payment.total.status !== "paid" && !payment.total.claimedPaid) {
        throw new ApiError(400, "Payment must be paid or claimed paid before it can be marked as received");
    }

    payment.total.status = "paid";
    payment.total.completedAt = new Date();
    payment.total.claimedPaid = false;
    payment.overallStatus = payment.isAdminManagementFee ? "final_paid" : "advance_paid";
    await payment.save();

    res.status(200).json(
        new ApiResponse(200, payment, "Payment marked as received successfully")
    );
});

const generateUPIDeeplink = asyncHandler(async (req, res) => {
    const { paymentId } = req.params;

    const payment = await Payment.findById(paymentId);
    if (!payment) {
        throw new ApiError(404, "Payment not found");
    }

    if (payment.total.paymentType !== "upi") {
        throw new ApiError(400, "This is not a UPI payment");
    }

    const upiId = payment.total.upiId || process.env.UPI_ID;
    const amount = payment.totalAmount; // Use base amount, not total.amount which includes fees
    const description = payment.moderationId || payment.description || "WorkBridg Payment";

    // Generate UPI deeplink
    const upiLink = `upi://pay?pa=${upiId}&am=${amount}&cu=INR&tn=${encodeURIComponent(description)}`;

    res.status(200).json(
        new ApiResponse(200, { upiLink, amount, upiId }, "UPI deeplink generated successfully")
    );
});

export {
    markPaymentAsPaid,
    markPaymentAsReceived,
    generateUPIDeeplink
};