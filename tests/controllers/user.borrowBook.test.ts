import { beforeEach, describe, expect, test, jest } from "@jest/globals";
import {
  installPrismaMock,
  prismaMock,
  resetPrismaMock,
} from "../mocks/prisma";
import { mockRequest, mockResponse } from "../helpers/http";

let scheduler = {
  scheduleReturnReminder: jest.fn(),
  scheduleRestock: jest.fn(),
  cancelReturnReminder: jest.fn(),
};

describe("user borrow book", () => {
  beforeEach(async () => {
    await installPrismaMock();

    resetPrismaMock();

    scheduler = {
      scheduleReturnReminder: jest.fn(),
      scheduleRestock: jest.fn(),
      cancelReturnReminder: jest.fn(),
    };

    jest.unstable_mockModule("../../src/service/scheduler.service", () => ({
      scheduleReturnReminder: scheduler.scheduleReturnReminder,
      scheduleRestock: scheduler.scheduleRestock,
      cancelReturnReminder: scheduler.cancelReturnReminder,
    }));
  });

  test("when x-user-email missing", async () => {
    // arrange
    const { borrowBook } = await import("../../src/controller/user.controller");

    const req = mockRequest({
      body: { bookId: 1 },
      headers: {},
    }) as any;

    const res = mockResponse() as any;

    // act
    await borrowBook(req, res);

    // assert
    expect(res.status).toHaveBeenCalledWith(400);

    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: {
        code: "BAD_REQUEST",
        message: "x-user-email header is required",
      },
    });
  });

  test("when bookId invalid", async () => {
    // arrange
    const { borrowBook } = await import("../../src/controller/user.controller");

    const req = mockRequest({
      headers: { "x-user-email": "john@example.com" },
      body: { bookId: -1 },
    }) as any;

    const res = mockResponse() as any;

    // act
    await borrowBook(req, res);

    // assert
    expect(res.status).toHaveBeenCalledWith(400);

    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: {
        code: "BAD_REQUEST",
        message: "Valid bookId positive integer is required",
      },
    });
  });

  test("when book not found", async () => {
    // arrange
    const { borrowBook } = await import("../../src/controller/user.controller");

    prismaMock.book.findUnique.mockResolvedValue(null);

    const req = mockRequest({
      headers: { "x-user-email": "john@example.com" },
      body: { bookId: 1 },
    }) as any;

    const res = mockResponse() as any;

    // act
    await borrowBook(req, res);

    // assert
    expect(prismaMock.book.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
    });

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: { code: "NOT_FOUND", message: "Book not found" },
    });
  });

  test("when no copies available", async () => {
    // arrange
    const { borrowBook } = await import("../../src/controller/user.controller");

    prismaMock.book.findUnique.mockResolvedValue({
      id: 1,
      copiesAvailable: 0,
      copiesSeeded: 3,
      borrowPrice: 10,
      sellPrice: 100,
      stockPrice: 50,
    });

    const req = mockRequest({
      headers: { "x-user-email": "john@example.com" },
      body: { bookId: 1 },
    }) as any;

    const res = mockResponse() as any;

    // act
    await borrowBook(req, res);

    // assert
    expect(res.status).toHaveBeenCalledWith(409);

    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: { code: "CONFLICT", message: "No copies available" },
    });
  });

  test("when already borrowed same book", async () => {
    // arrange
    const { borrowBook } = await import("../../src/controller/user.controller");

    prismaMock.book.findUnique.mockResolvedValue({
      id: 1,
      copiesAvailable: 5,
      copiesSeeded: 5,
      borrowPrice: 10,
      sellPrice: 100,
      stockPrice: 50,
    });

    prismaMock.user.upsert.mockResolvedValue({
      id: 99,
      email: "john@example.com",
    });

    prismaMock.borrow.count.mockResolvedValue(0);

    prismaMock.borrow.findFirst.mockResolvedValue({
      id: 123,
      status: "BORROWED",
    });

    const req = mockRequest({
      headers: { "x-user-email": "john@example.com" },
      body: { bookId: 1 },
    }) as any;

    const res = mockResponse() as any;

    // act
    await borrowBook(req, res);

    // assert
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: { code: "CONFLICT", message: "You already borrowed this book" },
    });
  });

  test("when borrow limit reached", async () => {
    // arrange
    const { borrowBook } = await import("../../src/controller/user.controller");

    prismaMock.book.findUnique.mockResolvedValue({
      id: 1,
      copiesAvailable: 5,
      copiesSeeded: 5,
      borrowPrice: 10,
      sellPrice: 100,
      stockPrice: 50,
    });

    prismaMock.user.upsert.mockResolvedValue({
      id: 99,
      email: "john@example.com",
    });

    prismaMock.borrow.count.mockResolvedValue(3);
    prismaMock.borrow.findFirst.mockResolvedValue(null);

    const req = mockRequest({
      headers: { "x-user-email": "john@example.com" },
      body: { bookId: 1 },
    }) as any;

    const res = mockResponse() as any;

    // act
    await borrowBook(req, res);

    // assert
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "Borrow limit reached max 3 active",
      },
    });
  });

  test("happy path creates borrow, BORROW action, wallet credit, schedules reminder; triggers low stock restock flow", async () => {
    // arrange
    const { borrowBook } = await import("../../src/controller/user.controller");

    // initial book has 2 copies after decrement becomes 1
    prismaMock.book.findUnique.mockResolvedValue({
      id: 7,
      title: "Alpha",
      copiesAvailable: 2,
      copiesSeeded: 5,
      borrowPrice: 10,
      sellPrice: 100,
      stockPrice: 50,
    });

    prismaMock.user.upsert.mockResolvedValue({
      id: 200,
      email: "john@example.com",
    });
    prismaMock.borrow.count.mockResolvedValue(0);
    prismaMock.borrow.findFirst.mockResolvedValue(null);

    // inside $transaction
    prismaMock.book.update.mockResolvedValue({
      id: 7,
      copiesAvailable: 1,
    });

    // return borrow row with id so controller can schedule reminder
    prismaMock.borrow.create.mockResolvedValue({
      id: 777,
      userId: 200,
      bookId: 7,
      quantity: 1,
      borrowedAt: new Date(),
      dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      status: "BORROWED",
      priceAtBorrow: 10,
    });

    prismaMock.bookAction.create.mockResolvedValue({ id: 1 });
    prismaMock.wallet.update.mockResolvedValue({ id: 1, balance: 10 });
    prismaMock.walletMovement.create.mockResolvedValue({ id: 5 });

    const req = mockRequest({
      headers: { "x-user-email": "john@example.com" },
      body: { bookId: 7 },
    }) as any;
    const res = mockResponse() as any;

    // act
    await borrowBook(req, res);

    // assert
    // response basics
    expect(res.status).not.toHaveBeenCalled();
    const body = res.body;
    expect(body.ok).toBe(true);
    expect(body.data.borrowId).toBe(777);
    expect(body.data.copiesAvailable).toBe(1);
    expect(typeof body.data.dueAt).toBe("string");

    expect(prismaMock.bookAction.create).toHaveBeenCalled();
    const calls = prismaMock.bookAction.create.mock.calls;

    const types = calls.map((c) => c[0].data.type).sort();
    expect(types).toEqual(["BORROW", "RESTOCK_REQUESTED"]);

    expect(prismaMock.wallet.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { balance: { increment: 10 } },
    });

    expect(prismaMock.walletMovement.create).toHaveBeenCalled();

    expect(scheduler.scheduleReturnReminder).toHaveBeenCalledTimes(1);

    const [borrowIdArg, emailArg, bookIdArg, whenArg] = scheduler
      .scheduleReturnReminder.mock.calls[0] as [number, string, number, Date];

    expect(borrowIdArg).toBe(777);
    expect(emailArg).toBe("john@example.com");
    expect(bookIdArg).toBe(7);

    expect(new Date(body.data.dueAt).getTime()).toBe(
      new Date(whenArg).getTime()
    );

    expect(scheduler.scheduleRestock).toHaveBeenCalledWith(7, 60 * 60 * 1000);
  });
  
});
