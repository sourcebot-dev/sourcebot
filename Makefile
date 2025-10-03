
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
	redis-cli FLUSHALL
	yarn dev:prisma:migrate:reset

	rm -rf \
		bin \
		node_modules \
		.turbo \
		packages/web/.turbo \
		packages/web/node_modules \
		packages/web/.next \
		packages/backend/.turbo \
		packages/backend/dist \
		packages/backend/node_modules \
		packages/db/.turbo \
		packages/db/node_modules \
		packages/db/dist \
		packages/schemas/.turbo \
		packages/schemas/node_modules \
		packages/schemas/dist \
		packages/crypto/.turbo \
		packages/crypto/node_modules \
		packages/crypto/dist \
		packages/error/node_modules \
		packages/error/dist \
		packages/mcp/.turbo \
		packages/mcp/node_modules \
		packages/mcp/dist \
		packages/shared/.turbo \
		packages/shared/node_modules \
		packages/shared/dist \
		packages/zoekt/.turbo \
		packages/zoekt/node_modules \
		packages/zoekt/dist \
		packages/zoekt/bin \
		.sourcebot

soft-reset:
	rm -rf .sourcebot
	redis-cli FLUSHALL
	yarn dev:prisma:migrate:reset


.PHONY: bin
