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

// import routes
import userRouter from "./routes/user.route.js"
app.use("/api/v1/users", userRouter)

export {app};