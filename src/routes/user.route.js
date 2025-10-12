import { Router } from "express";
import { loginUser, registerUser, verifyUser, logoutUser, meUser, getAllUsers, refreshAccessToken, setRole, approveProjectForUser,
    rejectProjectForUser,
    getApprovedProjects,
    getRejectedProjects,
    getInterviewers,
    googleSignup,
    googleLogin,
    forgotPassword,
    resetPassword } from "../controllers/user.controller.js";
import {upload} from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { checkEmailVerified } from "../middlewares/email_verification.middleware.js";

const router = Router()
router.route("/register").post(registerUser)
router.route("/login").post(loginUser)

// secure routes
router.route("/logout").post(verifyJWT, logoutUser)
router.route("/me").get(verifyJWT, meUser)
router.route('/all').get(verifyJWT, getAllUsers)
router.route('/auth/refresh-token').post(verifyJWT, refreshAccessToken)
router.route('/set-role').post(verifyJWT, setRole)

// interviewers
router.route('/interviewers').get(verifyJWT, checkEmailVerified, getInterviewers)


router.route('/:userId/projects/approve')
    .post(verifyJWT, checkEmailVerified, approveProjectForUser);

router.route('/:userId/projects/reject')
    .post(verifyJWT, checkEmailVerified, rejectProjectForUser);

router.route('/:userId/projects/approved')
    .get(verifyJWT, checkEmailVerified, getApprovedProjects);

router.route('/:userId/projects/rejected')
    .get(verifyJWT, checkEmailVerified, getRejectedProjects);

// Google OAuth
router.route('/auth/google/signup').post(googleSignup)
router.route('/auth/google/login').post(googleLogin)

// verify user using email
router.route("/verify").get(verifyUser)

// password reset routes
router.route("/forgot-password").post(forgotPassword)
router.route("/reset-password/:token").post(resetPassword)

export default router