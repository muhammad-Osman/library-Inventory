import type { Request, Response } from "express";
import { prisma } from "../db/prisma";
import { BookActionType, BorrowStatus } from "@prisma/client";
import { USER_EMAIL_HEADER } from "../utils/constants";

type BorrowBody = { bookId?: number };
type ReturnBody = { bookId?: number };
type BuyBody = { bookId?: number; quantity?: number };

const DAY_MS = 24 * 60 * 60 * 1000;
const BORROW_DURATION_DAYS = 3;
const RESTOCK_DELAY_MS = 60 * 60 * 1000;

function getUserEmail(req: Request<any, any, any, any, any>): string {
  return (req.header(USER_EMAIL_HEADER) || "").trim().toLowerCase();
}

export const borrowBook = async (
  req: Request<unknown, unknown, BorrowBody>,
  res: Response
) => {
  try {
    const email = getUserEmail(req);
    if (!email)
      return res
        .status(400)
        .json({
          ok: false,
          error: {
            code: "BAD_REQUEST",
            message: "x-user-email header is required",
          },
        });

    const { bookId } = req.body ?? {};

    if (!Number.isInteger(bookId) || (bookId as number) <= 0) {
      return res
        .status(400)
        .json({
          ok: false,
          error: {
            code: "BAD_REQUEST",
            message: "Valid bookId positive integer is required",
          },
        });
    }

    const book = await prisma.book.findUnique({
      where: { id: bookId as number },
    });

    if (!book)
      return res
        .status(404)
        .json({
          ok: false,
          error: { code: "NOT_FOUND", message: "Book not found" },
        });

    if (book.copiesAvailable <= 0) {
      return res
        .status(409)
        .json({
          ok: false,
          error: { code: "CONFLICT", message: "No copies available" },
        });
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email },
    });

    const [activeCount, sameBookActive] = await Promise.all([
      prisma.borrow.count({
        where: { userId: user.id, status: BorrowStatus.BORROWED },
      }),
      prisma.borrow.findFirst({
        where: {
          userId: user.id,
          bookId: book.id,
          status: BorrowStatus.BORROWED,
        },
      }),
    ]);

    if (sameBookActive)
      return res
        .status(409)
        .json({
          ok: false,
          error: {
            code: "CONFLICT",
            message: "You already borrowed this book",
          },
        });

    if (activeCount >= 3)
      return res
        .status(409)
        .json({
          ok: false,
          error: {
            code: "CONFLICT",
            message: "Borrow limit reached max 3 active",
          },
        });

    const now = new Date();
    const dueAt = new Date(now.getTime() + BORROW_DURATION_DAYS * DAY_MS);

    let localBorrowId: number | null = null;
    let localCopiesAfter = book.copiesAvailable;
    let localBecameOne = false;

    const updated = await prisma.book.update({
      where: { id: book.id },
      data: { copiesAvailable: { decrement: 1 } },
    });

    const borrow = await prisma.borrow.create({
      data: {
        userId: user.id,
        bookId: book.id,
        quantity: 1,
        borrowedAt: now,
        dueAt,
        status: BorrowStatus.BORROWED,
        priceAtBorrow: book.borrowPrice,
      },
    });

    await prisma.bookAction.create({
      data: {
        type: BookActionType.BORROW,
        bookId: book.id,
        userId: user.id,
        quantity: 1,
        pricePerUnit: book.borrowPrice,
        total: book.borrowPrice,
        dueAt,
      },
    });

    await prisma.wallet.update({
      where: { id: 1 },
      data: { balance: { increment: Number(book.borrowPrice) } },
    });

    await prisma.walletMovement.create({
      data: {
        type: "BORROW_REVENUE",
        direction: "CREDIT",
        amount: Number(book.borrowPrice),
        userId: user.id,
        bookId: book.id,
        note: "Borrow fee",
      } as any,
    });

    localCopiesAfter = updated.copiesAvailable;
    localBecameOne = updated.copiesAvailable === 1;
    localBorrowId = borrow.id;

    const borrowId = localBorrowId;

    if (borrowId) {
      const { scheduleReturnReminder } = await import(
        "../service/scheduler.service"
      );
      scheduleReturnReminder(borrowId, email, book.id, dueAt);
    }

    const becameOne = localBecameOne;
    if (becameOne) {
      await prisma.bookAction.create({
        data: {
          type: BookActionType.RESTOCK_REQUESTED,
          bookId: book.id,
          meta: {
            requestedAt: new Date().toISOString(),
            reason: "Low stock reached 1",
          },
        },
      });
      console.log(
        `[supply@library.com] Please restock bookId=${book.id} to ${book.copiesSeeded} copies.`
      );
      const { scheduleRestock } = await import("../service/scheduler.service");
      scheduleRestock(book.id, RESTOCK_DELAY_MS);
    }

    return res.json({
      ok: true,
      data: {
        borrowId,
        dueAt: dueAt.toISOString(),
        copiesAvailable: localCopiesAfter as number,
      },
    });
  } catch (e) {
    console.error("borrowBook failed:", e);
    return res
      .status(500)
      .json({
        ok: false,
        error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
      });
  }
};

export const returnBook = async (
  req: Request<unknown, unknown, ReturnBody>,
  res: Response
) => {
  try {
    const email = getUserEmail(req);
    if (!email)
      return res
        .status(400)
        .json({
          ok: false,
          error: {
            code: "BAD_REQUEST",
            message: "x-user-email header is required",
          },
        });

    const { bookId } = req.body ?? {};
    if (!Number.isInteger(bookId) || (bookId as number) <= 0) {
      return res
        .status(400)
        .json({
          ok: false,
          error: { code: "BAD_REQUEST", message: "Valid bookId is required" },
        });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)
      return res
        .status(404)
        .json({
          ok: false,
          error: { code: "NOT_FOUND", message: "User not found" },
        });

    const activeBorrow = await prisma.borrow.findFirst({
      where: {
        userId: user.id,
        bookId: bookId as number,
        status: BorrowStatus.BORROWED,
      },
    });
    if (!activeBorrow) {
      return res
        .status(409)
        .json({
          ok: false,
          error: {
            code: "CONFLICT",
            message: "No active borrow found for this book",
          },
        });
    }

    const now = new Date();

    await prisma.borrow.update({
      where: { id: activeBorrow.id },
      data: { status: BorrowStatus.RETURNED, returnedAt: now },
    });

    const updatedBook = await prisma.book.update({
      where: { id: activeBorrow.bookId },
      data: { copiesAvailable: { increment: 1 } },
    });

    await prisma.bookAction.create({
      data: {
        type: BookActionType.RETURN,
        bookId: activeBorrow.bookId,
        userId: user.id,
        quantity: 1,
        dueAt: activeBorrow.dueAt,
        meta: { borrowId: activeBorrow.id },
      },
    });

    const copiesAfter = updatedBook.copiesAvailable;

    {
      const { cancelReturnReminder } = await import(
        "../service/scheduler.service"
      );
      cancelReturnReminder(activeBorrow.id);
    }

    return res.json({
      ok: true,
      data: {
        returnedAt: now.toISOString(),
        copiesAvailable: copiesAfter,
      },
    });
  } catch (e) {
    console.error("returnBook failed:", e);
    return res
      .status(500)
      .json({
        ok: false,
        error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
      });
  }
};

export const buyBook = async (
  req: Request<unknown, unknown, BuyBody>,
  res: Response
) => {
  try {
    const email = getUserEmail(req);

    if (!email)
      return res
        .status(400)
        .json({
          ok: false,
          error: {
            code: "BAD_REQUEST",
            message: "x-user-email header is required",
          },
        });

    const { bookId, quantity } = req.body ?? {};

    const qty = Number(quantity ?? 1);

    if (!Number.isInteger(bookId) || (bookId as number) <= 0) {
      return res
        .status(400)
        .json({
          ok: false,
          error: { code: "BAD_REQUEST", message: "Valid bookId is required" },
        });
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      return res
        .status(400)
        .json({
          ok: false,
          error: {
            code: "BAD_REQUEST",
            message: "quantity must be a positive integer",
          },
        });
    }

    const book = await prisma.book.findUnique({
      where: { id: bookId as number },
    });

    if (!book)
      return res
        .status(404)
        .json({
          ok: false,
          error: { code: "NOT_FOUND", message: "Book not found" },
        });
    
    if (book.copiesAvailable < qty) {
      return res
        .status(409)
        .json({
          ok: false,
          error: { code: "CONFLICT", message: "Not enough copies available" },
        });
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email },
    });

    const [sameBookAgg, totalAgg] = await Promise.all([
      prisma.bookAction.aggregate({
        _sum: { quantity: true },
        where: { type: "BUY", userId: user.id, bookId: book.id },
      }),

      prisma.bookAction.aggregate({
        _sum: { quantity: true },
        where: { type: "BUY", userId: user.id },
      }),
    ]);

    const sameBefore = sameBookAgg._sum.quantity ?? 0;
    const totalBefore = totalAgg._sum.quantity ?? 0;

    if (sameBefore + qty > 2) {
      return res
        .status(409)
        .json({
          ok: false,
          error: {
            code: "CONFLICT",
            message: "Limit: max 2 copies per same book",
          },
        });
    }
    if (totalBefore + qty > 10) {
      return res
        .status(409)
        .json({
          ok: false,
          error: {
            code: "CONFLICT",
            message: "Limit: max 10 copies across all books",
          },
        });
    }

    const totalCost = Number(book.sellPrice) * qty;

    const updated2 = await prisma.book.update({
      where: { id: book.id },
      data: { copiesAvailable: { decrement: qty } },
    });

    await prisma.bookAction.create({
      data: {
        type: BookActionType.BUY,
        bookId: book.id,
        userId: user.id,
        quantity: qty,
        pricePerUnit: book.sellPrice,
        total: totalCost,
      },
    });

    await prisma.wallet.update({
      where: { id: 1 },
      data: { balance: { increment: totalCost } },
    });

    await prisma.walletMovement.create({
      data: {
        type: "SELL_REVENUE",
        direction: "CREDIT",
        amount: totalCost,
        userId: user.id,
        bookId: book.id,
        note: `Sold ${qty} copies`,
      } as any,
    });

    const becameOne2 = updated2.copiesAvailable === 1;

    if (becameOne2) {
      await prisma.bookAction.create({
        data: {
          type: BookActionType.RESTOCK_REQUESTED,
          bookId: book.id,
          meta: {
            requestedAt: new Date().toISOString(),
            reason: "Low stock reached 1",
          },
        },
      });


      console.log(
        `[supply@library.com] Please restock bookId=${book.id} to ${book.copiesSeeded} copies.`
      );

      const { scheduleRestock } = await import("../service/scheduler.service");
      
      scheduleRestock(book.id, RESTOCK_DELAY_MS);
    }

    return res.json({
      ok: true,
      data: {
        quantity: qty,
        total: totalCost,
        copiesAvailable: updated2.copiesAvailable,
      },
    });
  } catch (e) {
    console.error("buyBook failed:", e);
    return res
      .status(500)
      .json({
        ok: false,
        error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
      });
  }
};
