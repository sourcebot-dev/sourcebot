-- CreateIndex
CREATE INDEX "idx_audit_core_actions_full" ON "Audit"("orgId", "timestamp", "action", "actorId");

-- CreateIndex
CREATE INDEX "idx_audit_actor_time_full" ON "Audit"("actorId", "timestamp");
