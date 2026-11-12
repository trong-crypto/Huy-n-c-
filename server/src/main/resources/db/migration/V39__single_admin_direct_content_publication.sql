-- One Admin can publish editorial content directly on save. Keep the immutable
-- revision and event history, but remove only the second-person publisher gate.
DROP TRIGGER IF EXISTS cms_hexagram_interpretation_independent_review
    ON cms_hexagram_interpretation_events;
DROP FUNCTION IF EXISTS cms_hexagram_interpretation_require_reviewer();
