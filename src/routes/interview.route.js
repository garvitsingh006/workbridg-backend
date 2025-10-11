import Router from "express";
import { getPendingInterviewsForFreelancer, getFreelancersWithoutInterview, assignInterviewToFreelancer, getAssignedInterviewsForInterviewer, updateInterviewStatus, submitInterviewFeedback } from "../controllers/interview.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { checkEmailVerified } from "../middlewares/email_verification.middleware.js";

const router = Router();
// For freelancer
router.route("/freelancers/pending-interviews").get(verifyJWT, checkEmailVerified, getPendingInterviewsForFreelancer);

// only admin
router.route("/admin/freelancers/pending-interviews").get(verifyJWT, checkEmailVerified, getFreelancersWithoutInterview );
router.route("/admin/interviews/assign").post(verifyJWT, checkEmailVerified, assignInterviewToFreelancer);

// interviewer dashboard
router.route("/interviewer/assigned").get(verifyJWT, checkEmailVerified, getAssignedInterviewsForInterviewer);
router.route("/:id/status").patch(verifyJWT, checkEmailVerified, updateInterviewStatus);
router.route("/:id/feedback").patch(verifyJWT, checkEmailVerified, submitInterviewFeedback);

export default router;