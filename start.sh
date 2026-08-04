#!/bin/sh
# Demarre le bot MMTRADE en arriere-plan (avec redemarrage auto s'il crash,
# sans jamais tuer le conteneur -- Next.js reste le process principal suivi
# par Railway) puis Next.js au premier plan (Steven 04/08).
set -e

(
  cd /app/ghost-bot
  while true; do
    python3 real_web/server.py >> /app/ghost-bot/data/bot_stdout.log 2>&1 || true
    echo "[mmtrade-bot] process termine/crash a $(date) -- redemarrage dans 5s" >> /app/ghost-bot/data/bot_stdout.log
    sleep 5
  done
) &

cd /app
npx prisma migrate deploy
exec npm run start:next
