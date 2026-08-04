-- CreateTable
CREATE TABLE "mmtrade_killswitch_events" (
    "id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "cash_at_trigger" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mmtrade_killswitch_events_pkey" PRIMARY KEY ("id")
);
