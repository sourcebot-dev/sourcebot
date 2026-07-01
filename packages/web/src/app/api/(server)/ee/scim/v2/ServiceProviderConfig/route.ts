import { apiHandler } from '@/lib/apiHandler';
import { scimJson } from '@/ee/features/scim/mapper';
import { serviceProviderConfig } from '@/ee/features/scim/schemas';
import { withScimAuth } from '@/ee/features/scim/withScimAuth';
import { NextRequest } from 'next/server';

// eslint-disable-next-line authz/require-auth-wrapper -- SCIM bearer auth via withScimAuth
export const GET = apiHandler(async (request: NextRequest) =>
    withScimAuth(request, async () => scimJson(serviceProviderConfig, 200)));
