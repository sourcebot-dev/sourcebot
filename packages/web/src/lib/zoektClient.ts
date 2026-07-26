// Thin wrapper around the vendored Zoekt webserver gRPC client. Kept in
// a separate module so the readiness route can mock it in tests without
// pulling the gRPC + @opentelemetry CJS chain at test-load time.

export type ZoektListRequest = {
    opts?: { max_wall_time?: { seconds: number; nanos: number } };
};

export type ZoektClient = {
    List: (request: ZoektListRequest, callback: (err: Error | null) => void) => void;
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
        zoekt: { webserver: { v1: { WebserverService: new (address: string, credentials: unknown) => ZoektClient } } };
    };

    const zoektUrl = new URL(shared.env.ZOEKT_WEBSERVER_URL);
    const grpcAddress = `${zoektUrl.hostname}:${zoektUrl.port}`;
    return new proto.zoekt.webserver.v1.WebserverService(
        grpcAddress,
        grpc.credentials.createInsecure(),
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

