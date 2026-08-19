-- AUT-20 — GarageServiceVisit.workOrderId referenced a WorkOrder entity that has never
-- existed in this schema (grep on services/car/src confirmed zero reads/writes of the
-- field anywhere in application code) — a dead forward-reference to the not-yet-built
-- v1.4 "Services & work orders" concept (docs/V1_4_SERVICES_AND_WORK_ORDERS.md), not a
-- deliberate placeholder. Dropping now rather than carrying an unused, undocumented
-- column; re-add when v1.4 actually ships a real WorkOrder model. See
-- docs/DATA_MODEL_STANDARDS.md §9 #1.

ALTER TABLE "garage_service_visits" DROP COLUMN "work_order_id";
