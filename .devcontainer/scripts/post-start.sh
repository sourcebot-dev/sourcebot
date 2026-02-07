#!/bin/bash
# post-start.sh - Runs each time the container starts
set -e

echo "=========================================="
echo "Sourcebot Dev Container: Post-Start Check"
echo "=========================================="

cd /workspaces/sourcebot

# 1. Wait for PostgreSQL to be ready
echo ""
echo "[1/2] Checking PostgreSQL connection..."
timeout=30
counter=0
until pg_isready -h postgres -p 5432 -U postgres > /dev/null 2>&1; do
  counter=$((counter + 1))
  if [ $counter -ge $timeout ]; then
    echo "ERROR: PostgreSQL did not become ready within ${timeout} seconds"
    exit 1
  fi
  echo "  Waiting for PostgreSQL... ($counter/$timeout)"
  sleep 1
done
echo "PostgreSQL is ready!"

# 2. Wait for Redis to be ready
echo ""
echo "[2/2] Checking Redis connection..."
counter=0
until redis-cli -h redis -p 6379 ping > /dev/null 2>&1; do
  counter=$((counter + 1))
  if [ $counter -ge $timeout ]; then
    echo "ERROR: Redis did not become ready within ${timeout} seconds"
    exit 1
  fi
  echo "  Waiting for Redis... ($counter/$timeout)"
  sleep 1
done
echo "Redis is ready!"

echo ""
echo "=========================================="
echo "Dev container is ready!"
echo ""
echo "To start development, run:"
echo "  yarn dev"
echo "=========================================="
