#!/bin/sh
set -e

exec "zoekt-webserver" "-index" "${DATA_DIR}/index"