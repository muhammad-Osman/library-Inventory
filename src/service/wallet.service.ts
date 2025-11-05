import { prisma } from '../db/prisma';
import { MovementDirection, WalletMovementType } from '@prisma/client';
import { sendEmail } from './email.service';

export async function creditBorrowRevenue(amount: number, opts: { bookId: number; userId: number }) {
  const updated = await prisma.wallet.update({
    where: { id: 1 },
    data: { balance: { increment: amount } },
  });

  await prisma.walletMovement.create({
    data: {
      type: WalletMovementType.BORROW_REVENUE,
      direction: MovementDirection.CREDIT,
      amount,
      bookId: opts.bookId,
      userId: opts.userId,
      note: 'Borrow fee',
    },
  });

  if (!updated.milestoneNotifiedAt && Number(updated.balance) > 2000) {
    
    await prisma.wallet.update({
      where: { id: 1 },
      data: { milestoneNotifiedAt: new Date() },
    });

    try {
      await sendEmail({
        to: 'management@dummy-library.com',
        subject: 'Wallet balance milestone reached',
        text: 'The library wallet balance has exceeded 2000.'
      });
    } catch (err) {
      console.error('Failed to send wallet milestone email:', err);
    }
  }
}
