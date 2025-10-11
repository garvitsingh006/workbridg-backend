import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { checkEmailVerified } from "../middlewares/email_verification.middleware.js";
import { getProfile, setProfile } from "../controllers/profile.controller.js";

const router = Router();

// Public: anyone can view by username
router.route("/:username").get(verifyJWT, checkEmailVerified, getProfile);

// Private: only logged-in user can update their own profile
router.route("/me").post(
    verifyJWT,
    checkEmailVerified,
    upload.fields([{ name: "resume", maxCount: 1 }]),
    setProfile
);

export default router;