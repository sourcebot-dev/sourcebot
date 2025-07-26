# ------ Global scope variables ------
ARG NEXT_PUBLIC_SOURCEBOT_VERSION
ARG NEXT_PUBLIC_SENTRY_BACKEND_DSN
ARG SENTRY_ORG
ARG SENTRY_BACKEND_PROJECT
ARG SENTRY_SMUAT

FROM node:20-alpine3.19 AS node-alpine
FROM golang:1.23.4-alpine3.19 AS go-alpine

# ------ Build Zoekt ------
FROM go-alpine AS zoekt-builder
RUN apk add --no-cache ca-certificates
WORKDIR /zoekt
COPY vendor/zoekt/go.mod vendor/zoekt/go.sum ./
RUN go mod download
COPY vendor/zoekt ./
RUN CGO_ENABLED=0 GOOS=linux go build -o /cmd/ ./cmd/...

# ------ Build shared libraries ------
FROM node-alpine AS shared-libs-builder
WORKDIR /app

COPY package.json yarn.lock* .yarnrc.yml ./
COPY .yarn ./.yarn
COPY ./packages/db ./packages/db
COPY ./packages/schemas ./packages/schemas
COPY ./packages/crypto ./packages/crypto
COPY ./packages/error ./packages/error
COPY ./packages/logger ./packages/logger
COPY ./packages/shared ./packages/shared

RUN yarn workspace @sourcebot/db install
RUN yarn workspace @sourcebot/schemas install
RUN yarn workspace @sourcebot/crypto install
RUN yarn workspace @sourcebot/error install
RUN yarn workspace @sourcebot/logger install
RUN yarn workspace @sourcebot/shared install

# ------ Build Backend ------
FROM node-alpine AS backend-builder
ENV SKIP_ENV_VALIDATION=1

# Set environment variables
ARG NEXT_PUBLIC_SOURCEBOT_VERSION
ENV NEXT_PUBLIC_SOURCEBOT_VERSION=$NEXT_PUBLIC_SOURCEBOT_VERSION
ARG SENTRY_ORG
ENV SENTRY_ORG=$SENTRY_ORG
ARG SENTRY_BACKEND_PROJECT
ENV SENTRY_BACKEND_PROJECT=$SENTRY_BACKEND_PROJECT
ARG SENTRY_SMUAT
ENV SENTRY_SMUAT=$SENTRY_SMUAT

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
COPY --from=shared-libs-builder /app/packages/logger ./packages/logger
COPY --from=shared-libs-builder /app/packages/shared ./packages/shared

RUN yarn workspace @sourcebot/backend install
RUN yarn workspace @sourcebot/backend build

# Upload source maps to Sentry if we have the necessary build-time args
RUN if [ -n "$SENTRY_SMUAT" ] && [ -n "$SENTRY_ORG" ] && [ -n "$SENTRY_BACKEND_PROJECT" ] && [ -n "$NEXT_PUBLIC_SOURCEBOT_VERSION" ]; then \
    apk add --no-cache curl; \
    curl -sL https://sentry.io/get-cli/ | sh; \
    sentry-cli login --auth-token $SENTRY_SMUAT; \
    sentry-cli sourcemaps inject --org $SENTRY_ORG --project $SENTRY_BACKEND_PROJECT --release $NEXT_PUBLIC_SOURCEBOT_VERSION ./packages/backend/dist; \
    sentry-cli sourcemaps upload --org $SENTRY_ORG --project $SENTRY_BACKEND_PROJECT --release $NEXT_PUBLIC_SOURCEBOT_VERSION ./packages/backend/dist; \
fi

ENV SKIP_ENV_VALIDATION=0

# ------ Runtime ------
FROM node-alpine AS runner

# Set environment variables
ARG NEXT_PUBLIC_SOURCEBOT_VERSION
ENV NEXT_PUBLIC_SOURCEBOT_VERSION=$NEXT_PUBLIC_SOURCEBOT_VERSION
ARG NEXT_PUBLIC_SENTRY_BACKEND_DSN
ENV NEXT_PUBLIC_SENTRY_BACKEND_DSN=$NEXT_PUBLIC_SENTRY_BACKEND_DSN

WORKDIR /app
ENV NODE_ENV=production
ENV SRC_TENANT_ENFORCEMENT_MODE=strict
ENV SOURCEBOT_PUBLIC_KEY_PATH=/app/public.pem
ENV SOURCEBOT_LOG_LEVEL=info

# Install system dependencies
RUN apk add --no-cache git ca-certificates bind-tools tini jansson wget curl perl jq openssl util-linux unzip

# Configure zoekt and ctags
COPY vendor/zoekt/install-ctags-alpine.sh .
RUN ./install-ctags-alpine.sh && rm install-ctags-alpine.sh

# Copy zoekt binaries (backend specifically needs these for git indexing)
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

# Copy application files
COPY package.json yarn.lock* .yarnrc.yml public.pem ./
COPY .yarn ./.yarn

COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/packages/backend ./packages/backend
COPY --from=shared-libs-builder /app/packages/db ./packages/db
COPY --from=shared-libs-builder /app/packages/schemas ./packages/schemas
COPY --from=shared-libs-builder /app/packages/crypto ./packages/crypto
COPY --from=shared-libs-builder /app/packages/error ./packages/error
COPY --from=shared-libs-builder /app/packages/logger ./packages/logger
COPY --from=shared-libs-builder /app/packages/shared ./packages/shared

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "./packages/backend/dist/index.js"]
