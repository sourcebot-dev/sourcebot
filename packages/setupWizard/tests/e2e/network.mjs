// Test-only network boundary. This file is outside the installed tarball. It changes
// TCP routing, not the SDK, URL, headers, event payload, or production configuration.
import tls from 'node:tls';
import { Agent, setGlobalDispatcher } from 'undici';
import { basename } from 'node:path';

if (process.platform === 'win32' && basename(process.execPath).toLowerCase() === 'docker.exe') {
    process.argv.splice(1, 0, 'fakeDocker.cjs');
    await import('./fakeDocker.cjs');
    // The fixture owns its exit/timers; never execute "compose" as a JS file.
    await new Promise(() => {});
}

setGlobalDispatcher(new Agent({ connect(options, callback) {
    if (options.protocol !== 'https:') {
        callback(new Error('Non-HTTPS test egress denied'), null);
        return;
    }
    const socket = tls.connect({ host: '127.0.0.1', port: Number(process.env.TEST_CAPTURE_PORT), servername: options.hostname });
    socket.once('secureConnect', () => callback(null, socket));
    socket.once('error', error => callback(error, null));
} }));
