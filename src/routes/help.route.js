import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { submitHelpRequest } from "../controllers/help.controller.js";

const router = Router();

router.route("/submit").post(verifyJWT, submitHelpRequest);

export default router;