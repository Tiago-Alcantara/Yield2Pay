ALTER TABLE "deposits" ADD COLUMN "venue_id" TEXT NOT NULL DEFAULT 'stellar:blend';
CREATE INDEX "deposits_company_id_venue_id_idx" ON "deposits"("company_id", "venue_id");
