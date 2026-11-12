ALTER TABLE accounts ADD COLUMN phone_number VARCHAR(16)
    CHECK (phone_number ~ '^[+]?[0-9]{7,15}$');
