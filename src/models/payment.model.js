import mongoose from "mongoose";

const paymentStageSchema = new mongoose.Schema({
  orderId: { type: String },
  paymentId: { type: String },
  signature: { type: String },
  amount: { type: Number, required: true },
  status: {
    type: String,
    enum: ["pending", "created", "paid", "failed"],
    default: "pending",
  },
  createdAt: { type: Date, default: Date.now },
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
    required: true,
  },

  totalAmount: { type: Number, required: true },
  platformFee: {
    serviceCharge: { type: Number, required: true },
    commissionFee: { type: Number, required: true },
  },

//   advance: { type: paymentStageSchema, required: true },
//   final: { type: paymentStageSchema, required: true },
  total: {type: paymentStageSchema, required: true},

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
    ],
    default: "pending",
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

paymentSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

export const Payment = mongoose.model("Payment", paymentSchema);