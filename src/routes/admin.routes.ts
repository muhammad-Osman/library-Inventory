import express from "express";
import {
  getBookActions,
  getUserBooks,
  getUsers,
  getWallet,
  getWalletMovements,
  searchBooks,
} from "../controller/admin.controller";

const router = express.Router();

router.get("/books/search", searchBooks);
router.get("/books/:bookId/actions", getBookActions);
router.get("/wallet", getWallet);
router.get("/wallet/movements", getWalletMovements);
router.get('/users/:email/books', getUserBooks);
router.get("/user/all", getUsers);

export const adminRoutes = router;
