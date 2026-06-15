#!/bin/sh
set -e
# Appliquer les migrations Prisma au démarrage
npx prisma migrate deploy || true
exec "$@"
