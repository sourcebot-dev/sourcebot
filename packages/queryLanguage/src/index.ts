import { parser } from "./parser";

type Tree = ReturnType<typeof parser.parse>;
type SyntaxNode = Tree['topNode'];
export type { Tree, SyntaxNode };
export * from "./parser";