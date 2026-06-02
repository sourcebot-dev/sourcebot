#!/bin/sh

# Exit immediately if a command fails
set -e
# Disable auto-exporting of variables
set +a

# Detect if running as root
IS_ROOT=false
if [ "$(id -u)" -eq 0 ]; then
    IS_ROOT=true
fi

if [ "$IS_ROOT" = "true" ]; then
    echo -e "\e[34m[Info] Running as root user.\e[0m"
else
    echo -e "\e[34m[Info] Running as non-root user.\e[0m"
fi

# If a CONFIG_PATH is set, resolve the environment overrides from the config file.
# The overrides will be written into variables scopped to the current shell. This is
# required in case one of the variables used in this entrypoint is overriden (e.g.,
# DATABASE_URL, REDIS_URL, etc.)
if [ -n "$CONFIG_PATH" ]; then
    echo -e "\e[34m[Info] Resolving environment overrides from $CONFIG_PATH...\e[0m"

    set +e # Disable exist on error so we can capture EXIT_CODE
    OVERRIDES_OUTPUT=$(SKIP_ENV_VALIDATION=1 yarn tool:resolve-env-overrides)
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

# Construct the database URL from the individual variables if DATABASE_URL is not set
if [ -z "$DATABASE_URL" ] && [ -n "$DATABASE_HOST" ] && [ -n "$DATABASE_USERNAME" ] && [ -n "$DATABASE_PASSWORD" ]  && [ -n "$DATABASE_NAME" ]; then
    DATABASE_URL="postgresql://${DATABASE_USERNAME}:${DATABASE_PASSWORD}@${DATABASE_HOST}/${DATABASE_NAME}"

    if [ -n "$DATABASE_ARGS" ]; then
        DATABASE_URL="${DATABASE_URL}?$DATABASE_ARGS"
    fi
fi

# As of v5, Sourcebot no longer ships an embedded Postgres or Redis. Both must be
# provided externally via DATABASE_URL and REDIS_URL.
# @see: https://docs.sourcebot.dev/docs/upgrade/v4-to-v5-guide
if [ -z "$DATABASE_URL" ]; then
    echo -e "\e[31m[Error] DATABASE_URL is not set.\e[0m"
    echo -e "\e[31mAs of v5, Sourcebot no longer ships an embedded Postgres database. You must provide a\e[0m"
    echo -e "\e[31mPostgres instance and set DATABASE_URL (e.g. postgresql://user:password@host:5432/sourcebot).\e[0m"
    echo -e "\e[31mYou can also use DATABASE_HOST, DATABASE_USERNAME, DATABASE_PASSWORD, DATABASE_NAME, and\e[0m"
    echo -e "\e[31mDATABASE_ARGS to construct the connection string.\e[0m"
    echo -e "\e[31mSee the migration guide: https://docs.sourcebot.dev/docs/upgrade/v4-to-v5-guide\e[0m"
    exit 1
fi

if [ -z "$REDIS_URL" ]; then
    echo -e "\e[31m[Error] REDIS_URL is not set.\e[0m"
    echo -e "\e[31mAs of v5, Sourcebot no longer ships an embedded Redis instance. You must provide a Redis\e[0m"
    echo -e "\e[31minstance and set REDIS_URL (e.g. redis://host:6379).\e[0m"
    echo -e "\e[31mSee the migration guide: https://docs.sourcebot.dev/docs/upgrade/v4-to-v5-guide\e[0m"
    exit 1
fi

# Extract version from version.ts
VERSION_FILE="/app/packages/shared/src/version.ts"
if [ -f "$VERSION_FILE" ]; then
    SOURCEBOT_VERSION=$(grep -o '"v[^"]*"' "$VERSION_FILE" | tr -d '"')
    # Validate extraction succeeded
    if [ -z "$SOURCEBOT_VERSION" ]; then
        echo -e "\e[33m[Warning] Failed to extract version from $VERSION_FILE. Setting to 'unknown'.\e[0m" >&2
        SOURCEBOT_VERSION="unknown"
    fi
else
    SOURCEBOT_VERSION="unknown"
fi

echo -e "\e[34m[Info] Sourcebot version: $SOURCEBOT_VERSION\e[0m"

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

        if [ "$SOURCEBOT_TELEMETRY_DISABLED" = "false" ]; then
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

# Run a Database migration
echo -e "\e[34m[Info] Running database migration...\e[0m"
DATABASE_URL="$DATABASE_URL" yarn workspace @sourcebot/db prisma:migrate:prod

# Create the log directory if it doesn't exist
mkdir -p /var/log/sourcebot

# Run supervisord
exec supervisord -c /etc/supervisor/conf.d/supervisord.conf
