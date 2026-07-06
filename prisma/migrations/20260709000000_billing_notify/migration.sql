-- AlterEnum
ALTER TYPE "EmailType" ADD VALUE 'new_booking_pro';

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "stripe_customer_id" TEXT,
ADD COLUMN     "subscription_id" TEXT,
ADD COLUMN     "subscription_status" TEXT;

