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

# Run a Database migration
echo -e "\e[34m[Info] Running database migration...\e[0m"
export DATABASE_URL="file:$DATA_CACHE_DIR/db.sqlite"
yarn workspace @sourcebot/db prisma:migrate:prod

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
            "api_key": "'"$POSTHOG_PAPIK"'",
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
                "api_key": "'"$POSTHOG_PAPIK"'",
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

# Update NextJs public env variables w/o requiring a rebuild.
# @see: https://phase.dev/blog/nextjs-public-runtime-variables/
{
    # Infer NEXT_PUBLIC_SOURCEBOT_TELEMETRY_DISABLED if it is not set
    if [ -z "$NEXT_PUBLIC_SOURCEBOT_TELEMETRY_DISABLED" ] && [ ! -z "$SOURCEBOT_TELEMETRY_DISABLED" ]; then
        export NEXT_PUBLIC_SOURCEBOT_TELEMETRY_DISABLED="$SOURCEBOT_TELEMETRY_DISABLED"
    fi

    # Infer NEXT_PUBLIC_SOURCEBOT_VERSION if it is not set
    if [ -z "$NEXT_PUBLIC_SOURCEBOT_VERSION" ] && [ ! -z "$SOURCEBOT_VERSION" ]; then
        export NEXT_PUBLIC_SOURCEBOT_VERSION="$SOURCEBOT_VERSION"
    fi

    # Always infer NEXT_PUBLIC_POSTHOG_PAPIK
    export NEXT_PUBLIC_POSTHOG_PAPIK="$POSTHOG_PAPIK"

    # Iterate over all .js files in .next & public, making substitutions for the `BAKED_` sentinal values
    # with their actual desired runtime value.
    find /app/packages/web/public /app/packages/web/.next -type f -name "*.js" |
    while read file; do
        sed -i "s|BAKED_NEXT_PUBLIC_SOURCEBOT_TELEMETRY_DISABLED|${NEXT_PUBLIC_SOURCEBOT_TELEMETRY_DISABLED}|g" "$file"
        sed -i "s|BAKED_NEXT_PUBLIC_SOURCEBOT_VERSION|${NEXT_PUBLIC_SOURCEBOT_VERSION}|g" "$file"
        sed -i "s|BAKED_NEXT_PUBLIC_POSTHOG_PAPIK|${NEXT_PUBLIC_POSTHOG_PAPIK}|g" "$file"
    done
}


# Update specifically NEXT_PUBLIC_DOMAIN_SUB_PATH w/o requiring a rebuild.
# Ultimately, the DOMAIN_SUB_PATH sets the `basePath` param in the next.config.mjs.
# Similar to above, we pass in a `BAKED_` sentinal value into next.config.mjs at build
# time. Unlike above, the `basePath` configuration is set in files other than just javascript
# code (e.g., manifest files, css files, etc.), so this section has subtle differences.
#
# @see: https://nextjs.org/docs/app/api-reference/next-config-js/basePath
# @see: https://phase.dev/blog/nextjs-public-runtime-variables/
{
    if [ ! -z "$DOMAIN_SUB_PATH" ]; then
        # If the sub-path is "/", this creates problems with certain replacements. For example:
        # /BAKED_NEXT_PUBLIC_DOMAIN_SUB_PATH/_next/image -> //_next/image (notice the double slash...)
        # To get around this, we default to an empty sub-path, which is the default when no sub-path is defined.
        if [ "$DOMAIN_SUB_PATH" = "/" ]; then
            DOMAIN_SUB_PATH=""

        # Otherwise, we need to ensure that the sub-path starts with a slash, since this is a requirement
        # for the basePath property. For example, assume DOMAIN_SUB_PATH=/bot, then:
        # /BAKED_NEXT_PUBLIC_DOMAIN_SUB_PATH/_next/image -> /bot/_next/image
        elif [[ ! "$DOMAIN_SUB_PATH" =~ ^/ ]]; then
            DOMAIN_SUB_PATH="/$DOMAIN_SUB_PATH"
        fi
    fi

    if [ ! -z "$DOMAIN_SUB_PATH" ]; then
        echo -e "\e[34m[Info] DOMAIN_SUB_PATH was set to "$DOMAIN_SUB_PATH". Overriding default path.\e[0m"
    fi

    # Always set NEXT_PUBLIC_DOMAIN_SUB_PATH to DOMAIN_SUB_PATH (even if it is empty!!)
    export NEXT_PUBLIC_DOMAIN_SUB_PATH="$DOMAIN_SUB_PATH"

    # Iterate over _all_ files in the web directory, making substitutions for the `BAKED_` sentinal values
    # with their actual desired runtime value.
    find /app/packages/web -type f |
    while read file; do
        # @note: the leading "/" is required here as it is included at build time. See Dockerfile.
        sed -i "s|/BAKED_NEXT_PUBLIC_DOMAIN_SUB_PATH|${NEXT_PUBLIC_DOMAIN_SUB_PATH}|g" "$file"
    done
}


# Run supervisord
exec supervisord -c /etc/supervisor/conf.d/supervisord.conf