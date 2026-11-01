-- Keep API evidence and the question identity while retiring its cloud execution claim.
ALTER TABLE question_turns ADD COLUMN codex_fallback_json TEXT
 CHECK(codex_fallback_json IS NULL OR json_valid(codex_fallback_json));

-- A complete saved API receipt is recovered on its original attempt before any fallback.
UPDATE question_turns SET status='pending',error=NULL,claim_hash=NULL,lease_until=NULL
 WHERE execution_route='cloud-v1' AND status='failed'
 AND EXISTS(SELECT 1 FROM api_cloud_runs r WHERE r.project='second-algorithm' AND r.task=question_turns.id
  AND r.attempt=CAST(question_turns.api_attempt AS TEXT) AND r.outcome='completed');
-- Existing API failures enter Codex once; this does not resend an API request.
UPDATE question_turns SET codex_fallback_json=json_object('schemaVersion',1,'from','cloud-v1',
 'apiAttempt',CAST(api_attempt AS TEXT),'apiOutcomeUnknown',json(CASE WHEN error='outcome_unknown' THEN 'true' ELSE 'false' END),
 'at',CAST(strftime('%s','now') AS INTEGER)*1000,'reason','previous_api_failure'),
 execution_route='legacy',status='pending',error=NULL,claim_hash=NULL,lease_until=NULL
 WHERE execution_route='cloud-v1' AND status='failed';
