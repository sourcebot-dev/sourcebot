import { stripVTControlCharacters } from 'node:util';
import type { Events } from './telemetryEvents.js';

type Reason = Events['start_failed']['failureReason'];

// Docker exposes an exit status, not structured error reasons, for compose up.
// Recognize only specific CLI/daemon diagnostics locally. Never serialize output,
// captures, paths, image names, container names or IDs into an event.
export class DockerStartFailure {
    private pending = '';
    private detected: Reason = 'unknown';

    write(chunk: Buffer): void {
        // Bound retained output even for a long-running foreground Compose process.
        const lines = (this.pending + chunk.toString()).split(/[\r\n]/);
        this.pending = (lines.pop() ?? '').slice(-8192);
        for (const line of lines) {
            this.classify(line.slice(-8192));
        }
    }

    reason(): Reason {
        this.classify(this.pending);
        this.pending = '';
        return this.detected;
    }

    private classify(raw: string): void {
        if (this.detected !== 'unknown') {
            return;
        }
        const line = stripVTControlCharacters(raw).trim();
        // Attached application logs are not Docker diagnostics.
        if (line.includes(' | ')) {
            return;
        }
        const daemon = /^Error response from daemon:/i.test(line);
        if (daemon && /container name .+ is already in use by container/i.test(line)) {
            this.detected = 'container_name_conflict';
        } else if (daemon && /port is already allocated|address already in use/i.test(line)) {
            this.detected = 'port_conflict';
        } else if (
            /^(?:Error response from daemon:|unable to get image|pull access denied|failed to resolve reference)/i.test(line) &&
            /pull access denied|manifest unknown|manifest for .+ not found|failed to resolve reference|no matching manifest|toomanyrequests|unauthorized: authentication required/i.test(line)
        ) {
            this.detected = 'image_pull_failed';
        } else if (daemon && /invalid mount config|mounts denied|error while creating mount source path|invalid volume specification/i.test(line)) {
            this.detected = 'mount_failed';
        } else if (/^(?:Cannot connect to the Docker daemon|error during connect:|permission denied while trying to connect to the Docker daemon|docker: ['"]?compose['"]? is not a docker command)/i.test(line)) {
            this.detected = 'docker_unavailable';
        } else if (/^(?:validating .+:|no configuration file provided:|yaml: line \d+:|services\..+:|service .+ refers to undefined (?:volume|network) .+: invalid compose project)/i.test(line)) {
            this.detected = 'compose_configuration';
        }
    }
}
