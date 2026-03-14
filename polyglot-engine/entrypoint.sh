#!/bin/sh
set -e

# Run migrations
node node_modules/prisma/build/index.js migrate deploy

# Start Next.js server, daemon, and Telegram bot
node server.js &
node daemon.js &
node bot.js &

wait
