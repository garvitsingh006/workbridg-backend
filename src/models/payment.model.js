import mongoose from "mongoose";

const paymentStageSchema = new mongoose.Schema({
  cashfreeOrderId: { type: String },
  cashfreePaymentId: { type: String },
  cashfreeSignature: { type: String },
  amount: { type: Number, required: true },
  currency: { type: String, default: "INR" },
  status: {
    type: String,
    enum: ["pending", "created", "paid", "received", "failed"],
    default: "pending",
  },
  customerName: { type: String },
  customerEmail: { type: String },
  customerPhone: { type: String },
  paymentMethod: { type: String },
  paymentType: {
    type: String,
    enum: ["cashfree", "upi"],
    default: "cashfree"
  },
  upiId: { type: String },
  claimedPaid: { type: Boolean, default: false },
  claimedPaidAt: { type: Date },
  errorCode: { type: String },
  errorMessage: { type: String },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
});

const paymentSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
    required: true,
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  freelancerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: function() {
      return !this.isAdminManagementFee;
    },
  },

  totalAmount: { type: Number, required: true },
  currency: { type: String, default: "INR" },
  platformFee: {
    serviceCharge: { type: Number, required: true },
    commissionFee: { type: Number, required: true },
  },

  total: { type: paymentStageSchema, required: true },

  rawCashfreeResponse: { type: mongoose.Schema.Types.Mixed },

  releaseAmount: { type: Number, default: 0 },
  releaseStatus: {
    type: String,
    enum: ["not_released", "released", "refunded"],
    default: "not_released",
  },

  overallStatus: {
    type: String,
    enum: [
      "pending",
      "advance_paid",
      "final_paid",
      "released",
      "refunded",
      "failed"
    ],
    default: "pending",
  },

  isAdminManagementFee: { type: Boolean, default: false },
  moderationId: { type: String, unique: true, sparse: true },
  description: { type: String },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

paymentSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

export const Payment = mongoose.model("Payment", paymentSchema);