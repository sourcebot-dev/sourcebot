#!/bin/bash
set -e

# Container name
CONTAINER_NAME="dev-postgres"

# Start PostgreSQL container
echo "[Info] Starting PostgreSQL container..."
docker run --name $CONTAINER_NAME \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -e POSTGRES_DB=sourcebot \
  -p 5432:5432 \
  --rm -d postgres:latest

# Wait for PostgreSQL to be ready
echo "[Info] Waiting for PostgreSQL to be ready..."
until docker exec $CONTAINER_NAME pg_isready -U postgres > /dev/null 2>&1; do
  sleep 1
done

# Run Prisma migrate dev
echo "[Info] Running Prisma migrations..."
yarn prisma migrate dev

# Shut down the PostgreSQL container
echo "[Info] Shutting down PostgreSQL container..."
docker stop $CONTAINER_NAME

echo "[Info] Migrations completed successfully."
