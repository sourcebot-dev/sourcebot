
CMDS := zoekt ui

ALL: $(CMDS)

ui:
	yarn install

zoekt:
	mkdir -p bin
	go build -C vendor/zoekt -o $(PWD)/bin ./cmd/...

clean:
	rm -rf bin node_modules

.PHONY: bin
