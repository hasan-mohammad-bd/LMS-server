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
            minlength: [6, "Password should be at least 6 characters long"],
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

const userModel: Model<IUser> = mongoose.model<IUser>("User", userSchema);

export default userModel; 
    



