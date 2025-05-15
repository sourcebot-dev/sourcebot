import escapeStringRegexp from "escape-string-regexp";
import { fileNotFound, ServiceError } from "../../lib/serviceError";
import { FileSourceRequest, FileSourceResponse } from "./types";
import { isServiceError } from "../../lib/utils";
import { search } from "./searchApi";
import { sew, withAuth, withOrgMembership } from "@/actions";

// @todo (bkellam) : We should really be using `git show <hash>:<path>` to fetch file contents here.
// This will allow us to support permalinks to files at a specific revision that may not be indexed
// by zoekt.
export const getFileSource = async ({ fileName, repository, branch }: FileSourceRequest, domain: string): Promise<FileSourceResponse | ServiceError> => sew(() =>
    withAuth((session) =>
        withOrgMembership(session, domain, async () => {
            const escapedFileName = escapeStringRegexp(fileName);
            const escapedRepository = escapeStringRegexp(repository);

            let query = `file:${escapedFileName} repo:^${escapedRepository}$`;
            if (branch) {
                query = query.concat(` branch:${branch}`);
            }

            const searchResponse = await search({
                query,
                matches: 1,
                whole: true,
            }, domain);

            if (isServiceError(searchResponse)) {
                return searchResponse;
            }

            const files = searchResponse.files;

            if (!files || files.length === 0) {
                return fileNotFound(fileName, repository);
            }

            const file = files[0];
            const source = file.content ?? '';
            const language = file.language;
            return {
                source,
                language,
            } satisfies FileSourceResponse;
        }), /* allowSingleTenantUnauthedAccess = */ true)
);
