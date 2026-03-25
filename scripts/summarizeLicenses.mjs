#!/usr/bin/env node

/**
 * Reads oss-licenses.json and produces a summary of license usage.
 *
 * Usage:
 *   node scripts/summarizeLicenses.mjs
 *   node scripts/summarizeLicenses.mjs --input custom-input.json --output custom-output.json
 */

import * as fs from "fs";
import * as path from "path";

const INPUT_DEFAULT = "oss-licenses.json";
const OUTPUT_DEFAULT = "oss-license-summary.json";

function main() {
    const args = process.argv.slice(2);
    const inputIdx = args.indexOf("--input");
    const outputIdx = args.indexOf("--output");
    const inputFile = inputIdx !== -1 && args[inputIdx + 1] ? args[inputIdx + 1] : INPUT_DEFAULT;
    const outputFile = outputIdx !== -1 && args[outputIdx + 1] ? args[outputIdx + 1] : OUTPUT_DEFAULT;

    const inputPath = path.join(process.cwd(), inputFile);
    if (!fs.existsSync(inputPath)) {
        console.error(`${inputFile} not found. Run \`node scripts/fetchLicenses.mjs\` first.`);
        process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
    const packages = data.packages || [];

    // Count by license
    const licenseCounts = {};
    for (const pkg of packages) {
        const license = typeof pkg.license === "object"
            ? JSON.stringify(pkg.license)
            : (pkg.license || "UNKNOWN");
        licenseCounts[license] = (licenseCounts[license] || 0) + 1;
    }

    // Sort descending by count
    const sorted = Object.entries(licenseCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([license, count]) => ({ license, count }));

    const summary = {
        generatedAt: new Date().toISOString(),
        sourcedFrom: inputFile,
        totalPackages: packages.length,
        totalLicenseTypes: sorted.length,
        licenses: sorted,
    };

    const outputPath = path.join(process.cwd(), outputFile);
    fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2) + "\n");

    console.log(`License summary (${packages.length} packages, ${sorted.length} license types):\n`);
    for (const { license, count } of sorted) {
        console.log(`  ${count} ${license}`);
    }
    console.log(`\nWritten to ${outputFile}`);
}

main();
