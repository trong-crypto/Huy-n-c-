CREATE VIEW admin_audit_events AS
SELECT 'method:' || method_code || ':' || version AS id, occurred_at, actor_id,
       'METHOD_GUIDE' AS target_type, method_code::text AS target_id, action::text AS action, version,
       NULL::text AS previous_value, NULL::text AS new_value, NULL::integer AS revoked_sessions
FROM cms_method_guide_events
UNION ALL
SELECT 'account-status:' || account_id || ':' || version, occurred_at, actor_id,
       'ACCOUNT', account_id::text, CASE WHEN status = 'LOCKED' THEN 'LOCK_ACCOUNT' ELSE 'UNLOCK_ACCOUNT' END, version,
       previous_status, status, revoked_sessions
FROM admin_account_status_events
UNION ALL
SELECT 'account-role:' || account_id || ':' || version, occurred_at, actor_id,
       'ACCOUNT', account_id::text, 'CHANGE_ROLE', version, previous_role, role, revoked_sessions
FROM admin_account_role_events
UNION ALL
SELECT 'consultant-submission:' || account_id, submitted_at, submitted_by,
       'CONSULTANT_PROFILE', account_id::text, 'SUBMIT_PROFILE', 1, NULL, 'PENDING_REVIEW', NULL
FROM consultant_profiles
WHERE submitted_at IS NOT NULL
UNION ALL
SELECT 'consultant-review:' || account_id || ':' || review_version, reviewed_at, reviewed_by,
       'CONSULTANT_PROFILE', account_id::text,
       CASE WHEN review_status = 'APPROVED' THEN 'APPROVE_PROFILE' ELSE 'REJECT_PROFILE' END,
       review_version, CASE WHEN review_version > 1 THEN 'PENDING_REVIEW' END, review_status, NULL
FROM consultant_profiles
WHERE reviewed_at IS NOT NULL;

CREATE INDEX ix_cms_method_guide_events_occurred_at ON cms_method_guide_events(occurred_at);
CREATE INDEX ix_admin_account_status_events_occurred_at ON admin_account_status_events(occurred_at);
CREATE INDEX ix_admin_account_role_events_occurred_at ON admin_account_role_events(occurred_at);
CREATE INDEX ix_consultant_profiles_submitted_at ON consultant_profiles(submitted_at) WHERE submitted_at IS NOT NULL;
CREATE INDEX ix_consultant_profiles_reviewed_at ON consultant_profiles(reviewed_at) WHERE reviewed_at IS NOT NULL;
