import $RefParser from "@apidevtools/json-schema-ref-parser";
import path from "path";
import { writeFile } from "fs/promises";

const BANNER_COMMENT = '// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!\n';
const SCHEMAS: string[] = ["github.json"];

(async () => {

    const cwd = process.cwd();
    const schemasPath = path.resolve(`${cwd}/../../schemas/v3`);
    const outDir = path.resolve(`${cwd}/src/schemas`);
    console.log(outDir);

    SCHEMAS.forEach(async (schemaName) => {
        const schemaPath = path.resolve(`${schemasPath}/${schemaName}`);
        const name = path.parse(schemaPath).name;
        console.log(name);

        const schema = JSON.stringify(await $RefParser.bundle(schemaPath), null, 2);
        
        await writeFile(
            path.join(outDir, `${name}.schema.ts`),
            BANNER_COMMENT +
            'const schema = ' +
                schema +
                ` as const;\nexport { schema as ${name}Schema };`,
        );
    });
})();