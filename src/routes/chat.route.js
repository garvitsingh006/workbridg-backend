import { Router } from "express";
import {
    newChat,
    newMessage,
    getAllChats,
    markMessagesAsRead,
    addAdminToChat,
    approveChat,
    newGroupChat,
    addParticipants,
    getParticipants,
    removeParticipant,
} from "../controllers/chat.controller.js";
import { proceedWithFreelancer } from "../controllers/project.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { checkEmailVerified } from "../middlewares/email_verification.middleware.js";

const router = Router();

router.route("/new").post(verifyJWT, checkEmailVerified, newChat);
router.route("/:id/message").post(verifyJWT, checkEmailVerified, newMessage);
router.route("/user").get(verifyJWT, checkEmailVerified, getAllChats);

// Group chat endpoints
router.route("/group").post(verifyJWT, checkEmailVerified, newGroupChat); // Create a group chat
router.route("/:chatId/participants")
    .post(verifyJWT, checkEmailVerified, addParticipants) // Add participants
    .get(verifyJWT, checkEmailVerified, getParticipants); // Fetch participants

router.route("/:chatId/read").patch(verifyJWT, checkEmailVerified, markMessagesAsRead);
router.route("/:chatId/add-admin").patch(verifyJWT, checkEmailVerified, addAdminToChat);
router.route("/:chatId/approve").patch(verifyJWT, checkEmailVerified, approveChat);
router.route("/:chatId/proceed-freelancer").patch(verifyJWT, checkEmailVerified, proceedWithFreelancer);
router.route("/:chatId/participants/:userId").delete(verifyJWT, checkEmailVerified, removeParticipant);

export default router;
