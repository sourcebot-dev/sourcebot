
ALTER TABLE "Repo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Repo" FORCE ROW LEVEL SECURITY;

-- Policy that enforces repository permissions.
CREATE POLICY repo_access_policy ON "Repo"
    USING (
        (
            CASE
                WHEN current_setting('sourcebot.current_user_id', true) = '' 
                THEN false
                
                ELSE EXISTS (
                    SELECT 1 
                    FROM "UserToRepoPermission" 
                    WHERE "repoId" = "Repo"."id" 
                    AND "userId" = current_setting('sourcebot.current_user_id', true)
                )
            END
        )
    );

CREATE POLICY bypass_rls ON "Repo" USING (current_setting('sourcebot.bypass_rls', TRUE)::text = 'on');