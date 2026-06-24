-- CreateEnum
CREATE TYPE "BillType" AS ENUM ('software', 'utility', 'other');

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "privy_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "stellar_address" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposits" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "tx_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deposits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_bills" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "monthly_cost" BIGINT NOT NULL,
    "type" "BillType" NOT NULL DEFAULT 'software',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yield_snapshots" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "vault_value" BIGINT NOT NULL,
    "principal" BIGINT NOT NULL,
    "spendable" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "yield_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_privy_user_id_key" ON "companies"("privy_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_company_id_key" ON "wallets"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_stellar_address_key" ON "wallets"("stellar_address");

-- CreateIndex
CREATE UNIQUE INDEX "deposits_tx_hash_key" ON "deposits"("tx_hash");

-- CreateIndex
CREATE INDEX "yield_snapshots_company_id_created_at_idx" ON "yield_snapshots"("company_id", "created_at");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_bills" ADD CONSTRAINT "recurring_bills_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yield_snapshots" ADD CONSTRAINT "yield_snapshots_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
