'use server';

import { schemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { NextRequest } from "next/server";
import { credentials, loadPackageDefinition, Metadata } from "@grpc/grpc-js";
import { loadSync } from "@grpc/proto-loader";
import { z } from "zod";

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

export const POST = async (request: NextRequest) => {
    const body = await request.json();
    const requestSchema = z.object({
        tenantId: z.number(),
    });

    const parsed = await requestSchema.safeParseAsync(body);
    if (!parsed.success) {
        return serviceErrorResponse(
            schemaValidationError(parsed.error)
        );
    }

    const metadata = new Metadata();
    metadata.add("x-Sourcegraph-Tenant-ID", parsed.data.tenantId.toString());

    const response = await new Promise((resolve, reject) => stub.Search({
        opts: {
            chunk_matches: true,
            num_context_lines: 1
        },
        // @todo : we will need to figure out how to parse a query into a AST.
        query: {
            and: {
                children: [
                    {
                        regexp: {
                            regexp: "useEffect"
                        }
                    }
                ]
            }
        }
    }, metadata, (err, response) => {
        if (err) {
            reject(err);
        }
        resolve(response);
    }));


    return Response.json(response);
}