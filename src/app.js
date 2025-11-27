import cookieParser from "cookie-parser";
import express from "express";
import cors from "cors";
import {upload} from "./middlewares/multer.middleware.js"

const app = express();

app.set("io", null);
app.use(cors({
    origin: process.env.CORS_ORIGIN || "https://workbridg-test.vercel.app",
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

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// import { Project } from "./models/project.model.js";
// import { Payment } from "./models/payment.model.js";
// import { Chat } from "./models/chat.model.js";

// const deleteAllProjects = async () => {
//   try {
//     const result = await Project.deleteMany({});
//     const result2 = await Payment.deleteMany({});
//         const result3 = await Chat.deleteMany({});
//     console.log(`Deleted ${result.deletedCount} projects.`);
//     console.log(`Deleted ${result2.deletedCount} payments.`);
//     console.log(`Deleted ${result3.deletedCount} chats.`);
//   } catch (err) {
//     console.error(err);
//   }
// };

// deleteAllProjects();


// import routes
import userRouter from "./routes/user.route.js"
import profileRouter from  "./routes/profile.route.js"
import projectRouter from "./routes/project.route.js"
import chatRouter from "./routes/chat.route.js"
import interviewRouter from "./routes/interview.route.js"
import paymentRouter from "./routes/payment.route.js"
import uploadRouter from "./routes/upload.route.js"
import helpRouter from "./routes/help.route.js"
app.use("/api/v1/users", userRouter)
app.use("/api/v1/profiles", profileRouter)
app.use("/api/v1/projects", projectRouter)
app.use("/api/v1/chats", chatRouter)
app.use("/api/v1/interviews", interviewRouter)
app.use("/api/v1/payments", paymentRouter)
app.use("/api/v1/upload", uploadRouter)
app.use("/api/v1/help", helpRouter)

export {app};