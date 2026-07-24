// Thin wrapper around the vendored Zoekt webserver gRPC client. Kept in
// a separate module so the readiness route can mock it in tests without
// pulling the gRPC + @opentelemetry CJS chain at test-load time.

export type ZoektListRequest = {
    opts?: { max_wall_time?: { seconds: number; nanos: number } };
};

export type ZoektClient = {
    List: (request: ZoektListRequest, callback: (err: Error | null) => void) => void;
};

let zoektClientPromise: Promise<ZoektClient> | undefined;

export const loadZoektClient = (): Promise<ZoektClient> => {
    if (!zoektClientPromise) {
        zoektClientPromise = (async () => {
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
        })();
    }
    return zoektClientPromise;
};
