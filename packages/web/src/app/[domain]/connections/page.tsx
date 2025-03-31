import { ConnectionList } from "./components/connectionList";
import { Header } from "../components/header";
import { NewConnectionCard } from "./components/newConnectionCard";
import { getConnections, getOrgMembership } from "@/actions";
import { isServiceError } from "@/lib/utils";
import { notFound, ServiceErrorException } from "@/lib/serviceError";

export default async function ConnectionsPage({ params: { domain } }: { params: { domain: string } }) {
    const connections = await getConnections(domain);
    if (isServiceError(connections)) {
        throw new ServiceErrorException(connections);
    }

    const membership = await getOrgMembership(domain);
    if (isServiceError(membership)) {
        return notFound();
    }

    return (
        <div>
            <Header>
                <h1 className="text-3xl">Connections</h1>
            </Header>
            <div className="flex flex-col md:flex-row gap-4">
                <ConnectionList
                    className="md:w-3/4"
                    role={membership.role}
                />
                <NewConnectionCard
                    className="md:w-1/4"
                    role={membership.role}
                />
            </div>
        </div>
    );
}
