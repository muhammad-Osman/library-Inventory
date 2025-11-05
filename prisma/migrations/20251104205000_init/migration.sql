-- CreateEnum
CREATE TYPE "WalletMovementType" AS ENUM ('SELL_REVENUE', 'BORROW_REVENUE', 'STOCK_PURCHASE', 'RESTOCK_COST', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "MovementDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "BookActionType" AS ENUM ('BORROW', 'RETURN', 'BUY', 'RESTOCK_REQUESTED', 'RESTOCKED', 'REMINDER_SENT');

-- CreateEnum
CREATE TYPE "BorrowStatus" AS ENUM ('BORROWED', 'RETURNED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "TagKind" AS ENUM ('AUTHOR', 'GENRE');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Book" (
    "id" SERIAL NOT NULL,
    "isbn" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER,
    "pages" INTEGER,
    "publisher" TEXT,
    "sellPrice" DECIMAL(10,2) NOT NULL,
    "stockPrice" DECIMAL(10,2) NOT NULL,
    "borrowPrice" DECIMAL(10,2) NOT NULL,
    "copiesSeeded" INTEGER NOT NULL,
    "copiesAvailable" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "balance" DECIMAL(12,2) NOT NULL,
    "milestoneNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletMovement" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL DEFAULT 1,
    "type" "WalletMovementType" NOT NULL,
    "direction" "MovementDirection" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "bookId" INTEGER,
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookAction" (
    "id" SERIAL NOT NULL,
    "type" "BookActionType" NOT NULL,
    "bookId" INTEGER NOT NULL,
    "userId" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "pricePerUnit" DECIMAL(10,2),
    "total" DECIMAL(12,2),
    "dueAt" TIMESTAMP(3),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Borrow" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "bookId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "borrowedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "returnedAt" TIMESTAMP(3),
    "priceAtBorrow" DECIMAL(10,2) NOT NULL,
    "status" "BorrowStatus" NOT NULL DEFAULT 'BORROWED',

    CONSTRAINT "Borrow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "TagKind" NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookTag" (
    "bookId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,
    "tagOrder" INTEGER,

    CONSTRAINT "BookTag_pkey" PRIMARY KEY ("bookId","tagId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Book_isbn_key" ON "Book"("isbn");

-- CreateIndex
CREATE INDEX "Book_title_idx" ON "Book"("title");

-- CreateIndex
CREATE INDEX "WalletMovement_createdAt_idx" ON "WalletMovement"("createdAt");

-- CreateIndex
CREATE INDEX "WalletMovement_type_idx" ON "WalletMovement"("type");

-- CreateIndex
CREATE INDEX "BookAction_bookId_type_createdAt_idx" ON "BookAction"("bookId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "BookAction_userId_type_createdAt_idx" ON "BookAction"("userId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "Borrow_userId_status_idx" ON "Borrow"("userId", "status");

-- CreateIndex
CREATE INDEX "Borrow_bookId_status_idx" ON "Borrow"("bookId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_kind_key" ON "Tag"("name", "kind");

-- CreateIndex
CREATE INDEX "BookTag_tagId_idx" ON "BookTag"("tagId");

-- AddForeignKey
ALTER TABLE "WalletMovement" ADD CONSTRAINT "WalletMovement_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletMovement" ADD CONSTRAINT "WalletMovement_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletMovement" ADD CONSTRAINT "WalletMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookAction" ADD CONSTRAINT "BookAction_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookAction" ADD CONSTRAINT "BookAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Borrow" ADD CONSTRAINT "Borrow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Borrow" ADD CONSTRAINT "Borrow_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookTag" ADD CONSTRAINT "BookTag_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookTag" ADD CONSTRAINT "BookTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
