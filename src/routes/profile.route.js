import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { checkEmailVerified } from "../middlewares/email_verification.middleware.js";
import { getProfile, setProfile, listFreelancerSummaries } from "../controllers/profile.controller.js";

const router = Router();

// List freelancers (paginated, filterable) - used by client dashboard browse
router.route("/list").get(verifyJWT, checkEmailVerified, listFreelancerSummaries);

// Private: only logged-in user can update their own profile
router.route("/me").post(
    verifyJWT,
    checkEmailVerified,
    upload.fields([{ name: "resume", maxCount: 1 }]),
    setProfile
);

// Public: anyone can view by username
router.route("/:username").get(verifyJWT, checkEmailVerified, getProfile);

export default router;