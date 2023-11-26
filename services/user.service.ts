import { Response } from "express";
import UserModel from "../models/user.model"
import { redis } from "../utils/redis";


//get users by Id

export const getUserById = async (id: string, res: Response) => {
    const userJson = await redis.get(id)

    if(userJson){
        const user = JSON.parse(userJson);
        res.status(201).json({
            success: true, 
            user
        })
    }

}

//get all users

export const getAllUsersService = async (res: Response) => {
    const users = await UserModel.find().sort({createdAt: -1});
    res.status(201).json({
        success: true,
        users
    })
}

//update user role 
export const updateUserRoleService = async (res: Response, id: string, role: string) => {
    const user = await UserModel.findByIdAndUpdate(id, {role}, {new: true}); //here we are updating the role of the user with the given id 
    if(user){ 
        user.role = role;
        await user.save();
        res.status(201).json({
            success: true,
            user
        })
    }}