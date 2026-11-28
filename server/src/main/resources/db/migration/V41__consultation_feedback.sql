CREATE TABLE consultation_reports (
 id uuid PRIMARY KEY, conversation_id uuid NOT NULL REFERENCES chat_conversations(id),
 reporter_id uuid NOT NULL REFERENCES accounts(id), target_id uuid NOT NULL REFERENCES accounts(id),
 reason varchar(40) NOT NULL CHECK (reason IN ('HARASSMENT','INAPPROPRIATE','FRAUD','PRIVACY','SPAM','OTHER')),
 description varchar(2000) NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(),
 status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','REVIEWING','RESOLVED','DISMISSED')),
 admin_note varchar(2000) NOT NULL DEFAULT '', reviewed_by uuid REFERENCES accounts(id), reviewed_at timestamptz,
 CHECK (reporter_id <> target_id), UNIQUE(conversation_id,reporter_id)
);
CREATE INDEX ix_consultation_reports_status ON consultation_reports(status,created_at DESC);
CREATE TABLE consultation_ratings (
 conversation_id uuid PRIMARY KEY REFERENCES chat_conversations(id),
 user_id uuid NOT NULL REFERENCES accounts(id), consultant_id uuid NOT NULL REFERENCES accounts(id),
 stars smallint NOT NULL CHECK (stars BETWEEN 1 AND 5), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_consultation_ratings_consultant ON consultation_ratings(consultant_id);
ALTER TABLE accounts ADD COLUMN lock_reason varchar(2000);
ALTER TABLE admin_account_status_events ADD COLUMN reason varchar(2000);
