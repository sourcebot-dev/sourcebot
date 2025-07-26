# ------ Global scope variables ------

# Set of global build arguments.
# These are considered "public" and will be baked into the image.
# The convention is to prefix these with `NEXT_PUBLIC_` so that
# they can be optionally be passed as client-side environment variables
# in the webapp.
# @see: https://docs.docker.com/build/building/variables/#scoping

ARG NEXT_PUBLIC_SOURCEBOT_VERSION
# PAPIK = Project API Key
# Note that this key does not need to be kept secret, so it's not
# necessary to use Docker build secrets here.
# @see: https://posthog.com/tutorials/api-capture-events#authenticating-with-the-project-api-key
ARG NEXT_PUBLIC_POSTHOG_PAPIK
ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT
ARG NEXT_PUBLIC_SOURCEBOT_CLOUD_ENVIRONMENT
ARG NEXT_PUBLIC_SENTRY_WEBAPP_DSN
ARG NEXT_PUBLIC_SENTRY_BACKEND_DSN
ARG NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY
ARG NEXT_PUBLIC_LANGFUSE_BASE_URL

# Sentry source map upload arguments
ARG SENTRY_ORG
ARG SENTRY_WEBAPP_PROJECT
ARG SENTRY_SMUAT

FROM node:20-alpine3.19 AS node-alpine
# ----------------------------------

# ------ Build shared libraries ------
FROM node-alpine AS shared-libs-builder
WORKDIR /app

# Copy package management files
COPY package.json yarn.lock* .yarnrc.yml ./
COPY .yarn ./.yarn

# Copy shared packages
COPY ./packages/db ./packages/db
COPY ./packages/schemas ./packages/schemas
COPY ./packages/crypto ./packages/crypto
COPY ./packages/error ./packages/error
COPY ./packages/logger ./packages/logger
COPY ./packages/shared ./packages/shared

# Install shared dependencies
RUN yarn workspace @sourcebot/db install
RUN yarn workspace @sourcebot/schemas install
RUN yarn workspace @sourcebot/crypto install
RUN yarn workspace @sourcebot/error install
RUN yarn workspace @sourcebot/logger install
RUN yarn workspace @sourcebot/shared install
# ------------------------------------

# ------ Build Web ------
FROM node-alpine AS web-builder
ENV SKIP_ENV_VALIDATION=1

# Set build-time environment variables
ARG NEXT_PUBLIC_SOURCEBOT_VERSION
ENV NEXT_PUBLIC_SOURCEBOT_VERSION=$NEXT_PUBLIC_SOURCEBOT_VERSION
ARG NEXT_PUBLIC_POSTHOG_PAPIK
ENV NEXT_PUBLIC_POSTHOG_PAPIK=$NEXT_PUBLIC_POSTHOG_PAPIK
ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT
ENV NEXT_PUBLIC_SENTRY_ENVIRONMENT=$NEXT_PUBLIC_SENTRY_ENVIRONMENT
ARG NEXT_PUBLIC_SOURCEBOT_CLOUD_ENVIRONMENT
ENV NEXT_PUBLIC_SOURCEBOT_CLOUD_ENVIRONMENT=$NEXT_PUBLIC_SOURCEBOT_CLOUD_ENVIRONMENT
ARG NEXT_PUBLIC_SENTRY_WEBAPP_DSN
ENV NEXT_PUBLIC_SENTRY_WEBAPP_DSN=$NEXT_PUBLIC_SENTRY_WEBAPP_DSN
ARG NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY
ENV NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY=$NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY
ARG NEXT_PUBLIC_LANGFUSE_BASE_URL
ENV NEXT_PUBLIC_LANGFUSE_BASE_URL=$NEXT_PUBLIC_LANGFUSE_BASE_URL

# Sentry configuration for source map upload
ARG SENTRY_ORG
ENV SENTRY_ORG=$SENTRY_ORG
ARG SENTRY_WEBAPP_PROJECT
ENV SENTRY_WEBAPP_PROJECT=$SENTRY_WEBAPP_PROJECT
ENV SENTRY_RELEASE=$NEXT_PUBLIC_SOURCEBOT_VERSION
ARG SENTRY_SMUAT
ENV SENTRY_SMUAT=$SENTRY_SMUAT

RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package management files
COPY package.json yarn.lock* .yarnrc.yml ./
COPY .yarn ./.yarn

# Copy web package
COPY ./packages/web ./packages/web

# Copy shared libraries from previous stage
COPY --from=shared-libs-builder /app/node_modules ./node_modules
COPY --from=shared-libs-builder /app/packages/db ./packages/db
COPY --from=shared-libs-builder /app/packages/schemas ./packages/schemas
COPY --from=shared-libs-builder /app/packages/crypto ./packages/crypto
COPY --from=shared-libs-builder /app/packages/error ./packages/error
COPY --from=shared-libs-builder /app/packages/logger ./packages/logger
COPY --from=shared-libs-builder /app/packages/shared ./packages/shared

# Install web dependencies (fixes arm64 timeouts)
RUN yarn workspace @sourcebot/web install

# Build the web application
ENV NEXT_TELEMETRY_DISABLED=1
RUN yarn workspace @sourcebot/web build
ENV SKIP_ENV_VALIDATION=0
# ------------------------------

# ------ Runner ------
FROM node-alpine AS runner

# Set runtime environment variables
ARG NEXT_PUBLIC_SOURCEBOT_VERSION
ENV NEXT_PUBLIC_SOURCEBOT_VERSION=$NEXT_PUBLIC_SOURCEBOT_VERSION
ARG NEXT_PUBLIC_POSTHOG_PAPIK
ENV NEXT_PUBLIC_POSTHOG_PAPIK=$NEXT_PUBLIC_POSTHOG_PAPIK
ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT
ENV NEXT_PUBLIC_SENTRY_ENVIRONMENT=$NEXT_PUBLIC_SENTRY_ENVIRONMENT
ARG NEXT_PUBLIC_SENTRY_WEBAPP_DSN
ENV NEXT_PUBLIC_SENTRY_WEBAPP_DSN=$NEXT_PUBLIC_SENTRY_WEBAPP_DSN
ARG NEXT_PUBLIC_SENTRY_BACKEND_DSN
ENV NEXT_PUBLIC_SENTRY_BACKEND_DSN=$NEXT_PUBLIC_SENTRY_BACKEND_DSN
ARG NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY
ENV NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY=$NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY
ARG NEXT_PUBLIC_LANGFUSE_BASE_URL
ENV NEXT_PUBLIC_LANGFUSE_BASE_URL=$NEXT_PUBLIC_LANGFUSE_BASE_URL
ENV SOURCEBOT_PUBLIC_KEY_PATH=/app/public.pem

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache tini git

RUN echo "Sourcebot Web Version: $NEXT_PUBLIC_SOURCEBOT_VERSION"

# Copy package management files
COPY package.json yarn.lock* .yarnrc.yml public.pem ./
COPY .yarn ./.yarn

# Copy built web application
COPY --from=web-builder /app/packages/web/public ./packages/web/public
COPY --from=web-builder /app/packages/web/.next/standalone ./
COPY --from=web-builder /app/packages/web/.next/static ./packages/web/.next/static

# Copy shared dependencies
COPY --from=web-builder /app/node_modules ./node_modules
COPY --from=web-builder /app/packages/db ./packages/db
COPY --from=web-builder /app/packages/schemas ./packages/schemas
COPY --from=web-builder /app/packages/crypto ./packages/crypto
COPY --from=web-builder /app/packages/error ./packages/error
COPY --from=web-builder /app/packages/logger ./packages/logger
COPY --from=web-builder /app/packages/shared ./packages/shared

COPY ./packages/web/entrypoint.sh ./packages/web/entrypoint.sh
RUN chmod +x ./packages/web/entrypoint.sh

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/sbin/tini", "--", "./packages/web/entrypoint.sh"]

CMD ["node", "packages/web/server.js"]
# ------------------------------
