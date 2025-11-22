import Router from "express";
import {
	getPendingInterviewsForFreelancer,
	getFreelancersWithoutInterview,
	assignInterviewToFreelancer,
	getAssignedInterviewsForInterviewer,
	updateInterviewStatus,
	submitInterviewFeedback,
	// new
	createInterviewRequest,
	getAvailableSlots,
	getInterviewRequestsForAdmin,
	adminRequestReschedule,
} from "../controllers/interview.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { checkEmailVerified } from "../middlewares/email_verification.middleware.js";

const router = Router();
// For freelancer
router.route("/freelancers/pending-interviews").get(verifyJWT, checkEmailVerified, getPendingInterviewsForFreelancer);
router.route("/freelancers/requests").get(verifyJWT, checkEmailVerified, getPendingInterviewsForFreelancer);
router.route("/freelancers/slots").get(verifyJWT, checkEmailVerified, getAvailableSlots);
router.route("/freelancers/request").post(verifyJWT, checkEmailVerified, createInterviewRequest);

// only admin
router.route("/admin/freelancers/pending-interviews").get(verifyJWT, checkEmailVerified, getFreelancersWithoutInterview );
router.route("/admin/interviews/assign").post(verifyJWT, checkEmailVerified, assignInterviewToFreelancer);
router.route("/admin/interviews/requests").get(verifyJWT, checkEmailVerified, getInterviewRequestsForAdmin);
router.route("/admin/interviews/:id/request-reschedule").post(verifyJWT, checkEmailVerified, adminRequestReschedule);

// interviewer dashboard
router.route("/interviewer/assigned").get(verifyJWT, checkEmailVerified, getAssignedInterviewsForInterviewer);
router.route("/:id/status").patch(verifyJWT, checkEmailVerified, updateInterviewStatus);
router.route("/:id/feedback").patch(verifyJWT, checkEmailVerified, submitInterviewFeedback);

export default router;