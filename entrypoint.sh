#!/bin/sh
set -e

# Check if CONFIG_PATH is set
if [ -z "$CONFIG_PATH" ]; then
    echo "\e[33mWarning: CONFIG_PATH environment variable is not set.\e[0m"
fi

# Check if GITHUB_TOKEN is set
if [ -n "$GITHUB_TOKEN" ]; then
    echo "$GITHUB_TOKEN" > "$HOME/.github-token"
    chmod 600 "$HOME/.github-token"

    # Configure Git with the provided GITHUB_TOKEN
    echo "machine github.com
       login oauth
       password ${GITHUB_TOKEN}" >> "$HOME/.netrc"
       chmod 600 "$HOME/.netrc"
else
    echo -e "\e[33mWarning: Private GitHub repositories will not be indexed since GITHUB_TOKEN was not set. If you are not using GitHub, disregard.\e[0m"
fi

# Check if GITLAB_TOKEN is set
if [ -n "$GITLAB_TOKEN" ]; then
    echo "$GITLAB_TOKEN" > "$HOME/.gitlab-token"
    chmod 600 "$HOME/.gitlab-token"
   
       # Configure Git with the provided GITLAB_TOKEN
       echo "machine gitlab.com
       login oauth
       password ${GITLAB_TOKEN}" >> "$HOME/.netrc"
       chmod 600 "$HOME/.netrc"
else
    echo -e "\e[33mWarning: GitLab repositories will not be indexed since GITLAB_TOKEN was not set. If you are not using GitLab, disregard.\e[0m"
fi

# Update nextjs public env variables w/o requiring a rebuild.
# @see: https://phase.dev/blog/nextjs-public-runtime-variables/

# Infer NEXT_PUBLIC_SOURCEBOT_TELEMETRY_DISABLED if it is not set
if [ -z "$NEXT_PUBLIC_SOURCEBOT_TELEMETRY_DISABLED" ] && [ ! -z "$SOURCEBOT_TELEMETRY_DISABLED" ]; then
    export NEXT_PUBLIC_SOURCEBOT_TELEMETRY_DISABLED="$SOURCEBOT_TELEMETRY_DISABLED"
fi

find /app/public /app/.next -type f -name "*.js" |
while read file; do
    sed -i "s|BAKED_NEXT_PUBLIC_SOURCEBOT_TELEMETRY_DISABLED|${NEXT_PUBLIC_SOURCEBOT_TELEMETRY_DISABLED}|g" "$file"
done

exec supervisord -c /etc/supervisor/conf.d/supervisord.conf