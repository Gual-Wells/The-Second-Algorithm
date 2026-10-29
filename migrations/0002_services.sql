-- Small control plane only. Chapter/research bodies remain in Git/static storage.
CREATE TABLE IF NOT EXISTS service_control (
  owner_scope TEXT NOT NULL, epoch INTEGER NOT NULL,
  goal TEXT NOT NULL DEFAULT '', rest_requested INTEGER NOT NULL DEFAULT 1,
  temporary_request_text TEXT NOT NULL DEFAULT '', temporary_request_id TEXT,
  revision INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0,
  runner_seen_at INTEGER, runner_configured INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(owner_scope, epoch)
);
CREATE TABLE IF NOT EXISTS service_snapshot (
  owner_scope TEXT NOT NULL, epoch INTEGER NOT NULL,
  value_json TEXT NOT NULL, updated_at INTEGER NOT NULL, revision INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(owner_scope, epoch)
);
CREATE TABLE IF NOT EXISTS service_runs (
  run_id TEXT NOT NULL, owner_scope TEXT NOT NULL, epoch INTEGER NOT NULL,
  rest_requested INTEGER NOT NULL, goal TEXT NOT NULL,
  temporary_request_text TEXT NOT NULL DEFAULT '', temporary_request_id TEXT,
  claimed_at INTEGER NOT NULL, completed_at INTEGER, outcome TEXT,
  PRIMARY KEY(owner_scope, epoch, run_id)
);
CREATE INDEX IF NOT EXISTS service_runs_owner ON service_runs(owner_scope, epoch, claimed_at);
-- Permission is consumed in the same transaction as the new immutable claim.
CREATE TRIGGER IF NOT EXISTS service_claim_consumes_permission
AFTER INSERT ON service_runs
BEGIN
  UPDATE service_control SET rest_requested=1, temporary_request_text='',
    temporary_request_id=NULL, revision=revision+1, updated_at=NEW.claimed_at
  WHERE owner_scope=NEW.owner_scope AND epoch=NEW.epoch;
END;
CREATE TABLE IF NOT EXISTS service_push (
  id TEXT PRIMARY KEY, owner_scope TEXT NOT NULL, epoch INTEGER NOT NULL,
  endpoint TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS service_push_owner ON service_push(owner_scope, epoch);
CREATE TABLE IF NOT EXISTS service_push_delivery (
  event_id TEXT NOT NULL, subscription_id TEXT NOT NULL, payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL, sent_at INTEGER, attempts INTEGER NOT NULL DEFAULT 0,
  claim_at INTEGER, PRIMARY KEY(event_id, subscription_id)
);
