import { auth } from "@/auth";
import { getUser } from "@/data/user";
import { prisma } from "@/prisma";
import { ConnectionList } from "./components/connectionList";
import { Header } from "../components/header";
import { NewConnectionCard } from "./components/newConnectionCard";

export default async function ConnectionsPage() {
    const session = await auth();
    if (!session) {
        return null;
    }

    const user = await getUser(session.user.id);
    if (!user || !user.activeOrgId) {
        return null;
    }

    const connections = await prisma.connection.findMany({
        where: {
            orgId: user.activeOrgId,
        }
    });

    return (
        <div>
            <Header>
                <h1 className="text-3xl">Connections</h1>
            </Header>
            <div className="flex flex-col md:flex-row gap-4">
                <ConnectionList
                    connections={connections}
                    className="md:w-3/4"
                />
                <NewConnectionCard
                    className="md:w-1/4"
                />
            </div>
        </div>
    );
}
