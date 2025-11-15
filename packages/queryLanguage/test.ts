import { parser } from "./src/parser";

const input = "hello case:yes";
const tree = parser.parse(input);

const prettyPrint = (tree: ReturnType<typeof parser.parse>, input: string) => {
    let result = "";
    let lastPos = 0;
    
    tree.iterate({
        enter: (node) => {
            // If this is a leaf node (terminal), collect its text
            if (node.from >= node.to) {
                // Empty node, skip
                return;
            }
            
            // Check if this node has any children by checking the tree structure
            const nodeTree = node.node;
            const isLeaf = !nodeTree.firstChild;
            
            if (isLeaf) {
                // Add any whitespace between the last position and this node
                if (node.from > lastPos) {
                    result += input.slice(lastPos, node.from);
                }
                
                // Add the node's text
                result += input.slice(node.from, node.to);
                lastPos = node.to;
            }
        }
    });
    
    // Add any trailing content
    if (lastPos < input.length) {
        result += input.slice(lastPos, input.length);
    }
    
    return result;
}

const reconstructed = prettyPrint(tree, input);
console.log("Original:", input);
console.log("Reconstructed:", reconstructed);
console.log("Match:", input === reconstructed);