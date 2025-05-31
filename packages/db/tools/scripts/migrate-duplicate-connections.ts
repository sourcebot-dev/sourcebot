import { Script } from "../scriptRunner";
import { PrismaClient } from "../../dist";
import { confirmAction } from "../utils";
import { createLogger } from "@sourcebot/logger";

const logger = createLogger('migrate-duplicate-connections');

// Handles duplicate connections by renaming them to be unique.
// @see: 20250320215449_unique_connection_name_constraint_within_org
export const migrateDuplicateConnections: Script = {
    run: async (prisma: PrismaClient) => {

        // Find all duplicate connections based on name and orgId
        const duplicates = (await prisma.connection.groupBy({
            by: ['name', 'orgId'],
            _count: {
                _all: true,
            },
        })).filter(({ _count }) => _count._all > 1);

        logger.info(`Found ${duplicates.reduce((acc, { _count }) => acc + _count._all, 0)} duplicate connections.`);

        confirmAction();

        let migrated = 0;
        
        for (const duplicate of duplicates) {
            const { name, orgId } = duplicate;
            const connections = await prisma.connection.findMany({
                where: {
                    name,
                    orgId,
                },
                orderBy: {
                    createdAt: 'asc',
                },
            });

            for (let i = 0; i < connections.length; i++) {
                const connection = connections[i];
                const newName = `${name}-${i + 1}`;

                logger.info(`Migrating connection with id ${connection.id} from name=${name} to name=${newName}`);

                await prisma.connection.update({
                    where: { id: connection.id },
                    data: { name: newName },
                });
                migrated++;
            }
        }

        logger.info(`Migrated ${migrated} connections.`);
    },
};
