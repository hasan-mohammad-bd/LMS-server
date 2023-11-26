import { Request, Response, NextFunction } from "express";
import { catchAsyncError } from "../middleware/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import cloudinary from "cloudinary";
import { createCourse } from "../services/course.service";
import CourseModel from "../models/course.model";
import { redis } from "../utils/redis";
import mongoose from "mongoose";
import ejs from "ejs";
import path from "path";
import sendMail from "../utils/sendMail";
import NotificationModel from "../models/notification.model";

// upload course
export const uploadCourse = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;

      const thumbnail = data?.thumbnail;
      if (thumbnail) {
        const myCloud = await cloudinary.v2.uploader.upload(thumbnail, {
          folder: "courses",
        });
        data.thumbnail = {
          public_id: myCloud.public_id,
          url: myCloud.secure_url,
        };
      }

      createCourse(data, res, next);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

//edit course
export const editCourse = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;
      const thumbnail = data?.thumbnail;

      if (thumbnail) {
        await cloudinary.v2.uploader.destroy(thumbnail.public_id);

        const myCloud = await cloudinary.v2.uploader.upload(thumbnail, {
          folder: "courses",
        });

        data.thumbnail = {
          public_id: myCloud.public_id,
          url: myCloud.secure_url,
        };
      }

      const courseId = req.params.id;
      const course = await CourseModel.findByIdAndUpdate(
        courseId,
        { $set: data },
        { new: true }
      );
      res.status(201).json({
        success: true,
        course,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

//get single course without purchase
export const getSingleCourse = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = req.params.id;
      const isCacheExist = await redis.get(courseId);

      if (isCacheExist) {
        const course = JSON.parse(isCacheExist);
        res.status(200).json({
          success: true,
          course,
        });
      } else {
        const course = await CourseModel.findById(req.params.id).select(
          "-courseData.videoUrl -courseData.suggestions -courseData.questions -courseData.links"
        );

        // upload session to redis thats way it will be cached.

        await redis.set(courseId, JSON.stringify(course));
        res.status(201).json({
          success: true,
          course,
        });
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

//get all coursers without purchase
export const getAllCourses = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isCacheExist = await redis.get("allCourses");
      if (isCacheExist) {
        const courses = JSON.parse(isCacheExist);
        res.status(200).json({
          success: true,
          courses,
        });
      } else {
        const courses = await CourseModel.find().select(
          "-courseData.videoUrl -courseData.suggestions -courseData.questions -courseData.links"
        );

        await redis.set("allCourses", JSON.stringify(courses));
        res.status(201).json({
          success: true,
          courses,
        });
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// get all content for valid users

export const getCourseByUser = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userCourseList = req.user?.course;
      const courseId = req.params.id;
      const courseExists = userCourseList?.find(
        (course: any) => course._id.toString() === courseId
      );
      if (!courseExists) {
        return next(
          new ErrorHandler("Your are not eligible to access this course", 404)
        );
      }

      const course = await CourseModel.findById(courseId);
      const content = course?.courseData;

      res.status(200).json({
        success: true,
        content,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// add question in course
interface IAddQuestionData {
  question: string;
  courseId: string;
  contentId: string;
}

export const addQuestion = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { question, courseId, contentId } = req.body as IAddQuestionData;
      const course = await CourseModel.findById(courseId);

      if (!mongoose.Types.ObjectId.isValid(contentId)) {
        return next(new ErrorHandler("Invalid content id", 404));
      }

      const courseContent = course?.courseData?.find((item: any) =>
        item._id.equals(contentId)
      );

      if (!courseContent) {
        return next(new ErrorHandler("Invalid content id", 404));
      }

      //create a new question object
      const newQuestion: any = {
        user: req.user,
        question,
        questionResponses: [],
      };

      //add this question to our course content
      courseContent.questions.push(newQuestion);

      await NotificationModel.create({
        userId: req.user?._id,
        title: "New Question Received",
        message: `New question added in ${courseContent?.title}`,
      })

      //save the course
      await course?.save();

      res.status(200).json({
        success: true,
        course,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

//add answer in course question.
interface IAddAnswerData {
  answer: string;
  courseId: string;
  contentId: string;
  questionId: string;
}

export const addAnswer = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { answer, courseId, contentId, questionId } =
        req.body as IAddAnswerData;
      const course = await CourseModel.findById(courseId);

      if (!mongoose.Types.ObjectId.isValid(contentId)) {
        return next(new ErrorHandler("Invalid content id", 404));
      }

      const courseContent = course?.courseData?.find((item: any) =>
        item._id.equals(contentId)
      );

      if (!courseContent) {
        return next(new ErrorHandler("Invalid content id", 404));
      }

      const question = courseContent?.questions?.find((item: any) =>
        item._id.equals(questionId)
      );

      if (!question) {
        return next(new ErrorHandler("Invalid question id", 404));
      }

      // create a new answer
      const newAnswer: any = {
        user: req.user,
        answer,
      };

      // add this answer to our question
      question?.questionReplies?.push(newAnswer) as any;

      await course?.save();

      if (req?.user?._id === question?.user?._id) {
        // create notification

        await NotificationModel.create({
          userId: req.user?._id,
          title: "New Question Reply Received",
          message: `New question reply added in ${courseContent?.title}`,
        })
        
      } else {
        const data = {
          name: question.user.name,
          title: courseContent.title,
        };

        const html = await ejs.renderFile(
          path.join(__dirname, "../emails/question-reply.ejs"),
          data
        );

        try {
          await sendMail({
            email: question.user.email,
            subject: "Reply to your question",
            template: "question-reply.ejs",
            data,
          });
        } catch (error: any) {
          return next(new ErrorHandler(error.message, 500));
        }
      }

/*             //save the course
            await course?.save(); */

      res.status(200).json({
        success: true,
        course,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);


// add review in the course 
interface IAddReviewData {
  review: string;
  rating: number;
  userId: string;


}

export const addReview = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userCourseList = req.user?.course;

    const courseId = req.params.id

    //check if courseId already exists in userCourseList based on Id

    //some method returns boolean. if any element is in the list it will return true
    const courseExists = userCourseList?.some((course:any) => course._id.toString() === courseId.toString())

    if(!courseExists){
      return next(new ErrorHandler("You are not enrolled in this course", 404))

    }
    const course = await CourseModel.findById(courseId)

    const {review, rating} = req.body as IAddReviewData;
    
    const reviewData:any = {
      user: req.user,
      comment : review,
      rating
    }

    course?.reviews?.push(reviewData);
     
    let avg = 0;

    course?.reviews?.forEach((rev:any)=> {
      avg += rev.rating; 
    })

    if(course && course.reviews){
      course.ratings = avg / course.reviews.length // example 2 review (5 + 3) / 2 = 4 ratings
    }

    

    await course?.save()

      const notification = {
        title : "New Review",
        message: `${req.user?.name} has added a review on your course ${course?.name}`,
      }

      res.status(200).json({
        success: true,
        course
      })

  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
})

// add reply in review
interface IAddReplyData{
  comment : string;
  courseId: string;
  reviewId: string;
}

export const addReplyToReview = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {comment, courseId, reviewId} = req.body as IAddReplyData;
    const course = await CourseModel.findById(courseId)

    if(!course){
      return next(new ErrorHandler("Course not found", 404))
    }

    const review = course?.reviews?.find((rev:any) => rev._id.toString() === reviewId)

    if(!review){
      return next(new ErrorHandler("Review not found", 404))
    }

    const replyData:any = {
      user: req.user,
      comment
    };
    if(!review?.commentReplies){
      review.commentReplies = []
    }

    review?.commentReplies?.push(replyData);

    await course?.save()

    res.status(200).json({
      success: true,
      course
    })

  } catch (error :any) {
    return next(new ErrorHandler(error.message, 500))
  }
    
  })