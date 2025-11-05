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

describe("user controller returnBook", () => {
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
    const { returnBook } = await import("../../src/controller/user.controller");
    const req = mockRequest({ body: { bookId: 1 } }) as any;
    const res = mockResponse() as any;

    // act
    await returnBook(req, res);

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
    const { returnBook } = await import("../../src/controller/user.controller");

    const req = mockRequest({
      headers: { "x-user-email": "john@example.com" },
      body: { bookId: 0 },
    }) as any;

    const res = mockResponse() as any;

    // act
    await returnBook(req, res);

    // assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: { code: "BAD_REQUEST", message: "Valid bookId is required" },
    });
    
  });

  test("when user not found", async () => {
    // arrange
    const { returnBook } = await import("../../src/controller/user.controller");
    prismaMock.user.findUnique.mockResolvedValue(null);

    const req = mockRequest({
      headers: { "x-user-email": "john@example.com" },
      body: { bookId: 10 },
    }) as any;

    const res = mockResponse() as any;

    // act
    await returnBook(req, res);

    // assert
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { email: "john@example.com" },
    });

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: { code: "NOT_FOUND", message: "User not found" },
    });

  });

  test("when no active borrow exists for this book", async () => {
    // arrange
    const { returnBook } = await import("../../src/controller/user.controller");
    prismaMock.user.findUnique.mockResolvedValue({
      id: 99,
      email: "john@example.com",
    });
    prismaMock.borrow.findFirst.mockResolvedValue(null);

    const req = mockRequest({
      headers: { "x-user-email": "john@example.com" },
      body: { bookId: 10 },
    }) as any;

    const res = mockResponse() as any;

    // act
    await returnBook(req, res);

    // assert
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "No active borrow found for this book",
      },
    });
  });

  test("happy path: marks borrow RETURNED, increments copies, creates RETURN action, cancels reminder", async () => {
    // arrange
    const { returnBook } = await import("../../src/controller/user.controller");

    const now = new Date("2025-02-10T10:00:00.000Z");
    const dueAt = new Date("2025-02-13T10:00:00.000Z");

    prismaMock.user.findUnique.mockResolvedValue({
      id: 99,
      email: "john@example.com",
    });
    prismaMock.borrow.findFirst.mockResolvedValue({
      id: 555,
      userId: 99,
      bookId: 77,
      status: "BORROWED",
      dueAt,
    });

    // inside transaction
    prismaMock.borrow.update.mockResolvedValue({
      id: 555,
      status: "RETURNED",
      returnedAt: now,
    });

    prismaMock.book.update.mockResolvedValue({
      id: 77,
      copiesAvailable: 3,
    });

    prismaMock.bookAction.create.mockResolvedValue({
      id: 1,
      type: "RETURN",
    });

    const req = mockRequest({
      headers: { "x-user-email": "john@example.com" },
      body: { bookId: 77 },
    }) as any;

    const res = mockResponse() as any;

    // act
    await returnBook(req, res);

    // assert
    expect(scheduler.cancelReturnReminder).toHaveBeenCalledTimes(1);
    const [borrowIdArg] = scheduler.cancelReturnReminder.mock.calls[0] as [
      number
    ];
    expect(borrowIdArg).toBe(555);

    expect(prismaMock.bookAction.create).toHaveBeenCalledTimes(1);
    const createArg = prismaMock.bookAction.create.mock.calls[0][0];
    expect(createArg.data.type).toBe("RETURN");
    expect(createArg.data.bookId).toBe(77);
    expect(createArg.data.userId).toBe(99);
    expect(createArg.data.quantity).toBe(1);
    expect(new Date(createArg.data.dueAt).getTime()).toBe(dueAt.getTime());

    const body = res.body;

    expect(body.ok).toBe(true);
    expect(typeof body.data.returnedAt).toBe("string");
    expect(body.data.copiesAvailable).toBe(3);
  });
});
