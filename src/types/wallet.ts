export type WalletSummary = {
  balance: number;
  milestoneNotifiedAt: string | null;
};

export type WalletMovementItem = {
  id: number;
  type: 'SELL_REVENUE' | 'BORROW_REVENUE' | 'STOCK_PURCHASE' | 'RESTOCK_COST' | 'ADJUSTMENT';
  direction: 'CREDIT' | 'DEBIT';
  amount: number;
  note?: string | null;
  createdAt: string;
  book?: { id: number; title: string } | null;
  userEmail?: string | null;
};