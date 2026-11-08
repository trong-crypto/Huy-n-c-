ALTER TABLE cms_hexagram_gloss_events DROP CONSTRAINT cms_hexagram_gloss_events_action_check;

ALTER TABLE cms_hexagram_gloss_events ADD CONSTRAINT cms_hexagram_gloss_events_action_check
    CHECK (action IN ('SUBMIT', 'RETURN', 'PUBLISH', 'HIDE', 'SHOW'));

CREATE INDEX ix_hexagram_gloss_visibility
    ON cms_hexagram_gloss_events(hexagram_code, sequence DESC) WHERE action IN ('HIDE', 'SHOW');
