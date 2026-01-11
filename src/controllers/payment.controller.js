import axios from "axios";
import crypto from "crypto";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Payment } from "../models/payment.model.js";
import { Project } from "../models/project.model.js";

const CASHFREE_BASE_URL = process.env.CASHFREE_ENVIRONMENT === 'PRODUCTION' 
    ? 'https://api.cashfree.com/pg' 
    : 'https://sandbox.cashfree.com/pg';

const getAuthHeaders = () => ({
    'x-client-id': process.env.CASHFREE_APP_ID,
    'x-client-secret': process.env.CASHFREE_APP_SECRET,
    'x-api-version': '2022-09-01',
    'Content-Type': 'application/json'
});



// Helper function to generate signature
const generateSignature = (data, secret) => {
    return crypto
        .createHmac('sha256', secret)
        .update(data)
        .digest('base64');
};

const createPaymentRecord = asyncHandler(async (req, res) => {
    const {
        projectId,
        totalAmount,
        clientPlatformFeePercentage,
    } = req.body;

    if (!projectId || !totalAmount) {
        throw new ApiError(400, "Project ID and total amount are required");
    }

    const project = await Project.findById(projectId).populate(
        "createdBy assignedTo"
    );
    if (!project) {
        throw new ApiError(404, "Project not found");
    }

    if (!project.assignedTo) {
        throw new ApiError(400, "Project must have a freelancer assigned");
    }

    const existingPayment = await Payment.findOne({ projectId });
    if (existingPayment) {
        throw new ApiError(
            400,
            "Payment record already exists for this project"
        );
    }

    // Determine service charge based on admin management status
    const serviceChargePercentage = project.hasRequestedAdminManagement ? 5 : 0;
    const clientPlatformFee = (totalAmount * serviceChargePercentage) / 100;
    const freelancerPlatformFee = (totalAmount * 10) / 100;

    const payment = await Payment.create({
        projectId,
        clientId: project.createdBy._id,
        freelancerId: project.assignedTo._id,
        totalAmount,
        currency: "INR",
        platformFee: {
            serviceCharge: clientPlatformFee,
            commissionFee: freelancerPlatformFee,
        },
        total: {
            amount: totalAmount + clientPlatformFee,
            currency: "INR",
            status: "pending",
            customerName: project.createdBy.fullName,
            customerEmail: project.createdBy.email,
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
        .json(
            new ApiResponse(
                201,
                populatedPayment,
                "Payment record created successfully"
            )
        );
});

const createOrder = asyncHandler(async (req, res) => {
  const { paymentId } = req.body;
  if (!paymentId) throw new ApiError(400, "Payment ID is required");

  const payment = await Payment.findById(paymentId)
    .populate("clientId", "username email fullName phone")
    .populate("projectId", "title");

  if (!payment) throw new ApiError(404, "Payment record not found");
  if (payment.total.status === "paid")
    throw new ApiError(400, "Payment has already been completed");

  const orderId = `order_${payment._id}_${Date.now()}`;

  const orderRequest = {
    order_amount: Number(payment.total.amount),
    order_currency: "INR",
    order_id: orderId,
    customer_details: {
      customer_id: payment.clientId._id.toString(),
      customer_name: payment.clientId.fullName || "User",
      customer_email: payment.clientId.email,
      customer_phone: payment.clientId.phone || "9999999999",
    },
    order_meta: {
      return_url: `${process.env.FRONTEND_URL}/payment/callback?order_id=${orderId}`,
      notify_url: `${process.env.BACKEND_URL}/api/v1/payments/webhook`,
    },
    order_note: `Payment for project: ${payment.projectId.title}`,
  };

  try {
    const response = await axios.post(
      `${CASHFREE_BASE_URL}/orders`,
      orderRequest,
      {
        headers: {
          "Content-Type": "application/json",
          "x-client-id": process.env.CASHFREE_APP_ID,
          "x-client-secret": process.env.CASHFREE_APP_SECRET,
          "x-api-version": "2022-09-01",
        },
      }
    );

    const { order_id, payment_session_id } = response.data;

    if (!payment_session_id || !payment_session_id.startsWith("session_")) {
      throw new ApiError(500, "Invalid payment_session_id received from Cashfree");
    }

    payment.total.cashfreeOrderId = order_id;
    payment.total.status = "created";
    await payment.save();

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          orderId: order_id,
          paymentSessionId: payment_session_id,
          amount: payment.total.amount,
          currency: "INR",
        },
        "Cashfree order created successfully"
      )
    );
  } catch (error) {
    console.error(
      "Cashfree order creation error:",
      error.response?.data || error.message
    );
    throw new ApiError(
      500,
      error.response?.data?.message || "Failed to create payment order"
    );
  }
});


const verifyPayment = asyncHandler(async (req, res) => {
  const { paymentId, cashfreeOrderId } = req.body;

  if (!paymentId || !cashfreeOrderId) {
    throw new ApiError(400, "Payment ID and Cashfree order ID are required");
  }

  const payment = await Payment.findById(paymentId);
  if (!payment) throw new ApiError(404, "Payment record not found");

  try {
    const response = await axios.get(
      `${CASHFREE_BASE_URL}/orders/${cashfreeOrderId}/payments`,
      { headers: getAuthHeaders() }
    );

    const cashfreePayment = response.data?.[0];
    if (!cashfreePayment) throw new ApiError(404, "No payment found for this order");

    if (cashfreePayment.payment_status !== "SUCCESS") {
      payment.total.status = "failed";
      payment.overallStatus = "failed";
      payment.total.errorCode = cashfreePayment.error_details?.error_code;
      payment.total.errorMessage = cashfreePayment.error_details?.error_description;
      await payment.save();
      throw new ApiError(
        400,
        `Payment failed: ${cashfreePayment.payment_status}`
      );
    }

    payment.total.cashfreePaymentId = cashfreePayment.cf_payment_id;
    payment.total.status = "paid";
    payment.total.paymentMethod = cashfreePayment.payment_group;
    payment.total.completedAt = new Date(cashfreePayment.payment_time);
    payment.overallStatus = "final_paid";
    payment.rawCashfreeResponse = cashfreePayment;

    await payment.save();

    const populatedPayment = await Payment.findById(payment._id)
      .populate("clientId", "username email fullName")
      .populate("freelancerId", "username email fullName")
      .populate("projectId", "title");

    return res.status(200).json(
      new ApiResponse(200, populatedPayment, "Payment verified successfully")
    );
  } catch (error) {
    console.error("Payment verification error:", error.response?.data || error.message);
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      error.response?.status || 500,
      error.response?.data?.message || "Payment verification failed"
    );
  }
});


const handleWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers["x-webhook-signature"];
  const timestamp = req.headers["x-webhook-timestamp"];
  const rawBody = req.rawBody; // Raw string, not parsed JSON

  try {
    // ✅ Compute expected signature exactly per docs
    const expectedSignature = crypto
      .createHmac("sha256", process.env.CASHFREE_APP_SECRET)
      .update(timestamp + rawBody)
      .digest("base64");

    if (signature !== expectedSignature) {
      console.error("❌ Invalid webhook signature");
      return res.status(400).json({ message: "Invalid signature" });
    }

    const webhookData = JSON.parse(rawBody);
    const orderId = webhookData.data?.order?.order_id;

    if (!orderId) {
      return res.status(400).json({ message: "Order ID not found in webhook" });
    }

    const payment = await Payment.findOne({
      "total.cashfreeOrderId": orderId,
    });

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    const eventType = webhookData.type;
    const paymentData = webhookData.data?.payment;

    if (eventType === "PAYMENT_SUCCESS_WEBHOOK" && paymentData) {
      payment.total.cashfreePaymentId = paymentData.cf_payment_id;
      payment.total.status = "paid";
      payment.total.paymentMethod = paymentData.payment_group;
      payment.total.completedAt = new Date(paymentData.payment_time);
      payment.overallStatus = "final_paid";
    } else if (eventType === "PAYMENT_FAILED_WEBHOOK" && paymentData) {
      payment.total.status = "failed";
      payment.total.errorCode = paymentData.error_details?.error_code;
      payment.total.errorMessage = paymentData.error_details?.error_description;
    }

    payment.rawCashfreeResponse = webhookData;
    await payment.save();

    return res.status(200).json({ message: "Webhook processed successfully" });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return res.status(500).json({ message: "Webhook processing failed" });
  }
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

    return res
        .status(200)
        .json(new ApiResponse(200, payment, "Payment fetched successfully"));
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

    return res
        .status(200)
        .json(new ApiResponse(200, payment, "Payment fetched successfully"));
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
        throw new ApiError(400, "Payment must be completed before release");
    }

    if (payment.releaseStatus === "released") {
        throw new ApiError(400, "Payment has already been released");
    }

    const releaseAmount =
        payment.totalAmount -
        payment.platformFee.serviceCharge -
        payment.platformFee.commissionFee;

    payment.releaseAmount = releaseAmount;
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
                `Payment of ${payment.releaseAmount} released to freelancer`
            )
        );
});

// const refundPayment = asyncHandler(async (req, res) => {
//     if (req.user.role !== "admin") {
//         throw new ApiError(403, "Only admins can process refunds");
//     }

//     const { paymentId, refundAmount, refundNote } = req.body;

//     if (!paymentId) {
//         throw new ApiError(400, "Payment ID is required");
//     }

//     const payment = await Payment.findById(paymentId);
//     if (!payment) {
//         throw new ApiError(404, "Payment record not found");
//     }

//     if (payment.releaseStatus === "released") {
//         throw new ApiError(
//             400,
//             "Cannot refund a payment that has already been released"
//         );
//     }

//     if (payment.releaseStatus === "refunded") {
//         throw new ApiError(400, "Payment has already been refunded");
//     }

//     if (payment.total.status !== "paid") {
//         throw new ApiError(400, "Can only refund paid payments");
//     }

//     try {
//         const refundRequest = {
//             refund_amount: refundAmount || payment.total.amount,
//             refund_id: `refund_${payment._id}_${Date.now()}`,
//             refund_note: refundNote || "Refund requested by admin",
//         };

//         const refundResponse = await Cashfree.PGOrderCreateRefund(
//             "2023-08-01",
//             payment.total.cashfreeOrderId,
//             refundRequest
//         );

//         payment.releaseStatus = "refunded";
//         payment.overallStatus = "refunded";
//         payment.rawCashfreeResponse = {
//             ...payment.rawCashfreeResponse,
//             refund: refundResponse.data,
//         };

//         await payment.save();

//         const populatedPayment = await Payment.findById(payment._id)
//             .populate("clientId", "username email fullName")
//             .populate("freelancerId", "username email fullName")
//             .populate("projectId", "title");

//         return res
//             .status(200)
//             .json(
//                 new ApiResponse(
//                     200,
//                     populatedPayment,
//                     "Payment refunded successfully"
//                 )
//             );
//     } catch (error) {
//         console.error("Refund error:", error);
//         throw new ApiError(500, error.message || "Refund processing failed");
//     }
// });

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
        .json(
            new ApiResponse(200, payments, "All payments fetched successfully")
        );
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
        .populate("projectId", "title status hasRequestedAdminManagement")
        .sort({ createdAt: -1 });

    // Update payments for admin-moderated projects
    const updatedPayments = [];
    for (const payment of payments) {
        if (payment.projectId?.hasRequestedAdminManagement && 
            payment.platformFee.serviceCharge === 0 && 
            payment.total.status !== "paid") {
            
            const newServiceCharge = (payment.totalAmount * 5) / 100;
            payment.platformFee.serviceCharge = newServiceCharge;
            payment.total.amount = payment.totalAmount + newServiceCharge;
            await payment.save();
        }
        updatedPayments.push(payment);
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, updatedPayments, "User payments fetched successfully")
        );
});

const updatePaymentForAdminManagement = asyncHandler(async (req, res) => {
    const { projectId } = req.body;

    if (!projectId) {
        throw new ApiError(400, "Project ID is required");
    }

    const project = await Project.findById(projectId);
    if (!project) {
        throw new ApiError(404, "Project not found");
    }

    const payment = await Payment.findOne({ projectId });
    if (!payment) {
        throw new ApiError(404, "Payment record not found for this project");
    }

    if (payment.total.status === "paid") {
        throw new ApiError(400, "Cannot update payment that has already been completed");
    }

    // Calculate new service charge if admin management is requested
    if (project.hasRequestedAdminManagement) {
        const newServiceCharge = (payment.totalAmount * 5) / 100;
        const difference = newServiceCharge - payment.platformFee.serviceCharge;
        
        payment.platformFee.serviceCharge = newServiceCharge;
        payment.total.amount = payment.totalAmount + newServiceCharge;
        
        await payment.save();
        
        const populatedPayment = await Payment.findById(payment._id)
            .populate("clientId", "username email fullName")
            .populate("freelancerId", "username email fullName")
            .populate("projectId", "title");
        
        return res.status(200).json(
            new ApiResponse(200, populatedPayment, "Payment updated for admin management")
        );
    }

    return res.status(200).json(
        new ApiResponse(200, payment, "No update needed")
    );
});

export {
    createPaymentRecord,
    createOrder,
    verifyPayment,
    handleWebhook,
    getPaymentByProject,
    getPaymentById,
    releasePayment,
    // refundPayment,
    getAllPayments,
    getUserPayments,
    updatePaymentForAdminManagement,
};
