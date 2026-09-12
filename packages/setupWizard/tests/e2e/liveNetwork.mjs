// External test routing only. Production PostHog is always captured locally;
// live public code hosts and model catalogs retain their real network behavior.
import tls from 'node:tls';
import { Agent, buildConnector, setGlobalDispatcher } from 'undici';

if (process.versions.bun) {
    throw Error('Live tests require the actual Node runtime');
}
const connect = buildConnector({});
const permitted = new Set(['api.github.com', 'github.com', 'gitlab.com', 'gitea.com', 'codeberg.org', 'models.dev', 'gerrit-review.googlesource.com']);
setGlobalDispatcher(new Agent({ connect(options, callback) {
    if (options.hostname === 'us.i.posthog.com' || options.hostname === 'raw.githubusercontent.com') {
        const socket = tls.connect({ host: '127.0.0.1', port: Number(process.env.TEST_CAPTURE_PORT), servername: options.hostname });
        socket.once('secureConnect', () => callback(null, socket));
        socket.once('error', error => callback(error, null));
    } else if (options.protocol === 'https:' && permitted.has(options.hostname)) {
        connect(options, callback);
    } else {
        callback(new Error('Live wizard egress outside the approved code hosts denied'), null);
    }
} }));
