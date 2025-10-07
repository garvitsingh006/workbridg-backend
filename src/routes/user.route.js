import { Router } from "express";
import { loginUser, registerUser, logoutUser, meUser, getAllUsers, refreshAccessToken, approveProjectForUser,
    rejectProjectForUser,
    getApprovedProjects,
    getRejectedProjects } from "../controllers/user.controller.js";
import {upload} from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()
router.route("/register").post(registerUser)
router.route("/login").post(loginUser)

// secure routes
router.route("/logout").post(verifyJWT, logoutUser)
router.route("/me").get(verifyJWT, meUser)
router.route('/all').get(verifyJWT, getAllUsers)
router.route('/auth/refresh-token').post(refreshAccessToken)


router.route('/:userId/projects/approve')
    .post(verifyJWT, approveProjectForUser);

router.route('/:userId/projects/reject')
    .post(verifyJWT, rejectProjectForUser);

router.route('/:userId/projects/approved')
    .get(verifyJWT, getApprovedProjects);

router.route('/:userId/projects/rejected')
    .get(verifyJWT, getRejectedProjects);


export default router