// The following script loads the config.json file and resolves any environment variable overrides.
// It then writes then to stdout in the format of `KEY="VALUE"`.
// This is used by entrypoint.sh to set them as variables.
(async () => {
    if (!process.env.CONFIG_PATH) {
        console.error('CONFIG_PATH is not set');
        process.exit(1);
    }

    // Silence all console logs so we don't pollute stdout.
    const originalConsoleLog = console.log;
    console.log = () => {};
    console.debug = () => {};
    console.info = () => {};
    console.warn = () => {};
    // console.error = () => {}; // Keep errors

    const { loadConfig } = await import("../src/utils.js");
    const { resolveEnvironmentVariableOverridesFromConfig } = await import("../src/env.server.js");

    const config = await loadConfig(process.env.CONFIG_PATH);
    const overrides = await resolveEnvironmentVariableOverridesFromConfig(config);

    for (const [key, value] of Object.entries(overrides)) {
        const escapedValue = value.replace(/"/g, '\\"');
        originalConsoleLog(`${key}="${escapedValue}"`);
    }

    process.exit(0);
})();