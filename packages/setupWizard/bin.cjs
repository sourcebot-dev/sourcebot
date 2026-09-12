#!/usr/bin/env node
// Intersection of posthog-node and @inquirer/prompts runtime requirements.
const [major, minor] = process.versions.node.split('.').map(Number);
const supported = (major === 20 && minor >= 20) ||
    (major === 22 && minor >= 22) || (major === 23 && minor >= 5) || major >= 24;
if (!supported) {
    console.error('setup-sourcebot requires Node.js 20.20+, 22.22+, or 23.5+ (including Node.js 24+). Please upgrade Node.js.');
    process.exitCode = 1;
} else {
    import('./dist/index.js').catch(() => {
        console.error('Unable to start setup-sourcebot. Please reinstall the package.');
        process.exitCode = 1;
    });
}
