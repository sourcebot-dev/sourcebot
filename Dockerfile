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

# ------ Build Database ------
FROM node-alpine AS database-builder
WORKDIR /app

COPY package.json yarn.lock* ./
COPY ./packages/db ./packages/db
RUN yarn workspace @sourcebot/db install --frozen-lockfile

# ------ Build Web ------
FROM node-alpine AS web-builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json yarn.lock* ./
COPY ./packages/web ./packages/web
COPY --from=database-builder /app/node_modules ./node_modules
COPY --from=database-builder /app/packages/db ./packages/db

# Fixes arm64 timeouts
RUN yarn config set registry https://registry.npmjs.org/
RUN yarn config set network-timeout 1200000
RUN yarn workspace @sourcebot/web install --frozen-lockfile
ENV NEXT_TELEMETRY_DISABLED=1
# @see: https://phase.dev/blog/nextjs-public-runtime-variables/
ARG NEXT_PUBLIC_SOURCEBOT_TELEMETRY_DISABLED=BAKED_NEXT_PUBLIC_SOURCEBOT_TELEMETRY_DISABLED
ARG NEXT_PUBLIC_SOURCEBOT_VERSION=BAKED_NEXT_PUBLIC_SOURCEBOT_VERSION
ENV NEXT_PUBLIC_POSTHOG_PAPIK=BAKED_NEXT_PUBLIC_POSTHOG_PAPIK

# @nocheckin: This was interfering with the the `matcher` regex in middleware.ts,
# causing regular expressions parsing errors when making a request. It's unclear
# why exactly this was happening, but it's likely due to a bad replacement happening
# in the `sed` command.
# @note: leading "/" is required for the basePath property. @see: https://nextjs.org/docs/app/api-reference/next-config-js/basePath
# ARG NEXT_PUBLIC_DOMAIN_SUB_PATH=/BAKED_NEXT_PUBLIC_DOMAIN_SUB_PATH

RUN yarn workspace @sourcebot/web build

# ------ Build Backend ------
FROM node-alpine AS backend-builder
WORKDIR /app

COPY package.json yarn.lock* ./
COPY ./schemas ./schemas
COPY ./packages/backend ./packages/backend
COPY --from=database-builder /app/node_modules ./node_modules
COPY --from=database-builder /app/packages/db ./packages/db
RUN yarn workspace @sourcebot/backend install --frozen-lockfile
RUN yarn workspace @sourcebot/backend build
    
        
# ------ Runner ------
FROM node-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATA_DIR=/data
ENV CONFIG_PATH=$DATA_DIR/config.json
ENV DATA_CACHE_DIR=$DATA_DIR/.sourcebot
ENV DB_DATA_DIR=$DATA_CACHE_DIR/db
ENV DB_NAME=sourcebot

ARG SOURCEBOT_VERSION=unknown
ENV SOURCEBOT_VERSION=$SOURCEBOT_VERSION
RUN echo "Sourcebot Version: $SOURCEBOT_VERSION"

ENV SOURCEBOT_TENANT_MODE=single

# Valid values are: debug, info, warn, error
ENV SOURCEBOT_LOG_LEVEL=info

# Configures the sub-path of the domain to serve Sourcebot from.
# For example, if DOMAIN_SUB_PATH is set to "/sb", Sourcebot
# will serve from http(s)://example.com/sb
ENV DOMAIN_SUB_PATH=/

# PAPIK = Project API Key
# Note that this key does not need to be kept secret, so it's not
# necessary to use Docker build secrets here.
# @see: https://posthog.com/tutorials/api-capture-events#authenticating-with-the-project-api-key
ARG POSTHOG_PAPIK=
ENV POSTHOG_PAPIK=$POSTHOG_PAPIK

# Sourcebot collects anonymous usage data using [PostHog](https://posthog.com/). Uncomment this line to disable.
# ENV SOURCEBOT_TELEMETRY_DISABLED=1

# Configure dependencies
RUN apk add --no-cache git ca-certificates bind-tools tini jansson wget supervisor uuidgen curl perl jq redis postgresql postgresql-contrib

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

# Configure the webapp
COPY --from=web-builder /app/packages/web/public ./packages/web/public
COPY --from=web-builder /app/packages/web/.next/standalone ./
COPY --from=web-builder /app/packages/web/.next/static ./packages/web/.next/static

# Configure the backend
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/packages/backend ./packages/backend

# Configure the database
RUN mkdir -p /run/postgresql && \
    chown -R postgres:postgres /run/postgresql && \
    chmod 775 /run/postgresql
COPY --from=database-builder /app/node_modules ./node_modules
COPY --from=database-builder /app/packages/db ./packages/db

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