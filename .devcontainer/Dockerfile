# Development container for Sourcebot
# Based on Node.js 24 with TypeScript support
FROM mcr.microsoft.com/devcontainers/typescript-node:24

ARG GO_VERSION=1.23.4
ARG CTAGS_VERSION=v6.1.0

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Build tools for universal-ctags
    autoconf \
    automake \
    pkg-config \
    make \
    gcc \
    g++ \
    libjansson-dev \
    libyaml-dev \
    libseccomp-dev \
    libxml2-dev \
    # PostgreSQL client tools (for debugging)
    postgresql-client \
    # Redis CLI tools (for debugging)
    redis-tools \
    # Other utilities
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Go (detect architecture automatically)
RUN ARCH=$(dpkg --print-architecture) && \
    if [ "$ARCH" = "arm64" ]; then GOARCH="arm64"; else GOARCH="amd64"; fi && \
    curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-${GOARCH}.tar.gz" | tar -C /usr/local -xzf -
ENV PATH="/usr/local/go/bin:${PATH}"
ENV GOPATH="/home/node/go"
ENV PATH="${GOPATH}/bin:${PATH}"

# Build and install universal-ctags from source
RUN git clone --depth 1 --branch "${CTAGS_VERSION}" https://github.com/universal-ctags/ctags.git /tmp/ctags \
    && cd /tmp/ctags \
    && ./autogen.sh \
    && ./configure \
    && make -j$(nproc) \
    && make install \
    && rm -rf /tmp/ctags

# Enable corepack for Yarn and disable download prompts
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

# Create directories that will be mounted as volumes with correct ownership
# This ensures the node user can write to them when volumes are mounted
RUN mkdir -p /home/node/go /home/node/.yarn/berry/cache \
    && chown -R node:node /home/node/go /home/node/.yarn

# Set working directory
WORKDIR /workspaces/sourcebot

# Switch to non-root user
USER node

# Install Claude CLI (native binary)
RUN curl -fsSL https://claude.ai/install.sh | bash
ENV PATH="/home/node/.claude/bin:${PATH}"
