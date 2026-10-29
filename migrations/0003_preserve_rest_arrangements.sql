-- Rest-day checks are not publication permission: preserve the user's next request.
-- 0002 is already applied in production; replace its trigger in a new migration.
DROP TRIGGER IF EXISTS service_claim_consumes_permission;
CREATE TRIGGER service_claim_consumes_permission
AFTER INSERT ON service_runs
WHEN NEW.rest_requested = 0
BEGIN
  UPDATE service_control SET rest_requested=1, temporary_request_text='',
    temporary_request_id=NULL, revision=revision+1, updated_at=NEW.claimed_at
  WHERE owner_scope=NEW.owner_scope AND epoch=NEW.epoch;
END;
