import { PrismaClient } from "@sourcebot/db";
import { getDBConnectionString } from "@sourcebot/shared";

export const prisma = new PrismaClient({
    datasources: {
        db: {
            url: getDBConnectionString(),
        },
    },
});
