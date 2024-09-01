#!/bin/sh
set -e

exec "zoekt-webserver" "-index" "${ZOEKT_DATA_CACHE_DIR}/index"