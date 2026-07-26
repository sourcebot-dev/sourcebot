// Thin wrapper around the vendored Zoekt webserver gRPC client. Kept in
// a separate module so the readiness route can mock it in tests without
// pulling the gRPC + @opentelemetry CJS chain at test-load time.

export type ZoektListRequest = {
    opts?: { max_wall_time?: { seconds: number; nanos: number } };
};

// Loose summary of the `List` response. The full gRPC type is much wider
// (see `proto/zoekt/webserver/v1/ListResponse.ts`); we only need the bits
// the readiness probe inspects, so callers can mock it with a small object.
export type ZoektListResponse = {
    repos?: unknown[];
    repos_map?: Record<number, unknown>;
};

export type ZoektClient = {
    List: (request: ZoektListRequest, callback: (err: Error | null, result: ZoektListResponse) => void) => void;
};

let cachedClient: ZoektClient | undefined;

const buildClient = async (): Promise<ZoektClient> => {
    const [grpc, protoLoader, nodePath, shared] = await Promise.all([
        import('@grpc/grpc-js'),
        import('@grpc/proto-loader'),
        import('node:path'),
        import('@sourcebot/shared'),
    ]);

    const protoBasePath = nodePath.join(process.cwd(), '../../vendor/zoekt/grpc/protos');
    const protoPath = nodePath.join(protoBasePath, 'zoekt/webserver/v1/webserver.proto');

    const packageDefinition = protoLoader.loadSync(protoPath, {
        keepCase: true,
        longs: Number,
        enums: String,
        defaults: true,
        oneofs: true,
        includeDirs: [protoBasePath],
    });

    const proto = grpc.loadPackageDefinition(packageDefinition) as unknown as {
        zoekt: { webserver: { v1: { WebserverService: new (address: string, credentials: unknown, options?: Record<string, unknown>) => ZoektClient } } };
    };

    const zoektUrl = new URL(shared.env.ZOEKT_WEBSERVER_URL);
    const grpcAddress = `${zoektUrl.hostname}:${zoektUrl.port}`;
    // Match the channel options used by `zoektSearcher` so a healthy Zoekt
    // instance with a large repo catalog does not fail the probe just
    // because the default 4MB gRPC receive cap is smaller than the
    // response.
    return new proto.zoekt.webserver.v1.WebserverService(
        grpcAddress,
        grpc.credentials.createInsecure(),
        {
            'grpc.max_receive_message_length': 500 * 1024 * 1024, // 500MB
            'grpc.max_send_message_length': 500 * 1024 * 1024,    // 500MB
        },
    );
};

// Returns a connected client, building it on first use. Only successful
// builds are cached: a transient init failure does not poison subsequent
// readiness probes, so the next call can retry.
export const loadZoektClient = async (): Promise<ZoektClient> => {
    if (cachedClient) {
        return cachedClient;
    }
    const client = await buildClient();
    cachedClient = client;
    return client;
};

