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