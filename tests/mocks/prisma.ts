import { jest } from '@jest/globals';

type AnyFn = (...args: any[]) => any;

type AsyncMock<T = any> = jest.MockedFunction<(...args: any[]) => Promise<T>>;

function asyncMock<T = any>(): AsyncMock<T> {
  const fn = jest.fn();
  return fn as unknown as AsyncMock<T>;
}

type ModelMock = {
  findMany: AsyncMock<any[]>;
  findFirst: AsyncMock<any | null>;
  findUnique: AsyncMock<any | null>;
  count: AsyncMock<number>;
  create: AsyncMock<any>;
  update: AsyncMock<any>;
  upsert: AsyncMock<any>;
  aggregate: AsyncMock<any>;
  groupBy: AsyncMock<any[]>;
};

export type PrismaMock = {
  book: ModelMock;
  bookAction: ModelMock;
  wallet: ModelMock;
  walletMovement: ModelMock;
  user: ModelMock;
  borrow: ModelMock;
  $transaction: jest.MockedFunction<(cb: AnyFn | any[]) => Promise<any>>;
};

function makeModel(): ModelMock {
  return {
    findMany: asyncMock<any[]>(),
    findFirst: asyncMock<any | null>(),
    findUnique: asyncMock<any | null>(),
    count: asyncMock<number>(),
    create: asyncMock<any>(),
    update: asyncMock<any>(),
    upsert: asyncMock<any>(),
    aggregate: asyncMock<any>(),
    groupBy: asyncMock<any[]>(),
  };
}

export let prismaMock: PrismaMock;

export async function installPrismaMock(
  modulePath = '../../src/db/prisma',
): Promise<PrismaMock> {
  const existing = (globalThis as any).__PRISMA_MOCK__ as PrismaMock | undefined;
  if (existing) {
    prismaMock = existing;
    return prismaMock;
  }

  const prisma: PrismaMock = {
    book: makeModel(),
    bookAction: makeModel(),
    wallet: makeModel(),
    walletMovement: makeModel(),
    user: makeModel(),
    borrow: makeModel(),
    $transaction: jest.fn() as any,
  };

  prisma.$transaction = jest.fn(async (cb: AnyFn | any[]) => {
    if (typeof cb === 'function') return await cb(prisma);
    if (Array.isArray(cb)) return Promise.all(cb);
    return undefined as any;
  }) as jest.MockedFunction<(cb: AnyFn | any[]) => Promise<any>>;

  prismaMock = prisma;

  (globalThis as any).__PRISMA_MOCK__ = prismaMock;

  jest.unstable_mockModule(modulePath, () => ({ prisma: prismaMock }));

  return prismaMock;
}

export function resetPrismaMock(): void {
  if (!prismaMock) return;
  const visit = (obj: any) => {
    for (const k of Object.keys(obj)) {
      const v = (obj as any)[k];
      if (typeof v === 'function' && 'mockReset' in v) {
        (v as jest.Mock).mockReset();
      } else if (v && typeof v === 'object') {
        visit(v);
      }
    }
  };

  visit(prismaMock);
}
