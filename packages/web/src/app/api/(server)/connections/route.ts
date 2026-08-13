import { apiHandler } from '@/lib/apiHandler';
import { serviceErrorResponse } from '@/lib/serviceError';
import { isServiceError } from '@/lib/utils';
import { listConnections } from './listConnectionsApi';

// eslint-disable-next-line authz/require-auth-wrapper -- delegates to listConnections(), which calls withOptionalAuth
export const GET = apiHandler(async () => {
    const result = await listConnections();
    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result);
});
