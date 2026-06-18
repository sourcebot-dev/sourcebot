-- CreateTable
CREATE TABLE "SeatUsageEvent" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seatCount" INTEGER NOT NULL,
    "orgId" INTEGER NOT NULL,

    CONSTRAINT "SeatUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SeatUsageEvent_orgId_timestamp_idx" ON "SeatUsageEvent"("orgId", "timestamp");

-- AddForeignKey
ALTER TABLE "SeatUsageEvent" ADD CONSTRAINT "SeatUsageEvent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill a baseline seat-count row for every existing org, using its current
-- member count. The LEFT JOIN ensures orgs with zero members get a row too.
INSERT INTO "SeatUsageEvent" ("id", "seatCount", "orgId")
SELECT
    gen_random_uuid()::text,
    COUNT("UserToOrg"."userId")::int,
    "Org"."id"
FROM "Org"
LEFT JOIN "UserToOrg" ON "UserToOrg"."orgId" = "Org"."id"
GROUP BY "Org"."id";
