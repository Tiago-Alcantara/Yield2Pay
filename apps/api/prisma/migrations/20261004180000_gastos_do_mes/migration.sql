-- CreateEnum
CREATE TYPE "ExpenseSource" AS ENUM ('conta', 'nota');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('mercado', 'conta_da_casa', 'transporte', 'outros');

-- CreateTable
CREATE TABLE "recurring_accounts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "month_expenses" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "merchant" TEXT NOT NULL,
    "spent_on" DATE NOT NULL,
    "source" "ExpenseSource" NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "access_key" TEXT,
    "recurring_account_id" TEXT,
    "year_month" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "month_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recurring_accounts_company_id_idx" ON "recurring_accounts"("company_id");

-- CreateIndex
CREATE INDEX "month_expenses_company_id_spent_on_idx" ON "month_expenses"("company_id", "spent_on");

-- CreateIndex
CREATE INDEX "month_expenses_company_id_year_month_idx" ON "month_expenses"("company_id", "year_month");

-- CreateIndex
CREATE UNIQUE INDEX "month_expenses_company_id_recurring_account_id_year_month_key" ON "month_expenses"("company_id", "recurring_account_id", "year_month");

-- CreateIndex
CREATE UNIQUE INDEX "month_expenses_company_id_access_key_key" ON "month_expenses"("company_id", "access_key");

-- AddForeignKey
ALTER TABLE "recurring_accounts" ADD CONSTRAINT "recurring_accounts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "month_expenses" ADD CONSTRAINT "month_expenses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "month_expenses" ADD CONSTRAINT "month_expenses_recurring_account_id_fkey" FOREIGN KEY ("recurring_account_id") REFERENCES "recurring_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
