#!/bin/sh

# Exit immediately if a command fails
set -e
# Disable auto-exporting of variables
set +a

# If a CONFIG_PATH is set, resolve the environment overrides from the config file.
# The overrides will be written into variables scopped to the current shell. This is
# required in case one of the variables used in this entrypoint is overriden (e.g.,
# DATABASE_URL, REDIS_URL, etc.)
if [ -n "$CONFIG_PATH" ]; then
    echo -e "\e[34m[Info] Resolving environment overrides from $CONFIG_PATH...\e[0m"

    set +e # Disable exist on error so we can capture EXIT_CODE
    OVERRIDES_OUTPUT=$(SKIP_ENV_VALIDATION=1 yarn tool:resolve-env-overrides 2>&1)
    EXIT_CODE=$?
    set -e # Re-enable exit on error

    if [ $EXIT_CODE -eq 0 ]; then
        eval "$OVERRIDES_OUTPUT"
    else
        echo -e "\e[31m[Error] Failed to resolve environment overrides.\e[0m"
        echo "$OVERRIDES_OUTPUT"
        exit 1
    fi
fi

# Descontruct the database URL from the individual variables if DATABASE_URL is not set
if [ -z "$DATABASE_URL" ] && [ -n "$DATABASE_HOST" ] && [ -n "$DATABASE_USERNAME" ] && [ -n "$DATABASE_PASSWORD" ]  && [ -n "$DATABASE_NAME" ]; then
    DATABASE_URL="postgresql://${DATABASE_USERNAME}:${DATABASE_PASSWORD}@${DATABASE_HOST}/${DATABASE_NAME}"

    if [ -n "$DATABASE_ARGS" ]; then
        DATABASE_URL="${DATABASE_URL}?$DATABASE_ARGS"
    fi
fi

if [ -z "$DATABASE_URL" ]; then
    echo -e "\e[34m[Info] DATABASE_URL is not set. Using embeded database.\e[0m"
    export DATABASE_EMBEDDED="true"
    export DATABASE_URL="postgresql://postgres@localhost:5432/sourcebot"
else
    export DATABASE_EMBEDDED="false"
fi

if [ -z "$REDIS_URL" ]; then
    echo -e "\e[34m[Info] REDIS_URL is not set. Using embeded redis.\e[0m"
    export REDIS_EMBEDDED="true"
    export REDIS_URL="redis://localhost:6379"
else
    export REDIS_EMBEDDED="false"
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
    mkdir -p "$DATA_CACHE_DIR"
fi

# Check if DATABASE_DATA_DIR exists, if not initialize it
if [ "$DATABASE_EMBEDDED" = "true" ] && [ ! -d "$DATABASE_DATA_DIR" ]; then
    echo -e "\e[34m[Info] Initializing database at $DATABASE_DATA_DIR...\e[0m"
    mkdir -p $DATABASE_DATA_DIR && chown -R postgres:postgres "$DATABASE_DATA_DIR"
    su postgres -c "initdb -D $DATABASE_DATA_DIR"
fi

# Create the redis data directory if it doesn't exist
if [ "$REDIS_EMBEDDED" = "true" ] && [ ! -d "$REDIS_DATA_DIR" ]; then
    mkdir -p $REDIS_DATA_DIR
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
    su postgres -c "postgres -D $DATABASE_DATA_DIR" &
    until pg_isready -h localhost -p 5432 -U postgres; do
        echo -e "\e[34m[Info] Waiting for the database to be ready...\e[0m"
        sleep 1
    done

    # Check if the database already exists, and create it if it dne
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
DATABASE_URL="$DATABASE_URL" yarn workspace @sourcebot/db prisma:migrate:prod

# Create the log directory
mkdir -p /var/log/sourcebot

# Run supervisord
exec supervisord -c /etc/supervisor/conf.d/supervisord.conf