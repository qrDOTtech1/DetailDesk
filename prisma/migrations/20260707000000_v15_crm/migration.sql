-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('fixed', 'percent');

-- AlterEnum
ALTER TYPE "PhotoKind" ADD VALUE 'general';

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "is_vip" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "trim" TEXT;

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "discount_cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "promotion_id" TEXT;

-- AlterTable
ALTER TABLE "business_settings" ADD COLUMN     "show_public_gallery" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "booking_photos" ADD COLUMN     "caption" TEXT,
ADD COLUMN     "customer_id" TEXT,
ADD COLUMN     "is_public_visible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_shareable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "vehicle_id" TEXT,
ALTER COLUMN "booking_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "customer_consents" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "consent_type" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT false,
    "granted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "source" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_login_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_login_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "discount_type" "DiscountType" NOT NULL,
    "discount_value" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "usage_limit" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_redemptions" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "promotion_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_consents_business_id_idx" ON "customer_consents"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_consents_customer_id_consent_type_key" ON "customer_consents"("customer_id", "consent_type");

-- CreateIndex
CREATE UNIQUE INDEX "portal_login_tokens_token_key" ON "portal_login_tokens"("token");

-- CreateIndex
CREATE INDEX "promotions_business_id_idx" ON "promotions"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "promotions_business_id_code_key" ON "promotions"("business_id", "code");

-- CreateIndex
CREATE INDEX "promotion_redemptions_promotion_id_idx" ON "promotion_redemptions"("promotion_id");

-- CreateIndex
CREATE INDEX "booking_photos_vehicle_id_idx" ON "booking_photos"("vehicle_id");

-- CreateIndex
CREATE INDEX "booking_photos_business_id_idx" ON "booking_photos"("business_id");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_photos" ADD CONSTRAINT "booking_photos_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_photos" ADD CONSTRAINT "booking_photos_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_consents" ADD CONSTRAINT "customer_consents_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_login_tokens" ADD CONSTRAINT "portal_login_tokens_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_redemptions" ADD CONSTRAINT "promotion_redemptions_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

