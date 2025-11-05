import path from 'node:path';
import fs from 'node:fs/promises';
import { prisma } from '../src/db/prisma';
import { TagKind } from '@prisma/client';

interface Price { sell: number; stock: number; borrow: number; }
interface BookSeed {
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

const SEED_FILE = path.resolve(process.cwd(), 'prisma', 'books.seed.json');

const norm = (s?: string | null) => {
  const t = (s ?? '').trim();
  return t.length ? t : null;
};

const dedupeStrings = (values?: string[]) => {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values ?? []) {
    const trimmed = norm(value);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(trimmed);
  }
  return unique;
};

async function upsertTag(name: string, kind: TagKind) {
  const safe = (name ?? '').trim();
  return prisma.tag.upsert({
    where: { name_kind: { name: safe, kind } },
    update: {},
    create: { name: safe, kind },
  });
}

async function upsertBookFromSeed(seed: BookSeed) {
  const { title, authors, genres, prices, year, pages, publisher, isbn, copies } = seed;
  const uniqueAuthors = dedupeStrings(authors);
  const uniqueGenres = dedupeStrings(genres);

  const book = await prisma.book.upsert({
    where: { isbn },
    update: {
      title: (title ?? '').trim(),
      year: year ?? null,
      pages: pages ?? null,
      publisher: norm(publisher),
      sellPrice: prices.sell,
      stockPrice: prices.stock,
      borrowPrice: prices.borrow,
      copiesSeeded: copies,
    },
    create: {
      isbn,
      title: (title ?? '').trim(),
      year: year ?? null,
      pages: pages ?? null,
      publisher: norm(publisher),
      sellPrice: prices.sell,
      stockPrice: prices.stock,
      borrowPrice: prices.borrow,
      copiesSeeded: copies,
      copiesAvailable: copies,
    },
  });

  await prisma.bookTag.deleteMany({ where: { bookId: book.id } });

  let order = 1;
  for (const author of uniqueAuthors) {
    const tag = await upsertTag(author, TagKind.AUTHOR);
    await prisma.bookTag.create({ data: { bookId: book.id, tagId: tag.id, tagOrder: order++ } });
  }
  for (const genre of uniqueGenres) {
    const tag = await upsertTag(genre, TagKind.GENRE);
    await prisma.bookTag.create({ data: { bookId: book.id, tagId: tag.id } });
  }
}

export async function seedOnStart(): Promise<boolean> {
  const existingBooks = await prisma.book.count();

  await prisma.wallet.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, balance: 100.0 },
  });

  if (existingBooks > 0) {
    return false;
  }

  const raw = await fs.readFile(SEED_FILE, 'utf8');
  const data = JSON.parse(raw) as BookSeed[];

  for (const b of data) {
    await upsertBookFromSeed(b);
  }

  return true;
}
