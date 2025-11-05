export type BookActionItem = {
  id: number;
  bookId: number;
  type: 'BORROW' | 'RETURN' | 'BUY' | 'RESTOCK_REQUESTED' | 'RESTOCKED' | 'REMINDER_SENT';
  quantity: number;
  pricePerUnit?: number | null;
  total?: number | null;
  dueAt?: string | null;
  meta?: unknown;
  createdAt: string;
  userEmail?: string | null;
};

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
