import { jest } from '@jest/globals';

export type MockRequestInit = {
  headers?: Record<string, string | undefined>;
  params?: Record<string, any>;
  query?: Record<string, any>;
  body?: any;
  path?: string;
  method?: string;
};

export const mockRequest = (init: MockRequestInit = {}) => {
  const lower = new Map<string, string>();
  for (const [k, v] of Object.entries(init.headers ?? {})) {
    if (typeof v === 'string') lower.set(k.toLowerCase(), v);
  }

  return {
    header: (key: string) => lower.get(String(key).toLowerCase()) ?? '',
    get: (key: string) => lower.get(String(key).toLowerCase()) ?? '',
    params: init.params ?? {},
    query: init.query ?? {},
    body: init.body ?? {},
    route: { path: init.path ?? '/', methods: { [String(init.method ?? 'get').toLowerCase()]: true } },
    method: (init.method ?? 'GET').toUpperCase(),
  } as any;
};

export type MockResponse = ReturnType<typeof mockResponse>;

export const mockResponse = () => {
  const res: any = {};
  res.locals = {};
  res.statusCode = 200;
  res.headers = new Map<string, string>();

  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  });

  res.set = jest.fn((key: string, value: string) => {
    res.headers.set(key.toLowerCase(), value);
    return res;
  });

  res.get = jest.fn((key: string) => res.headers.get(key.toLowerCase()));

  res.json = jest.fn((data: any) => {
    res.body = data;
    return res;
  });

  return res;
};

export const mockNext = () => jest.fn();

export const useFakeTimers = () => {
  jest.useFakeTimers();
  return {
    advance: async (ms: number) => {
      jest.advanceTimersByTime(ms);
      await Promise.resolve();
    },
    runAll: async () => {
      jest.runOnlyPendingTimers();
      await Promise.resolve();
    },
    restore: () => jest.useRealTimers(),
  };
};
