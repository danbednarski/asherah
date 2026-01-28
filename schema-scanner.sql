-- Port Scanner Schema for Asherah
-- Run this after the main schema.sql

-- Scan queue (like crawl_queue)
CREATE TABLE IF NOT EXISTS scan_queue (
    id SERIAL PRIMARY KEY,
    domain_id INTEGER REFERENCES domains(id) ON DELETE CASCADE,
    domain VARCHAR(62) NOT NULL,
    profile VARCHAR(50) DEFAULT 'standard',
    ports INTEGER[],
    priority INTEGER DEFAULT 100,
    status VARCHAR(20) DEFAULT 'pending',
    worker_id VARCHAR(50),
    attempts INTEGER DEFAULT 0,
    last_attempt TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(domain)
);

-- Port scan results
CREATE TABLE IF NOT EXISTS port_scans (
    id SERIAL PRIMARY KEY,
    domain_id INTEGER REFERENCES domains(id) ON DELETE CASCADE,
    domain VARCHAR(62) NOT NULL,
    port INTEGER NOT NULL,
    state VARCHAR(20) NOT NULL,  -- open/closed/filtered/timeout
    response_time_ms INTEGER,
    banner TEXT,
    scanned_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(domain, port)
);

-- Detected services
CREATE TABLE IF NOT EXISTS detected_services (
    id SERIAL PRIMARY KEY,
    port_scan_id INTEGER REFERENCES port_scans(id) ON DELETE CASCADE,
    domain VARCHAR(62) NOT NULL,
    port INTEGER NOT NULL,
    service_name VARCHAR(100),
    service_version VARCHAR(100),
    confidence INTEGER,
    raw_banner TEXT,
    first_seen TIMESTAMP DEFAULT NOW(),
    last_seen TIMESTAMP DEFAULT NOW()
);

-- Scan locks (like domain_locks)
CREATE TABLE IF NOT EXISTS scan_locks (
    domain VARCHAR(62) PRIMARY KEY,
    worker_id VARCHAR(50) NOT NULL,
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 minutes'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_scan_queue_status ON scan_queue(status);
CREATE INDEX IF NOT EXISTS idx_scan_queue_domain ON scan_queue(domain);
CREATE INDEX IF NOT EXISTS idx_scan_queue_priority ON scan_queue(priority);
CREATE INDEX IF NOT EXISTS idx_port_scans_domain ON port_scans(domain);
CREATE INDEX IF NOT EXISTS idx_port_scans_state ON port_scans(state);
CREATE INDEX IF NOT EXISTS idx_detected_services_domain ON detected_services(domain);
CREATE INDEX IF NOT EXISTS idx_detected_services_service ON detected_services(service_name);
CREATE INDEX IF NOT EXISTS idx_scan_locks_expires ON scan_locks(expires_at);

-- Function to acquire scan lock
CREATE OR REPLACE FUNCTION acquire_scan_lock(p_domain VARCHAR, p_worker_id VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    lock_acquired BOOLEAN := FALSE;
BEGIN
    -- Delete expired locks
    DELETE FROM scan_locks WHERE expires_at < NOW();

    -- Try to insert a new lock
    INSERT INTO scan_locks (domain, worker_id, expires_at)
    VALUES (p_domain, p_worker_id, NOW() + INTERVAL '30 minutes')
    ON CONFLICT (domain) DO UPDATE
    SET worker_id = p_worker_id, expires_at = NOW() + INTERVAL '30 minutes'
    WHERE scan_locks.worker_id = p_worker_id OR scan_locks.expires_at < NOW();

    -- Check if we got the lock
    SELECT EXISTS (
        SELECT 1 FROM scan_locks
        WHERE domain = p_domain AND worker_id = p_worker_id
    ) INTO lock_acquired;

    RETURN lock_acquired;
END;
$$ LANGUAGE plpgsql;

-- Function to release scan lock
CREATE OR REPLACE FUNCTION release_scan_lock(p_domain VARCHAR, p_worker_id VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    rows_affected INTEGER := 0;
BEGIN
    DELETE FROM scan_locks
    WHERE domain = p_domain AND worker_id = p_worker_id;

    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to extend scan lock
CREATE OR REPLACE FUNCTION extend_scan_lock(p_domain VARCHAR, p_worker_id VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    rows_affected INTEGER := 0;
BEGIN
    UPDATE scan_locks
    SET expires_at = NOW() + INTERVAL '30 minutes'
    WHERE domain = p_domain AND worker_id = p_worker_id;

    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql;
