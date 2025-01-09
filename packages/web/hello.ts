import { credentials, loadPackageDefinition, Metadata } from "@grpc/grpc-js";
import { loadSync } from "@grpc/proto-loader";

// Useful: https://github.com/badsyntax/grpc-js-typescript/tree/master

// Load the protobuf definition
const packageDefinition = loadSync(
    "../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/webserver.proto",
    {
        keepCase: false,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        includeDirs: ["../../vendor/zoekt/grpc/protos"],
    },
);

const protoDescriptor = loadPackageDefinition(packageDefinition);
const zoekt = protoDescriptor.zoekt.webserver.v1;

const stub = new zoekt.WebserverService("localhost:6070", credentials.createInsecure());

const metadata = new Metadata();
metadata.add("x-Sourcegraph-Tenant-ID", "1");

stub.Search({
    "opts": {
        "chunk_matches": true,
        "num_context_lines": 5
    },
    "query": {
        "and": {
            "children": [
                {
                    "regexp": {
                        "regexp": "useEffect"
                    }
                }
            ]
        }
    }
}, metadata, (err, response) => {
    console.log(JSON.stringify(response, null, 2));
})
