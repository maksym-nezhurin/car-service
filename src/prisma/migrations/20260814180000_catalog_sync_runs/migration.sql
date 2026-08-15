-- ETL audit log (docs/V1_7_VEHICLE_ENCYCLOPEDIA.md §13.2, §13.4 step 1).
-- Standalone table, no FKs to existing catalog_* tables — zero risk to existing write paths.

CREATE TABLE "catalog_sync_runs" (
    "id" TEXT NOT NULL,
    "script" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "scope_make_slug" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "stats" JSONB,
    "error_message" TEXT,

    CONSTRAINT "catalog_sync_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "catalog_sync_runs_script_started_at_idx" ON "catalog_sync_runs"("script", "started_at");
