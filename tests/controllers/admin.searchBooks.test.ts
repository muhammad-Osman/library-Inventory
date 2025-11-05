import { beforeEach, describe, expect, test } from "@jest/globals";
import { TagKind } from "@prisma/client";
import {
  installPrismaMock,
  prismaMock,
  resetPrismaMock,
} from "../mocks/prisma";
import { mockRequest, mockResponse } from "../helpers/http";

describe("admin searchBooks", () => {
  beforeEach(async () => {
    await installPrismaMock();
    resetPrismaMock();
  });

  test("returns mpped book list item meta no q", async () => {
    // arrange
    const { searchBooks } = await import(
      "../../src/controller/admin.controller"
    );

    prismaMock.book.findMany.mockResolvedValue([
      {
        id: 1,
        isbn: "123",
        title: "Alpha",
        year: null,
        pages: null,
        publisher: null,
        sellPrice: 100,
        stockPrice: 50,
        borrowPrice: 10,
        copiesSeeded: 5,
        copiesAvailable: 2,
        bookTags: [
          { tag: { kind: "AUTHOR", name: "Z Author" }, tagOrder: 2 },
          { tag: { kind: "AUTHOR", name: "A Author" }, tagOrder: 1 },
          { tag: { kind: "GENRE", name: "Fantasy" }, tagOrder: null },
        ],
      },
    ]);

    prismaMock.book.count.mockResolvedValue(1);

    const req = mockRequest({
      query: { page: 1, pageSize: 20 },
    }) as any;
    const res = mockResponse() as any;

    // act
    await searchBooks(req, res);

    // assert
    expect(prismaMock.book.findMany).toHaveBeenCalledTimes(1);
    const args = prismaMock.book.findMany.mock.calls[0][0];

    expect(args.include).toEqual({ bookTags: { include: { tag: true } } });
    expect(args.orderBy).toEqual({ title: "asc" });
    expect(args.skip).toBe(0);
    expect(args.take).toBe(20);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledTimes(1);

    const payload = res.body;
    expect(payload.ok).toBe(true);
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]).toEqual({
      id: 1,
      isbn: "123",
      title: "Alpha",
      year: null,
      pages: null,
      publisher: null,
      prices: { sell: 100, stock: 50, borrow: 10 },
      copiesSeeded: 5,
      copiesAvailable: 2,
      authors: ["A Author", "Z Author"],
      genres: ["Fantasy"],
    });

    expect(payload.meta).toEqual({
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
      q: null,
    });
  });

  test("applies q across title authors genres", async () => {
    const { searchBooks } = await import(
      "../../src/controller/admin.controller"
    );

    prismaMock.book.findMany.mockResolvedValue([]);
    prismaMock.book.count.mockResolvedValue(0);

    const req = mockRequest({
      query: { q: "alpha", page: 2, pageSize: 10 },
    }) as any;
    const res = mockResponse() as any;

    await searchBooks(req, res);

    expect(prismaMock.book.findMany).toHaveBeenCalledTimes(1);
    const opts = prismaMock.book.findMany.mock.calls[0][0];

    expect(opts.skip).toBe((2 - 1) * 10);
    expect(opts.take).toBe(10);

    expect(opts.include).toEqual({ bookTags: { include: { tag: true } } });
    expect(opts.orderBy).toEqual({ title: "asc" });

    const where = opts.where;

    expect(where).toBeDefined();
    expect(Array.isArray(where.OR)).toBe(true);
    expect(where.OR).toHaveLength(3);

    expect(where.OR[0]).toEqual({
      title: { contains: "alpha", mode: "insensitive" },
    });

    expect(where.OR[1]).toEqual({
      bookTags: {
        some: {
          tag: {
            kind: TagKind.AUTHOR,
            name: { contains: "alpha", mode: "insensitive" },
          },
        },
      },
    });

    expect(where.OR[2]).toEqual({
      bookTags: {
        some: {
          tag: {
            kind: TagKind.GENRE,
            name: { contains: "alpha", mode: "insensitive" },
          },
        },
      },
    });

    const body = res.body;

    expect(body.meta).toEqual({
      page: 2,
      pageSize: 10,
      total: 0,
      totalPages: 1,
      q: "alpha",
    });
  });
  
});
