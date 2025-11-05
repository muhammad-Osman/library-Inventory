import express from "express";
import { borrowBook, buyBook, returnBook } from "../controller/user.controller";

const router = express.Router();

router.post("/borrow", borrowBook);
router.post("/return", returnBook);
router.post("/buy", buyBook);

export const userRoutes = router;
