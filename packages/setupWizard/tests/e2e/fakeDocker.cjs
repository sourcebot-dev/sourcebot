const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.TEST_DOCKER_LOG, JSON.stringify(args) + '\n');
const state = JSON.parse(fs.readFileSync(process.env.TEST_DOCKER_STATE, 'utf8'));
const command = args.slice(0, 2).join(' ');
fs.appendFileSync(process.env.TEST_DOCKER_PIDS, String(process.pid) + '\n');
if (command === 'compose up' && state.start) {
    let index = 0;
    const write = () => {
        if (index < (state.start.stderrChunks ?? []).length) {
            process.stderr.write(state.start.stderrChunks[index++]);
            setTimeout(write, 10);
        } else if (state.start.signal) {
            process.kill(process.pid, state.start.signal);
        } else {
            process.exit(state.start.exitCode ?? 1);
        }
    };
    setTimeout(write, state.start.delayMs ?? 0);
} else if (state.fail?.includes(command)) {
    console.error('canary-sensitive-error');
    process.exit(1);
} else if (state.stall?.includes(command)) {
    if (state.descendant) {
        const child = require('node:child_process').spawn(process.execPath, ['-e', "process.on('SIGINT', () => {}); setInterval(() => {}, 1000)"], { stdio: 'ignore' });
        fs.appendFileSync(process.env.TEST_DOCKER_PIDS, String(child.pid) + '\n');
    }
    if (state.stubborn) {
        process.on('SIGINT', () => {});
    }
    setInterval(() => {}, 1000);
} else if (command === 'compose ps') {
    console.log(state.malformed ? 'malformed' : JSON.stringify(state.containers ?? []));
} else if (command === 'volume ls') {
    console.log((state.volumes ?? []).join('\n'));
} else if (args[0] === 'ps') {
    console.log(state.ports ?? '');
} else if (args[0] === 'stop') {
    if (!state.keepPorts) {
        state.ports = '';
        fs.writeFileSync(process.env.TEST_DOCKER_STATE, JSON.stringify(state));
    }
}
