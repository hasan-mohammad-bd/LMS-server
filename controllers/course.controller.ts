
import { Request, Response, NextFunction } from "express";
import { catchAsyncError } from "../middleware/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import cloudinary from "cloudinary";


// upload course 
export const uploadCourse = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = req.body;
        const thumbnail = data.thumbnail;
        if(!thumbnail){
            const myCloud = await cloudinary.v2.uploader.upload(thumbnail, {folder: "courses"});
            data.thumbnail = {
                public_id: myCloud.public_id,
                url: myCloud.secure_url
            }
        }
        
    } catch (error :any) {
        return next(new ErrorHandler(error.message, 500));
    }
})