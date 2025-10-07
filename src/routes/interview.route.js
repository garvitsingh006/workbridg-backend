import Router from "express";
import { getPendingInterviewsForFreelancer, getFreelancersWithoutInterview, assignInterviewToFreelancer, getAssignedInterviewsForInterviewer, updateInterviewStatus, submitInterviewFeedback } from "../controllers/interview.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();
// For freelancer
router.route("/freelancers/pending-interviews").get(verifyJWT, getPendingInterviewsForFreelancer);

// only admin
router.route("/admin/freelancers/pending-interviews").get(verifyJWT, getFreelancersWithoutInterview );
router.route("/admin/interviews/assign").post(verifyJWT, assignInterviewToFreelancer);

// interviewer dashboard
router.route("/interviewer/assigned").get(verifyJWT, getAssignedInterviewsForInterviewer);
router.route("/:id/status").patch(verifyJWT, updateInterviewStatus);
router.route("/:id/feedback").patch(verifyJWT, submitInterviewFeedback);

export default router;