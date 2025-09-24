import cookieParser from "cookie-parser";
import express from "express";
import cors from "cors";
import {upload} from "./middlewares/multer.middleware.js"

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))
app.use(express.json("limit: 10mb"));
app.use(cookieParser());
app.use(express.static("public"));
app.use(express.urlencoded({extended: true, limit: "10mb"}));
app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        success: false,
        message: err.message || "Internal Server Error",
    });
});


// import routes
import userRouter from "./routes/user.route.js"
import profileRouter from  "./routes/profile.route.js"
import projectRouter from "./routes/project.route.js"
import chatRouter from "./routes/chat.route.js"
app.use("/api/v1/users", userRouter)
app.use("/api/v1/profiles", profileRouter)
app.use("/api/v1/projects", projectRouter)
app.use("/api/v1/chats", chatRouter)
// app.use("/api/v1/admin/projects/pending", "something") // TODO: ADMIN WORK!!!

export {app};