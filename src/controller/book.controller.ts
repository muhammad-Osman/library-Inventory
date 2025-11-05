import { Request, Response, NextFunction } from "express";


export const healthCheck = (req: Request, res: Response, next: NextFunction) => {
    try{
        res.json("working");
    } catch(e) {
        next();
    }
}
