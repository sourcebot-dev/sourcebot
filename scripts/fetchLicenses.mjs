#!/usr/bin/env node

/**
 * Parses yarn.lock and fetches license information for all external dependencies.
 *
 * It works by:
 * 1. Parsing the yarn.lock file to extract external (non-workspace) packages
 * 2. Fetching license info from the npm registry for each unique package+version
 * 3. Writing the results to a JSON file
 *
 * Usage:
 *   node scripts/fetchLicenses.mjs
 *   node scripts/fetchLicenses.mjs --output custom-output.json
 */

import * as fs from "fs";
import * as path from "path";

const NPM_REGISTRY = "https://registry.npmjs.org";
const CONCURRENCY = 10;
const OUTPUT_DEFAULT = "oss-licenses.json";
const LICENSE_MAP_PATH = path.join(path.dirname(new URL(import.meta.url).pathname), "npmLicenseMap.json");

function loadLicenseMap() {
    if (!fs.existsSync(LICENSE_MAP_PATH)) {
        return {};
    }
    return JSON.parse(fs.readFileSync(LICENSE_MAP_PATH, "utf-8"));
}

function deepEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

function applyLicenseMap(results, licenseMap) {
    let overrideCount = 0;
    for (const result of results) {
        const mapping = licenseMap[result.name];
        if (!mapping) continue;
        if (deepEqual(result.license, mapping.old)) {
            result.license = mapping.new;
            overrideCount++;
        }
    }
    return overrideCount;
}

function parseYarnLock(lockfilePath) {
    const content = fs.readFileSync(lockfilePath, "utf-8");
    const lines = content.split("\n");

    const packages = [];
    let currentEntry = null;

    for (const line of lines) {
        // New top-level entry (package descriptor line starts with a quote at column 0)
        if (line.startsWith('"') && line.endsWith(":")) {
            currentEntry = { descriptor: line.slice(0, -1), resolution: null, linkType: null };
            continue;
        }

        if (!currentEntry) continue;

        const trimmed = line.trimStart();

        if (trimmed.startsWith("resolution:")) {
            // e.g. resolution: "@ai-sdk/anthropic@npm:3.0.50"
            const match = trimmed.match(/resolution:\s*"(.+)"/);
            if (match) {
                currentEntry.resolution = match[1];
            }
        } else if (trimmed.startsWith("linkType:")) {
            const match = trimmed.match(/linkType:\s*(\w+)/);
            if (match) {
                currentEntry.linkType = match[1];
            }
        }

        // When we have both resolution and linkType, the entry is complete enough
        if (currentEntry.resolution && currentEntry.linkType) {
            if (currentEntry.linkType === "hard") {
                packages.push(currentEntry.resolution);
            }
            currentEntry = null;
        }
    }

    return packages;
}

function parseResolution(resolution) {
    // resolution format: "<name>@npm:<version>"
    const match = resolution.match(/^(.+)@npm:(.+)$/);
    if (!match) return null;
    return { name: match[1], version: match[2] };
}

async function fetchLicense(name, version) {
    const url = `${NPM_REGISTRY}/${encodeURIComponent(name).replace("%40", "@")}/${version}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            return { name, version, license: "UNKNOWN", error: `HTTP ${response.status}` };
        }
        const data = await response.json();
        const license = data.license || "UNKNOWN";
        const repository = data.repository?.url || data.repository || null;
        const homepage = data.homepage || null;
        return { name, version, license, repository, homepage };
    } catch (err) {
        return { name, version, license: "UNKNOWN", error: err.message };
    }
}

async function processInBatches(items, batchSize, fn) {
    const results = [];
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(fn));
        results.push(...batchResults);

        if (i + batchSize < items.length) {
            process.stdout.write(`\r  Fetched ${results.length}/${items.length} packages...`);
        }
    }
    process.stdout.write(`\r  Fetched ${results.length}/${items.length} packages...\n`);
    return results;
}

async function main() {
    const args = process.argv.slice(2);
    const outputIdx = args.indexOf("--output");
    const outputFile = outputIdx !== -1 && args[outputIdx + 1]
        ? args[outputIdx + 1]
        : OUTPUT_DEFAULT;

    const lockfilePath = path.join(process.cwd(), "yarn.lock");
    if (!fs.existsSync(lockfilePath)) {
        console.error("yarn.lock not found in current directory. Run `yarn install` first.");
        process.exit(1);
    }

    console.log("1. Parsing yarn.lock...");
    const resolutions = parseYarnLock(lockfilePath);
    console.log(`   Found ${resolutions.length} external package entries`);

    // Deduplicate by name+version
    const uniquePackages = new Map();
    for (const resolution of resolutions) {
        const parsed = parseResolution(resolution);
        if (!parsed) continue;
        const key = `${parsed.name}@${parsed.version}`;
        if (!uniquePackages.has(key)) {
            uniquePackages.set(key, parsed);
        }
    }

    const packages = Array.from(uniquePackages.values());
    console.log(`   ${packages.length} unique packages after deduplication`);

    console.log("\n2. Fetching license information from npm registry...");
    const results = await processInBatches(packages, CONCURRENCY, (pkg) =>
        fetchLicense(pkg.name, pkg.version)
    );

    // Apply license overrides from npmLicenseMap.json
    const licenseMap = loadLicenseMap();
    const overrideCount = applyLicenseMap(results, licenseMap);
    if (overrideCount > 0) {
        console.log(`\n   Applied ${overrideCount} license override(s) from npmLicenseMap.json`);
    }

    // Sort by package name for stable output
    results.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));

    const output = {
        generatedAt: new Date().toISOString(),
        totalPackages: results.length,
        packages: results,
    };

    const outputPath = path.join(process.cwd(), outputFile);
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n");
    console.log(`\n3. Results written to ${outputFile}`);

    // Print summary
    const licenseCounts = {};
    for (const r of results) {
        const lic = r.license || "UNKNOWN";
        const licStr = typeof lic === "object" ? JSON.stringify(lic) : lic;
        licenseCounts[licStr] = (licenseCounts[licStr] || 0) + 1;
    }

    console.log("\nLicense summary:");
    const sorted = Object.entries(licenseCounts).sort((a, b) => b[1] - a[1]);
    for (const [license, count] of sorted) {
        console.log(`  ${license}: ${count}`);
    }
}

main().catch((error) => {
    console.error("Error:", error.message);
    process.exit(1);
});
