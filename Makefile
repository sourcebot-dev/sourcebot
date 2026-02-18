
CMDS := zoekt yarn

ALL: $(CMDS)

yarn:
	yarn install
	yarn build:deps

zoekt:
	mkdir -p bin
	go build -C vendor/zoekt -o $(PWD)/bin ./cmd/...
	export PATH="$(PWD)/bin:$(PATH)"
	export CTAGS_COMMANDS=ctags

clean:
	@if docker ps 2>/dev/null | grep -q sourcebot-redis; then \
		echo "Flushing Redis in Docker container..."; \
		docker exec sourcebot-redis redis-cli FLUSHALL; \
	else \
		echo "Flushing local Redis..."; \
		redis-cli FLUSHALL; \
	fi
	yarn dev:prisma:migrate:reset

	rm -rf \
		bin \
		node_modules \
		packages/web/node_modules \
		packages/web/.next \
		packages/backend/dist \
		packages/backend/node_modules \
		packages/db/node_modules \
		packages/db/dist \
		packages/schemas/node_modules \
		packages/schemas/dist \
		packages/mcp/node_modules \
		packages/mcp/dist \
		packages/shared/node_modules \
		packages/shared/dist \
		.sourcebot

soft-reset:
	rm -rf .sourcebot
	@if docker ps 2>/dev/null | grep -q sourcebot-redis; then \
		echo "Flushing Redis in Docker container..."; \
		docker exec sourcebot-redis redis-cli FLUSHALL; \
	else \
		echo "Flushing local Redis..."; \
		redis-cli FLUSHALL; \
	fi
	yarn dev:prisma:migrate:reset


.PHONY: bin
