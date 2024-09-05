#!/bin/sh
set -e

# Check if the configuration file exists
if [ ! -f "$CONFIG_PATH" ]; then
    echo "Error: Configuration file not found at $CONFIG_PATH. Please check that you mounted a volume to $DATA_DIR, and the volume contains a config.json file at the root."
    exit 1
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

exec supervisord -c /etc/supervisor/conf.d/supervisord.conf