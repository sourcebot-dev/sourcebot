-- Backfill source metadata for historical audit events.
--
-- Before this change, all audit events were created from the web UI without
-- a 'source' field in metadata. The new analytics dashboard segments events
-- by source (sourcebot-*, mcp, or null/other for API). Without this backfill,
-- historical web UI events would be misclassified as API traffic.

-- Code searches and chat creation were web-only (no server-side audit existed)
UPDATE "Audit"
SET metadata = jsonb_set(COALESCE(metadata, '{}')::jsonb, '{source}', '"sourcebot-web-client"')
WHERE action IN ('user.performed_code_search', 'user.created_ask_chat')
  AND (metadata IS NULL OR metadata->>'source' IS NULL);

-- Navigation events (find references, goto definition) were web-only
-- (created from the symbolHoverPopup client component)
UPDATE "Audit"
SET metadata = jsonb_set(COALESCE(metadata, '{}')::jsonb, '{source}', '"sourcebot-web-client"')
WHERE action IN ('user.performed_find_references', 'user.performed_goto_definition')
  AND (metadata IS NULL OR metadata->>'source' IS NULL);
