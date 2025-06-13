-- CreateTable
CREATE TABLE "Audit" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "sourcebotVersion" TEXT NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "Audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Audit_actorId_actorType_targetId_targetType_idx" ON "Audit"("actorId", "actorType", "targetId", "targetType");
