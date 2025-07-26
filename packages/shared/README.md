This package contains shared code between the backend & webapp packages.

### Why two index files?

This package contains two index files: `index.server.ts` and `index.client.ts`. There is some code in this package that will only work in a Node.JS runtime (e.g., because it depends on the `fs` package. Entitlements are a good example of this), and other code that is runtime agnostic (e.g., `constants.ts`). To deal with this, we these two index files export server code and client code, respectively.

For package consumers, the usage would look like the following:
- Server: `import { ... } from @sourcebot/shared`
- Client: `import { ... } from @sourcebot/shared/client`