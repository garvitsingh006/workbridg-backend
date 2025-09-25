import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { getProject, newProject, updateProject, deleteProject, fetchAllUserProjects, fetchAllProjects, applyToProject, getProjectApplications, deleteProjectApplication} from "../controllers/project.controller.js";

const router = Router();

// Private: only logged-in client can create/update/delete the project
router.route("/new").post(verifyJWT, newProject);
router.route("/:id").patch(verifyJWT, updateProject)
router.route("/:id").delete(verifyJWT, deleteProject)
router.route("/all").get(verifyJWT, fetchAllUserProjects)
router.route('/users/all').get(verifyJWT, fetchAllProjects)

// Private: only specific client and admin can view this project
router.route("/:id").get(verifyJWT, getProject);

// Something else
router.route("/:projectId/apply").post(verifyJWT, applyToProject)
router.route("/:projectId/applications").get(verifyJWT, getProjectApplications)
router.route("/:projectId/applications/:userId").delete(verifyJWT, deleteProjectApplication);


export default router;