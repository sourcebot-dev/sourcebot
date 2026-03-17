// @NOTE: When adding a new tool, follow these steps:
// 1. Add the tool to the `toolNames` constant in `constants.ts`.
// 2. Add the tool to the `SBChatMessageToolTypes` type in `types.ts`.
// 3. Add the tool to the `tools` prop in `agent.ts`.
// 4. If the tool is meant to be rendered in the UI:
//    - Add the tool to the `uiVisiblePartTypes` constant in `constants.ts`.
//    - Add the tool's component to the `DetailsCard` switch statement in `detailsCard.tsx`.
//
// - bk, 2025-07-25

export * from "./findSymbolReferences";
export * from "./findSymbolDefinitions";
export * from "./searchCode";
