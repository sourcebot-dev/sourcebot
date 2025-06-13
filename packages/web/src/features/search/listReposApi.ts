import { OrgRole } from "@sourcebot/db";
import { invalidZoektResponse, ServiceError } from "../../lib/serviceError";
import { ListRepositoriesResponse } from "./types";
import { zoektFetch } from "./zoektClient";
import { zoektListRepositoriesResponseSchema } from "./zoektSchema";
import { sew, withAuth, withOrgMembership } from "@/actions";
import { getAuditService } from "@/ee/features/audit/factory";

const auditService = getAuditService();

export const listRepositories = async (domain: string, apiKey: string | undefined = undefined): Promise<ListRepositoriesResponse | ServiceError> => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const body = JSON.stringify({
                opts: {
                    Field: 0,
                }
            });

            let header: Record<string, string> = {};
            header = {
                "X-Tenant-ID": org.id.toString()
            };

            const listResponse = await zoektFetch({
                path: "/api/list",
                body,
                header,
                method: "POST",
                cache: "no-store",
            });

            if (!listResponse.ok) {
                return invalidZoektResponse(listResponse);
            }

            const listBody = await listResponse.json();

            const parser = zoektListRepositoriesResponseSchema.transform(({ List }) => ({
                repos: List.Repos.map((repo) => ({
                    name: repo.Repository.Name,
                    webUrl: repo.Repository.URL.length > 0 ? repo.Repository.URL : undefined,
                    branches: repo.Repository.Branches?.map((branch) => branch.Name) ?? [],
                    rawConfig: repo.Repository.RawConfig ?? undefined,
                }))
            } satisfies ListRepositoriesResponse));

            const result = parser.parse(listBody);

            await auditService.createAudit({
                action: "query.list_repositories",
                actor: {
                    id: apiKey ? apiKey : userId,
                    type: apiKey ? "api_key" : "user"
                },
                target: {
                    id: org.id.toString(),
                    type: "org"
                },
                metadata: {
                    message: result.repos.map((repo) => repo.name).join(", ")
                }
            });

            return result;
        }, /* minRequiredRole = */ OrgRole.GUEST), /* allowSingleTenantUnauthedAccess = */ true, apiKey ? { apiKey, domain } : undefined)
);
