import path, { dirname } from "path";
import { mkdir, rm, writeFile } from "fs/promises";
import $RefParser from "@apidevtools/json-schema-ref-parser";
import { compileFromFile } from "json-schema-to-typescript";
import { glob } from "glob";


const BANNER_COMMENT = '// THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!\n';
// const SCHEMAS: string[] = ["github.json", "shared.json"];

(async () => {
    const cwd = process.cwd();
    const schemasBasePath = path.resolve(`${cwd}/../../schemas`);
    const schemas = await glob(`${schemasBasePath}/**/*.json`)

    await Promise.all(schemas.map(async (schemaPath) => {
        const name = path.parse(schemaPath).name;
        const version = path.basename(path.dirname(schemaPath));
        const outDir = path.join(cwd, `src/${version}`);

        // Clean output directory first
        await rm(outDir, { recursive: true, force: true });
        await mkdir(outDir, { recursive: true });

        // Generate schema
        const schema = JSON.stringify(await $RefParser.bundle(schemaPath), null, 2);
        await writeFile(
            path.join(outDir, `${name}.schema.ts`),
            BANNER_COMMENT +
            'const schema = ' +
                schema +
                ` as const;\nexport { schema as ${name}Schema };`,
        );

        // Generate types
        const content = await compileFromFile(schemaPath, {
            bannerComment: BANNER_COMMENT,
            cwd: dirname(schemaPath),
            ignoreMinAndMaxItems: true,
            declareExternallyReferenced: true,
            unreachableDefinitions: true,
        });
        await writeFile(
            path.join(outDir, `${name}.type.ts`),
            content,
        )
    }));
})();