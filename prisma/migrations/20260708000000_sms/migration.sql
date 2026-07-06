-- AlterTable
ALTER TABLE "business_settings" ADD COLUMN     "sms_quota_monthly" INTEGER NOT NULL DEFAULT 150,
ADD COLUMN     "sms_reminders_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "sms_logs" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "booking_id" TEXT,
    "recipient" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "clicksend_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sms_logs_business_id_created_at_idx" ON "sms_logs"("business_id", "created_at");

