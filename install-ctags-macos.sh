#!/bin/sh

# This script installs universal-ctags v6.1.0 on macOS.
# This version is pinned to match the version used in the Sourcebot Docker image.
# See vendor/zoekt/install-ctags-alpine.sh for the Alpine equivalent.

CTAGS_VERSION=v6.1.0
CTAGS_ARCHIVE_TOP_LEVEL_DIR=ctags-6.1.0
INSTALL_DIR=/usr/local/bin

cleanup() {
  cd /
  rm -rf /tmp/ctags-$CTAGS_VERSION
}

trap cleanup EXIT

set -eux

# Ensure required build tools are available
if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew is required to install build dependencies. See https://brew.sh."
  exit 1
fi

brew install autoconf automake pkg-config jansson

curl --retry 5 "https://codeload.github.com/universal-ctags/ctags/tar.gz/$CTAGS_VERSION" | tar xz -C /tmp
cd /tmp/$CTAGS_ARCHIVE_TOP_LEVEL_DIR
./autogen.sh
./configure --program-prefix=universal- --enable-json
make -j"$(sysctl -n hw.ncpu)"
sudo make install

echo ""
echo "universal-ctags installed to $INSTALL_DIR/universal-ctags"
echo "Add the following to your .env.development.local:"
echo "  CTAGS_COMMAND=$INSTALL_DIR/universal-ctags"
