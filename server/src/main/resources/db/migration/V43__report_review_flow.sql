ALTER TABLE consultation_reports ADD COLUMN review_note varchar(2000) NOT NULL DEFAULT '';
UPDATE consultation_reports SET review_note=admin_note WHERE status IN ('PENDING','REVIEWING');
CREATE TABLE consultation_report_reviews (
 id uuid PRIMARY KEY,
 report_id uuid NOT NULL REFERENCES consultation_reports(id),
 actor_id uuid NOT NULL REFERENCES accounts(id),
 previous_status varchar(20) NOT NULL,
 status varchar(20) NOT NULL CHECK(status='REVIEWING'),
 note varchar(2000) NOT NULL,
 version integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(report_id,version)
);
