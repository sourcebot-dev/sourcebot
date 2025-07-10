## Sources and References

We have the concept of "sources" and "references" in sb:
1. **source** - A source is some artifact that exists in the codebase (e.g., file, commit, etc.) that helps the LLM ground its answer in reality.
2. **references** - A reference (or citation) is a _pointer_ to a source that the LLM can output in it's response so that the developer can understand why the LLM got to the conclusion it got to.

Sources can be attached to a chat thread in two ways:
1. The developer @ mentions a source (e.g., _"what does `@auth.ts` do?"_) in their request.
2. The LLM makes a tool call (e.g., `readFile`) in its response.

Sources are included in the chat thread using a [custom data part](https://v5.ai-sdk.dev/docs/ai-sdk-ui/streaming-data#streaming-custom-data) as a JSON payload with the necessary data to allow us to retrieve the source at a later point (e.g., in `ReferencedSourcesListView.tsx`).

References are included in a LLMs response by embedding a known pattern (e.g., `@file:{auth.ts:12-24}`) that can be grepped and rendered with a custom component using a [remark plugin](https://github.com/remarkjs/remark). The LLM is instructed to use this pattern in the system prompt.

The process of resolving a reference to a source is inherently fuzzy since we are not guaranteed any determinism with LLMs (e.g., the LLM could hallucinate a source that doesn't exist). We perform reference resolution on a best-effort basis.