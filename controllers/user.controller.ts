import {Request, Response, NextFunction} from "express";
import UserModel, {IUser} from "../models/user.model";
import ErrorHandler from "../utils/ErrorHandler";
import jwt, { JwtPayload, Secret } from "jsonwebtoken";
import { catchAsyncError } from "../middleware/catchAsyncError";
require('dotenv').config();
import ejs from "ejs";
import path from "path";
import sendMail from "../utils/sendMail";
import { accessTokenOptions, refreshTokenOptions, sendToken } from "../utils/jwt";
import { redis } from "../utils/redis";
import { getAllUsersService, getUserById, updateUserRoleService } from "../services/user.service";
import cloudinary from "cloudinary";


//Register user
interface IRegistrationBody {
    name: string;
    email: string;
    password: string;
    avatar?: string
}


export const registrationUser = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {name, email, password} = req.body;
        const isEmailExist = await UserModel.findOne({email});
        if(isEmailExist){
            return next(new ErrorHandler("Email already exist", 400))
        }

        const user:IRegistrationBody = {
            name,
            email,
            password
        };
        const activationToken = createActivationToken(user);
        const activationCode = activationToken.activationCode;
        const data = {user: {name:user.name}, activationCode}
        const html = await ejs.renderFile(path.join(__dirname, "../emails/activation-email.ejs"), data)

        try {
            await sendMail({
                email: user.email,
                subject: "Activate your account",
                template: "activation-email.ejs",
                data
            })

            res.status(201).json({
                success: true,
                message: `Please check your email: ${user.email} and activate your account`,
                activationToken: activationToken.token
            })
        } catch (error:any) {
            return next(new ErrorHandler(error.message, 400));
        }

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
})


interface IActivationToken{
    token: string;
    activationCode: string;
}

export const createActivationToken = (user: any): IActivationToken => {
    const activationCode = Math.floor(1000 + Math.random() * 9000).toString();

    const token = jwt.sign(
        {
            user,activationCode
        },
        process.env.ACTIVATION_TOKEN_SECRET as Secret,
        {
            expiresIn: "5m",
        }
    );
    return {token, activationCode}
}

//activate user
interface IActivationRequest{
    activation_token: string;
    activation_code: string;
}

export const activateUser = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {activation_token, activation_code} = req.body as IActivationRequest;
        const newUser: {user: IUser; activationCode: string} = jwt.verify(
            activation_token,
            process.env.ACTIVATION_TOKEN_SECRET as string 
        ) as {user: IUser; activationCode: string};

        if(newUser.activationCode !== activation_code){
            return next(new ErrorHandler("Invalid activation code", 400));
        }

        const {name, email, password} = newUser.user;
        const existUser = await UserModel.findOne({email});

        if(existUser){
            return next(new ErrorHandler("User already exist", 400))
        }

        const user = await UserModel.create({
            name,
            email,
            password
        });

        res.status(201).json({
            success: true,
            message: "Account activated",
        })
        
    } catch (error:any) {
        return next(new ErrorHandler(error.message, 400));
    }
})


//Login user

interface ILoginRequest{
    email: string;
    password: string;
}

export const loginUser = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {email, password} = req.body as ILoginRequest;

        if(!email || !password){
            return next(new ErrorHandler("Please enter email and password", 400));
        };
        const user = await UserModel.findOne({email}).select("+password");

        if(!user){
            return next(new ErrorHandler("Invalid email or password", 400));
        };

        const isPasswordMatch = await user.comparePassword(password);
        if(!isPasswordMatch){
            return next(new ErrorHandler("Invalid email or password", 400));
        };

        sendToken(user, 200, res)


    } catch (error:any) {
        return next(new ErrorHandler(error.message, 400));
        
    }
})




//logout user
export const logoutUser = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {

        res.cookie("access_token", "", {maxAge: 1});
        res.cookie("refresh_token", "", {maxAge: 1});

        const userId = req.user?._id; 
        redis.del(userId);
        res.status(200).json({
            success: true,
            message: "Logged out successfully" 
        })
        
    } catch (error:any) {
        return next(new ErrorHandler(error.message, 400));
    }
})

// update access token 
export const updateAccessToken = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const refresh_token = req.cookies.refreshToken as string;
        const decoded = jwt.verify(refresh_token, process.env.REFRESH_TOKEN as string) as JwtPayload;
        const message = "Could not refresh token";
        if(!decoded){
            return next(new ErrorHandler(message, 400));
        }
        const session = await redis.get(decoded.id as string);

        if(!session){
            return next(new ErrorHandler(message, 400));
        }

        const user = JSON.parse(session);

        const accessToken = jwt.sign({id: user._id}, process.env.ACCESS_TOKEN as string, {
            expiresIn: "5m"
        })

        const refreshToken = jwt.sign({id: user._id}, process.env.REFRESH_TOKEN as string, {
            expiresIn: "3d"
        })

        req.user = user;

        res.cookie("accessToken", accessToken, accessTokenOptions as any);
        res.cookie("refreshToken", refreshToken, refreshTokenOptions as any);

        res.status(200).json({
            status:"success",
            accessToken 
        })
    } catch (error:any) {
        return next(new ErrorHandler(error.message, 400));
        
    }
})

//get user info 
export const getUserInfo = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?._id;
        getUserById(userId, res);
    } catch (error :any) {
        return next(new ErrorHandler(error.message, 400));
        
    }
})

// social auth
interface ISocialAuthBody{
    email: string;
    name: string;
    avatar: string;
}

export const socialAuth = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {email, name, avatar} = req.body as ISocialAuthBody;
        const user = await UserModel.findOne({email});
        //change the user idVerified to true
/*         if(user){
            user.isVerified = true;
            await user.save();
        } */
        if(!user){
            const newUser = await UserModel.create({email, name, avatar});
/*             newUser.isVerified = true;
            await newUser.save(); */
            sendToken(newUser, 200, res);
        }
        else {
            sendToken(user, 200, res)
        }
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
        
    }
})

//update user info
interface IUpdateUserInfo {
    name?: string;
    email?: string;

}

export const updateUserInfo = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
 try {
    const {name, email} = req.body as IUpdateUserInfo
    const userId = req.user?._id;
    const user = await UserModel.findById(userId);

    if(email && user){
        const isEmailExist = await UserModel.findOne({email});
        if(isEmailExist){
            return next(new ErrorHandler("Email already exists", 400));
        }

        user.email = email;
        await user.save();
        await redis.set(userId, JSON.stringify(user));

        }
    if(name && user){
        user.name = name;  
        await user.save();    
        await redis.set(userId, JSON.stringify(user));
    }

    res.status(200).json({
        success: true,
        user
    })
 } catch (error :any) {
    return next(new ErrorHandler(error.message, 400));
    
 }
})

//update user password 
interface IUpdatePassword {
    oldPassword: string;
    newPassword: string;
}

export const updatePassword = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {oldPassword, newPassword} = req.body as IUpdatePassword;

        if(!oldPassword || !newPassword){
            return next(new ErrorHandler("Please enter old and new password", 400));
        }
        const user = await UserModel.findById(req.user?._id).select("+password");

        if(user?.password === undefined ){
            return next(new ErrorHandler("Invalid User", 400));
        }
        const isPasswordMatch = await user?.comparePassword(oldPassword);
        if(!isPasswordMatch){
            return next(new ErrorHandler("Old password is incorrect", 400));
        }
        user.password = newPassword;

        await user.save();

        res.status(201).json({
            success: true,
            message: "Password updated successfully",
            user
        })


    } catch (error :any) {
        return next(new ErrorHandler(error.message, 400));
        
    }
})

//Update profile picture 

interface IUpdateProfilePicture {
    avatar: string;
}
export const updateProfilePicture = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {avatar} = req.body; 
        const userId = req.user?._id;
        const user = await UserModel.findById(userId);

        if(avatar && user){
            //if public_id is present, means that the user has already uploaded a profile picture and we need to delete it before uploading a new one
            if(user?.avatar?.public_id){
                await cloudinary.v2.uploader.destroy(user?.avatar?.public_id);

                const myCloud = await cloudinary.v2.uploader.upload(avatar, {folder: "avatars", width: 150});
                user.avatar = {
                    public_id: myCloud.public_id,
                    url: myCloud.secure_url
                }
            }  
                        
            else {
             const myCloud = await cloudinary.v2.uploader.upload(avatar, {folder: "avatars", width: 150});
             user.avatar = {
                 public_id: myCloud.public_id,
                 url: myCloud.secure_url
             }
            }
        }

        await user?.save();
        await redis.set(userId, JSON.stringify(user));
        res.status(200).json({
            success: true,
            user
        })

    } catch (error :any) {
        return next(new ErrorHandler(error.message, 400));
        
    }
})

//get all users - only for admin

export const getAllUsers = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        getAllUsersService(res)
    } catch (error : any) {
        return next(new ErrorHandler(error.message, 500));
        
    }
})


// update user role 
export const updateUserRole = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {id, role} = req.body;
        updateUserRoleService(res, id, role);
    } catch (error :any) {
        return next(new ErrorHandler(error.message, 500));
        
    }
})

//delete user -- only for admin 

export const deleteUser = catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {id} = req.params;
        const user = await UserModel.findById(id);

        if(!user){
            return next(new ErrorHandler("User not found", 404));
        }

        await user.deleteOne({id});

        await redis.del(id);

        res.status(200).json({
            success: true,
            message: "User deleted successfully"
        })
    } catch (error :any) {
        return next(new ErrorHandler(error.message, 500));
        
    }
})
