import { Request, Response, NextFunction } from "express";
import { catchAsyncError } from "./catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import jwt, { JwtPayload } from "jsonwebtoken";
import { redis } from "../utils/redis";
import { IUser } from "../models/user.model";


interface IAuthenticatedRequest extends Request {
  user?: IUser;
}

//authenticated user
export const isAuthenticated = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {

    
  const access_token = req.cookies.accessToken as string;


    if (!access_token) {
      return next(new ErrorHandler("Please login to access this resource", 400)
      );
    }

    const decoded = jwt.verify(access_token, process.env.ACCESS_TOKEN as string) as JwtPayload;

    if (!decoded) {
      return next(new ErrorHandler("Access token is invalid", 400));
    }

    const user = await redis.get(decoded.id);

    if (!user) {
      return next(new ErrorHandler("User not found", 400));
    }

    const reqWithUser = req as IAuthenticatedRequest;
    reqWithUser.user = JSON.parse(user);
    console.log(reqWithUser.user, "hello bor");
    
    next(); 
  }
);
