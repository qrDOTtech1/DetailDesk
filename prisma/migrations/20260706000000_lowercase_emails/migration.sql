-- Normalize existing emails to lowercase (login/lookup is now case-insensitive
-- via lowercasing at the application boundary).
UPDATE "profiles" SET "email" = lower("email") WHERE "email" <> lower("email");
UPDATE "customers" SET "email" = lower("email") WHERE "email" IS NOT NULL AND "email" <> lower("email");
UPDATE "businesses" SET "email" = lower("email") WHERE "email" <> lower("email");
