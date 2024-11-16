#!/bin/sh
set -e

echo -e "\e[34m[Info] Sourcebot version: $SOURCEBOT_VERSION\e[0m"

# Issue a info message about telemetry
if [ ! -z "$SOURCEBOT_TELEMETRY_DISABLED" ]; then
    echo -e "\e[34m[Info] Disabling telemetry since SOURCEBOT_TELEMETRY_DISABLED was set.\e[0m"
fi

# Check if DATA_CACHE_DIR exists, if not create it
if [ ! -d "$DATA_CACHE_DIR" ]; then
    mkdir -p "$DATA_CACHE_DIR"
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
        curl -L -s --header "Content-Type: application/json" -d '{
            "api_key": "'"$POSTHOG_KEY"'",
            "event": "install",
            "distinct_id": "'"$SOURCEBOT_INSTALL_ID"'",
            "properties": {
                "sourcebot_version": "'"$SOURCEBOT_VERSION"'"
            }
        }' https://us.i.posthog.com/capture/ > /dev/null
    fi
else
    export SOURCEBOT_INSTALL_ID=$(cat "$FIRST_RUN_FILE" | jq -r '.install_id')
    PREVIOUS_VERSION=$(cat "$FIRST_RUN_FILE" | jq -r '.version')

    # If the version has changed, we assume an upgrade has occurred.
    if [ "$PREVIOUS_VERSION" != "$SOURCEBOT_VERSION" ]; then
        echo -e "\e[34m[Info] Upgraded from version $PREVIOUS_VERSION to $SOURCEBOT_VERSION\e[0m"

        if [ -z "$SOURCEBOT_TELEMETRY_DISABLED" ]; then
            curl -L -s --header "Content-Type: application/json" -d '{
                "api_key": "'"$POSTHOG_KEY"'",
                "event": "upgrade",
                "distinct_id": "'"$SOURCEBOT_INSTALL_ID"'",
                "properties": {
                    "from_version": "'"$PREVIOUS_VERSION"'",
                    "to_version": "'"$SOURCEBOT_VERSION"'"
                }
            }' https://us.i.posthog.com/capture/ > /dev/null
        fi
    fi
fi

echo "{\"version\": \"$SOURCEBOT_VERSION\", \"install_id\": \"$SOURCEBOT_INSTALL_ID\"}" > "$FIRST_RUN_FILE"

# Fallback to sample config if a config does not exist
if echo "$CONFIG_PATH" | grep -qE '^https?://'; then
    if ! curl --output /dev/null --silent --head --fail "$CONFIG_PATH"; then
        echo -e "\e[33m[Warning] Remote config file at '$CONFIG_PATH' not found. Falling back on sample config.\e[0m"
        CONFIG_PATH="./default-config.json"
    fi
elif [ ! -f "$CONFIG_PATH" ]; then
    echo -e "\e[33m[Warning] Config file at '$CONFIG_PATH' not found. Falling back on sample config.\e[0m"
    CONFIG_PATH="./default-config.json"
fi

echo -e "\e[34m[Info] Using config file at: '$CONFIG_PATH'.\e[0m"

# Update nextjs public env variables w/o requiring a rebuild.
# @see: https://phase.dev/blog/nextjs-public-runtime-variables/

# Infer NEXT_PUBLIC_SOURCEBOT_TELEMETRY_DISABLED if it is not set
if [ -z "$NEXT_PUBLIC_SOURCEBOT_TELEMETRY_DISABLED" ] && [ ! -z "$SOURCEBOT_TELEMETRY_DISABLED" ]; then
    export NEXT_PUBLIC_SOURCEBOT_TELEMETRY_DISABLED="$SOURCEBOT_TELEMETRY_DISABLED"
fi

# Infer NEXT_PUBLIC_SOURCEBOT_VERSION if it is not set
if [ -z "$NEXT_PUBLIC_SOURCEBOT_VERSION" ] && [ ! -z "$SOURCEBOT_VERSION" ]; then
    export NEXT_PUBLIC_SOURCEBOT_VERSION="$SOURCEBOT_VERSION"
fi

find /app/packages/web/public /app/packages/web/.next -type f -name "*.js" |
while read file; do
    sed -i "s|BAKED_NEXT_PUBLIC_SOURCEBOT_TELEMETRY_DISABLED|${NEXT_PUBLIC_SOURCEBOT_TELEMETRY_DISABLED}|g" "$file"
    sed -i "s|BAKED_NEXT_PUBLIC_SOURCEBOT_VERSION|${NEXT_PUBLIC_SOURCEBOT_VERSION}|g" "$file"
done

# @todo: document this
if [ ! -z "$BASE_PATH" ]; then
    if [ "$BASE_PATH" = "/" ]; then
        BASE_PATH=""
    elif [[ ! "$BASE_PATH" =~ ^/ ]]; then
        BASE_PATH="/$BASE_PATH"
    fi
fi

if [ ! -z "$BASE_PATH" ]; then
    echo -e "\e[34m[Info] BASE_PATH was set to "$BASE_PATH". Overriding default base path.\e[0m"
fi

# Always set NEXT_PUBLIC_BASE_PATH to BASE_PATH
export NEXT_PUBLIC_BASE_PATH="$BASE_PATH"

find /app/packages/web/public /app/packages/web -type f |
while read file; do
    sed -i "s|/BAKED_NEXT_PUBLIC_BASE_PATH|${NEXT_PUBLIC_BASE_PATH}|g" "$file"
done

# Run supervisord
exec supervisord -c /etc/supervisor/conf.d/supervisord.conf