import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { getProject, newProject, updateProject, deleteProject } from "../controllers/project.controller.js";

const router = Router();

// Private: only logged-in client can create/update/delete the project
router.route("/new").post(verifyJWT, newProject);
router.route("/:id").patch(verifyJWT, updateProject)
router.route("/:id").delete(verifyJWT, deleteProject)

// Private: only specific client and admin can view this project
router.route("/:id").get(verifyJWT, getProject);

export default router;