import Razorpay from "razorpay";
import crypto from "crypto";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Payment } from "../models/payment.model.js";
import { Project } from "../models/project.model.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const createPaymentRecord = asyncHandler(async (req, res) => {
  const { projectId, totalAmount, clientPlatformFeePercentage = 5 } = req.body;

  if (!projectId || !totalAmount) {
    throw new ApiError(400, "Project ID and total amount are required");
  }

  const project = await Project.findById(projectId).populate("createdBy assignedTo");
  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  if (!project.assignedTo) {
    throw new ApiError(400, "Project must have a freelancer assigned");
  }

  const existingPayment = await Payment.findOne({ projectId });
  if (existingPayment) {
    throw new ApiError(400, "Payment record already exists for this project");
  }

  const clientPlatformFee = (totalAmount * clientPlatformFeePercentage) / 100;
//   const advanceAmount = (totalAmount * 10) / 100;
//   const finalAmount = totalAmount - advanceAmount;
  const freelancerPlatformFee = (totalAmount * 8)/100;

  const payment = await Payment.create({
    projectId,
    clientId: project.createdBy._id,
    freelancerId: project.assignedTo._id,
    totalAmount,
    platformFee: {
        serviceCharge: clientPlatformFee,
        commissionFee: freelancerPlatformFee,
    },
    // advance: {
    //   amount: advanceAmount,
    //   status: "pending",
    // },
    // final: {
    //   amount: finalAmount,
    //   status: "pending",
    // },
    total: {
      amount: totalAmount,
      status: "pending",
    },
    overallStatus: "pending",
  });

  project.payment = payment._id;
  await project.save();

  const populatedPayment = await Payment.findById(payment._id)
    .populate("clientId", "username email fullName")
    .populate("freelancerId", "username email fullName")
    .populate("projectId", "title");

  return res
    .status(201)
    .json(new ApiResponse(201, populatedPayment, "Payment record created successfully"));
});

const createOrder = asyncHandler(async (req, res) => {
  const { paymentId, paymentType } = req.body;

  if (!paymentId || !paymentType) {
    throw new ApiError(400, "Payment ID and payment type are required");
  }

  if (!["advance", "final"].includes(paymentType)) {
    throw new ApiError(400, "Payment type must be either 'advance' or 'final'");
  }

  const payment = await Payment.findById(paymentId);
  if (!payment) {
    throw new ApiError(404, "Payment record not found");
  }

  const stage = payment[paymentType];
  const amount = stage.amount;

  if (stage.status === "paid") {
    throw new ApiError(400, `${paymentType} payment has already been completed`);
  }

  const options = {
    amount: Math.round(amount * 100),
    currency: "INR",
    receipt: `${paymentType}_${payment._id}_${Date.now()}`,
  };

  const order = await razorpay.orders.create(options);

  payment[paymentType].orderId = order.id;
  payment[paymentType].status = "created";
  await payment.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        orderId: order.id,
        amount: amount,
        currency: "INR",
        keyId: process.env.RAZORPAY_KEY_ID,
        paymentType,
      },
      "Razorpay order created successfully"
    )
  );
});

const verifyPayment = asyncHandler(async (req, res) => {
  const { paymentId, paymentType, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

  if (!paymentId || !paymentType || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new ApiError(400, "All payment verification fields are required");
  }

  if (!["advance", "final"].includes(paymentType)) {
    throw new ApiError(400, "Payment type must be either 'advance' or 'final'");
  }

  const payment = await Payment.findById(paymentId);
  if (!payment) {
    throw new ApiError(404, "Payment record not found");
  }

  const body = razorpayOrderId + "|" + razorpayPaymentId;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest("hex");

  const isAuthentic = expectedSignature === razorpaySignature;

  if (!isAuthentic) {
    payment[paymentType].status = "failed";
    await payment.save();
    throw new ApiError(400, "Payment verification failed");
  }

  payment[paymentType].paymentId = razorpayPaymentId;
  payment[paymentType].signature = razorpaySignature;
  payment[paymentType].status = "paid";

  if (paymentType === "advance") {
    payment.overallStatus = "advance_paid";
  } else if (paymentType === "final") {
    payment.overallStatus = "final_paid";
  }

  await payment.save();

  const populatedPayment = await Payment.findById(payment._id)
    .populate("clientId", "username email fullName")
    .populate("freelancerId", "username email fullName")
    .populate("projectId", "title");

  return res
    .status(200)
    .json(new ApiResponse(200, populatedPayment, "Payment verified successfully"));
});

const getPaymentByProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const payment = await Payment.findOne({ projectId })
    .populate("clientId", "username email fullName")
    .populate("freelancerId", "username email fullName")
    .populate("projectId", "title status");

  if (!payment) {
    throw new ApiError(404, "Payment record not found for this project");
  }

  return res.status(200).json(new ApiResponse(200, payment, "Payment fetched successfully"));
});

const getPaymentById = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;

  const payment = await Payment.findById(paymentId)
    .populate("clientId", "username email fullName")
    .populate("freelancerId", "username email fullName")
    .populate("projectId", "title status");

  if (!payment) {
    throw new ApiError(404, "Payment record not found");
  }

  return res.status(200).json(new ApiResponse(200, payment, "Payment fetched successfully"));
});

const releasePayment = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    throw new ApiError(403, "Only admins can release payments");
  }

  const { paymentId } = req.body;

  if (!paymentId) {
    throw new ApiError(400, "Payment ID is required");
  }

  const payment = await Payment.findById(paymentId);
  if (!payment) {
    throw new ApiError(404, "Payment record not found");
  }

  if (payment.overallStatus !== "final_paid") {
    throw new ApiError(400, "Both advance and final payments must be completed before release");
  }

  if (payment.releaseStatus === "released") {
    throw new ApiError(400, "Payment has already been released");
  }

  payment.releaseAmount = payment.totalAmount - payment.platformFee;
  payment.releaseStatus = "released";
  payment.overallStatus = "released";

  await payment.save();

  const populatedPayment = await Payment.findById(payment._id)
    .populate("clientId", "username email fullName")
    .populate("freelancerId", "username email fullName")
    .populate("projectId", "title");

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        populatedPayment,
        `Payment of ₹${payment.releaseAmount} released to freelancer`
      )
    );
});

const refundPayment = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    throw new ApiError(403, "Only admins can process refunds");
  }

  const { paymentId } = req.body;

  if (!paymentId) {
    throw new ApiError(400, "Payment ID is required");
  }

  const payment = await Payment.findById(paymentId);
  if (!payment) {
    throw new ApiError(404, "Payment record not found");
  }

  if (payment.releaseStatus === "released") {
    throw new ApiError(400, "Cannot refund a payment that has already been released");
  }

  if (payment.releaseStatus === "refunded") {
    throw new ApiError(400, "Payment has already been refunded");
  }

  payment.releaseStatus = "refunded";
  payment.overallStatus = "refunded";

  await payment.save();

  const populatedPayment = await Payment.findById(payment._id)
    .populate("clientId", "username email fullName")
    .populate("freelancerId", "username email fullName")
    .populate("projectId", "title");

  return res
    .status(200)
    .json(new ApiResponse(200, populatedPayment, "Payment refunded successfully"));
});

const getAllPayments = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    throw new ApiError(403, "Only admins can view all payments");
  }

  const payments = await Payment.find({})
    .populate("clientId", "username email fullName")
    .populate("freelancerId", "username email fullName")
    .populate("projectId", "title status")
    .sort({ createdAt: -1 });

  return res
    .status(200)
    .json(new ApiResponse(200, payments, "All payments fetched successfully"));
});

const getUserPayments = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const userRole = req.user.role;

  let query = {};
  if (userRole === "client") {
    query.clientId = userId;
  } else if (userRole === "freelancer") {
    query.freelancerId = userId;
  } else {
    throw new ApiError(403, "Invalid user role for fetching payments");
  }

  const payments = await Payment.find(query)
    .populate("clientId", "username email fullName")
    .populate("freelancerId", "username email fullName")
    .populate("projectId", "title status")
    .sort({ createdAt: -1 });

  return res
    .status(200)
    .json(new ApiResponse(200, payments, "User payments fetched successfully"));
});

export {
  createPaymentRecord,
  createOrder,
  verifyPayment,
  getPaymentByProject,
  getPaymentById,
  releasePayment,
  refundPayment,
  getAllPayments,
  getUserPayments,
};
