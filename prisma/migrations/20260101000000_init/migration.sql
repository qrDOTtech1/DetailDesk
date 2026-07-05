-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('studio', 'mobile', 'both');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('owner', 'staff');

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('interior', 'exterior', 'polish', 'ceramic', 'restoration', 'other');

-- CreateEnum
CREATE TYPE "DepositType" AS ENUM ('fixed', 'percent');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'succeeded', 'failed', 'cancelled', 'refunded');

-- CreateEnum
CREATE TYPE "EmailType" AS ENUM ('welcome', 'booking_confirmation', 'payment_confirmation', 'booking_reminder', 'booking_cancelled');

-- CreateEnum
CREATE TYPE "SizeCategory" AS ENUM ('compact', 'sedan', 'suv', 'truck', 'van', 'other');

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT,
    "platform_role" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "businesses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "business_type" "BusinessType" NOT NULL DEFAULT 'studio',
    "logo_url" TEXT,
    "cancellation_policy" TEXT,
    "stripe_account_id" TEXT,
    "stripe_connected" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_members" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'owner',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "ServiceCategory" NOT NULL DEFAULT 'other',
    "price_cents" INTEGER NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "deposit_required" BOOLEAN NOT NULL DEFAULT false,
    "deposit_type" "DepositType" NOT NULL DEFAULT 'fixed',
    "deposit_value" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER,
    "plate" TEXT,
    "size_category" "SizeCategory",
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "vehicle_id" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'pending',
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "total_price_cents" INTEGER NOT NULL,
    "deposit_amount_cents" INTEGER NOT NULL DEFAULT 0,
    "deposit_paid" BOOLEAN NOT NULL DEFAULT false,
    "public_cancel_token" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_status_history" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "old_status" "BookingStatus",
    "new_status" "BookingStatus" NOT NULL,
    "changed_by_profile_id" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "stripe_payment_intent_id" TEXT,
    "stripe_checkout_session_id" TEXT,
    "stripe_connected_account_id" TEXT,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'eur',
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "application_fee_cents" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_rules" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "availability_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocked_slots" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,

    CONSTRAINT "blocked_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_settings" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Paris',
    "reminder_hours_before" INTEGER NOT NULL DEFAULT 24,
    "booking_notice_hours" INTEGER NOT NULL DEFAULT 12,
    "buffer_minutes" INTEGER NOT NULL DEFAULT 15,
    "confirmation_message" TEXT,
    "reminder_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "business_id" TEXT,
    "booking_id" TEXT,
    "resend_id" TEXT,
    "type" "EmailType" NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_reminders" (
    "booking_id" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_reminders_pkey" PRIMARY KEY ("booking_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles"("email");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "businesses_slug_key" ON "businesses"("slug");

-- CreateIndex
CREATE INDEX "business_members_user_id_idx" ON "business_members"("user_id");

-- CreateIndex
CREATE INDEX "business_members_business_id_idx" ON "business_members"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "business_members_business_id_user_id_key" ON "business_members"("business_id", "user_id");

-- CreateIndex
CREATE INDEX "services_business_id_idx" ON "services"("business_id");

-- CreateIndex
CREATE INDEX "customers_business_id_idx" ON "customers"("business_id");

-- CreateIndex
CREATE INDEX "vehicles_business_id_idx" ON "vehicles"("business_id");

-- CreateIndex
CREATE INDEX "vehicles_customer_id_idx" ON "vehicles"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_public_cancel_token_key" ON "bookings"("public_cancel_token");

-- CreateIndex
CREATE INDEX "bookings_business_id_idx" ON "bookings"("business_id");

-- CreateIndex
CREATE INDEX "bookings_business_id_starts_at_idx" ON "bookings"("business_id", "starts_at");

-- CreateIndex
CREATE INDEX "bookings_business_id_status_idx" ON "bookings"("business_id", "status");

-- CreateIndex
CREATE INDEX "booking_status_history_business_id_booking_id_idx" ON "booking_status_history"("business_id", "booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripe_checkout_session_id_key" ON "payments"("stripe_checkout_session_id");

-- CreateIndex
CREATE INDEX "payments_business_id_idx" ON "payments"("business_id");

-- CreateIndex
CREATE INDEX "payments_booking_id_idx" ON "payments"("booking_id");

-- CreateIndex
CREATE INDEX "availability_rules_business_id_idx" ON "availability_rules"("business_id");

-- CreateIndex
CREATE INDEX "blocked_slots_business_id_idx" ON "blocked_slots"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "business_settings_business_id_key" ON "business_settings"("business_id");

-- CreateIndex
CREATE INDEX "email_logs_business_id_idx" ON "email_logs"("business_id");

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_members" ADD CONSTRAINT "business_members_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_members" ADD CONSTRAINT "business_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_changed_by_profile_id_fkey" FOREIGN KEY ("changed_by_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocked_slots" ADD CONSTRAINT "blocked_slots_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_reminders" ADD CONSTRAINT "booking_reminders_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

