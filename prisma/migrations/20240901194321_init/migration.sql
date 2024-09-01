-- CreateTable
CREATE TABLE "Wallet" (
    "id" SERIAL NOT NULL,
    "chatId" INTEGER NOT NULL,
    "public" TEXT NOT NULL,
    "private" TEXT NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);
