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

FROM node:20-alpine3.19 AS node-alpine
FROM golang:1.23.4-alpine3.19 AS go-alpine
# ----------------------------------

# ------ Build Zoekt ------
FROM go-alpine AS zoekt-builder
RUN apk add --no-cache ca-certificates
WORKDIR /zoekt
COPY vendor/zoekt/go.mod vendor/zoekt/go.sum ./
RUN go mod download
COPY vendor/zoekt ./
RUN CGO_ENABLED=0 GOOS=linux go build -o /cmd/ ./cmd/...
# -------------------------

# ------ Build shared libraries ------
FROM node-alpine AS shared-libs-builder
WORKDIR /app

COPY package.json yarn.lock* .yarnrc.yml ./
COPY .yarn ./.yarn
COPY ./packages/db ./packages/db
COPY ./packages/schemas ./packages/schemas
COPY ./packages/error ./packages/error
COPY ./packages/shared ./packages/shared

RUN yarn workspace @sourcebot/db install
RUN yarn workspace @sourcebot/schemas install
RUN yarn workspace @sourcebot/error install
RUN yarn workspace @sourcebot/shared install
# ------------------------------------

# ------ Build Web ------
FROM node-alpine AS web-builder
ENV SKIP_ENV_VALIDATION=1
# -----------
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

# To upload source maps to Sentry, we need to set the following build-time args.
# It's important that we don't set these for oss builds, otherwise the Sentry
# auth token will be exposed.
# @see : next.config.mjs
ARG SENTRY_ORG
ENV SENTRY_ORG=$SENTRY_ORG
ARG SENTRY_WEBAPP_PROJECT
ENV SENTRY_WEBAPP_PROJECT=$SENTRY_WEBAPP_PROJECT
ENV SENTRY_RELEASE=$NEXT_PUBLIC_SOURCEBOT_VERSION
# SMUAT = Source Map Upload Auth Token
ARG SENTRY_SMUAT
ENV SENTRY_SMUAT=$SENTRY_SMUAT
# -----------

RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json yarn.lock* .yarnrc.yml ./
COPY .yarn ./.yarn
COPY ./packages/web ./packages/web
COPY --from=shared-libs-builder /app/node_modules ./node_modules
COPY --from=shared-libs-builder /app/packages/db ./packages/db
COPY --from=shared-libs-builder /app/packages/schemas ./packages/schemas
COPY --from=shared-libs-builder /app/packages/error ./packages/error
COPY --from=shared-libs-builder /app/packages/shared ./packages/shared

# Fixes arm64 timeouts
RUN yarn workspace @sourcebot/web install

ENV NEXT_TELEMETRY_DISABLED=1
RUN yarn workspace @sourcebot/web build
ENV SKIP_ENV_VALIDATION=0
# ------------------------------

# ------ Build Backend ------
FROM node-alpine AS backend-builder
ENV SKIP_ENV_VALIDATION=1
# -----------
ARG NEXT_PUBLIC_SOURCEBOT_VERSION
ENV NEXT_PUBLIC_SOURCEBOT_VERSION=$NEXT_PUBLIC_SOURCEBOT_VERSION

# To upload source maps to Sentry, we need to set the following build-time args.
# It's important that we don't set these for oss builds, otherwise the Sentry
# auth token will be exposed.
ARG SENTRY_ORG
ENV SENTRY_ORG=$SENTRY_ORG
ARG SENTRY_BACKEND_PROJECT
ENV SENTRY_BACKEND_PROJECT=$SENTRY_BACKEND_PROJECT
# SMUAT = Source Map Upload Auth Token
ARG SENTRY_SMUAT
ENV SENTRY_SMUAT=$SENTRY_SMUAT
# -----------

WORKDIR /app

COPY package.json yarn.lock* .yarnrc.yml ./
COPY .yarn ./.yarn
COPY ./schemas ./schemas
COPY ./packages/backend ./packages/backend
COPY --from=shared-libs-builder /app/node_modules ./node_modules
COPY --from=shared-libs-builder /app/packages/db ./packages/db
COPY --from=shared-libs-builder /app/packages/schemas ./packages/schemas
COPY --from=shared-libs-builder /app/packages/error ./packages/error
COPY --from=shared-libs-builder /app/packages/shared ./packages/shared
RUN yarn workspace @sourcebot/backend install
RUN yarn workspace @sourcebot/backend build

# Upload source maps to Sentry if we have the necessary build-time args.
RUN if [ -n "$SENTRY_SMUAT" ] && [ -n "$SENTRY_ORG" ] && [ -n "$SENTRY_BACKEND_PROJECT" ] && [ -n "$NEXT_PUBLIC_SOURCEBOT_VERSION" ]; then \
    apk add --no-cache curl; \
    curl -sL https://sentry.io/get-cli/ | sh; \
    sentry-cli login --auth-token $SENTRY_SMUAT; \
    sentry-cli sourcemaps inject --org $SENTRY_ORG --project $SENTRY_BACKEND_PROJECT --release $NEXT_PUBLIC_SOURCEBOT_VERSION ./packages/backend/dist; \
    sentry-cli sourcemaps upload --org $SENTRY_ORG --project $SENTRY_BACKEND_PROJECT --release $NEXT_PUBLIC_SOURCEBOT_VERSION ./packages/backend/dist; \
fi

ENV SKIP_ENV_VALIDATION=0
# ------------------------------
        
# ------ Runner ------
FROM node-alpine AS runner
# -----------
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
# -----------

RUN echo "Sourcebot Version: $NEXT_PUBLIC_SOURCEBOT_VERSION"

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATA_DIR=/data
ENV DATA_CACHE_DIR=$DATA_DIR/.sourcebot
ENV DATABASE_DATA_DIR=$DATA_CACHE_DIR/db
ENV REDIS_DATA_DIR=$DATA_CACHE_DIR/redis
ENV REDIS_URL="redis://localhost:6379"
ENV SRC_TENANT_ENFORCEMENT_MODE=strict
ENV SOURCEBOT_PUBLIC_KEY_PATH=/app/public.pem

# Valid values are: debug, info, warn, error
ENV SOURCEBOT_LOG_LEVEL=info

# Sourcebot collects anonymous usage data using [PostHog](https://posthog.com/). Uncomment this line to disable.
# ENV SOURCEBOT_TELEMETRY_DISABLED=1

COPY package.json yarn.lock* .yarnrc.yml public.pem ./
COPY .yarn ./.yarn

# Configure zoekt
COPY vendor/zoekt/install-ctags-alpine.sh .
RUN ./install-ctags-alpine.sh && rm install-ctags-alpine.sh
RUN mkdir -p ${DATA_CACHE_DIR}
COPY --from=zoekt-builder \
/cmd/zoekt-git-index \
/cmd/zoekt-indexserver \
/cmd/zoekt-mirror-github \
/cmd/zoekt-mirror-gitiles \
/cmd/zoekt-mirror-bitbucket-server \
/cmd/zoekt-mirror-gitlab \
/cmd/zoekt-mirror-gerrit \
/cmd/zoekt-webserver \
/cmd/zoekt-index \
/usr/local/bin/

# Copy all of the things
COPY --from=web-builder /app/packages/web/public ./packages/web/public
COPY --from=web-builder /app/packages/web/.next/standalone ./
COPY --from=web-builder /app/packages/web/.next/static ./packages/web/.next/static

COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/packages/backend ./packages/backend

COPY --from=shared-libs-builder /app/node_modules ./node_modules
COPY --from=shared-libs-builder /app/packages/db ./packages/db
COPY --from=shared-libs-builder /app/packages/schemas ./packages/schemas
COPY --from=shared-libs-builder /app/packages/error ./packages/error
COPY --from=shared-libs-builder /app/packages/shared ./packages/shared

# Configure dependencies
RUN apk add --no-cache git ca-certificates bind-tools tini jansson wget supervisor uuidgen curl perl jq redis postgresql postgresql-contrib openssl util-linux unzip

# Fixes git "dubious ownership" issues when the volume is mounted with different permissions to the container.
RUN git config --global safe.directory "*"

# Configure the database
RUN mkdir -p /run/postgresql && \
    chown -R postgres:postgres /run/postgresql && \
    chmod 775 /run/postgresql

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY prefix-output.sh ./prefix-output.sh
RUN chmod +x ./prefix-output.sh
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENTRYPOINT ["/sbin/tini", "--", "./entrypoint.sh"]
# ------------------------------