'use server';

import { sew } from "@/sew";
import { withAuthV2 } from "@/withAuthV2";
import { ServiceError } from "@/lib/serviceError";
import { AnalyticsResponse } from "./types";
import { hasEntitlement } from "@sourcebot/shared";
import { ErrorCode } from "@/lib/errorCodes";
import { StatusCodes } from "http-status-codes";

export const getAnalytics = async (domain: string, _apiKey: string | undefined = undefined): Promise<AnalyticsResponse | ServiceError> => sew(() =>
  withAuthV2(async ({ org, prisma }) => {
    if (!hasEntitlement("analytics")) {
      return {
        statusCode: StatusCodes.FORBIDDEN,
        errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
        message: "Analytics is not available in your current plan",
      } satisfies ServiceError;
    }

    const rows = await prisma.$queryRaw<AnalyticsResponse>`
    WITH core AS (
      SELECT
        date_trunc('day',   "timestamp") AS day,
        date_trunc('week',  "timestamp") AS week,
        date_trunc('month', "timestamp") AS month,
        action,
        "actorId"
      FROM "Audit"
      WHERE "orgId" = ${org.id}
        AND action IN (
          'user.performed_code_search',
          'user.performed_find_references',
          'user.performed_goto_definition'
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
        COUNT(*) FILTER (WHERE c.action = 'user.performed_code_search') AS code_searches,
        COUNT(*) FILTER (WHERE c.action IN ('user.performed_find_references', 'user.performed_goto_definition')) AS navigations,
        COUNT(DISTINCT c."actorId") AS active_users
      FROM core c
      JOIN LATERAL (
        SELECT unnest(array['day', 'week', 'month']) AS period
      ) b ON true
      GROUP BY b.period, bucket
    )
  
    SELECT
      b.period,
      b.bucket,
      COALESCE(a.code_searches, 0)::int AS code_searches,
      COALESCE(a.navigations, 0)::int AS navigations,
      COALESCE(a.active_users, 0)::int AS active_users
    FROM buckets b
    LEFT JOIN aggregated a
      ON a.period = b.period AND a.bucket = b.bucket
    ORDER BY b.period, b.bucket;
  `;
  

    return rows;
  })
); 