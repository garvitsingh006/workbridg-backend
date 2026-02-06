import { Router } from "express";
import { health } from "../controllers/health.controller.js";

const router = Router();

router.route("/").get(health).head((req,res) => res.sendStatus(200));

export default router;