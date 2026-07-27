// Thin wrapper around the vendored Zoekt webserver gRPC client. Kept in
// a separate module so the readiness route can mock it in tests without
// pulling the gRPC + @opentelemetry CJS chain at test-load time.

export type ZoektListRequest = {
    opts?: { max_wall_time?: { seconds: number; nanos: number } };
};

export type ZoektClient = {
    List: (request: ZoektListRequest, callback: (err: Error | null) => void) => void;
};

// Hard ceiling on the first-use Zoekt build. Stays under 1s so the
// per-check withTimeout (2s route budget) always has time to run the
// gRPC List probe after the client is built. A hung init cannot leave
// clientPromise pending forever either — the catch in loadZoektClient
// clears the cached promise on the timeout.
const ZOEKT_BUILD_TIMEOUT_MS = 800;

let clientPromise: Promise<ZoektClient> | null = null;

const buildClient = async (): Promise<ZoektClient> => {
    const build = async (): Promise<ZoektClient> => {
        const [grpc, protoLoader, nodePath, shared] = await Promise.all([
            import('@grpc/grpc-js'),
            import('@grpc/proto-loader'),
            import('node:path'),
            import('@sourcebot/shared'),
        ]);

        const protoBasePath = nodePath.join(process.cwd(), '../../vendor/zoekt/grpc/protos');
        const protoPath = nodePath.join(protoBasePath, 'zoekt/webserver/v1/webserver.proto');

        // load (async) instead of loadSync so the event loop stays
        // responsive while proto descriptors are being read and compiled.
        const packageDefinition = await protoLoader.load(protoPath, {
            keepCase: true,
            longs: Number,
            enums: String,
            defaults: true,
            oneofs: true,
            includeDirs: [protoBasePath],
        });

        const proto = grpc.loadPackageDefinition(packageDefinition) as unknown as {
            zoekt: { webserver: { v1: { WebserverService: new (address: string, credentials: unknown) => ZoektClient } } };
        };

        const zoektUrl = new URL(shared.env.ZOEKT_WEBSERVER_URL);
        const grpcAddress = `${zoektUrl.hostname}:${zoektUrl.port}`;
        return new proto.zoekt.webserver.v1.WebserverService(
            grpcAddress,
            grpc.credentials.createInsecure(),
        );
    };

    // Race the build against a hard timeout. If the build hangs (a slow
    // dynamic import or proto load) the timeout wins and the catch in
    // loadZoektClient clears the cached promise so the next call retries.
    //
    // The build promise itself is deliberately NOT cancellable, so when the
    // timeout wins the race the underlying work continues in the background
    // until the imports and proto load complete. Attach a no-op .catch so
    // a late rejection from the orphaned build does not surface as an
    // unhandled promise rejection in Node.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
            () => reject(new Error(`Zoekt client build exceeded ${ZOEKT_BUILD_TIMEOUT_MS}ms`)),
            ZOEKT_BUILD_TIMEOUT_MS,
        );
    });
    const orphaned = build().catch(() => {});
    try {
        return await Promise.race([orphaned, timeout]);
    } finally {
        if (timer) {
            clearTimeout(timer);
        }
    }
};

// Returns a connected client, building it on first use. Concurrent callers
// share the same in-flight build (no duplicated gRPC/proto init on a cold
// process). The cached promise is cleared on any failure — including the
// build timeout — so a transient init hang does not poison subsequent
// readiness probes.
export const loadZoektClient = (): Promise<ZoektClient> => {
    if (!clientPromise) {
        clientPromise = buildClient().catch((err) => {
            clientPromise = null;
            throw err;
        });
    }
    return clientPromise;
};

