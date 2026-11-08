CREATE TABLE admin_calculation_metrics_origin (
    singleton BOOLEAN PRIMARY KEY CHECK (singleton),
    tracking_started_at TIMESTAMPTZ NOT NULL
);

INSERT INTO admin_calculation_metrics_origin VALUES (TRUE, clock_timestamp());

CREATE TABLE admin_calculation_daily_counts (
    local_date DATE NOT NULL,
    method VARCHAR(16) NOT NULL CHECK (method IN ('TIME', 'OBJECT_COUNT', 'LINES', 'TAM_THE')),
    completed_count BIGINT NOT NULL CHECK (completed_count > 0),
    PRIMARY KEY (local_date, method)
);
