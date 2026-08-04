-- CreateTable
CREATE TABLE "mmtrade_config_state" (
    "id" TEXT NOT NULL,
    "floor_usd" DOUBLE PRECISION NOT NULL,
    "killswitch_enabled" BOOLEAN NOT NULL,
    "killswitch_cash_floor_usd" DOUBLE PRECISION NOT NULL,
    "killswitch_max_session_loss_usd" DOUBLE PRECISION NOT NULL,
    "killswitch_max_global_consec_losses" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mmtrade_config_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mmtrade_config_events" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mmtrade_config_events_pkey" PRIMARY KEY ("id")
);
