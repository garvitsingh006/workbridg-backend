import express from "express";
import {
  createPaymentRecord,
  createOrder,
  verifyPayment,
  handleWebhook,
  getPaymentByProject,
  getPaymentById,
  releasePayment,
//   refundPayment,
  getAllPayments,
  getUserPayments,
  updatePaymentForAdminManagement,
} from "../controllers/payment.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/create-record", verifyJWT, createPaymentRecord);
router.post("/create-order", verifyJWT, createOrder);
router.post("/verify-payment", verifyJWT, verifyPayment);
router.post("/webhook", handleWebhook);
router.get("/project/:projectId", verifyJWT, getPaymentByProject);
router.get("/:paymentId", verifyJWT, getPaymentById);
router.post("/release", verifyJWT, releasePayment);
// router.post("/refund", verifyJWT, refundPayment);
router.get("/admin/all", verifyJWT, getAllPayments);
router.get("/user/my-payments", verifyJWT, getUserPayments);
router.post("/update-admin-management", verifyJWT, updatePaymentForAdminManagement);

export default router;