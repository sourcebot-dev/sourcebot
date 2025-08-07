#!/bin/sh

# @see : https://github.com/Supervisor/supervisor/issues/553#issuecomment-1353523182

# Check if structured logging is enabled
if [ "${SOURCEBOT_STRUCTURED_LOGGING_ENABLED}" = "true" ]; then
    # Don't prefix output, just execute the command directly
    exec "$@"
else
    # Apply prefix to output
    exec 1> >( perl -ne '$| = 1; print "['"${SUPERVISOR_PROCESS_NAME}"'] | $_"' >&1)
    exec 2> >( perl -ne '$| = 1; print "['"${SUPERVISOR_PROCESS_NAME}"'] | $_"' >&2)
    
    exec "$@"
fi