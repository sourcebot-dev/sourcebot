#!/usr/bin/env sh

# Generate Random Passwords, ignoring any existing secrets.
GENERATE_NEW_SECRETS='Y'

# Verify Variables.
if [ $GENERATE_NEW_SECRETS != 'Y' -a $GENERATE_NEW_SECRETS != 'y' -a $GENERATE_NEW_SECRETS != 'N' -a $GENERATE_NEW_SECRETS != 'n' ]; then
	echo "Environment variable GENERATE_NEW_SECRETS must be either Y or N."; exit 1;
fi

echo "(Re)creating Podman Secret Cache"
if [ $GENERATE_NEW_SECRETS = 'Y' -o $GENERATE_NEW_SECRETS = 'y' ]; then
    if [ ! -d './secrets' ]; then
        mkdir --mode='u=rwx,g=,o=' './secrets'
    else
        chmod 'u=rwx,g=,o=' './secrets'
    fi
    find './secrets' -type f -exec chmod 'u=rw,g=,o=' {} +

    # Use gpg dry-run to generate random passwords without worrying about profile polution.
    # Additionally, it does not add linebreaks to long random strings like openssl does.
    gpg --dry-run --gen-random --armor 1 64 > ./secrets/postgres_admin_password 2> /dev/null
    gpg --dry-run --gen-random --armor 1 33 > ./secrets/sourcebot_auth_secret 2> /dev/null
    gpg --dry-run --gen-random --armor 1 24 > ./secrets/sourcebot_encryption_key 2> /dev/null
fi

# Removing old versions of these secrets
podman secret ls -f name="(POSTGRES_ADMIN_PASSWORD|SOURCEBOT_AUTH_SECRET|SOURCEBOT_ENCRYPTION_KEY|SOURCEBOT_DATABASE_URL)" --format "{{.ID}}" | xargs --no-run-if-empty podman secret rm
# If you want to create secrets inline: printf 'Hello World!' | podman secret create hello_world -
podman secret create POSTGRES_ADMIN_PASSWORD "./secrets/postgres_admin_password"
podman secret create SOURCEBOT_AUTH_SECRET "./secrets/sourcebot_auth_secret"
podman secret create SOURCEBOT_ENCRYPTION_KEY "./secrets/sourcebot_encryption_key"

# URL encodes everything following the function name using just native sh and printf.
# Invoke via:
# url_encode test me out
# url_encode 'test me out'
# url_encode $(cat /run/secrets/password)
# echo 'test me out' | xargs -I {} sh -c 'url_encode "$@"' _ {}
url_encode () {
  string=$*
  while [ -n "$string" ]; do
    tail=${string#?}
    head=${string%$tail}
    case $head in
      [-._~0-9A-Za-z]) printf %c "$head";;
      *) printf %%%02x "'$head"
    esac
    string=$tail
  done
  echo
}

# * Generate URL-encoded DATABASE_URL based on secrets. Allows use of special characters in passwords.
# When running on podman 5+, all containers run in the same pod, so the correct address for postgres is 'localhost'.
printf 'postgresql://postgres:%s@localhost/postgres' "$(url_encode $(cat ./secrets/postgres_admin_password))" | podman secret create SOURCEBOT_DATABASE_URL -

echo "Setup complete!"
