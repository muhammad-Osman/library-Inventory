import express from "express";
import { healthCheck } from "../controller/book.controller";
import { adminRoutes } from "./admin.routes";
import { userRoutes } from "./user.routes";

const router = express.Router();

router.use("/admin", adminRoutes);
router.use("/user", userRoutes);
router.get("/books", healthCheck);

export const bookRoutes = router;
