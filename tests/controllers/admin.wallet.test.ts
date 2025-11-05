import { beforeEach, describe, expect, test } from '@jest/globals';
import { installPrismaMock, prismaMock, resetPrismaMock } from '../mocks/prisma';
import { mockRequest, mockResponse } from '../helpers/http';

describe('adminr with wallet', () => {
  // arrange
  beforeEach(async () => {
    await installPrismaMock();
    resetPrismaMock();
  });

  test('get wallet and 404 when wallet not found', async () => {
    // arrange
    const { getWallet } = await import('../../src/controller/admin.controller');
    prismaMock.wallet.findUnique.mockResolvedValue(null);

    const req = mockRequest() as any;
    const res = mockResponse() as any;

    // act
    await getWallet(req, res);

    // assert
    expect(prismaMock.wallet.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Wallet not found' },
    });

  });

  test('get wallet and returns mapped summary', async () => {
    // arrange
    const { getWallet } = await import('../../src/controller/admin.controller');
    const milestone = new Date('2025-02-03T12:00:00.000Z');

    prismaMock.wallet.findUnique.mockResolvedValue({
      id: 1,
      balance: 1500.25,
      milestoneNotifiedAt: milestone,
    });

    const req = mockRequest() as any;
    const res = mockResponse() as any;

    // act
    await getWallet(req, res);

    // assert
    expect(res.status).not.toHaveBeenCalled();
    const body = res.body;
    expect(body.ok).toBe(true);
    expect(body.data).toEqual({
      balance: 1500.25,
      milestoneNotifiedAt: milestone.toISOString(),
    });
  });

});

describe('admin with wallet movements', () => {
  beforeEach(async () => {
    await installPrismaMock();
    resetPrismaMock();
  });

  test('get wallet movements with applies type, from, to filters with pagination include', async () => {
    // arrange
    const { getWalletMovements } = await import('../../src/controller/admin.controller');

    prismaMock.walletMovement.findMany.mockResolvedValue([]);
    prismaMock.walletMovement.count.mockResolvedValue(0);

    const req = mockRequest({
      query: {
        type: 'SELL_REVENUE, BORROW_REVENUE',
        from: '2025-01-01T00:00:00.000Z',
        to: '2025-12-31T23:59:59.000Z',
        page: '3',
        pageSize: '2',
      },
    }) as any;
    const res = mockResponse() as any;

    // act
    await getWalletMovements(req, res);

    // assert
    expect(prismaMock.walletMovement.findMany).toHaveBeenCalledTimes(1);

    const opts = prismaMock.walletMovement.findMany.mock.calls[0][0];

    expect(opts.skip).toBe((3 - 1) * 2);
    expect(opts.take).toBe(2);
    expect(opts.orderBy).toEqual({ createdAt: 'desc' });
    expect(opts.include).toEqual({ book: true, user: true });

    expect(opts.where.type.in).toEqual(['SELL_REVENUE', 'BORROW_REVENUE']);
    expect(opts.where.createdAt.gte instanceof Date).toBe(true);
    expect(opts.where.createdAt.lte instanceof Date).toBe(true);

    const body = res.body;

    expect(body.ok).toBe(true);
    expect(body.data.page).toBe(3);
    expect(body.data.pageSize).toBe(2);
    expect(body.data.total).toBe(0);
    expect(body.data.totalPages).toBe(1);
  });

  test('get wallet movements with maps rows to wallet movement ttem', async () => {
    // arrange
    const { getWalletMovements } = await import('../../src/controller/admin.controller');

    const createdAt = new Date('2025-03-01T08:30:00.000Z');

    prismaMock.walletMovement.findMany.mockResolvedValue([
      {
        id: 9,
        type: 'SELL_REVENUE',
        direction: 'CREDIT',
        amount: 45.5,
        note: 'Sold 1 copy',
        createdAt,
        book: { id: 5, title: 'Clean Code' },
        user: { email: 'alice@example.com' },
      },
      {
        id: 10,
        type: 'RESTOCK_COST',
        direction: 'DEBIT',
        amount: 100,
        note: null,
        createdAt,
        book: null,
        user: null,
      },
    ]);
    prismaMock.walletMovement.count.mockResolvedValue(2);

    const req = mockRequest({ query: { page: '1', pageSize: '50' } }) as any;
    
    const res = mockResponse() as any;

    // act
    await getWalletMovements(req, res);

    // assert
    const body = res.body;
    
    expect(body.ok).toBe(true);
    expect(body.data.items).toEqual([
      {
        id: 9,
        type: 'SELL_REVENUE',
        direction: 'CREDIT',
        amount: 45.5,
        note: 'Sold 1 copy',
        createdAt: createdAt.toISOString(),
        book: { id: 5, title: 'Clean Code' },
        userEmail: 'alice@example.com',
      },
      {
        id: 10,
        type: 'RESTOCK_COST',
        direction: 'DEBIT',
        amount: 100,
        note: null,
        createdAt: createdAt.toISOString(),
        book: null,
        userEmail: null,
      },
    ]);
    
    expect(body.data.total).toBe(2);
    expect(body.data.totalPages).toBe(1);
  });

});
