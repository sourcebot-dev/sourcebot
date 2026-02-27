import { Script } from "../scriptRunner";
import { PrismaClient, Prisma } from "../../dist";
import { confirmAction } from "../utils";

// User profile: defines how a user interacts with Sourcebot
interface UserProfile {
    id: string
    // Whether this user uses the web UI, and how active they are (0 = never, 1 = heavy)
    webWeight: number
    // Whether this user uses MCP, and how active they are (0 = never, 1 = heavy)
    mcpWeight: number
    // Whether this user uses the API directly, and how active they are (0 = never, 1 = heavy)
    apiWeight: number
    // API source label (for non-MCP API usage)
    apiSource: string
    // How likely they are to be active on a weekday (0-1)
    weekdayActivity: number
    // How likely they are to be active on a weekend (0-1)
    weekendActivity: number
}

// Generate realistic audit data for analytics testing
// Simulates 50 users with mixed usage patterns across web UI, MCP, and API
export const injectAuditDataV2: Script = {
    run: async (prisma: PrismaClient) => {
        const orgId = 1;

        // Check if org exists
        const org = await prisma.org.findUnique({
            where: { id: orgId }
        });

        if (!org) {
            console.error(`Organization with id ${orgId} not found. Please create it first.`);
            return;
        }

        console.log(`Injecting audit data for organization: ${org.name} (${org.domain})`);

        const apiSources = ['cli', 'sdk', 'custom-app'];

        // Build user profiles with mixed usage patterns
        const users: UserProfile[] = [];

        // Web-only users (20): browse the UI, never use MCP or API
        for (let i = 0; i < 20; i++) {
            users.push({
                id: `user_${String(users.length + 1).padStart(3, '0')}`,
                webWeight: 0.6 + Math.random() * 0.4,  // 0.6-1.0
                mcpWeight: 0,
                apiWeight: 0,
                apiSource: '',
                weekdayActivity: 0.7 + Math.random() * 0.2,
                weekendActivity: 0.05 + Math.random() * 0.15,
            });
        }

        // Hybrid web + MCP users (12): use the web UI daily and also have MCP set up in their IDE
        for (let i = 0; i < 12; i++) {
            users.push({
                id: `user_${String(users.length + 1).padStart(3, '0')}`,
                webWeight: 0.4 + Math.random() * 0.4,  // 0.4-0.8
                mcpWeight: 0.5 + Math.random() * 0.5,  // 0.5-1.0
                apiWeight: 0,
                apiSource: '',
                weekdayActivity: 0.8 + Math.random() * 0.15,
                weekendActivity: 0.1 + Math.random() * 0.2,
            });
        }

        // MCP-heavy users (8): primarily use MCP through their IDE, occasionally check the web UI
        for (let i = 0; i < 8; i++) {
            users.push({
                id: `user_${String(users.length + 1).padStart(3, '0')}`,
                webWeight: 0.05 + Math.random() * 0.2,  // 0.05-0.25 (occasional)
                mcpWeight: 0.7 + Math.random() * 0.3,   // 0.7-1.0
                apiWeight: 0,
                apiSource: '',
                weekdayActivity: 0.85 + Math.random() * 0.1,
                weekendActivity: 0.3 + Math.random() * 0.3,
            });
        }

        // API-only users (5): automated scripts/CI, no web UI or MCP
        for (let i = 0; i < 5; i++) {
            users.push({
                id: `user_${String(users.length + 1).padStart(3, '0')}`,
                webWeight: 0,
                mcpWeight: 0,
                apiWeight: 0.6 + Math.random() * 0.4,
                apiSource: apiSources[i % apiSources.length],
                weekdayActivity: 0.9 + Math.random() * 0.1,
                weekendActivity: 0.6 + Math.random() * 0.3,
            });
        }

        // Hybrid web + API users (5): developers who use both the UI and have scripts that call the API
        for (let i = 0; i < 5; i++) {
            users.push({
                id: `user_${String(users.length + 1).padStart(3, '0')}`,
                webWeight: 0.3 + Math.random() * 0.4,
                mcpWeight: 0,
                apiWeight: 0.4 + Math.random() * 0.4,
                apiSource: apiSources[i % apiSources.length],
                weekdayActivity: 0.8 + Math.random() * 0.15,
                weekendActivity: 0.1 + Math.random() * 0.2,
            });
        }

        // Generate data for the last 90 days
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 90);

        const webOnlyCount = users.filter(u => u.webWeight > 0 && u.mcpWeight === 0 && u.apiWeight === 0).length;
        const hybridWebMcpCount = users.filter(u => u.webWeight > 0 && u.mcpWeight > 0).length;
        const mcpHeavyCount = users.filter(u => u.mcpWeight > 0 && u.webWeight < 0.3).length;
        const apiOnlyCount = users.filter(u => u.apiWeight > 0 && u.webWeight === 0 && u.mcpWeight === 0).length;
        const hybridWebApiCount = users.filter(u => u.webWeight > 0 && u.apiWeight > 0).length;

        console.log(`Generating data from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
        console.log(`User breakdown: ${webOnlyCount} web-only, ${hybridWebMcpCount} web+MCP, ${mcpHeavyCount} MCP-heavy, ${apiOnlyCount} API-only, ${hybridWebApiCount} web+API`);

        confirmAction();

        function randomTimestamp(date: Date, isWeekend: boolean): Date {
            const ts = new Date(date);
            if (isWeekend) {
                ts.setHours(9 + Math.floor(Math.random() * 12));
            } else {
                ts.setHours(9 + Math.floor(Math.random() * 9));
            }
            ts.setMinutes(Math.floor(Math.random() * 60));
            ts.setSeconds(Math.floor(Math.random() * 60));
            return ts;
        }

        function scaledCount(baseMin: number, baseMax: number, weight: number, isWeekend: boolean): number {
            const weekendFactor = isWeekend ? 0.3 : 1.0;
            const scaledMax = Math.round(baseMax * weight * weekendFactor);
            const scaledMin = Math.min(Math.round(baseMin * weight * weekendFactor), scaledMax);
            if (scaledMax <= 0) return 0;
            return scaledMin + Math.floor(Math.random() * (scaledMax - scaledMin + 1));
        }

        async function createAudits(
            userId: string,
            action: string,
            count: number,
            currentDate: Date,
            isWeekend: boolean,
            targetType: string,
            metadata?: Prisma.InputJsonValue,
        ) {
            for (let i = 0; i < count; i++) {
                await prisma.audit.create({
                    data: {
                        timestamp: randomTimestamp(currentDate, isWeekend),
                        action,
                        actorId: userId,
                        actorType: 'user',
                        targetId: `${targetType}_${Math.floor(Math.random() * 1000)}`,
                        targetType,
                        sourcebotVersion: '1.0.0',
                        orgId,
                        ...(metadata ? { metadata } : {}),
                    }
                });
            }
        }

        // Generate data for each day
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const currentDate = new Date(d);
            const dayOfWeek = currentDate.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            for (const user of users) {
                // Determine if user is active today
                const activityChance = isWeekend ? user.weekendActivity : user.weekdayActivity;
                if (Math.random() >= activityChance) continue;

                // --- Web UI activity (source='sourcebot-web-client' or 'sourcebot-ui-codenav') ---
                if (user.webWeight > 0) {
                    const webMeta: Prisma.InputJsonValue = { source: 'sourcebot-web-client' };
                    const codenavMeta: Prisma.InputJsonValue = { source: 'sourcebot-ui-codenav' };

                    // Code searches (2-5 base)
                    await createAudits(user.id, 'user.performed_code_search',
                        scaledCount(2, 5, user.webWeight, isWeekend), currentDate, isWeekend, 'search', webMeta);

                    // Navigations: find references + goto definition (5-10 base)
                    const navCount = scaledCount(5, 10, user.webWeight, isWeekend);
                    for (let i = 0; i < navCount; i++) {
                        const action = Math.random() < 0.6 ? 'user.performed_find_references' : 'user.performed_goto_definition';
                        await createAudits(user.id, action, 1, currentDate, isWeekend, 'symbol', codenavMeta);
                    }

                    // Ask chats (0-2 base) - web only
                    await createAudits(user.id, 'user.created_ask_chat',
                        scaledCount(0, 2, user.webWeight, isWeekend), currentDate, isWeekend, 'org', webMeta);

                    // File source views (3-8 base)
                    await createAudits(user.id, 'user.fetched_file_source',
                        scaledCount(3, 8, user.webWeight, isWeekend), currentDate, isWeekend, 'file', webMeta);

                    // File tree browsing (2-5 base)
                    await createAudits(user.id, 'user.fetched_file_tree',
                        scaledCount(2, 5, user.webWeight, isWeekend), currentDate, isWeekend, 'repo', webMeta);

                    // List repos (1-3 base)
                    await createAudits(user.id, 'user.listed_repos',
                        scaledCount(1, 3, user.webWeight, isWeekend), currentDate, isWeekend, 'org', webMeta);
                }

                // --- MCP activity (source='mcp') ---
                if (user.mcpWeight > 0) {
                    const meta: Prisma.InputJsonValue = { source: 'mcp' };

                    // MCP code searches (5-15 base) - higher volume than web
                    await createAudits(user.id, 'user.performed_code_search',
                        scaledCount(5, 15, user.mcpWeight, isWeekend), currentDate, isWeekend, 'search', meta);

                    // MCP file source fetches (5-12 base)
                    await createAudits(user.id, 'user.fetched_file_source',
                        scaledCount(5, 12, user.mcpWeight, isWeekend), currentDate, isWeekend, 'file', meta);

                    // MCP file tree fetches (3-6 base)
                    await createAudits(user.id, 'user.fetched_file_tree',
                        scaledCount(3, 6, user.mcpWeight, isWeekend), currentDate, isWeekend, 'repo', meta);

                    // MCP list repos (3-8 base)
                    await createAudits(user.id, 'user.listed_repos',
                        scaledCount(3, 8, user.mcpWeight, isWeekend), currentDate, isWeekend, 'org', meta);
                }

                // --- API activity (source=cli/sdk/custom-app) ---
                if (user.apiWeight > 0) {
                    const meta: Prisma.InputJsonValue = { source: user.apiSource };

                    // API code searches (10-30 base) - highest volume, automated
                    await createAudits(user.id, 'user.performed_code_search',
                        scaledCount(10, 30, user.apiWeight, isWeekend), currentDate, isWeekend, 'search', meta);

                    // API file source fetches (8-20 base)
                    await createAudits(user.id, 'user.fetched_file_source',
                        scaledCount(8, 20, user.apiWeight, isWeekend), currentDate, isWeekend, 'file', meta);

                    // API file tree fetches (4-10 base)
                    await createAudits(user.id, 'user.fetched_file_tree',
                        scaledCount(4, 10, user.apiWeight, isWeekend), currentDate, isWeekend, 'repo', meta);

                    // API list repos (5-15 base)
                    await createAudits(user.id, 'user.listed_repos',
                        scaledCount(5, 15, user.apiWeight, isWeekend), currentDate, isWeekend, 'org', meta);
                }
            }
        }

        console.log(`\nAudit data injection complete!`);
        console.log(`Users: ${users.length}`);
        console.log(`Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

        // Show statistics
        const stats = await prisma.audit.groupBy({
            by: ['action'],
            where: { orgId },
            _count: { action: true }
        });

        console.log('\nAction breakdown:');
        stats.forEach(stat => {
            console.log(`  ${stat.action}: ${stat._count.action}`);
        });

        // Show source breakdown
        const allAudits = await prisma.audit.findMany({
            where: { orgId },
            select: { metadata: true }
        });

        let webCount = 0, mcpCount = 0, apiCount = 0;
        for (const audit of allAudits) {
            const meta = audit.metadata as Record<string, unknown> | null;
            const source = meta?.source as string | undefined;
            if (source && typeof source === 'string' && source.startsWith('sourcebot-')) {
                webCount++;
            } else if (source === 'mcp') {
                mcpCount++;
            } else {
                apiCount++;
            }
        }
        console.log('\nSource breakdown:');
        console.log(`  Web UI (source=sourcebot-*): ${webCount}`);
        console.log(`  MCP (source=mcp): ${mcpCount}`);
        console.log(`  API (source=other/null): ${apiCount}`);
    },
};
