ALTER TABLE consultation_reports ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version > 0);
CREATE TABLE moderation_decisions (
 id uuid PRIMARY KEY,
 report_id uuid REFERENCES consultation_reports(id),
 account_id uuid NOT NULL REFERENCES accounts(id),
 actor_id uuid REFERENCES accounts(id),
 action varchar(30) NOT NULL CHECK(action IN ('WARNING','TEMP_LOCK','PERMANENT_LOCK','DISMISS','AUTO_UNLOCK')),
 reason varchar(2000) NOT NULL,
 days integer NOT NULL DEFAULT 0 CHECK(days IN (0,1,7,30)),
 report_version integer NOT NULL DEFAULT 0,
 expires_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_moderation_account_history ON moderation_decisions(account_id,created_at DESC);
ALTER TABLE accounts ADD COLUMN lock_until timestamptz;
ALTER TABLE accounts ADD COLUMN lock_decision_id uuid REFERENCES moderation_decisions(id);
CREATE INDEX ix_accounts_temporary_locks ON accounts(lock_until) WHERE status='LOCKED' AND lock_until IS NOT NULL;
CREATE TABLE moderation_notifications (
 id uuid PRIMARY KEY,
 account_id uuid NOT NULL REFERENCES accounts(id),
 decision_id uuid NOT NULL REFERENCES moderation_decisions(id),
 title varchar(200) NOT NULL,
 body varchar(3000) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz,
 UNIQUE(account_id,decision_id)
);
CREATE INDEX ix_moderation_notifications_account ON moderation_notifications(account_id,created_at DESC);
