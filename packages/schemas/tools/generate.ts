import path, { dirname } from "path";
import { mkdir, writeFile } from "fs/promises";
import $RefParser from "@apidevtools/json-schema-ref-parser";
import { compileFromFile } from "json-schema-to-typescript";
import { glob } from "glob";


const BANNER_COMMENT = 'THIS IS A AUTO-GENERATED FILE. DO NOT MODIFY MANUALLY!';

(async () => {
    const cwd = process.cwd();
    const schemasBasePath = path.resolve(`${cwd}/../../schemas`);
    const srcDir = path.resolve(`${cwd}/src`);
    const docsDir = path.resolve(`${cwd}/../../docs/snippets/schemas`);
    const schemas = await glob(`${schemasBasePath}/**/*.json`);

    await Promise.all(schemas.map(async (schemaPath) => {
        const name = path.parse(schemaPath).name;
        const version = path.basename(path.dirname(schemaPath));

        const srcOutDir = path.join(srcDir, version);
        const docsOutDir = path.join(docsDir, version);

        await mkdir(srcOutDir, { recursive: true });
        await mkdir(docsOutDir, { recursive: true });

        // Generate schema
        const schema = JSON.stringify(await $RefParser.dereference(schemaPath), null, 2);

        // Write to src
        await writeFile(
            path.join(srcOutDir, `${name}.schema.ts`),
            `// ${BANNER_COMMENT}\n` +
            'const schema = ' +
            schema +
            ` as const;\nexport { schema as ${name}Schema };`,
        );

        // Write to docs
        await writeFile(
            path.join(docsOutDir, `${name}.schema.mdx`),
            `{/* ${BANNER_COMMENT} */}\n` +
            '```json\n' +
            schema +
            '\n```\n'
        );

        // Generate types
        const content = await compileFromFile(schemaPath, {
            bannerComment: `// ${BANNER_COMMENT}\n`,
            cwd: dirname(schemaPath),
            ignoreMinAndMaxItems: true,
            declareExternallyReferenced: true,
            unreachableDefinitions: true,
        });
        await writeFile(
            path.join(srcOutDir, `${name}.type.ts`),
            content,
        )
    }));
})();