
CMDS := zoekt yarn

ALL: $(CMDS)

yarn:
	yarn install
	yarn workspace @sourcebot/db prisma:migrate:dev

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
		.sourcebot

.PHONY: bin
