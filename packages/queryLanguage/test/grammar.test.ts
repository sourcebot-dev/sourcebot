import { parser } from "../src/parser";
import { fileTests } from "@lezer/generator/dist/test";
import { describe, it } from "vitest";
import { fileURLToPath } from "url"
import * as fs from "fs";
import * as path from "path";

const caseDir = path.dirname(fileURLToPath(import.meta.url))

for (const file of fs.readdirSync(caseDir)) {
    if (!/\.txt$/.test(file)) {
        continue;
    }

    let name = /^[^\.]*/.exec(file)?.[0];
    describe(name ?? "unknown", () => {
        for (const { name, run } of fileTests(fs.readFileSync(path.join(caseDir, file), "utf8"), file)) {
            it(name, () => run(parser));
        }
    });
}