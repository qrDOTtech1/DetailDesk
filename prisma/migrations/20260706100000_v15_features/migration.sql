-- CreateEnum
CREATE TYPE "PhotoKind" AS ENUM ('before', 'after');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EmailType" ADD VALUE 'review_request';
ALTER TYPE "EmailType" ADD VALUE 'rebooking_reminder';

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "rebook_after_days" INTEGER;

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "rebooking_reminder_sent_at" TIMESTAMP(3),
ADD COLUMN     "review_request_sent_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "business_settings" ADD COLUMN     "google_review_url" TEXT;

-- CreateTable
CREATE TABLE "service_addons" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_addons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_addons" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_cents" INTEGER NOT NULL,

    CONSTRAINT "booking_addons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_photos" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "kind" "PhotoKind" NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_addons_business_id_idx" ON "service_addons"("business_id");

-- CreateIndex
CREATE INDEX "service_addons_service_id_idx" ON "service_addons"("service_id");

-- CreateIndex
CREATE INDEX "booking_addons_booking_id_idx" ON "booking_addons"("booking_id");

-- CreateIndex
CREATE INDEX "booking_photos_booking_id_idx" ON "booking_photos"("booking_id");

-- AddForeignKey
ALTER TABLE "service_addons" ADD CONSTRAINT "service_addons_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_addons" ADD CONSTRAINT "booking_addons_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_photos" ADD CONSTRAINT "booking_photos_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

