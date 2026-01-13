import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Notification } from "../models/notification.model.js";

const createNotification = async (userId, type, title, preview, meta = {}) => {
    const truncatedPreview = preview.length > 15 ? preview.substring(0, 15) + "..." : preview;
    
    await Notification.create({
        user: userId,
        type,
        title,
        preview: truncatedPreview,
        meta,
    });
};

const getNotifications = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({ user: req.user._id })
        .sort({ isRead: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit);

    const unreadCount = await Notification.countDocuments({ 
        user: req.user._id, 
        isRead: false 
    });

    return res.status(200).json(
        new ApiResponse(200, { notifications, unreadCount }, "Notifications fetched successfully")
    );
});

const markAsRead = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const notification = await Notification.findOneAndUpdate(
        { _id: id, user: req.user._id },
        { isRead: true },
        { new: true }
    );

    if (!notification) {
        throw new ApiError(404, "Notification not found");
    }

    return res.status(200).json(
        new ApiResponse(200, notification, "Notification marked as read")
    );
});

const markAllAsRead = asyncHandler(async (req, res) => {
    await Notification.updateMany(
        { user: req.user._id, isRead: false },
        { isRead: true }
    );

    return res.status(200).json(
        new ApiResponse(200, {}, "All notifications marked as read")
    );
});

export { createNotification, getNotifications, markAsRead, markAllAsRead };