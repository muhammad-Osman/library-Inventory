import { beforeEach, describe, expect, test, jest } from '@jest/globals';
import { installPrismaMock, prismaMock, resetPrismaMock } from '../mocks/prisma';
import { mockRequest, mockResponse } from '../helpers/http';

let scheduler = {
  scheduleReturnReminder: jest.fn(),
  scheduleRestock: jest.fn(),
  cancelReturnReminder: jest.fn(),
};

describe('user buy book', () => {
  beforeEach(async () => {
    await installPrismaMock();
    resetPrismaMock();

    scheduler = {
      scheduleReturnReminder: jest.fn(),
      scheduleRestock: jest.fn(),
      cancelReturnReminder: jest.fn(),
    };

    jest.unstable_mockModule('../../src/service/scheduler.service', () => ({
      scheduleReturnReminder: scheduler.scheduleReturnReminder,
      scheduleRestock: scheduler.scheduleRestock,
      cancelReturnReminder: scheduler.cancelReturnReminder,
    }));
  });

  test('when x-user-email missing', async () => {
    // arrange
    const { buyBook } = await import('../../src/controller/user.controller');
    const req = mockRequest({ body: { bookId: 1, quantity: 1 } }) as any;
    
    const res = mockResponse() as any;

    // act
    await buyBook(req, res);

    // assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: { code: 'BAD_REQUEST', message: 'x-user-email header is required' },
    });

  });

  test('when bookId invalid', async () => {
    // arrange
    const { buyBook } = await import('../../src/controller/user.controller');
    
    const req = mockRequest({
      headers: { 'x-user-email': 'john@example.com' },
      body: { bookId: 0, quantity: 1 },
    }) as any;

    const res = mockResponse() as any;

    // act
    await buyBook(req, res);

    // assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: { code: 'BAD_REQUEST', message: 'Valid bookId is required' },
    });

  });

  test('when quantity invalid <= 0', async () => {
    // arrange
    const { buyBook } = await import('../../src/controller/user.controller');
    const req = mockRequest({
      headers: { 'x-user-email': 'john@example.com' },
      body: { bookId: 1, quantity: 0 },
    }) as any;

    const res = mockResponse() as any;

    // act
    await buyBook(req, res);

    // assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: { code: 'BAD_REQUEST', message: 'quantity must be a positive integer' },
    });

  });

  test('when book not found', async () => {
    // arrange
    const { buyBook } = await import('../../src/controller/user.controller');
    prismaMock.book.findUnique.mockResolvedValue(null);

    const req = mockRequest({
      headers: { 'x-user-email': 'john@example.com' },
      body: { bookId: 5, quantity: 1 },
    }) as any;

    const res = mockResponse() as any;

    // act
    await buyBook(req, res);

    // assert
    expect(prismaMock.book.findUnique).toHaveBeenCalledWith({ where: { id: 5 } });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Book not found' },
    });

  });

  test('when not enough copies available', async () => {
    // arrange
    const { buyBook } = await import('../../src/controller/user.controller');
    prismaMock.book.findUnique.mockResolvedValue({
      id: 5,
      copiesAvailable: 1,
      copiesSeeded: 5,
      sellPrice: 25,
      borrowPrice: 5,
      stockPrice: 10,
    });

    const req = mockRequest({
      headers: { 'x-user-email': 'john@example.com' },
      body: { bookId: 5, quantity: 2 },
    }) as any;

    const res = mockResponse() as any;

    // act
    await buyBook(req, res);

    // assert
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: { code: 'CONFLICT', message: 'Not enough copies available' },
    });

  });

  test('when per book limit exceeded', async () => {
    // arrange
    const { buyBook } = await import('../../src/controller/user.controller');

    prismaMock.book.findUnique.mockResolvedValue({
      id: 9,
      copiesAvailable: 10,
      copiesSeeded: 10,
      sellPrice: 30,
      borrowPrice: 5,
      stockPrice: 10,
    });

    prismaMock.user.upsert.mockResolvedValue({ id: 100, email: 'john@example.com' });

    prismaMock.bookAction.aggregate
      .mockResolvedValueOnce({ _sum: { quantity: 2 } })
      .mockResolvedValueOnce({ _sum: { quantity: 0 } });

    const req = mockRequest({
      headers: { 'x-user-email': 'john@example.com' },
      body: { bookId: 9, quantity: 1 },
    }) as any;

    const res = mockResponse() as any;

    // act
    await buyBook(req, res);

    // assert
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: { code: 'CONFLICT', message: 'Limit: max 2 copies per same book' },
    });

  });

  test('when total limit > 10 across all books exceeded', async () => {
    // srrange
    const { buyBook } = await import('../../src/controller/user.controller');

    prismaMock.book.findUnique.mockResolvedValue({
      id: 11,
      copiesAvailable: 10,
      copiesSeeded: 10,
      sellPrice: 40,
      borrowPrice: 5,
      stockPrice: 10,
    });

    prismaMock.user.upsert.mockResolvedValue({ id: 100, email: 'john@example.com' });

    prismaMock.bookAction.aggregate
      .mockResolvedValueOnce({ _sum: { quantity: 1 } })
      .mockResolvedValueOnce({ _sum: { quantity: 10 } });

    const req = mockRequest({
      headers: { 'x-user-email': 'john@example.com' },
      body: { bookId: 11, quantity: 1 },
    }) as any;
    
    const res = mockResponse() as any;

    // act
    await buyBook(req, res);

    // assert
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: { code: 'CONFLICT', message: 'Limit: max 10 copies across all books' },
    });

  });

  test('happy path decrements stock, creates BUY action, credits wallet, logs movement, triggers low stock restock', async () => {
    // arrange
    const { buyBook } = await import('../../src/controller/user.controller');

    prismaMock.book.findUnique.mockResolvedValue({
      id: 7,
      title: 'Alpha',
      copiesAvailable: 2,
      copiesSeeded: 5,
      sellPrice: 50,
      borrowPrice: 10,
      stockPrice: 20,
    });

    prismaMock.user.upsert.mockResolvedValue({ id: 300, email: 'alice@example.com' });

    prismaMock.bookAction.aggregate
      .mockResolvedValueOnce({ _sum: { quantity: 1 } })
      .mockResolvedValueOnce({ _sum: { quantity: 3 } });

    // inside $transaction
    prismaMock.book.update.mockResolvedValue({
      id: 7,
      copiesAvailable: 1,
    });
    prismaMock.bookAction.create.mockResolvedValue({ id: 1 });
    prismaMock.wallet.update.mockResolvedValue({ id: 1, balance: 50 });
    prismaMock.walletMovement.create.mockResolvedValue({ id: 10 });

    const req = mockRequest({
      headers: { 'x-user-email': 'alice@example.com' },
      body: { bookId: 7, quantity: 1 },
    }) as any;

    const res = mockResponse() as any;

    // act
    await buyBook(req, res);

    // assert
    const body = res.body;
    expect(body.ok).toBe(true);
    expect(body.data).toEqual({ quantity: 1, total: 50, copiesAvailable: 1 });

    // prisma interactions
    const types = prismaMock.bookAction.create.mock.calls.map((c) => c[0].data.type).sort();
    expect(types).toEqual(['BUY', 'RESTOCK_REQUESTED']);

    expect(prismaMock.wallet.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { balance: { increment: 50 } },
    });

    expect(prismaMock.walletMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'SELL_REVENUE',
          direction: 'CREDIT',
          amount: 50,
          userId: 300,
          bookId: 7,
        }),
      }),
    );

    expect(scheduler.scheduleRestock).toHaveBeenCalledWith(7, 60 * 60 * 1000);
  });

});
