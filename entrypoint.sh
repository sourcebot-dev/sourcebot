#!/bin/sh
set -e

echo -e "\e[34m[Info] Sourcebot version: $SOURCEBOT_VERSION\e[0m"

# If we don't have a PostHog key, then we need to disable telemetry.
if [ -z "$POSTHOG_PAPIK" ]; then
    echo -e "\e[33m[Warning] POSTHOG_PAPIK was not set. Setting SOURCEBOT_TELEMETRY_DISABLED.\e[0m"
    export SOURCEBOT_TELEMETRY_DISABLED=1
fi

# Issue a info message about telemetry
if [ ! -z "$SOURCEBOT_TELEMETRY_DISABLED" ]; then
    echo -e "\e[34m[Info] Disabling telemetry since SOURCEBOT_TELEMETRY_DISABLED was set.\e[0m"
fi

# Check if DATA_CACHE_DIR exists, if not create it
if [ ! -d "$DATA_CACHE_DIR" ]; then
    mkdir -p "$DATA_CACHE_DIR"
fi

# Check if DB_DATA_DIR exists, if not initialize it
if [ ! -d "$DB_DATA_DIR" ]; then
    echo -e "\e[34m[Info] Initializing database at $DB_DATA_DIR...\e[0m"
    mkdir -p $DB_DATA_DIR && chown -R postgres:postgres "$DB_DATA_DIR"
    su postgres -c "initdb -D $DB_DATA_DIR"
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

# In order to detect if this is the first run, we create a `.installed` file in
# the cache directory.
FIRST_RUN_FILE="$DATA_CACHE_DIR/.installedv2"

if [ ! -f "$FIRST_RUN_FILE" ]; then
    touch "$FIRST_RUN_FILE"
    export SOURCEBOT_INSTALL_ID=$(uuidgen)
    
    # If this is our first run, send a `install` event to PostHog
    # (if telemetry is enabled)
    if [ -z "$SOURCEBOT_TELEMETRY_DISABLED" ]; then
        if ! ( curl -L --output /dev/null --silent --fail --header "Content-Type: application/json" -d '{
            "api_key": "'"$POSTHOG_PAPIK"'",
            "event": "install",
            "distinct_id": "'"$SOURCEBOT_INSTALL_ID"'",
            "properties": {
                "sourcebot_version": "'"$SOURCEBOT_VERSION"'"
            }
        }' https://us.i.posthog.com/capture/ ) then
            echo -e "\e[33m[Warning] Failed to send install event.\e[0m"
        fi
    fi
else
    export SOURCEBOT_INSTALL_ID=$(cat "$FIRST_RUN_FILE" | jq -r '.install_id')
    PREVIOUS_VERSION=$(cat "$FIRST_RUN_FILE" | jq -r '.version')

    # If the version has changed, we assume an upgrade has occurred.
    if [ "$PREVIOUS_VERSION" != "$SOURCEBOT_VERSION" ]; then
        echo -e "\e[34m[Info] Upgraded from version $PREVIOUS_VERSION to $SOURCEBOT_VERSION\e[0m"

        if [ -z "$SOURCEBOT_TELEMETRY_DISABLED" ]; then
            if ! ( curl -L --output /dev/null --silent --fail --header "Content-Type: application/json" -d '{
                "api_key": "'"$POSTHOG_PAPIK"'",
                "event": "upgrade",
                "distinct_id": "'"$SOURCEBOT_INSTALL_ID"'",
                "properties": {
                    "from_version": "'"$PREVIOUS_VERSION"'",
                    "to_version": "'"$SOURCEBOT_VERSION"'"
                }
            }' https://us.i.posthog.com/capture/ ) then
                echo -e "\e[33m[Warning] Failed to send upgrade event.\e[0m"
            fi
        fi
    fi
fi

echo "{\"version\": \"$SOURCEBOT_VERSION\", \"install_id\": \"$SOURCEBOT_INSTALL_ID\"}" > "$FIRST_RUN_FILE"

# Upload sourcemaps to Sentry
# @nocheckin
su -c "sentry-cli login --auth-token $SENTRY_AUTH_TOKEN"
su -c "sentry-cli sourcemaps inject --org sourcebot --project backend /app/packages/backend/dist"
su -c "sentry-cli sourcemaps upload --org sourcebot --project backend /app/packages/backend/dist"


# Start the database and wait for it to be ready before starting any other service
if [ "$DATABASE_URL" = "postgresql://postgres@localhost:5432/sourcebot" ]; then
    su postgres -c "postgres -D $DB_DATA_DIR" &
    until pg_isready -h localhost -p 5432 -U postgres; do
        echo -e "\e[34m[Info] Waiting for the database to be ready...\e[0m"
        sleep 1
    done

    # Check if the database already exists, and create it if it dne
    EXISTING_DB=$(psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'")

    if [ "$EXISTING_DB" = "1" ]; then
        echo "Database '$DB_NAME' already exists; skipping creation."
    else
        echo "Creating database '$DB_NAME'..."
        psql -U postgres -c "CREATE DATABASE \"$DB_NAME\""
    fi
fi

# Run a Database migration
echo -e "\e[34m[Info] Running database migration...\e[0m"
yarn workspace @sourcebot/db prisma:migrate:prod

# Create the log directory
mkdir -p /var/log/sourcebot

# Run supervisord
exec supervisord -c /etc/supervisor/conf.d/supervisord.conf