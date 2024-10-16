#!/bin/sh

# @see : https://github.com/Supervisor/supervisor/issues/553#issuecomment-1353523182
exec 1> >( perl -ne '$| = 1; print "['"${SUPERVISOR_PROCESS_NAME}"'] | $_"' >&1)
exec 2> >( perl -ne '$| = 1; print "['"${SUPERVISOR_PROCESS_NAME}"'] | $_"' >&2)

exec "$@"