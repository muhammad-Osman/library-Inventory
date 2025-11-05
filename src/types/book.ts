export type BookListItem = {
  id: number;
  isbn: string;
  title: string;
  year?: number | null;
  pages?: number | null;
  publisher?: string | null;
  prices: {
    sell: number;
    stock: number;
    borrow: number;
  };
  copiesSeeded: number;
  copiesAvailable: number;
  authors: string[];
  genres: string[];
};

export type SearchQuery = {
  q?: string;
  page?: number;
  pageSize?: number;
};
