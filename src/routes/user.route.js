import { Router } from "express";
import { loginUser, registerUser, usernameAvailability, verifyUser, logoutUser, meUser, getAllUsers, getUserById, refreshAccessToken, setRole, changeUsername, approveProjectForUser, projectInProgress, userApplicationChosenByClient,
    rejectProjectForUser,
    getApprovedProjects,
    getRejectedProjects,
    getInterviewers,
    getFreelancers,
    getClients,
    googleSignup,
    googleLogin,
    forgotPassword,
    resetPassword,
    deleteAccount,
    getFreelancerApplications } from "../controllers/user.controller.js";
// import {upload} from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { checkEmailVerified } from "../middlewares/email_verification.middleware.js";

const router = Router()
router.route("/register").post(registerUser)
router.route("/login").post(loginUser)
router.route("/username-available/:username").get(usernameAvailability)

// secure routes
router.route("/logout").post(verifyJWT, logoutUser)
router.route("/me").get(verifyJWT, meUser)
router.route("/delete-account").delete(verifyJWT, deleteAccount)
router.route('/all').get(verifyJWT, getAllUsers)
router.route('/auth/refresh-token').post(verifyJWT, refreshAccessToken)
router.route('/set-role').post(verifyJWT, setRole)
router.route('/username').patch(verifyJWT, changeUsername)

// role-based user fetching
router.route('/getInterviewers').get(verifyJWT, checkEmailVerified, getInterviewers)
router.route('/getFreelancers').get(verifyJWT, checkEmailVerified, getFreelancers)
router.route('/getClients').get(verifyJWT, checkEmailVerified, getClients)

// This must come after specific routes to avoid conflicts
router.route('/:userId').get(verifyJWT, getUserById)

router.route('/:userId/projects/:projectId/chooseApplication')
    .post(verifyJWT, checkEmailVerified, userApplicationChosenByClient);

router.route('/:userId/projects/approve')
    .post(verifyJWT, checkEmailVerified, approveProjectForUser, projectInProgress);

router.route('/:userId/projects/reject')
    .post(verifyJWT, checkEmailVerified, rejectProjectForUser);

router.route('/:userId/projects/approved')
    .get(verifyJWT, checkEmailVerified, getApprovedProjects);

router.route('/:userId/projects/rejected')
    .get(verifyJWT, checkEmailVerified, getRejectedProjects);

// Google OAuth
router.route('/auth/google/signup').post(googleSignup)
router.route('/auth/google/login').post(googleLogin)

// freelancer routes
router.route('/freelancer/applications').get(verifyJWT, checkEmailVerified, getFreelancerApplications)

// verify user using email
router.route("/verify").get(verifyUser)

// password reset routes
router.route("/forgot-password").post(forgotPassword)
router.route("/reset-password/:token").post(resetPassword)

export default router