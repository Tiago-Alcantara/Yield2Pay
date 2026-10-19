-- CreateTable
CREATE TABLE "person_names" (
    "company_id" TEXT NOT NULL,
    "display_name" TEXT,
    "full_name" TEXT,
    "email" TEXT,

    CONSTRAINT "person_names_pkey" PRIMARY KEY ("company_id")
);

-- CreateTable
CREATE TABLE "households" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owner_company_id" TEXT NOT NULL,
    "household_size" TEXT,
    "monthly_income_cents" INTEGER,
    "reserve_cents" INTEGER,
    "priorities" TEXT[] NOT NULL DEFAULT '{}',
    "goal_months" INTEGER,
    "crypto_experience" TEXT,
    "onboarding_completed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_members" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "household_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_invites" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "household_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statements" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "added_by_company_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "added_by_company_id" TEXT NOT NULL,
    "statement_id" TEXT,
    "spent_on" DATE NOT NULL,
    "merchant" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "fixed" BOOLEAN NOT NULL,
    "amount_cents" INTEGER NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_progress" (
    "company_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL,

    CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("company_id","lesson_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "households_owner_company_id_key" ON "households"("owner_company_id");

-- CreateIndex
CREATE UNIQUE INDEX "household_members_company_id_key" ON "household_members"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "household_members_household_id_company_id_key" ON "household_members"("household_id", "company_id");

-- CreateIndex
CREATE INDEX "expenses_household_id_spent_on_idx" ON "expenses"("household_id", "spent_on");

-- AddForeignKey
ALTER TABLE "person_names" ADD CONSTRAINT "person_names_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "households" ADD CONSTRAINT "households_owner_company_id_fkey" FOREIGN KEY ("owner_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_invites" ADD CONSTRAINT "household_invites_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statements" ADD CONSTRAINT "statements_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_statement_id_fkey" FOREIGN KEY ("statement_id") REFERENCES "statements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
