import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { checkEmailVerified } from "../middlewares/email_verification.middleware.js";
import { 
    markPaymentAsPaid, 
    markPaymentAsReceived, 
    generateUPIDeeplink 
} from "../controllers/upi.controller.js";

const router = Router();

router.route("/:paymentId/mark-paid").patch(verifyJWT, checkEmailVerified, markPaymentAsPaid);
router.route("/:paymentId/mark-received").patch(verifyJWT, checkEmailVerified, markPaymentAsReceived);
router.route("/:paymentId/upi-link").get(verifyJWT, checkEmailVerified, generateUPIDeeplink);

export default router;