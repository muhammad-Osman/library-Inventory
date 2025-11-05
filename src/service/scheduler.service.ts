import { prisma } from '../db/prisma';
import {
  BookActionType,
  MovementDirection,
  WalletMovementType,
} from '@prisma/client';
import { sendEmail } from './email.service';

type TimerMap = Map<number, NodeJS.Timeout>;
const restockTimers: TimerMap = new Map();
const reminderTimers: Map<number, NodeJS.Timeout> = new Map();

export function scheduleRestock(bookId: number, delayMs = 60 * 60 * 1000) {
  if (restockTimers.has(bookId)) clearTimeout(restockTimers.get(bookId)!);

  const t = setTimeout(async () => {
    restockTimers.delete(bookId);

    const book = await prisma.book.findUnique({ where: { id: bookId } });
    if (!book) return;

    const needed = book.copiesSeeded - book.copiesAvailable;
    if (needed <= 0) return;

    const cost = Number(book.stockPrice) * needed;

    await prisma.$transaction(async (tx) => {
      await tx.book.update({
        where: { id: bookId },
        data: { copiesAvailable: { increment: needed } },
      });

      await tx.bookAction.create({
        data: {
          type: BookActionType.RESTOCKED,
          bookId,
          quantity: needed,
          pricePerUnit: book.stockPrice,
          total: cost,
          meta: { auto: true },
        },
      });

      await tx.wallet.update({
        where: { id: 1 },
        data: { balance: { decrement: cost } },
      });

      await tx.walletMovement.create({
        data: {
          type: WalletMovementType.RESTOCK_COST,
          direction: MovementDirection.DEBIT,
          amount: cost,
          bookId,
          note: `Auto restock ${needed} copies`,
        },
      });
    });

    try {
      await sendEmail({
        to: 'supply@library.com',
        subject: `Restock completed for book ${book.title}`,
        text: `Restock completed for bookId=${bookId}. Added ${needed} copies.`
      });
    } catch (err) {
      console.error('Failed to send restock notification email:', err);
    }
  }, delayMs);

  restockTimers.set(bookId, t);
}

export function scheduleReturnReminder(borrowId: number, userEmail: string, bookId: number, when: Date) {
  if (reminderTimers.has(borrowId)) clearTimeout(reminderTimers.get(borrowId)!);

  const delayMs = Math.max(0, when.getTime() - Date.now());
  
  const t = setTimeout(async () => {
    
    reminderTimers.delete(borrowId);
    
    await prisma.bookAction.create({
      data: {
        type: BookActionType.REMINDER_SENT,
        bookId,
        dueAt: when,
        meta: { borrowId, userEmail, dueAt: when.toISOString() },
      },
    });

    try {
      await sendEmail({
        to: userEmail,
        subject: 'Library return reminder',
        text: `Reminder: please return bookId=${bookId} by ${when.toISOString()}.`
      });
    } catch (err) {
      console.error('Failed to send return reminder email:', err);
    }

}, delayMs);

  reminderTimers.set(borrowId, t);
}

export function cancelReturnReminder(borrowId: number) {
  const t = reminderTimers.get(borrowId);
  
  if (t) {
    clearTimeout(t);
    reminderTimers.delete(borrowId);
  }

}
