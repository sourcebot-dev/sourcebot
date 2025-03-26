# ------ Global scope variables ------
# Set of global build arguments.
# @see: https://docs.docker.com/build/building/variables/#scoping

ARG SOURCEBOT_VERSION
# PAPIK = Project API Key
# Note that this key does not need to be kept secret, so it's not
# necessary to use Docker build secrets here.
# @see: https://posthog.com/tutorials/api-capture-events#authenticating-with-the-project-api-key
ARG POSTHOG_PAPIK
ARG SENTRY_ENVIRONMENT
ARG SOURCEBOT_CLOUD_ENVIRONMENT

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
COPY ./packages/crypto ./packages/crypto
COPY ./packages/error ./packages/error

RUN yarn workspace @sourcebot/db install
RUN yarn workspace @sourcebot/schemas install
RUN yarn workspace @sourcebot/crypto install
RUN yarn workspace @sourcebot/error install
# ------------------------------------

# ------ Build Web ------
FROM node-alpine AS web-builder
ENV SKIP_ENV_VALIDATION=1
# -----------
# Global args
ARG SOURCEBOT_VERSION
ENV NEXT_PUBLIC_SOURCEBOT_VERSION=$SOURCEBOT_VERSION
ARG POSTHOG_PAPIK
ENV NEXT_PUBLIC_POSTHOG_PAPIK=$POSTHOG_PAPIK
ARG SENTRY_ENVIRONMENT
ENV NEXT_PUBLIC_SENTRY_ENVIRONMENT=$SENTRY_ENVIRONMENT
ARG SOURCEBOT_CLOUD_ENVIRONMENT
ENV NEXT_PUBLIC_SOURCEBOT_CLOUD_ENVIRONMENT=$SOURCEBOT_CLOUD_ENVIRONMENT
# Local args
ARG NEXT_PUBLIC_SENTRY_WEBAPP_DSN
ENV NEXT_PUBLIC_SENTRY_WEBAPP_DSN=$NEXT_PUBLIC_SENTRY_WEBAPP_DSN
# -----------

RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json yarn.lock* .yarnrc.yml ./
COPY .yarn ./.yarn
COPY ./packages/web ./packages/web
COPY --from=shared-libs-builder /app/node_modules ./node_modules
COPY --from=shared-libs-builder /app/packages/db ./packages/db
COPY --from=shared-libs-builder /app/packages/schemas ./packages/schemas
COPY --from=shared-libs-builder /app/packages/crypto ./packages/crypto
COPY --from=shared-libs-builder /app/packages/error ./packages/error

# Fixes arm64 timeouts
RUN yarn workspace @sourcebot/web install

ENV NEXT_TELEMETRY_DISABLED=1
RUN yarn workspace @sourcebot/web build
ENV SKIP_ENV_VALIDATION=0
# ------------------------------

# ------ Build Backend ------
FROM node-alpine AS backend-builder
ENV SKIP_ENV_VALIDATION=1
WORKDIR /app

COPY package.json yarn.lock* .yarnrc.yml ./
COPY .yarn ./.yarn
COPY ./schemas ./schemas
COPY ./packages/backend ./packages/backend
COPY --from=shared-libs-builder /app/node_modules ./node_modules
COPY --from=shared-libs-builder /app/packages/db ./packages/db
COPY --from=shared-libs-builder /app/packages/schemas ./packages/schemas
COPY --from=shared-libs-builder /app/packages/crypto ./packages/crypto
COPY --from=shared-libs-builder /app/packages/error ./packages/error
RUN yarn workspace @sourcebot/backend install
RUN yarn workspace @sourcebot/backend build
ENV SKIP_ENV_VALIDATION=0
# ------------------------------
        
# ------ Runner ------
FROM node-alpine AS runner
# -----------
# Global args
ARG SOURCEBOT_VERSION
ENV SOURCEBOT_VERSION=$SOURCEBOT_VERSION
ARG POSTHOG_PAPIK
ENV POSTHOG_PAPIK=$POSTHOG_PAPIK
ARG SENTRY_ENVIRONMENT
ENV SENTRY_ENVIRONMENT=$SENTRY_ENVIRONMENT
# Local args
# -----------

RUN echo "Sourcebot Version: $SOURCEBOT_VERSION"

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATA_DIR=/data
ENV DATA_CACHE_DIR=$DATA_DIR/.sourcebot
ENV DB_DATA_DIR=$DATA_CACHE_DIR/db
ENV REDIS_DATA_DIR=$DATA_CACHE_DIR/redis
ENV DB_NAME=sourcebot
ENV DATABASE_URL="postgresql://postgres@localhost:5432/$DB_NAME"
ENV REDIS_URL="redis://localhost:6379"
ENV SRC_TENANT_ENFORCEMENT_MODE=strict

# Valid values are: debug, info, warn, error
ENV SOURCEBOT_LOG_LEVEL=info

# Configures the sub-path of the domain to serve Sourcebot from.
# For example, if DOMAIN_SUB_PATH is set to "/sb", Sourcebot
# will serve from http(s)://example.com/sb
ENV DOMAIN_SUB_PATH=/

# Sourcebot collects anonymous usage data using [PostHog](https://posthog.com/). Uncomment this line to disable.
# ENV SOURCEBOT_TELEMETRY_DISABLED=1

COPY package.json yarn.lock* .yarnrc.yml ./
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
COPY --from=shared-libs-builder /app/packages/crypto ./packages/crypto
COPY --from=shared-libs-builder /app/packages/error ./packages/error

# Configure dependencies
RUN apk add --no-cache git ca-certificates bind-tools tini jansson wget supervisor uuidgen curl perl jq redis postgresql postgresql-contrib openssl util-linux unzip
RUN curl -sL https://sentry.io/get-cli/ | sh

# Install grafana alloy. libc6-compat is required because alloy dynamically links against glibc which doesn't exist in alpine by default
# @nocheckin: figure out how to handle this for self hosted case (especially the config)
RUN apk add --no-cache libc6-compat 
RUN wget https://github.com/grafana/alloy/releases/download/v1.7.0/alloy-linux-amd64.zip \
    && unzip alloy-linux-amd64.zip \
    && mv alloy-linux-amd64 /usr/local/bin/alloy \
    && chmod +x /usr/local/bin/alloy \
    && rm alloy-linux-amd64.zip
COPY grafana.alloy .

# Configure the database
RUN mkdir -p /run/postgresql && \
    chown -R postgres:postgres /run/postgresql && \
    chmod 775 /run/postgresql

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY prefix-output.sh ./prefix-output.sh
RUN chmod +x ./prefix-output.sh
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

COPY default-config.json .

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENTRYPOINT ["/sbin/tini", "--", "./entrypoint.sh"]
# ------------------------------