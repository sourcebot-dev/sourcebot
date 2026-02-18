import { Script } from "../scriptRunner";
import { PrismaClient } from "../../dist";
import { confirmAction } from "../utils";

const mockUsers = [
    { name: "Alice Johnson", email: "alice.johnson@example.com" },
    { name: "Bob Smith", email: "bob.smith@example.com" },
    { name: "Charlie Brown", email: "charlie.brown@example.com" },
    { name: "Diana Prince", email: "diana.prince@example.com" },
    { name: "Ethan Hunt", email: "ethan.hunt@example.com" },
    { name: "Fiona Green", email: "fiona.green@example.com" },
    { name: "George Miller", email: "george.miller@example.com" },
    { name: "Hannah Lee", email: "hannah.lee@example.com" },
    { name: "Ivan Petrov", email: "ivan.petrov@example.com" },
    { name: "Julia Chen", email: "julia.chen@example.com" },
];

export const injectUserData: Script = {
    run: async (prisma: PrismaClient) => {
        const orgId = 1;

        // Check if org exists
        const org = await prisma.org.findUnique({
            where: { id: orgId }
        });

        if (!org) {
            console.error(`Organization with id ${orgId} not found. Please create it first.`);
            return;
        }

        console.log(`Injecting ${mockUsers.length} mock users for organization: ${org.name} (${org.domain})`);

        confirmAction();

        const createdUsers: { id: string; email: string | null; name: string | null }[] = [];

        for (const mockUser of mockUsers) {
            // Check if user already exists
            const existingUser = await prisma.user.findUnique({
                where: { email: mockUser.email }
            });

            if (existingUser) {
                console.log(`User ${mockUser.email} already exists, skipping...`);
                createdUsers.push(existingUser);
                continue;
            }

            // Create the user
            const user = await prisma.user.create({
                data: {
                    name: mockUser.name,
                    email: mockUser.email,
                }
            });

            console.log(`Created user: ${user.name} (${user.email})`);
            createdUsers.push(user);
        }

        // Add users to the organization
        for (const user of createdUsers) {
            // Check if already a member
            const existingMembership = await prisma.userToOrg.findUnique({
                where: {
                    orgId_userId: {
                        orgId,
                        userId: user.id,
                    }
                }
            });

            if (existingMembership) {
                console.log(`User ${user.email} is already a member of the org, skipping...`);
                continue;
            }

            await prisma.userToOrg.create({
                data: {
                    orgId,
                    userId: user.id,
                    role: "MEMBER",
                }
            });

            console.log(`Added ${user.email} to organization`);
        }

        console.log(`\nUser data injection complete!`);
        console.log(`Total users created/found: ${createdUsers.length}`);

        // Show org membership count
        const memberCount = await prisma.userToOrg.count({
            where: { orgId }
        });
        console.log(`Total org members: ${memberCount}`);
    },
};
