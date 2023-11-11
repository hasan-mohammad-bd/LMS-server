@types/node -D = allows to write export/import in modular way.
ts-node = compile the ts node into js code automatically.

step 1 : npm init (write the all necessary staff )
step 2 : npm i bcryptjs cookie-parser cors dotenv express ioredis jsonwebtoken mongoose ts-node-dev @types/bcrv @types/bcryptjs @types/cookie-parser @types/cors @types/express @types/jsonwebtoken @types/node typescript

     * also run the commend : npx tsc --init
     
step 3 : create app.ts and write the below commend 
                -------------------------------------
                require('dotenv').config();

                import express, { NextFunction, Request, Response } from "express";

                export const app = express();
                import cors from "cors";
                import cookieParser from "cookie-parser"

                //body parser
                app.use(express.json({limit: "50md"}));

                //cookie parser
                app.use(cookieParser());

                //cors => coss origin resource sharing
                app.use(
                    cors({
                        origin: process.env.ORIGIN,
                    })
                );

                //testing api

                app.get("/test", (req: Request, res: Response, next: NextFunction)=> {
                    res.status(200).json({
                        success: true,
                        message: "API is working"
                    })
                })

                //unknown router

                app.all("*", (req: Request, res: Response, next: NextFunction)=> {
                    const err = new Error(`Route ${req.originalUrl} not found`) as any;
                    err.statusCode = 404;
                    next(err)
                });
                -------------------------------------

step 4 : create server.ts and write the blow code 



                -------------------------------------
                import { app } from "./app";

                require('dotenv').config();

                //create server
                app.listen(process.env.PORT, ()=>{
                    console.log(`this server is running at port ${process.env.PORT}`);
                    
                })
                ----------------------------------------


step 5 : create .env file and write below code 

                -----------------------------------------
                PORT=8000
                ORIGIN=http://localhost:3000
                -----------------------------------------


step 6 : in package.json file, write blow script code:

                -------------------------------------------
                "scripts": {
                    "dev": "tsnd --respawn server.ts" 
                },
                -------------------------------------------

step 7 : npm run dev to start the project. 

step 8 : connect with database/redis

    a. go to mongodb and create a database , copy the url and paste it to .env file 
    b. create utils file > db.ts . and write below code to the file.  


    -----------------------------------------------------

            import mongoose from "mongoose";
            require('dotenv').config();

            const dbUrl : string = process.env.DB_URL || '';


            const connectDB = async () => {
                try {
                    await mongoose.connect(dbUrl).then((data : any) => {
                        console.log("database connected ");
                        
                    })
                } catch (error: any) {
                    console.log(error.message);
                    setTimeout(connectDB, 5000)
                    
                }
            }

            export default connectDB;
        --------------------------------------------------------

    c. go to cloudinary.com & upstash.com and create an account there and copy below key/api to .env file

        ----------------------------

        CLOUD_NAME=dpwbmgidi
        CLOUD_API_KEY=598779226541326
        CLOUD_SECRET_KEY=kwmaEQNSFa2RKOT2qbpe5SWMOjk
        //from cloudinary.com 

        REDIS_URL=rediss://default:38eff60fb4ff45d09730d4b1374b829a@apn1-enormous-yak-33948.upstash.io:33948
        //from upstash.com

    

        -----------------------------

    d . create a redis.ts file in utils and write below code 

        ----------------------------------

        import {Redis} from "ioredis";
        require('dotenv').config();

        const redisClient = () => {
            if(process.env.REDIS_URL){
                console.log(`Redis connected`);
                return process.env.REDIS_URL;
                
            }
            throw new Error('Redis connecting failed')
        }

        export const redis = new Redis(redisClient());

        --------------------------------------------------

step 9 : Error Handling > create a ErrorHandler.ts file in utils folder. and write below code
  
        ----------------------------------------------------------
        class ErrorHandler extends Error {

        statusCode: Number;
        constructor(message: any, statusCode: Number) {
            super(message);
            this.statusCode = statusCode;
            Error.captureStackTrace(this, this.constructor);
        }
        }

        export default ErrorHandler
        ----------------------------------------------------------------
step 10 : create a middleWare folder > error.ts file and write blow code 

        --------------------------------------------------------------

                
        import { NextFunction, Request, Response } from "express";
        import ErrorHandler from "../utils/ErrorHandler";


        export const ErrorMiddleware = (err:any, req:Request, res:Response, next:NextFunction ) => {
            err.statusCode = err.statusCode || 500;
            err.message = err.message || `Internal server error`;

            //wrong mongodb id error
            if(err.name === "CastError"){
                const message = `Resource not found. Invalid: ${err.path}`;
                err = new ErrorHandler(message, 400);
            }

            //Duplicate key error
            if(err.code === 11000){
                const message = `Duplicate ${Object.keys(err.keyValue)} entered`;
                err = new ErrorHandler(message, 400)
            }

            //wrong jwt token 
            if(err.name === "JsonWebTokenError"){
                const message = `Json web token is invalid, try again later`;
                err = new ErrorHandler(message, 400)
            }

            //jwt expired error

            if(err.name === 'TokenExpiredError'){
                const message = `Json web token is expired, try agin later`;
                err = new ErrorHandler(message, 400);
            }

            res.status(err.statusCode).json({
                success:false,
                message: err.message
            })
        }
        ------------------------------------------------

step 11 : also create catchAsyncError.ts file in middleware folder. and write below code.

        ------------------------------------------------
        import { NextFunction, Request, Response } from "express";

        export const catchAsyncError = (theFunc: any) => (req:Request, res:Response, next:NextFunction) => {
            Promise.resolve(theFunc(req, res, next)).catch(next)
        }

        ------------------------------------------------

step 13 : create a models folder > user.model.ts to write schema 

        ------------------------------------------------

            import mongoose, {Document, Model, Schema} from "mongoose";
            import bcrypt from "bcryptjs";

            //learn
            const emailRegexPattern: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

            export interface IUser extends Document{
                name: string;
                email: string;
                password: string;
                avatar: {
                    public_id: string;
                    url: string;
                },
                role: string;
                isVerified: boolean;
                course: Array<{courseId: string}>
                comparePassword: (password: string) => Promise<boolean>;
            }
            //write me this schema
            const userSchema: Schema<IUser> = new mongoose.Schema({
                    name:{
                        type: String, 
                        required: [true, "Please enter your name"],
                    },
                    email:{
                        type: String,
                        required: [true, "Please enter your email"],
                        validate: {
                            validator: (value:string) => {
                                return emailRegexPattern.test(value)
                            },
                            message: "Please enter a valid email"
                        },
                        unique: true
                    },
                    password: {
                        type: String,
                        required: [true, "Please enter your password"],
                        minlength: [6, "Password should be atleast 6 characters long"],
                        select: false,

                    },
                    avatar: {
                        public_id: String,
                        url: String
                    },
                    role: {
                        type: String,
                        default: "user"
                    },
                    isVerified: {
                        type: Boolean,
                        default: false
                    },
                    course: [
                        {
                            courseId:String,
                        }
                    ]

            }, {timestamps: true});

            //Hash password before saving it to the database
            userSchema.pre<IUser>("save", async function(next){
                if(!this.isModified("password")){
                    next();
                }
                this.password = await bcrypt.hash(this.password, 10);
                next();
            })

            //Compare password 
            userSchema.methods.comparePassword = async function(enteredPassword: string): Promise<boolean>{
                return await bcrypt.compare(enteredPassword, this.password);
            }

            const UserModel: Model<IUser> = mongoose.model<IUser>("User", userSchema);

            export default UserModel;

            ------------------------------------------------------------------
    






