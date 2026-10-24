-- Bảng số 5 của Diễn Cầm Tam Thế: mốc bắt đầu giờ Dần theo tháng âm.
-- Giữ nguyên chữ in trong sách và quyết định hiệu chỉnh của nhóm.
CREATE TABLE tam_the_hour_anchors (
    lunar_month SMALLINT PRIMARY KEY CHECK (lunar_month BETWEEN 1 AND 12),
    first_hour_start TIME NOT NULL,
    source_branch VARCHAR(8) NOT NULL,
    adopted_branch VARCHAR(8) NOT NULL,
    decision_status VARCHAR(32) NOT NULL DEFAULT 'AS_PRINTED'
        CHECK (decision_status IN ('AS_PRINTED', 'TEAM_CORRECTION')),
    decision_reason TEXT,
    source_section_id BIGINT NOT NULL REFERENCES source_sections(id),
    verification_status VARCHAR(32) NOT NULL DEFAULT 'SOURCE_LOCATED'
        CHECK (verification_status IN (
            'DRAFT', 'SOURCE_LOCATED', 'SOURCE_AMBIGUOUS',
            'BLOCKED_SOURCE_CONFLICT', 'VERIFIED'
        )),
    editor VARCHAR(128),
    reviewer VARCHAR(128),
    CHECK (verification_status <> 'VERIFIED' OR reviewer IS NOT NULL),
    CHECK (decision_status <> 'TEAM_CORRECTION' OR decision_reason IS NOT NULL)
);
