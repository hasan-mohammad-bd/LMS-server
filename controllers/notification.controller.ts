import NotificationModel from "../models/notification.model";
import { NextFunction, Request, Response } from "express";
import { catchAsyncError } from "../middleware/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";


//get all notifications --- for admin only
export const getNotifications = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const notifications = await NotificationModel.find().sort({createdAt: -1}); //here -1 is for descending
        res.status(201).json({
            success: true,
            notifications
        });
    } catch (error :any) {
        return next(new ErrorHandler(error.message, 500));
        
    }
})


// update notification status
export const updateNotification = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const notification = await NotificationModel.findById(req.params.id);

        if(!notification){
            return next(new ErrorHandler("Notification not found", 404));
        }

        notification.status? notification.status = "read" : notification.status;

        await notification.save();

        //to send the updated notifications to the client
        const  notifications = await NotificationModel.find().sort({createdAt: -1});
        res.status(201).json({
            success: true,
            notifications
        });
    } catch (error :any) {
        return next(new ErrorHandler(error.message, 500));
        
    }
})
