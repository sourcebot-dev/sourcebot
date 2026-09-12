#!/usr/bin/env node
if (Number(process.versions.node.split('.')[0]) < 24) {
    console.error('setup-sourcebot requires Node.js 24 or newer. Please upgrade Node.js.');
    process.exitCode = 1;
} else {
    import('./dist/index.js').catch(() => {
        console.error('Unable to start setup-sourcebot. Please reinstall the package.');
        process.exitCode = 1;
    });
}
