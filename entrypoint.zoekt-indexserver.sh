#!/bin/sh
set -e

# Check if GITHUB_TOKEN is set
if [ -n "$GITHUB_TOKEN" ]; then
    echo "$GITHUB_TOKEN" > "$HOME/.github-token"
    chmod 600 "$HOME/.github-token"
    
    # Configure Git with the provided GITHUB_TOKEN
    # @see : https://github.com/sourcegraph/zoekt/issues/578#issuecomment-1519369619
    git config --global url."https://${GITHUB_TOKEN}:x-oauth-basic@github.com/".insteadof "https://github.com"
else
    echo -e "\e[33mWarning: Private GitHub repositories will not be indexed since GITHUB_TOKEN was not set. If you are not using GitHub, disregard.\e[0m"
fi

exec "zoekt-indexserver" "-data_dir" "${DATA_DIR}" "-mirror_config" "${CONFIG_PATH}"
