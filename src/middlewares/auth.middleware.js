import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";

export const verifyJWT = asyncHandler(async (req, res, next) => {
    try {
        const token =
            req.cookies?.accessToken ||
            req.header("Authorization")?.replace("Bearer ", "");
        if (!token) {
            throw new ApiError(401, "Unauthorized Request");
        }

        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        if (!decodedToken) {
            throw new ApiError(401, "Invalid Access Token");
        }

        const user = await User.findById(decodedToken?._id).select(
            "-password  -refreshToken"
        );

        if (!user.isVerified) {
            throw new ApiError(403, "Email is not verified. Please verify your email to proceed");
        }
        req.user = user;

        next();
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            // Let frontend know it’s specifically expired
            throw new ApiError(401, "Access token expired");
        } else {
            throw new ApiError(401, error?.message || "Invalid Access Token");
        }
    }
});
