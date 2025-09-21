import { Router } from "express";
import { loginUser, registerUser, logoutUser, meUser } from "../controllers/user.controller.js";
import {upload} from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()
router.route("/register").post(registerUser)
router.route("/login").post(loginUser)

// secure routes
router.route("/logout").post(verifyJWT, logoutUser)
router.route("/me").get(verifyJWT, meUser)

export default router