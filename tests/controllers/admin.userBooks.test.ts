import { beforeEach, describe, expect, test } from '@jest/globals';
import { installPrismaMock, prismaMock, resetPrismaMock } from '../mocks/prisma';
import { mockRequest, mockResponse } from '../helpers/http';

describe('get user books', () => {
  // arrange
  beforeEach(async () => {
    await installPrismaMock();
    resetPrismaMock();
  });

  test('when email missing in path', async () => {
    // arrange
    const { getUserBooks } = await import('../../src/controller/admin.controller');
    const req = mockRequest({ params: {} }) as any;

    const res = mockResponse() as any;

    // act
    await getUserBooks(req, res);

    // assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: { code: 'BAD_REQUEST', message: 'Email is required in path' },
    });

  });

  test('returns empty borrowed when user not found', async () => {
    // arrange
    const { getUserBooks } = await import('../../src/controller/admin.controller');

    prismaMock.user.findUnique.mockResolvedValue(null);

    const req = mockRequest({
      params: { email: 'john@example.com' },
    }) as any;

    const res = mockResponse() as any;

    // act
    await getUserBooks(req, res);

    // assert
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: 'john@example.com' } });
    expect(res.status).not.toHaveBeenCalled();
    expect(res.body).toEqual({
      ok: true,
      data: { borrowed: [], bought: [] },
    });

  });

  test('maps active borrows and bought summary with null bookId', async () => {
    // arrange
    const { getUserBooks } = await import('../../src/controller/admin.controller');

    prismaMock.user.findUnique.mockResolvedValue({ id: 50, email: 'alice@example.com' });

    const bAt1 = new Date(Date.now());
    const dAt1 = new Date('2025-02-04T09:00:00.000Z');

    const bAt2 = new Date('2025-02-02T10:00:00.000Z');
    const dAt2 = new Date('2025-02-05T10:00:00.000Z');
    const rAt2 = new Date('2025-02-04T12:00:00.000Z');

    prismaMock.borrow.findMany.mockResolvedValue([
      {
        id: 1,
        userId: 50,
        bookId: 5,
        status: 'BORROWED',
        borrowedAt: bAt1,
        dueAt: dAt1,
        returnedAt: null,
        quantity: 1,
        priceAtBorrow: 10,
        book: { id: 5, title: 'Clean Architecture' },
      },
      {
        id: 2,
        userId: 50,
        bookId: 6,
        status: 'RETURNED',
        borrowedAt: bAt2,
        dueAt: dAt2,
        returnedAt: rAt2,
        quantity: 1,
        priceAtBorrow: 12,
        book: { id: 6, title: 'Refactoring' },
      },
    ]);

    const lastBuy = new Date('2025-02-03T08:00:00.000Z');

    prismaMock.bookAction.groupBy.mockResolvedValue([
      {
        bookId: 5,
        _sum: { quantity: 2, total: 60 },
        _max: { createdAt: lastBuy },
      },
      {
        bookId: null,
        _sum: { quantity: 1, total: 30 },
        _max: { createdAt: lastBuy },
      },
    ]);

    prismaMock.book.findMany.mockResolvedValue([
      { id: 5, title: 'Clean Architecture' },
    ]);

    const req = mockRequest({
      params: { email: 'Alice%40Example.com' },
    }) as any;

    const res = mockResponse() as any;

    // act
    await getUserBooks(req, res);

    // assert
    expect(prismaMock.borrow.findMany).toHaveBeenCalledWith({
      where: { userId: 50 },
      include: { book: true },
      orderBy: { borrowedAt: 'desc' },
    });

    const body = res.body;

    expect(body.ok).toBe(true);

    expect(body.data.borrowed).toEqual([
      {
        book: { id: 6, title: 'Refactoring' },
        status: 'RETURNED',
        borrowedAt: bAt2.toISOString(),
        dueAt: dAt2.toISOString(),
        returnedAt: rAt2.toISOString(),
      },
      {
        book: { id: 5, title: 'Clean Architecture' },
        status: 'BORROWED',
        borrowedAt: bAt1.toISOString(),
        dueAt: dAt1.toISOString(),
        returnedAt: null,
      },
    ]);

    expect(body.data.bought).toEqual([
      {
        book: { id: 5, title: 'Clean Architecture' },
        quantity: 2,
        total: 60,
        lastPurchasedAt: lastBuy.toISOString(),
      },
      {
        book: null,
        quantity: 1,
        total: 30,
        lastPurchasedAt: lastBuy.toISOString(),
      },
    ]);
  });

});

describe('admin controller getUsers', () => {
  beforeEach(async () => {
    await installPrismaMock();
    resetPrismaMock();
  });

  test('returns the raw list from prisma', async () => {
    // arrange
    const { getUsers } = await import('../../src/controller/admin.controller');
    prismaMock.user.findMany.mockResolvedValue([
      { id: 1, email: 'a@example.com' },
      { id: 2, email: 'b@example.com' },
    ]);

    const req = mockRequest() as any;
    const res = mockResponse() as any;

    // act
    await getUsers(req, res);

    // assert
    expect(prismaMock.user.findMany).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual({
      ok: true,
      data: [
        { id: 1, email: 'a@example.com' },
        { id: 2, email: 'b@example.com' },
      ],
    });
  });
});
