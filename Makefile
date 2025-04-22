
CMDS := zoekt yarn

ALL: $(CMDS)

yarn:
	yarn install

zoekt:
	mkdir -p bin
	go build -C vendor/zoekt -o $(PWD)/bin ./cmd/...
	export PATH=$(PWD)/bin:$(PATH)
	export CTAGS_COMMANDS=ctags

clean:
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
		packages/crypto/node_modules \
		packages/crypto/dist \
		packages/error/node_modules \
		packages/error/dist \
		.sourcebot

soft-reset:
	rm -rf .sourcebot
	redis-cli FLUSHALL
	yarn dev:prisma:migrate:reset


.PHONY: bin
