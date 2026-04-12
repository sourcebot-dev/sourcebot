'use server';

import { sew } from "@/middleware/sew";
import { withAuth } from "@/middleware/withAuth";
import { withMinimumOrgRole } from "@/middleware/withMinimumOrgRole";
import { ServiceError } from "@/lib/serviceError";
import { AnalyticsResponse, AnalyticsRow } from "./types";
import { env } from "@sourcebot/shared";
import { hasEntitlement } from "@/lib/entitlements";
import { ErrorCode } from "@/lib/errorCodes";
import { StatusCodes } from "http-status-codes";
import { OrgRole } from "@sourcebot/db";

export const getAnalytics = async (): Promise<AnalyticsResponse | ServiceError> => sew(() =>
  withAuth(async ({ org, role, prisma }) =>
    withMinimumOrgRole(role, OrgRole.OWNER, async () => {
    if (!await hasEntitlement("analytics")) {
      return {
        statusCode: StatusCodes.FORBIDDEN,
        errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
        message: "Analytics is not available in your current plan",
      } satisfies ServiceError;
    }

    const rows = await prisma.$queryRaw<AnalyticsRow[]>`
      WITH core AS (
        SELECT
          date_trunc('day',   "timestamp") AS day,
          date_trunc('week',  "timestamp") AS week,
          date_trunc('month', "timestamp") AS month,
          action,
          "actorId",
          metadata
        FROM "Audit"
        WHERE "orgId" = ${org.id}
          AND action IN (
            'user.performed_code_search',
            'user.performed_find_references',
            'user.performed_goto_definition',
            'user.created_ask_chat',
            'user.listed_repos',
            'user.fetched_file_source',
            'user.fetched_file_tree'
          )
      ),

      periods AS (
        SELECT unnest(array['day', 'week', 'month']) AS period
      ),

      buckets AS (
        SELECT
          generate_series(
            date_trunc('day',   (SELECT MIN("timestamp") FROM "Audit" WHERE "orgId" = ${org.id})),
            date_trunc('day',   CURRENT_DATE),
            interval '1 day'
          ) AS bucket,
          'day' AS period
        UNION ALL
        SELECT
          generate_series(
            date_trunc('week',  (SELECT MIN("timestamp") FROM "Audit" WHERE "orgId" = ${org.id})),
            date_trunc('week',  CURRENT_DATE),
            interval '1 week'
          ),
          'week'
        UNION ALL
        SELECT
          generate_series(
            date_trunc('month', (SELECT MIN("timestamp") FROM "Audit" WHERE "orgId" = ${org.id})),
            date_trunc('month', CURRENT_DATE),
            interval '1 month'
          ),
          'month'
      ),

      aggregated AS (
        SELECT
          b.period,
          CASE b.period
            WHEN 'day'   THEN c.day
            WHEN 'week'  THEN c.week
            ELSE              c.month
          END AS bucket,

          -- Global active users (any action, any source; excludes web repo listings)
          COUNT(DISTINCT c."actorId") FILTER (
            WHERE NOT (c.action = 'user.listed_repos' AND c.metadata->>'source' LIKE 'sourcebot-%')
          ) AS active_users,

          -- Web App metrics
          COUNT(DISTINCT c."actorId") FILTER (
            WHERE c.action = 'user.performed_code_search'
              AND c.metadata->>'source' = 'sourcebot-web-client'
          ) AS web_search_active_users,
          COUNT(*) FILTER (
            WHERE c.action = 'user.performed_code_search'
              AND c.metadata->>'source' = 'sourcebot-web-client'
          ) AS web_code_searches,
          COUNT(*) FILTER (
            WHERE c.action IN ('user.performed_find_references', 'user.performed_goto_definition')
              AND c.metadata->>'source' = 'sourcebot-web-client'
          ) AS web_navigations,
          COUNT(DISTINCT c."actorId") FILTER (
            WHERE c.action = 'user.created_ask_chat'
              AND c.metadata->>'source' = 'sourcebot-web-client'
          ) AS web_ask_active_users,
          COUNT(*) FILTER (
            WHERE c.action = 'user.created_ask_chat'
              AND c.metadata->>'source' = 'sourcebot-web-client'
          ) AS web_ask_chats,
          COUNT(DISTINCT c."actorId") FILTER (
            WHERE c.metadata->>'source' = 'sourcebot-web-client'
              AND c.action != 'user.listed_repos'
          ) AS web_active_users,

          -- MCP + API combined active users (any non-web source)
          COUNT(DISTINCT c."actorId") FILTER (
            WHERE c.metadata->>'source' IS NULL
              OR c.metadata->>'source' NOT LIKE 'sourcebot-%'
          ) AS non_web_active_users,

          -- MCP metrics (source = 'mcp')
          COUNT(*) FILTER (
            WHERE c.metadata->>'source' = 'mcp'
          ) AS mcp_requests,
          COUNT(DISTINCT c."actorId") FILTER (
            WHERE c.metadata->>'source' = 'mcp'
          ) AS mcp_active_users,

          -- API metrics (source IS NULL or not sourcebot-*/mcp)
          COUNT(*) FILTER (
            WHERE c.metadata->>'source' IS NULL
              OR (c.metadata->>'source' NOT LIKE 'sourcebot-%' AND c.metadata->>'source' != 'mcp')
          ) AS api_requests,
          COUNT(DISTINCT c."actorId") FILTER (
            WHERE c.metadata->>'source' IS NULL
              OR (c.metadata->>'source' NOT LIKE 'sourcebot-%' AND c.metadata->>'source' != 'mcp')
          ) AS api_active_users

        FROM core c
        JOIN LATERAL (
          SELECT unnest(array['day', 'week', 'month']) AS period
        ) b ON true
        GROUP BY b.period, bucket
      )

      SELECT
        b.period,
        b.bucket,
        COALESCE(a.active_users, 0)::int AS active_users,
        COALESCE(a.web_search_active_users, 0)::int AS web_search_active_users,
        COALESCE(a.web_code_searches, 0)::int AS web_code_searches,
        COALESCE(a.web_navigations, 0)::int AS web_navigations,
        COALESCE(a.web_ask_active_users, 0)::int AS web_ask_active_users,
        COALESCE(a.web_ask_chats, 0)::int AS web_ask_chats,
        COALESCE(a.web_active_users, 0)::int AS web_active_users,
        COALESCE(a.non_web_active_users, 0)::int AS non_web_active_users,
        COALESCE(a.mcp_requests, 0)::int AS mcp_requests,
        COALESCE(a.mcp_active_users, 0)::int AS mcp_active_users,
        COALESCE(a.api_requests, 0)::int AS api_requests,
        COALESCE(a.api_active_users, 0)::int AS api_active_users
      FROM buckets b
      LEFT JOIN aggregated a
        ON a.period = b.period AND a.bucket = b.bucket
      ORDER BY b.period, b.bucket;
    `;
    

      const oldestRecord = await prisma.audit.findFirst({
        where: { orgId: org.id },
        orderBy: { timestamp: 'asc' },
        select: { timestamp: true },
      });

    return {
      rows,
      retentionDays: env.SOURCEBOT_EE_AUDIT_RETENTION_DAYS,
      oldestRecordDate: oldestRecord?.timestamp ?? null,
    };
  }))
);