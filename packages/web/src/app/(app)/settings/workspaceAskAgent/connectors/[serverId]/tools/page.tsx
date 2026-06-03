import { authenticatedPage } from '@/middleware/authenticatedPage';
import { OrgRole } from '@sourcebot/db';
import { notFound } from 'next/navigation';
import { McpToolPermissionsPage } from './mcpToolPermissionsPage';

interface PageProps extends Record<string, unknown> {
    params: Promise<{
        serverId: string;
    }>;
}

export default authenticatedPage<PageProps>(async (_context, { params }) => {
    const { serverId } = await params;
    if (!serverId) {
        return notFound();
    }

    return <McpToolPermissionsPage serverId={serverId} />;
}, { minRole: OrgRole.OWNER, redirectTo: '/settings' });
