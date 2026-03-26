import { parser as _parser } from "../src/parser";
import { fileTests } from "@lezer/generator/dist/test";
import { describe, it } from "vitest";
import { fileURLToPath } from "url";
import * as fs from "fs";
import * as path from "path";

const regexParser = _parser.configure({ dialect: "regex" });
const caseDir = path.dirname(fileURLToPath(import.meta.url));

describe("regex", () => {
    for (const { name, run } of fileTests(fs.readFileSync(path.join(caseDir, "regex.txt"), "utf8"), "regex.txt")) {
        it(name, () => run(regexParser));
    }
});
