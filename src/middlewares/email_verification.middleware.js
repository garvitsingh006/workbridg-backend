import { ApiError } from "../utils/ApiError.js";

export const checkEmailVerified = (req, res, next) => {
    if (!req.user) {
        // Should never happen if verifyJWT runs before
        return next(new ApiError(401, "Unauthorized: no user found"));
    }

    if (!req.user.isVerified) {
        return next(new ApiError(403, "Email not verified. Please verify your email to access this resource."));
    }

    // User is verified, continue
    next();
};
