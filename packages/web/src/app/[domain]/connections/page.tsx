import { ConnectionList } from "./components/connectionList";
import { Header } from "../components/header";
import { getConnections, getOrgMembership } from "@/actions";
import { isServiceError } from "@/lib/utils";
import { notFound, ServiceErrorException } from "@/lib/serviceError";
import { OrgRole } from "@sourcebot/db";

export default async function ConnectionsPage(props: { params: Promise<{ domain: string }> }) {
    const params = await props.params;

    const {
        domain
    } = params;

    const connections = await getConnections(domain);
    if (isServiceError(connections)) {
        throw new ServiceErrorException(connections);
    }

    const membership = await getOrgMembership(domain);
    if (isServiceError(membership)) {
        throw new ServiceErrorException(notFound());
    }

    return (
        <div>
            <Header>
                <h1 className="text-3xl">Connections</h1>
            </Header>
            <ConnectionList
                isDisabled={membership.role !== OrgRole.OWNER}
            />
        </div>
    );
}
