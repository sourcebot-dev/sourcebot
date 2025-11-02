import { Script } from "../scriptRunner";
import { PrismaClient } from "../../dist";
import { confirmAction } from "../utils";

// Generate realistic audit data for analytics testing
// Simulates 50 engineers with varying activity patterns
export const injectAuditData: Script = {
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

        // Generate 50 fake user IDs
        const userIds = Array.from({ length: 50 }, (_, i) => `user_${String(i + 1).padStart(3, '0')}`);
        
        // Actions we're tracking
        const actions = [
            'user.performed_code_search',
            'user.performed_find_references', 
            'user.performed_goto_definition'
        ];

        // Generate data for the last 90 days
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 90);

        console.log(`Generating data from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

        confirmAction();

        // Generate data for each day
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const currentDate = new Date(d);
            const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            
            // For each user, generate activity for this day
            for (const userId of userIds) {
                // Determine if user is active today (higher chance on weekdays)
                const isActiveToday = isWeekend 
                    ? Math.random() < 0.15  // 15% chance on weekends
                    : Math.random() < 0.85; // 85% chance on weekdays

                if (!isActiveToday) continue;

                // Generate code searches (2-5 per day)
                const codeSearches = isWeekend 
                    ? Math.floor(Math.random() * 2) + 1  // 1-2 on weekends
                    : Math.floor(Math.random() * 4) + 2; // 2-5 on weekdays

                // Generate navigation actions (5-10 per day)
                const navigationActions = isWeekend
                    ? Math.floor(Math.random() * 3) + 1  // 1-3 on weekends  
                    : Math.floor(Math.random() * 6) + 5; // 5-10 on weekdays

                // Create code search records
                for (let i = 0; i < codeSearches; i++) {
                    const timestamp = new Date(currentDate);
                    // Spread throughout the day (9 AM to 6 PM on weekdays, more random on weekends)
                    if (isWeekend) {
                        timestamp.setHours(9 + Math.floor(Math.random() * 12));
                        timestamp.setMinutes(Math.floor(Math.random() * 60));
                    } else {
                        timestamp.setHours(9 + Math.floor(Math.random() * 9));
                        timestamp.setMinutes(Math.floor(Math.random() * 60));
                    }
                    timestamp.setSeconds(Math.floor(Math.random() * 60));

                    await prisma.audit.create({
                        data: {
                            timestamp,
                            action: 'user.performed_code_search',
                            actorId: userId,
                            actorType: 'user',
                            targetId: `search_${Math.floor(Math.random() * 1000)}`,
                            targetType: 'search',
                            sourcebotVersion: '1.0.0',
                            orgId
                        }
                    });
                }

                // Create navigation action records
                for (let i = 0; i < navigationActions; i++) {
                    const timestamp = new Date(currentDate);
                    if (isWeekend) {
                        timestamp.setHours(9 + Math.floor(Math.random() * 12));
                        timestamp.setMinutes(Math.floor(Math.random() * 60));
                    } else {
                        timestamp.setHours(9 + Math.floor(Math.random() * 9));
                        timestamp.setMinutes(Math.floor(Math.random() * 60));
                    }
                    timestamp.setSeconds(Math.floor(Math.random() * 60));

                    // Randomly choose between find references and goto definition
                    const action = Math.random() < 0.6 ? 'user.performed_find_references' : 'user.performed_goto_definition';

                    await prisma.audit.create({
                        data: {
                        timestamp,
                        action,
                        actorId: userId,
                        actorType: 'user',
                        targetId: `symbol_${Math.floor(Math.random() * 1000)}`,
                        targetType: 'symbol',
                        sourcebotVersion: '1.0.0',
                        orgId
                        }
                    });
                }
            }
        }

        console.log(`\nAudit data injection complete!`);
        console.log(`Users: ${userIds.length}`);
        console.log(`Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
        
        // Show some statistics
        const stats = await prisma.audit.groupBy({
            by: ['action'],
            where: { orgId },
            _count: { action: true }
        });
        
        console.log('\nAction breakdown:');
        stats.forEach(stat => {
            console.log(`  ${stat.action}: ${stat._count.action}`);
        });
    },
}; 