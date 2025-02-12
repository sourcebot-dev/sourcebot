import { ConnectionList } from "./components/connectionList";
import { Header } from "../components/header";
import { NewConnectionCard } from "./components/newConnectionCard";
import NotFoundPage from "@/app/not-found";
import { getConnections } from "@/actions";
import { isServiceError } from "@/lib/utils";

export default async function ConnectionsPage({ params: { domain } }: { params: { domain: string } }) {
    const connections = await getConnections(domain);
    if (isServiceError(connections)) {
        return <NotFoundPage />;
    }

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
