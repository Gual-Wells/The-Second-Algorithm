-- Questions are private reader records, never public static chapter material.
CREATE TABLE IF NOT EXISTS question_turns (
 seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE,
 owner_scope TEXT NOT NULL, epoch INTEGER NOT NULL,
 chapter_id TEXT NOT NULL, revision TEXT NOT NULL,
 document_url TEXT NOT NULL, markdown_url TEXT NOT NULL,
 question TEXT NOT NULL, answer TEXT, status TEXT NOT NULL DEFAULT 'pending',
 claim_hash TEXT, lease_until INTEGER, error TEXT,
 created_at INTEGER NOT NULL, answered_at INTEGER, read_at INTEGER
);
CREATE INDEX IF NOT EXISTS question_thread ON question_turns(owner_scope,epoch,chapter_id,revision,seq);
CREATE INDEX IF NOT EXISTS question_queue ON question_turns(owner_scope,epoch,status,seq);
CREATE INDEX IF NOT EXISTS question_unread ON question_turns(owner_scope,epoch,read_at) WHERE status='answered' AND read_at IS NULL;
