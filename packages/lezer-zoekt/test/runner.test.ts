import { parser } from '../src/parser';
import { fileTests } from '@lezer/generator/dist/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from "url"
import { it, describe } from "vitest";

let caseDir = path.dirname(fileURLToPath(import.meta.url))

for (let file of fs.readdirSync(caseDir)) {
    if (file === 'runner.test.ts') continue

    let name = /^[^\.]*/.exec(file)[0]
    describe(name, () => {
        for (let { name, run } of fileTests(fs.readFileSync(path.join(caseDir, file), "utf8"), file))
            it(name, () => run(parser))
    })
}