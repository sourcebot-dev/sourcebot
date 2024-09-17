FROM node:18-alpine3.19 AS node-alpine
FROM golang:1.22.2-alpine3.19 AS go-alpine

# ------ Build Zoekt ------
FROM go-alpine AS zoekt-builder
RUN apk add --no-cache ca-certificates
WORKDIR /zoekt
COPY vendor/zoekt/go.mod vendor/zoekt/go.sum ./
RUN go mod download
COPY vendor/zoekt ./
RUN CGO_ENABLED=0 GOOS=linux go build -o /cmd/ ./cmd/...

# ------ Build Web ------
FROM node-alpine AS web-builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json yarn.lock* ./

# Fixes arm64 timeouts
RUN yarn config set registry https://registry.npmjs.org/
RUN yarn config set network-timeout 1200000
RUN yarn --frozen-lockfile
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# @see: https://phase.dev/blog/nextjs-public-runtime-variables/
ARG NEXT_PUBLIC_SOURCEBOT_TELEMETRY_DISABLED=BAKED_NEXT_PUBLIC_SOURCEBOT_TELEMETRY_DISABLED
RUN yarn run build

# ------ Runner ------
FROM node-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATA_DIR=/data
ENV CONFIG_PATH=$DATA_DIR/config.json
ENV DATA_CACHE_DIR=$DATA_DIR/.sourcebot

# Sourcebot collects anonymous usage data using [PostHog](https://posthog.com/). Uncomment this line to disable.
# ENV SOURCEBOT_TELEMETRY_DISABLED=1

# Configure dependencies
RUN apk add --no-cache git ca-certificates bind-tools tini jansson wget supervisor

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
    /usr/local/bin/

# Configure the webapp
COPY --from=web-builder /app/public ./public
RUN mkdir .next
COPY --from=web-builder /app/.next/standalone ./
COPY --from=web-builder /app/.next/static ./.next/static

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENTRYPOINT ["/sbin/tini", "--", "./entrypoint.sh"]