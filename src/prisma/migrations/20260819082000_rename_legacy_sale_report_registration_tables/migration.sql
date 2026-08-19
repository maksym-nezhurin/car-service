-- AUT-15 step 3/3 — snake_case @@map/@map for the sale/report/registration "epoch 1"
-- models: VehicleSaleListing, ListingDistribution, VehicleReport,
-- VehicleReportAccessGrant, VehicleProfileViewLog, VehicleRegistrationEvent,
-- VehicleSaleContract. Pure rename — no data change, no column type change.
-- (VehicleTechnicalInspection/VehicleInsurancePolicy were already fully mapped and are
-- NOT part of this migration — see docs/DATA_MODEL_STANDARDS.md §3.1 correction.)
-- Explicitly-named indexes/unique constraints (e.g. "sale_listing_vehicle_owner_idx",
-- "sale_listing_platform_unique") already follow the snake_case convention and are left
-- untouched. See docs/DATA_MODEL_STANDARDS.md §7 step 2 and Linear AUT-15.
--
-- Constraint names below assume the default Prisma-generated names for these tables
-- (never overridden before this migration) — verify against the target database before
-- applying.

-- 1. Tables
ALTER TABLE "VehicleSaleListing" RENAME TO "vehicle_sale_listings";
ALTER TABLE "ListingDistribution" RENAME TO "listing_distributions";
ALTER TABLE "VehicleReport" RENAME TO "vehicle_reports";
ALTER TABLE "VehicleReportAccessGrant" RENAME TO "vehicle_report_access_grants";
ALTER TABLE "VehicleProfileViewLog" RENAME TO "vehicle_profile_view_logs";
ALTER TABLE "VehicleRegistrationEvent" RENAME TO "vehicle_registration_events";
ALTER TABLE "VehicleSaleContract" RENAME TO "vehicle_sale_contracts";

-- 2. Columns
ALTER TABLE "vehicle_sale_listings" RENAME COLUMN "vehicleId" TO "vehicle_id";
ALTER TABLE "vehicle_sale_listings" RENAME COLUMN "ownerUserId" TO "owner_user_id";
ALTER TABLE "vehicle_sale_listings" RENAME COLUMN "marketRegion" TO "market_region";
ALTER TABLE "vehicle_sale_listings" RENAME COLUMN "specsJson" TO "specs_json";
ALTER TABLE "vehicle_sale_listings" RENAME COLUMN "appearanceJson" TO "appearance_json";
ALTER TABLE "vehicle_sale_listings" RENAME COLUMN "featuresJson" TO "features_json";
ALTER TABLE "vehicle_sale_listings" RENAME COLUMN "contactJson" TO "contact_json";
ALTER TABLE "vehicle_sale_listings" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "vehicle_sale_listings" RENAME COLUMN "updatedAt" TO "updated_at";

ALTER TABLE "listing_distributions" RENAME COLUMN "saleListingId" TO "sale_listing_id";
ALTER TABLE "listing_distributions" RENAME COLUMN "externalId" TO "external_id";
ALTER TABLE "listing_distributions" RENAME COLUMN "externalUrl" TO "external_url";
ALTER TABLE "listing_distributions" RENAME COLUMN "lastError" TO "last_error";
ALTER TABLE "listing_distributions" RENAME COLUMN "payloadSnapshot" TO "payload_snapshot";
ALTER TABLE "listing_distributions" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "listing_distributions" RENAME COLUMN "updatedAt" TO "updated_at";

ALTER TABLE "vehicle_reports" RENAME COLUMN "vehicleId" TO "vehicle_id";
ALTER TABLE "vehicle_reports" RENAME COLUMN "rawPayload" TO "raw_payload";
ALTER TABLE "vehicle_reports" RENAME COLUMN "fetchedAt" TO "fetched_at";
ALTER TABLE "vehicle_reports" RENAME COLUMN "expiresAt" TO "expires_at";
ALTER TABLE "vehicle_reports" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "vehicle_reports" RENAME COLUMN "updatedAt" TO "updated_at";

ALTER TABLE "vehicle_report_access_grants" RENAME COLUMN "vehicleId" TO "vehicle_id";
ALTER TABLE "vehicle_report_access_grants" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "vehicle_report_access_grants" RENAME COLUMN "accessLevel" TO "access_level";
ALTER TABLE "vehicle_report_access_grants" RENAME COLUMN "validUntil" TO "valid_until";
ALTER TABLE "vehicle_report_access_grants" RENAME COLUMN "createdAt" TO "created_at";

ALTER TABLE "vehicle_profile_view_logs" RENAME COLUMN "vehicleId" TO "vehicle_id";
ALTER TABLE "vehicle_profile_view_logs" RENAME COLUMN "viewerUserId" TO "viewer_user_id";
ALTER TABLE "vehicle_profile_view_logs" RENAME COLUMN "requestedTier" TO "requested_tier";
ALTER TABLE "vehicle_profile_view_logs" RENAME COLUMN "resolvedTier" TO "resolved_tier";
ALTER TABLE "vehicle_profile_view_logs" RENAME COLUMN "createdAt" TO "created_at";

ALTER TABLE "vehicle_registration_events" RENAME COLUMN "vehicleId" TO "vehicle_id";
ALTER TABLE "vehicle_registration_events" RENAME COLUMN "ownerUserId" TO "owner_user_id";
ALTER TABLE "vehicle_registration_events" RENAME COLUMN "eventType" TO "event_type";
ALTER TABLE "vehicle_registration_events" RENAME COLUMN "eventDate" TO "event_date";
ALTER TABLE "vehicle_registration_events" RENAME COLUMN "countryCode" TO "country_code";
ALTER TABLE "vehicle_registration_events" RENAME COLUMN "createdAt" TO "created_at";

ALTER TABLE "vehicle_sale_contracts" RENAME COLUMN "vehicleId" TO "vehicle_id";
ALTER TABLE "vehicle_sale_contracts" RENAME COLUMN "sellerUserId" TO "seller_user_id";
ALTER TABLE "vehicle_sale_contracts" RENAME COLUMN "buyerUserId" TO "buyer_user_id";
ALTER TABLE "vehicle_sale_contracts" RENAME COLUMN "sellerSnapshot" TO "seller_snapshot";
ALTER TABLE "vehicle_sale_contracts" RENAME COLUMN "buyerSnapshot" TO "buyer_snapshot";
ALTER TABLE "vehicle_sale_contracts" RENAME COLUMN "salePriceAmount" TO "sale_price_amount";
ALTER TABLE "vehicle_sale_contracts" RENAME COLUMN "salePriceCurrency" TO "sale_price_currency";
ALTER TABLE "vehicle_sale_contracts" RENAME COLUMN "contractDate" TO "contract_date";
ALTER TABLE "vehicle_sale_contracts" RENAME COLUMN "generatedText" TO "generated_text";
ALTER TABLE "vehicle_sale_contracts" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "vehicle_sale_contracts" RENAME COLUMN "updatedAt" TO "updated_at";

-- 3. Primary key constraints
ALTER TABLE "vehicle_sale_listings" RENAME CONSTRAINT "VehicleSaleListing_pkey" TO "vehicle_sale_listings_pkey";
ALTER TABLE "listing_distributions" RENAME CONSTRAINT "ListingDistribution_pkey" TO "listing_distributions_pkey";
ALTER TABLE "vehicle_reports" RENAME CONSTRAINT "VehicleReport_pkey" TO "vehicle_reports_pkey";
ALTER TABLE "vehicle_report_access_grants" RENAME CONSTRAINT "VehicleReportAccessGrant_pkey" TO "vehicle_report_access_grants_pkey";
ALTER TABLE "vehicle_profile_view_logs" RENAME CONSTRAINT "VehicleProfileViewLog_pkey" TO "vehicle_profile_view_logs_pkey";
ALTER TABLE "vehicle_registration_events" RENAME CONSTRAINT "VehicleRegistrationEvent_pkey" TO "vehicle_registration_events_pkey";
ALTER TABLE "vehicle_sale_contracts" RENAME CONSTRAINT "VehicleSaleContract_pkey" TO "vehicle_sale_contracts_pkey";

-- 4. Foreign key constraints
ALTER TABLE "vehicle_sale_listings" RENAME CONSTRAINT "VehicleSaleListing_vehicleId_fkey" TO "vehicle_sale_listings_vehicle_id_fkey";
ALTER TABLE "listing_distributions" RENAME CONSTRAINT "ListingDistribution_saleListingId_fkey" TO "listing_distributions_sale_listing_id_fkey";
ALTER TABLE "vehicle_reports" RENAME CONSTRAINT "VehicleReport_vehicleId_fkey" TO "vehicle_reports_vehicle_id_fkey";
ALTER TABLE "vehicle_report_access_grants" RENAME CONSTRAINT "VehicleReportAccessGrant_vehicleId_fkey" TO "vehicle_report_access_grants_vehicle_id_fkey";
ALTER TABLE "vehicle_profile_view_logs" RENAME CONSTRAINT "VehicleProfileViewLog_vehicleId_fkey" TO "vehicle_profile_view_logs_vehicle_id_fkey";
ALTER TABLE "vehicle_registration_events" RENAME CONSTRAINT "VehicleRegistrationEvent_vehicleId_fkey" TO "vehicle_registration_events_vehicle_id_fkey";
ALTER TABLE "vehicle_sale_contracts" RENAME CONSTRAINT "VehicleSaleContract_vehicleId_fkey" TO "vehicle_sale_contracts_vehicle_id_fkey";
