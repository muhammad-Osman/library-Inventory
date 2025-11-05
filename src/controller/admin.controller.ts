import { Request, Response } from "express";
import {
  BookActionType,
  Prisma,
  TagKind,
  WalletMovementType,
} from "@prisma/client";
import { BookListItem } from "../types/book";
import { prisma } from "../db/prisma";
import { BookActionItem, Paginated } from "../types/admin";
import { WalletMovementItem, WalletSummary } from "../types/wallet";

export const searchBooks = async (req: Request, res: Response) => {
  try {
    const qRaw = (req.query.q as string | undefined)?.trim();
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(
      100,
      Math.max(1, Number(req.query.pageSize ?? 20))
    );
    const skip = (page - 1) * pageSize;

    let where: Prisma.BookWhereInput = {};
    
    if (qRaw) {
      const titleFilter = {
        contains: qRaw,
        mode: Prisma.QueryMode.insensitive,
      } satisfies Prisma.StringFilter<"Book">;

      const tagNameFilter = {
        contains: qRaw,
        mode: Prisma.QueryMode.insensitive,
      } satisfies Prisma.StringFilter<"Tag">;

      where = {
        OR: [
          { title: titleFilter },
          {
            bookTags: {
              some: {
                tag: {
                  kind: TagKind.AUTHOR,
                  name: tagNameFilter,
                },
              },
            },
          },
          {
            bookTags: {
              some: {
                tag: {
                  kind: TagKind.GENRE,
                  name: tagNameFilter,
                },
              },
            },
          },
        ],
      };
    }

    const [items, total] = await Promise.all([
      prisma.book.findMany({
        where,
        include: { bookTags: { include: { tag: true } } },
        orderBy: { title: "asc" },
        skip,
        take: pageSize,
      }),
      prisma.book.count({ where }),
    ]);

    const data: BookListItem[] = items.map(toBookListItem);

    res.json({
      ok: true,
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        q: qRaw ?? null,
      },
    });
  } catch (e: any) {
    console.error("searchBooks failed:", e);
    res.status(500).json({
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong",
        details: e.message,
      },
    });
  }
};

export const getBookActions = async (req: Request, res: Response) => {
  try {
    const bookId = Number(req.params.bookId);
    
    if (!Number.isFinite(bookId) || bookId <= 0) {
      return res.status(400).json({
        ok: false,
        error: { code: "BAD_REQUEST", message: "Invalid bookId" },
      });
    }

    const page = Math.max(1, Number(req.query.page ?? 1));
    
    const pageSize = Math.min(
      100,
      Math.max(1, Number(req.query.pageSize ?? 20))
    );
    const skip = (page - 1) * pageSize;

    const typeParam = (req.query.type as string | undefined)?.trim();
    
    const types = typeParam
      ? typeParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .filter((t): t is BookActionType =>
            [
              "BORROW",
              "RETURN",
              "BUY",
              "RESTOCK_REQUESTED",
              "RESTOCKED",
              "REMINDER_SENT",
            ].includes(t)
          )
      : undefined;

    const userEmail = (req.query.userEmail as string | undefined)?.trim();
    const fromStr = (req.query.from as string | undefined)?.trim();
    const toStr = (req.query.to as string | undefined)?.trim();
    const from = fromStr ? new Date(fromStr) : undefined;
    const to = toStr ? new Date(toStr) : undefined;

    const where: Prisma.BookActionWhereInput = {
      bookId,
      ...(types && types.length ? { type: { in: types } } : {}),
      ...(userEmail
        ? {
            user: {
              is: { email: { contains: userEmail, mode: "insensitive" } },
            },
          }
        : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };

    type Row = Prisma.BookActionGetPayload<{ include: { user: true } }>;

    const [rows, total] = await Promise.all([
      prisma.bookAction.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }) as Promise<Row[]>,
      prisma.bookAction.count({ where }),
    ]);

    const items: BookActionItem[] = rows.map(toBookActionItem);

    const payload: Paginated<BookActionItem> = {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };

    return res.json({ ok: true, data: payload });
  } catch (e) {
    console.error("getBookActions failed:", e);
    return res.status(500).json({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
    });
  }
};

export const getWallet = async (_req: Request, res: Response) => {
  try {
    const w = await prisma.wallet.findUnique({ where: { id: 1 } });
    
    if (!w)
      return res.status(404).json({
        ok: false,
        error: { code: "NOT_FOUND", message: "Wallet not found" },
      });

    const data: WalletSummary = {
      balance: Number(w.balance),
      milestoneNotifiedAt: w.milestoneNotifiedAt
        ? w.milestoneNotifiedAt.toISOString()
        : null,
    };
    
    return res.json({ ok: true, data });
  } catch (e) {
    console.error("getWallet failed:", e);
    return res.status(500).json({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
    });
  }
};

export const getWalletMovements = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
   
    const pageSize = Math.min(
      100,
      Math.max(1, Number(req.query.pageSize ?? 20))
    );
    const skip = (page - 1) * pageSize;

    const typeParam = (req.query.type as string | undefined)?.trim();
    
    const types = typeParam
      ? typeParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .filter((t): t is WalletMovementType =>
            [
              "SELL_REVENUE",
              "BORROW_REVENUE",
              "STOCK_PURCHASE",
              "RESTOCK_COST",
              "ADJUSTMENT",
            ].includes(t)
          )
      : undefined;

    const fromStr = (req.query.from as string | undefined)?.trim();
    const toStr = (req.query.to as string | undefined)?.trim();
    const from = fromStr ? new Date(fromStr) : undefined;
    const to = toStr ? new Date(toStr) : undefined;

    const where: Prisma.WalletMovementWhereInput = {
      ...(types && types.length ? { type: { in: types } } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.walletMovement.findMany({
        where,
        include: { book: true, user: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.walletMovement.count({ where }),
    ]);

    const items: WalletMovementItem[] = rows.map((m) => ({
      id: m.id,
      type: m.type,
      direction: m.direction,
      amount: Number(m.amount),
      note: m.note ?? null,
      createdAt: m.createdAt.toISOString(),
      book: m.book ? { id: m.book.id, title: m.book.title } : null,
      userEmail: m.user?.email ?? null,
    }));

    return res.json({
      ok: true,
      data: {
        items,
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (e) {
    console.error("getWalletMovements failed:", e);
    return res.status(500).json({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
    });
  }
};

export const getUserBooks = async (req: Request, res: Response) => {
  try {
    const email = decodeURIComponent(String(req.params.email || ""))
      .trim()
      .toLowerCase();
    
    if (!email) {
      return res
        .status(400)
        .json({
          ok: false,
          error: { code: "BAD_REQUEST", message: "Email is required in path" },
        });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user)
      return res.json({ ok: true, data: { borrowed: [], bought: [] } });

    const borrows = await prisma.borrow.findMany({
      where: { userId: user.id },
      include: { book: true },
      orderBy: { borrowedAt: "desc" },
    });

    borrows.sort(
      (a: any, b: any) => a.borrowedAt.getTime() - b.borrowedAt.getTime()
    );

    const grouped = await prisma.bookAction.groupBy({
      by: ["bookId"],
      where: { userId: user.id, type: "BUY" },
      _sum: { quantity: true, total: true },
      _max: { createdAt: true },
    });

    const bookIds = grouped
      .map((g) => g.bookId)
      .filter((id): id is number => id !== null);
    
      
    const books = bookIds.length
      ? await prisma.book.findMany({ where: { id: { in: bookIds } } })
      : [];

    const bookMap = new Map(books.map((b) => [b.id, b]));

    const bought = grouped.map((g) => {
      const b = g.bookId ? bookMap.get(g.bookId) : null;
      return {
        book: b ? { id: b.id, title: b.title } : null,
        quantity: g._sum.quantity ?? 0,
        total: Number(g._sum.total ?? 0),
        lastPurchasedAt: g._max.createdAt?.toISOString() ?? null,
      };
    });

    const borrowedOut = borrows.map((r) => ({
      book: { id: r.book.id, title: r.book.title },
      status: r.status,
      borrowedAt: r.borrowedAt.toISOString(),
      dueAt: r.dueAt.toISOString(),
      returnedAt: r.returnedAt ? r.returnedAt.toISOString() : null,
    }));

    return res.json({
      ok: true,
      data: {
        borrowed: borrowedOut,
        bought,
      },
    });
  } catch (e) {
    console.error("getUserBooks failed:", e);
    return res
      .status(500)
      .json({
        ok: false,
        error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
      });
  }
};

export const getUsers = async (req: Request, res: Response) => {
  try {
    const userList = await prisma.user.findMany();

    return res.json({
      ok: true,
      data: userList,
    });
  } catch (e) {
    console.error("getUserBooks failed:", e);
    return res
      .status(500)
      .json({
        ok: false,
        error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
      });
  }
};

function toBookActionItem(
  r: Prisma.BookActionGetPayload<{ include: { user: true } }>
): BookActionItem {
  return {
    id: r.id,
    bookId: r.bookId,
    type: r.type as BookActionItem["type"],
    quantity: r.quantity,
    pricePerUnit: r.pricePerUnit ? Number(r.pricePerUnit) : null,
    total: r.total ? Number(r.total) : null,
    dueAt: r.dueAt ? r.dueAt.toISOString() : null,
    meta: r.meta ?? null,
    createdAt: r.createdAt.toISOString(),
    userEmail: r.user?.email ?? null,
  };
}

function toBookListItem(b: any): BookListItem {
  const authors = b.bookTags
    .filter((bt: any) => bt.tag.kind === "AUTHOR")
    .sort((a: any, z: any) => (a.tagOrder ?? 0) - (z.tagOrder ?? 0))
    .map((bt: any) => bt.tag.name);

  const genres = b.bookTags
    .filter((bt: any) => bt.tag.kind === "GENRE")
    .map((bt: any) => bt.tag.name);

  return {
    id: b.id,
    isbn: b.isbn,
    title: b.title,
    year: b.year,
    pages: b.pages,
    publisher: b.publisher,
    prices: {
      sell: Number(b.sellPrice),
      stock: Number(b.stockPrice),
      borrow: Number(b.borrowPrice),
    },
    copiesSeeded: b.copiesSeeded,
    copiesAvailable: b.copiesAvailable,
    authors,
    genres,
  };
}
