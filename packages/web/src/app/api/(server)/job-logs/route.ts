import { apiHandler } from "@/lib/apiHandler";
import { getBullMQClient } from "@/lib/bullmqClient";
import {
    notFound,
    requestBodySchemaValidationError,
    serviceErrorResponse,
} from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { withAuth } from "@/middleware/withAuth";
import { withMinimumOrgRole } from "@/middleware/withMinimumOrgRole";
import { OrgRole } from "@sourcebot/db";
import {
    QUEUE_SPECS,
    type QueueName,
    type QueueSpec,
} from "@sourcebot/shared";
import { z } from "zod";

const queueSchema = z.custom<QueueName>(
    (value) =>
        typeof value === "string" && Object.hasOwn(QUEUE_SPECS, value),
    "Unsupported queue",
);

const requestSchema = z.object({
    queue: queueSchema,
    jobId: z.string().min(1).max(200),
});

const getJobLogs = async <TName extends QueueName>(
    spec: QueueSpec<TName>,
    jobId: string,
) => {
    const client = getBullMQClient();
    const job = await client.getJob(spec, jobId);
    if (!job) {
        return null;
    }

    return client.getJobLogs(spec, jobId, { ascending: true });
};

export const POST = apiHandler(async (request) => {
    const parsed = requestSchema.safeParse(
        await request.json().catch(() => null),
    );
    if (!parsed.success) {
        return serviceErrorResponse(
            requestBodySchemaValidationError(parsed.error),
        );
    }

    const result = await withAuth(({ role }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, () =>
            getJobLogs(
                QUEUE_SPECS[parsed.data.queue],
                parsed.data.jobId,
            )
        )
    );

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }
    if (!result) {
        return serviceErrorResponse(notFound("Job not found"));
    }

    return Response.json(result);
});
