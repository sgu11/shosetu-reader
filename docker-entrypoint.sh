#!/bin/sh
set -e

echo "Running database migrations..."
npx drizzle-kit migrate 2>&1 || echo "Migration warning: drizzle-kit migrate returned non-zero (may be first run)"

echo "Starting server..."
exec node server.js
