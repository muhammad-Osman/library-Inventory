import { beforeEach, describe, expect, test } from "@jest/globals";
import {
  installPrismaMock,
  prismaMock,
  resetPrismaMock,
} from "../mocks/prisma";
import { mockRequest, mockResponse } from "../helpers/http";

describe("admin get book actions", () => {
  beforeEach(async () => {
    await installPrismaMock();
    resetPrismaMock();
  });

  test("when bookId is invalid", async () => {
    // arrange
    const { getBookActions } = await import(
      "../../src/controller/admin.controller"
    );
    const req = mockRequest({ params: { bookId: "abc" } }) as any;
    const res = mockResponse() as any;

    // act
    await getBookActions(req, res);

    // assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: { code: "BAD_REQUEST", message: "Invalid bookId" },
    });
  });

  test("applies filters types, userEmail, from to with pagination and ordering", async () => {
    // arrange
    const { getBookActions } = await import(
      "../../src/controller/admin.controller"
    );
    prismaMock.bookAction.findMany.mockResolvedValue([]);
    prismaMock.bookAction.count.mockResolvedValue(0);

    const req = mockRequest({
      params: { bookId: "42" },
      query: {
        type: "BORROW, RETURN",
        userEmail: "john",
        from: "2025-01-01T00:00:00.000Z",
        to: "2025-12-31T23:59:59.000Z",
        page: "2",
        pageSize: "1",
      },
    }) as any;
    const res = mockResponse() as any;

    // act
    await getBookActions(req, res);

    // assert
    expect(prismaMock.bookAction.findMany).toHaveBeenCalledTimes(1);

    const opts = prismaMock.bookAction.findMany.mock.calls[0][0];

    expect(opts.skip).toBe(1);
    expect(opts.take).toBe(1);
    expect(opts.orderBy).toEqual({ createdAt: "desc" });
    expect(opts.include).toEqual({ user: true });

    expect(opts.where.bookId).toBe(42);
    expect(opts.where.type.in).toEqual(["BORROW", "RETURN"]);
    expect(opts.where.user.is.email).toEqual({
      contains: "john",
      mode: "insensitive",
    });
    expect(opts.where.createdAt.gte instanceof Date).toBe(true);
    expect(opts.where.createdAt.lte instanceof Date).toBe(true);

    const body = res.body;

    expect(body.ok).toBe(true);
    expect(body.data.page).toBe(2);
    expect(body.data.pageSize).toBe(1);
    expect(body.data.total).toBe(0);
    expect(body.data.totalPages).toBe(1);
  });

  test("maps rows with book action item correctly", async () => {
    // arrange
    const { getBookActions } = await import(
      "../../src/controller/admin.controller"
    );

    const createdAt1 = new Date("2025-02-01T10:00:00.000Z");
    const dueAt1 = new Date("2025-02-04T10:00:00.000Z");

    prismaMock.bookAction.findMany.mockResolvedValue([
      {
        id: 7,
        bookId: 42,
        type: "BORROW",
        quantity: 1,
        pricePerUnit: 5,
        total: 5,
        dueAt: dueAt1,
        meta: { note: "x" },
        createdAt: createdAt1,
        user: { email: "john@example.com" },
      },
    ]);

    prismaMock.bookAction.count.mockResolvedValue(1);

    const req = mockRequest({
      params: { bookId: "42" },
      query: { page: "1", pageSize: "20" },
    }) as any;

    const res = mockResponse() as any;

    // act
    await getBookActions(req, res);

    // assert
    const body = res.body;

    expect(body.ok).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0]).toEqual({
      id: 7,
      bookId: 42,
      type: "BORROW",
      quantity: 1,
      pricePerUnit: 5,
      total: 5,
      dueAt: dueAt1.toISOString(),
      meta: { note: "x" },
      createdAt: createdAt1.toISOString(),
      userEmail: "john@example.com",
    });
  });

});
