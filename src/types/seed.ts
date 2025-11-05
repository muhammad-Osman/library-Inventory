export interface Price {
  sell: number;
  stock: number;
  borrow: number;
}

export interface BookSeed {
  title: string;
  authors: string[];
  prices: Price;
  year?: number;
  pages?: number;
  publisher?: string;
  isbn: string;
  genres: string[];
  copies: number;
}

export type SeedArray = BookSeed[];
