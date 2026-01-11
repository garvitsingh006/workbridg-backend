import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { checkEmailVerified } from "../middlewares/email_verification.middleware.js";
import { getProject, newProject, updateProject, deleteProject, fetchAllUserProjects, fetchAllProjects, applyToProject, getProjectApplications, getChosenApplications, deleteProjectApplication, requestAdminManagement} from "../controllers/project.controller.js";

const router = Router();

// Private: only logged-in client can create/update/delete the project
router.route("/new").post(verifyJWT, checkEmailVerified, newProject);
router.route("/:id").patch(verifyJWT, checkEmailVerified, updateProject)
router.route("/:id").delete(verifyJWT, checkEmailVerified, deleteProject)
router.route("/all").get(verifyJWT, checkEmailVerified, fetchAllUserProjects)
router.route('/users/all').get(verifyJWT, checkEmailVerified, fetchAllProjects)

// Private: only specific client and admin can view this project
router.route("/:id").get(verifyJWT, checkEmailVerified, getProject);

// Something else
router.route("/:projectId/apply").post(verifyJWT, checkEmailVerified, applyToProject)
router.route("/:projectId/applications").get(verifyJWT, checkEmailVerified, getProjectApplications)
router.route("/:projectId/chosenApplications").get(verifyJWT, checkEmailVerified, getChosenApplications)
router.route("/:projectId/applications/:userId").delete(verifyJWT, checkEmailVerified, deleteProjectApplication);
router.route("/:projectId/request-admin-management").post(verifyJWT, checkEmailVerified, requestAdminManagement);


export default router;