-- Separate approval of title transcription from algorithm/interpretation approval.
-- Existing reviewer data is preserved; do not invent historical timestamps.
ALTER TABLE hexagrams
    ADD COLUMN reviewed_at TIMESTAMPTZ,
    ADD COLUMN verification_note TEXT;
