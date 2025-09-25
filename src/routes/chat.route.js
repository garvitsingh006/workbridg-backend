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
    removeParticipant
} from "../controllers/chat.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/new", verifyJWT, newChat);
router.post("/:id/message", verifyJWT, newMessage);
router.get("/user", verifyJWT, getAllChats);

// Group chat endpoints
router.post("/group", verifyJWT, newGroupChat); // Create a group chat
router.post("/:chatId/participants", verifyJWT, addParticipants); // Add participants
router.get("/:chatId/participants", verifyJWT, getParticipants); // Fetch participants

router.patch("/:chatId/read", verifyJWT, markMessagesAsRead);
router.patch("/:chatId/add-admin", verifyJWT, addAdminToChat);
router.patch("/:chatId/approve", verifyJWT, approveChat);
router.delete("/:chatId/participants/:userId", verifyJWT, removeParticipant);

export default router;
