#!/usr/bin/env node

/**
 * This script automatically tags Linear issues with the release version
 * when a new release is published.
 *
 * It works by:
 * 1. Parsing the CHANGELOG.md to find PR numbers for a specific version
 * 2. Using the Linear API to find issues that have GitHub PR attachments
 * 3. Creating a label for the release version if it doesn't exist
 * 4. Adding the release label to those issues
 *
 * Environment variables required:
 * - LINEAR_API_KEY: Linear API key with write access
 * - LINEAR_TEAM_ID: Linear team ID (e.g., "SOU")
 *
 * Usage:
 *   node scripts/tagLinearIssuesWithRelease.mjs <version>
 *   Example: node scripts/tagLinearIssuesWithRelease.mjs 4.11.4
 */

import * as fs from "fs";
import * as path from "path";

const LINEAR_API_URL = "https://api.linear.app/graphql";
const GITHUB_REPO = "sourcebot-dev/sourcebot";

async function linearGraphQL(query, variables = {}) {
    const apiKey = process.env.LINEAR_API_KEY;
    if (!apiKey) {
        throw new Error("LINEAR_API_KEY environment variable is required");
    }

    const response = await fetch(LINEAR_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: apiKey,
        },
        body: JSON.stringify({ query, variables }),
    });

    const result = await response.json();

    if (result.errors) {
        throw new Error(`Linear API error: ${JSON.stringify(result.errors)}`);
    }

    return result.data;
}

/**
 * Parse the changelog to extract PR numbers for a specific version
 */
function getPRsForVersion(changelogPath, version) {
    const changelog = fs.readFileSync(changelogPath, "utf-8");
    const lines = changelog.split("\n");

    const prNumbers = [];
    let inTargetVersion = false;

    for (const line of lines) {
        // Check if we're entering the target version section
        const versionMatch = line.match(/^## \[([^\]]+)\]/);
        if (versionMatch) {
            if (versionMatch[1] === version) {
                inTargetVersion = true;
                continue;
            } else if (inTargetVersion) {
                // We've moved past the target version, stop parsing
                break;
            }
        }

        // If we're in the target version section, extract PR numbers
        if (inTargetVersion) {
            const prMatches = line.matchAll(/\[#(\d+)\]\([^)]+\)/g);
            for (const match of prMatches) {
                prNumbers.push(parseInt(match[1], 10));
            }
        }
    }

    return [...new Set(prNumbers)]; // Remove duplicates
}

/**
 * Find Linear issues that have attachments linking to the given GitHub PRs
 */
async function findLinearIssuesForPRs(prNumbers) {
    const issues = [];

    for (const prNumber of prNumbers) {
        const prUrl = `https://github.com/${GITHUB_REPO}/pull/${prNumber}`;

        // Query Linear for attachments that match this PR URL
        const data = await linearGraphQL(
            `
            query($url: String!) {
                attachmentsForURL(url: $url) {
                    nodes {
                        id
                        url
                        issue {
                            id
                            identifier
                            title
                            labels {
                                nodes {
                                    id
                                    name
                                }
                            }
                        }
                    }
                }
            }
            `,
            { url: prUrl }
        );

        if (data.attachmentsForURL?.nodes) {
            for (const attachment of data.attachmentsForURL.nodes) {
                if (attachment.issue) {
                    issues.push({
                        issueId: attachment.issue.id,
                        identifier: attachment.issue.identifier,
                        title: attachment.issue.title,
                        existingLabels: attachment.issue.labels?.nodes || [],
                        prNumber,
                    });
                }
            }
        }
    }

    // Remove duplicate issues (same issue might be linked to multiple PRs)
    const uniqueIssues = [];
    const seenIds = new Set();
    for (const issue of issues) {
        if (!seenIds.has(issue.issueId)) {
            seenIds.add(issue.issueId);
            uniqueIssues.push(issue);
        }
    }

    return uniqueIssues;
}

/**
 * Get the team ID from the team key
 */
async function getTeamId(teamKey) {
    const data = await linearGraphQL(
        `
        query($key: String!) {
            team(id: $key) {
                id
                name
            }
        }
        `,
        { key: teamKey }
    );

    if (!data.team) {
        throw new Error(`Team with key "${teamKey}" not found`);
    }

    return data.team.id;
}

/**
 * Find or create a label for the release version
 */
async function findOrCreateReleaseLabel(teamId, version) {
    const labelName = `v${version}`;

    // First, search for existing label
    const searchData = await linearGraphQL(
        `
        query($teamId: String!) {
            team(id: $teamId) {
                labels {
                    nodes {
                        id
                        name
                    }
                }
            }
        }
        `,
        { teamId }
    );

    const existingLabel = searchData.team?.labels?.nodes?.find(
        (label) => label.name === labelName
    );

    if (existingLabel) {
        console.log(`Found existing label: ${labelName}`);
        return existingLabel.id;
    }

    // Create the label if it doesn't exist
    console.log(`Creating new label: ${labelName}`);
    const createData = await linearGraphQL(
        `
        mutation($teamId: String!, $name: String!) {
            issueLabelCreate(input: { teamId: $teamId, name: $name, color: "#10B981" }) {
                issueLabel {
                    id
                    name
                }
                success
            }
        }
        `,
        { teamId, name: labelName }
    );

    if (!createData.issueLabelCreate?.success) {
        throw new Error(`Failed to create label: ${labelName}`);
    }

    return createData.issueLabelCreate.issueLabel.id;
}

/**
 * Add a label to an issue
 */
async function addLabelToIssue(issueId, labelId, existingLabelIds) {
    // Combine existing labels with the new one
    const allLabelIds = [...new Set([...existingLabelIds, labelId])];

    const data = await linearGraphQL(
        `
        mutation($issueId: String!, $labelIds: [String!]!) {
            issueUpdate(id: $issueId, input: { labelIds: $labelIds }) {
                success
                issue {
                    identifier
                }
            }
        }
        `,
        { issueId, labelIds: allLabelIds }
    );

    return data.issueUpdate?.success;
}

async function main() {
    const version = process.argv[2];

    if (!version) {
        console.error("Usage: node tagLinearIssuesWithRelease.mjs <version>");
        console.error("Example: node tagLinearIssuesWithRelease.mjs 4.11.4");
        process.exit(1);
    }

    const teamKey = process.env.LINEAR_TEAM_ID;
    if (!teamKey) {
        console.error("LINEAR_TEAM_ID environment variable is required");
        process.exit(1);
    }

    console.log(`Tagging Linear issues for release v${version}`);

    // Find the changelog file
    const changelogPath = path.join(process.cwd(), "CHANGELOG.md");
    if (!fs.existsSync(changelogPath)) {
        console.error(`Changelog not found at: ${changelogPath}`);
        process.exit(1);
    }

    // Step 1: Parse changelog for PR numbers
    console.log("\n1. Parsing changelog for PR numbers...");
    const prNumbers = getPRsForVersion(changelogPath, version);
    if (prNumbers.length === 0) {
        console.log(`No PRs found for version ${version}`);
        process.exit(0);
    }
    console.log(`   Found ${prNumbers.length} PRs: ${prNumbers.join(", ")}`);

    // Step 2: Find Linear issues for these PRs
    console.log("\n2. Finding Linear issues linked to these PRs...");
    const issues = await findLinearIssuesForPRs(prNumbers);
    if (issues.length === 0) {
        console.log("   No Linear issues found linked to these PRs");
        process.exit(0);
    }
    console.log(`   Found ${issues.length} Linear issues:`);
    for (const issue of issues) {
        console.log(`   - ${issue.identifier}: ${issue.title} (PR #${issue.prNumber})`);
    }

    // Step 3: Get team ID and find/create release label
    console.log("\n3. Finding or creating release label...");
    const teamId = await getTeamId(teamKey);
    const labelId = await findOrCreateReleaseLabel(teamId, version);

    // Step 4: Add label to all issues
    console.log("\n4. Adding release label to issues...");
    let successCount = 0;
    for (const issue of issues) {
        const existingLabelIds = issue.existingLabels.map((l) => l.id);

        // Check if issue already has the label
        if (issue.existingLabels.some((l) => l.name === `v${version}`)) {
            console.log(`   ${issue.identifier}: Already has label v${version}, skipping`);
            successCount++;
            continue;
        }

        const success = await addLabelToIssue(issue.issueId, labelId, existingLabelIds);
        if (success) {
            console.log(`   ${issue.identifier}: Added label v${version}`);
            successCount++;
        } else {
            console.error(`   ${issue.identifier}: Failed to add label`);
        }
    }

    console.log(`\nDone! Tagged ${successCount}/${issues.length} issues with v${version}`);
}

main().catch((error) => {
    console.error("Error:", error.message);
    process.exit(1);
});
