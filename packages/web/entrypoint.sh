#!/bin/sh

if [ -z "$DATABASE_URL" ]; then
    echo "Error: Required environment variable DATABASE_URL is not set. Provide a valid PostgreSQL connection string."
    exit 1
fi

# Run a Database migration
echo -e "\e[34m[Info] Running database migration...\e[0m"
yarn workspace @sourcebot/db prisma:migrate:prod

# Run the command passed to the script
exec "$@"