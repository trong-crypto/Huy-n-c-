CREATE TABLE divination_methods (
    code VARCHAR(32) PRIMARY KEY CHECK (code ~ '^[A-Z][A-Z0-9_]{1,31}$'),
    method_group VARCHAR(16) NOT NULL CHECK (method_group IN ('MAI_HOA','TAM_THE','OTHER')),
    name VARCHAR(120) NOT NULL CHECK (btrim(name) <> ''),
    summary VARCHAR(500) NOT NULL CHECK (btrim(summary) <> ''),
    introduction TEXT NOT NULL DEFAULT '' CHECK (length(introduction) <= 4000),
    instructions TEXT NOT NULL DEFAULT '' CHECK (length(instructions) <= 6000),
    required_input VARCHAR(500) NOT NULL DEFAULT '',
    built_in BOOLEAN NOT NULL DEFAULT FALSE,
    listed BOOLEAN NOT NULL DEFAULT FALSE,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    CHECK (built_in = (code IN ('TIME','OBJECT_COUNT','LINES','TRUONG_XICH','TAM_THE'))),
    CHECK (NOT listed OR built_in),
    CHECK (NOT built_in OR method_group = CASE WHEN code = 'TAM_THE' THEN 'TAM_THE' ELSE 'MAI_HOA' END)
);

INSERT INTO divination_methods (code, method_group, name, summary, required_input, built_in, listed) VALUES
('TIME', 'MAI_HOA', 'Theo thời gian', 'Lập quẻ từ thời điểm được nhập theo giờ Việt Nam.', 'Ngày và giờ lập quẻ theo giờ Việt Nam (UTC+07:00).', TRUE, TRUE),
('OBJECT_COUNT', 'MAI_HOA', 'Theo số vật đếm được', 'Lập quẻ theo dữ kiện số vật.', 'Số vật đếm được và giờ Chi.', TRUE, TRUE),
('LINES', 'MAI_HOA', 'Nhập sáu hào (LINES)', 'Lập quẻ từ sáu hào và hào động đã chọn.', 'Sáu hào từ dưới lên và một hào động.', TRUE, TRUE),
('TRUONG_XICH', 'MAI_HOA', 'Trượng xích chiêm', 'Lập quẻ theo số trượng và số thước lẻ.', 'Số trượng và số thước lẻ theo đơn vị trong sách. Chỉ lập quẻ.', TRUE, TRUE),
('TAM_THE', 'TAM_THE', 'Công danh, Tài lộc, Tình duyên', 'Tra cứu Công danh, Tài lộc và Tình duyên theo dữ kiện sinh.', 'Ngày sinh, giờ sinh, loại lịch và nội dung muốn xem.', TRUE, TRUE);

ALTER TABLE cms_method_guides ADD CONSTRAINT cms_guides_catalog_fk
    FOREIGN KEY (method_code) REFERENCES divination_methods(code) ON DELETE RESTRICT;

CREATE TABLE divination_method_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    method_code VARCHAR(32) NOT NULL,
    version INTEGER NOT NULL CHECK (version > 0),
    action VARCHAR(24) NOT NULL CHECK (action IN ('CREATE_METHOD','UPDATE_METHOD','SHOW_METHOD','HIDE_METHOD','DELETE_METHOD')),
    actor_id UUID NOT NULL REFERENCES accounts(id),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    previous_state TEXT,
    new_state TEXT
);
CREATE INDEX ix_divination_method_events_occurred_at ON divination_method_events(occurred_at);
CREATE TRIGGER divination_method_events_append_only
    BEFORE UPDATE OR DELETE ON divination_method_events
    FOR EACH ROW EXECUTE FUNCTION cms_reject_guide_history_change();

CREATE OR REPLACE VIEW admin_audit_events AS
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
WHERE reviewed_at IS NOT NULL
UNION ALL
SELECT 'method-catalog:' || id, occurred_at, actor_id, 'METHOD_CATALOG', method_code::text,
       action::text, version, previous_state, new_state, NULL::integer
FROM divination_method_events;
