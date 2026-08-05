import { apiHandler } from '@/lib/apiHandler';
import { scimJson, toScimListResponse } from '@/ee/features/scim/mapper';
import { userSchemaDefinition } from '@/ee/features/scim/schemas';
import { withScimAuth } from '@/ee/features/scim/withScimAuth';
import { NextRequest } from 'next/server';

// eslint-disable-next-line authz/require-auth-wrapper -- SCIM bearer auth via withScimAuth
export const GET = apiHandler(async (request: NextRequest) =>
    withScimAuth(request, async () =>
        scimJson(toScimListResponse([userSchemaDefinition], 1, 1), 200)));
