import { NextFunction, Request, Response } from "express";
import { catchAsyncError } from "../middleware/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import OrderModel, { IOrder } from "../models/order.model";
import UserModel from "../models/user.model";
import CourseModel from "../models/course.model";
import path from "path";
import ejs from "ejs";
import sendMail from "../utils/sendMail";
import NotificationModel from "../models/notification.model";
import { newOrder } from "../services/order.service";


//create order

export const createOrder = catchAsyncError(async (req: Request, res: Response, next: NextFunction)=> {
    try {
        const {courseId, payment_info} = req.body as IOrder;

        const user = await UserModel.findById(req.user?._id);
        const courseExistInUser = user?.course.some((singleCourse:any)=> singleCourse?.courseId?.toString() === courseId);
        if(courseExistInUser){
            return next(new ErrorHandler("You have already purchased this course", 400));
        }

        const course = await CourseModel.findById(courseId);

        if(!course){
            return next(new ErrorHandler("Course not found", 404));
        };

        const data: any = {
            courseId: course._id,
            userId: req.user?._id,
            payment_info
        }
        
    

        const mailData = {
            order: {
                _id: course.id.toString().slice(0, 8),
                name: course.name, 
                price: course.price,
                date: new Date().toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                }),
            }
        }

        const html  = await ejs.renderFile(path.join(__dirname, '../emails/order-confirmation.ejs'), {
            order: mailData
        })

        try {
            if(user){
                await sendMail({
                    email: user.email,
                    subject: "Order Placed",
                    template: "order-confirmation.ejs",
                    data: mailData
                })
            }
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 500));
        }

        user?.course.push(course?._id);

        await user?.save();

        await NotificationModel.create({
            userId: user?._id,
            title: "New Order", 
            message: `You have a new order from ${course?.name}`,
        });


        if(course.purchased || course.purchased === 0){
            course.purchased += 1;
        
        }
        await course.save();
            
        newOrder(data, res, next)

        
    } catch (error : any) {
        return next(new ErrorHandler(error.message, 500));
    }
} )