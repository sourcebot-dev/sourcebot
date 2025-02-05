import { parser } from "./parser";

const output = parser.parse(`"hello world"`);
console.log(output.length);

let depth = 0;
output.cursor().iterate(
    (node) => {
        console.log(`${' '.repeat(depth)}Node: ${node.name}`);
        depth+=1;
    },
    () => {
        depth -=1;
    }
);
