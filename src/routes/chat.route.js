import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { newChat, newMessage, getAllChats, markMessagesAsRead } from "../controllers/chat.controller.js";

const router = Router();
router.route("/new").post(verifyJWT, newChat)
router.route("/:id/message").post(verifyJWT, newMessage)
router.route("/user").get(verifyJWT, getAllChats)
router.route("/:chatId/read").patch(verifyJWT, markMessagesAsRead)

export default router;