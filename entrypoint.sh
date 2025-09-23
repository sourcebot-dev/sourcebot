#!/bin/sh
set -e

if [ "$DATABASE_URL" = "postgresql://postgres@localhost:5432/sourcebot" ]; then
    DATABASE_EMBEDDED="true"
fi

echo -e "\e[34m[Info] Sourcebot version: $NEXT_PUBLIC_SOURCEBOT_VERSION\e[0m"

# If we don't have a PostHog key, then we need to disable telemetry.
if [ -z "$NEXT_PUBLIC_POSTHOG_PAPIK" ]; then
    echo -e "\e[33m[Warning] NEXT_PUBLIC_POSTHOG_PAPIK was not set. Setting SOURCEBOT_TELEMETRY_DISABLED.\e[0m"
    export SOURCEBOT_TELEMETRY_DISABLED=true
fi

if [ -n "$SOURCEBOT_TELEMETRY_DISABLED" ]; then
    # Validate that SOURCEBOT_TELEMETRY_DISABLED is either "true" or "false"
    if [ "$SOURCEBOT_TELEMETRY_DISABLED" != "true" ] && [ "$SOURCEBOT_TELEMETRY_DISABLED" != "false" ]; then
        echo -e "\e[31m[Error] SOURCEBOT_TELEMETRY_DISABLED must be either 'true' or 'false'. Got '$SOURCEBOT_TELEMETRY_DISABLED'\e[0m"
        exit 1
    fi
else
    export SOURCEBOT_TELEMETRY_DISABLED=false
fi

# Issue a info message about telemetry
if [ "$SOURCEBOT_TELEMETRY_DISABLED" = "true" ]; then
    echo -e "\e[34m[Info] Disabling telemetry since SOURCEBOT_TELEMETRY_DISABLED was set.\e[0m"
fi

# Check if DATA_CACHE_DIR exists, if not create it
if [ ! -d "$DATA_CACHE_DIR" ]; then
    mkdir -m 0750 -p "$DATA_CACHE_DIR"
fi

# Check if DATABASE_DATA_DIR exists, if not initialize it
if [ "$DATABASE_EMBEDDED" = "true" ] && [ ! -d "$DATABASE_DATA_DIR" ]; then
    echo -e "\e[34m[Info] Initializing database at $DATABASE_D\ATA_DIR...\e[0m"
    mkdir -m 0750 -p $DATABASE_DATA_DIR

    initdb -D "$DATABASE_DATA_DIR"
fi

# Create the redis data directory if it doesn't exist
if [ ! -d "$REDIS_DATA_DIR" ]; then
    mkdir -m 0750 -p $REDIS_DATA_DIR
fi

if [ -z "$SOURCEBOT_ENCRYPTION_KEY" ]; then
    echo -e "\e[33m[Warning] SOURCEBOT_ENCRYPTION_KEY is not set.\e[0m"

    if [ -f "$DATA_CACHE_DIR/.secret" ]; then
        echo -e "\e[34m[Info] Loading environment variables from $DATA_CACHE_DIR/.secret\e[0m"
    else
        echo -e "\e[34m[Info] Generating a new encryption key...\e[0m"
        SOURCEBOT_ENCRYPTION_KEY=$(openssl rand -base64 24)
        echo "SOURCEBOT_ENCRYPTION_KEY=\"$SOURCEBOT_ENCRYPTION_KEY\"" >> "$DATA_CACHE_DIR/.secret"
    fi

    set -a
    . "$DATA_CACHE_DIR/.secret"
    set +a
fi

# @see : https://authjs.dev/getting-started/deployment#auth_secret
if [ -z "$AUTH_SECRET" ]; then
    echo -e "\e[33m[Warning] AUTH_SECRET is not set.\e[0m"

    if [ -f "$DATA_CACHE_DIR/.authjs-secret" ]; then
        echo -e "\e[34m[Info] Loading environment variables from $DATA_CACHE_DIR/.authjs-secret\e[0m"
    else
        echo -e "\e[34m[Info] Generating a new encryption key...\e[0m"
        AUTH_SECRET=$(openssl rand -base64 33)
        echo "AUTH_SECRET=\"$AUTH_SECRET\"" >> "$DATA_CACHE_DIR/.authjs-secret"
    fi

    set -a
    . "$DATA_CACHE_DIR/.authjs-secret"
    set +a
fi

if [ -z "$AUTH_URL" ]; then
    echo -e "\e[33m[Warning] AUTH_URL is not set.\e[0m"
    export AUTH_URL="http://localhost:3000"
fi

# In order to detect if this is the first run, we create a `.installed` file in
# the cache directory.
FIRST_RUN_FILE="$DATA_CACHE_DIR/.installedv3"

if [ ! -f "$FIRST_RUN_FILE" ]; then
    touch "$FIRST_RUN_FILE"
    export SOURCEBOT_INSTALL_ID=$(uuidgen)
    
    # If this is our first run, send a `install` event to PostHog
    # (if telemetry is enabled)
    if [ "$SOURCEBOT_TELEMETRY_DISABLED" = "false" ]; then
        if ! ( curl -L --output /dev/null --silent --fail --header "Content-Type: application/json" -d '{
            "api_key": "'"$NEXT_PUBLIC_POSTHOG_PAPIK"'",
            "event": "install",
            "distinct_id": "'"$SOURCEBOT_INSTALL_ID"'",
            "properties": {
                "sourcebot_version": "'"$NEXT_PUBLIC_SOURCEBOT_VERSION"'"
            }
        }' https://us.i.posthog.com/capture/ ) then
            echo -e "\e[33m[Warning] Failed to send install event.\e[0m"
        fi
    fi
else
    export SOURCEBOT_INSTALL_ID=$(cat "$FIRST_RUN_FILE" | jq -r '.install_id')
    PREVIOUS_VERSION=$(cat "$FIRST_RUN_FILE" | jq -r '.version')

    # If the version has changed, we assume an upgrade has occurred.
    if [ "$PREVIOUS_VERSION" != "$NEXT_PUBLIC_SOURCEBOT_VERSION" ]; then
        echo -e "\e[34m[Info] Upgraded from version $PREVIOUS_VERSION to $NEXT_PUBLIC_SOURCEBOT_VERSION\e[0m"

        if [ "$SOURCEBOT_TELEMETRY_DISABLED" = "false" ]; then
            if ! ( curl -L --output /dev/null --silent --fail --header "Content-Type: application/json" -d '{
                "api_key": "'"$NEXT_PUBLIC_POSTHOG_PAPIK"'",
                "event": "upgrade",
                "distinct_id": "'"$SOURCEBOT_INSTALL_ID"'",
                "properties": {
                    "from_version": "'"$PREVIOUS_VERSION"'",
                    "to_version": "'"$NEXT_PUBLIC_SOURCEBOT_VERSION"'"
                }
            }' https://us.i.posthog.com/capture/ ) then
                echo -e "\e[33m[Warning] Failed to send upgrade event.\e[0m"
            fi
        fi
    fi
fi

echo "{\"version\": \"$NEXT_PUBLIC_SOURCEBOT_VERSION\", \"install_id\": \"$SOURCEBOT_INSTALL_ID\"}" > "$FIRST_RUN_FILE"


# Start the database and wait for it to be ready before starting any other service
if [ "$DATABASE_EMBEDDED" = "true" ]; then
    postgres -D "$DATABASE_DATA_DIR" &
    until pg_isready -h localhost -p 5432 -d sourcebot -U postgres; do
        echo -e "\e[34m[Info] Waiting for the database to be ready...\e[0m"
        sleep 1

        # As postgres runs in the background, we must check if it is still
        # running, otherwise the "until" loop will be running indefinitely.
        if ! pgrep -x "postgres" > /dev/null; then
            echo "postgres failed to run"
            exit 1
        break
    fi
    done

    # Running as non-root we need to ensure the postgres account is created.
    psql -U postgres -tc "SELECT 1 FROM pg_roles WHERE rolname='postgres'" | grep -q 1 \
        || createuser postgres -s

    # Check if the database already exists, and create it if it doesn't
    EXISTING_DB=$(psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'sourcebot'")

    if [ "$EXISTING_DB" = "1" ]; then
        echo "Database 'sourcebot' already exists; skipping creation."
    else
        echo "Creating database 'sourcebot'..."
        psql -U postgres -c "CREATE DATABASE \"sourcebot\""
    fi
fi

# Run a Database migration
echo -e "\e[34m[Info] Running database migration...\e[0m"
yarn workspace @sourcebot/db prisma:migrate:prod

# Create the log directory
mkdir -p /var/log/sourcebot

# Run supervisord
exec supervisord -c /etc/supervisor/conf.d/supervisord.conf
