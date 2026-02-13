-- Directory Scanner Schema for Asherah
-- Run this after the main schema.sql

-- Directory scan queue (mirrors scan_queue)
CREATE TABLE IF NOT EXISTS dirscan_queue (
    id SERIAL PRIMARY KEY,
    domain_id INTEGER REFERENCES domains(id) ON DELETE CASCADE,
    domain VARCHAR(62) NOT NULL,
    profile VARCHAR(50) DEFAULT 'standard',
    priority INTEGER DEFAULT 100,
    status VARCHAR(20) DEFAULT 'pending',
    worker_id VARCHAR(50),
    attempts INTEGER DEFAULT 0,
    last_attempt TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(domain)
);

-- Directory scan results
CREATE TABLE IF NOT EXISTS dirscan_results (
    id SERIAL PRIMARY KEY,
    domain_id INTEGER REFERENCES domains(id) ON DELETE CASCADE,
    domain VARCHAR(62) NOT NULL,
    path VARCHAR(500) NOT NULL,
    status_code INTEGER NOT NULL,
    content_length INTEGER,
    content_type VARCHAR(200),
    response_time_ms INTEGER,
    server_header VARCHAR(200),
    redirect_url TEXT,
    body_snippet TEXT,
    is_interesting BOOLEAN DEFAULT FALSE,
    interest_reason VARCHAR(100),
    scanned_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(domain, path)
);

-- Directory scan locks (mirrors scan_locks)
CREATE TABLE IF NOT EXISTS dirscan_locks (
    domain VARCHAR(62) PRIMARY KEY,
    worker_id VARCHAR(50) NOT NULL,
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 minutes'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dirscan_queue_status ON dirscan_queue(status);
CREATE INDEX IF NOT EXISTS idx_dirscan_queue_domain ON dirscan_queue(domain);
CREATE INDEX IF NOT EXISTS idx_dirscan_queue_priority ON dirscan_queue(priority);
CREATE INDEX IF NOT EXISTS idx_dirscan_results_domain ON dirscan_results(domain);
CREATE INDEX IF NOT EXISTS idx_dirscan_results_path ON dirscan_results(path);
CREATE INDEX IF NOT EXISTS idx_dirscan_results_interesting ON dirscan_results(is_interesting);
CREATE INDEX IF NOT EXISTS idx_dirscan_results_status_code ON dirscan_results(status_code);
CREATE INDEX IF NOT EXISTS idx_dirscan_locks_expires ON dirscan_locks(expires_at);

-- Function to acquire dirscan lock
CREATE OR REPLACE FUNCTION acquire_dirscan_lock(p_domain VARCHAR, p_worker_id VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    lock_acquired BOOLEAN := FALSE;
BEGIN
    -- Delete expired locks
    DELETE FROM dirscan_locks WHERE expires_at < NOW();

    -- Try to insert a new lock
    INSERT INTO dirscan_locks (domain, worker_id, expires_at)
    VALUES (p_domain, p_worker_id, NOW() + INTERVAL '30 minutes')
    ON CONFLICT (domain) DO UPDATE
    SET worker_id = p_worker_id, expires_at = NOW() + INTERVAL '30 minutes'
    WHERE dirscan_locks.worker_id = p_worker_id OR dirscan_locks.expires_at < NOW();

    -- Check if we got the lock
    SELECT EXISTS (
        SELECT 1 FROM dirscan_locks
        WHERE domain = p_domain AND worker_id = p_worker_id
    ) INTO lock_acquired;

    RETURN lock_acquired;
END;
$$ LANGUAGE plpgsql;

-- Function to release dirscan lock
CREATE OR REPLACE FUNCTION release_dirscan_lock(p_domain VARCHAR, p_worker_id VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    rows_affected INTEGER := 0;
BEGIN
    DELETE FROM dirscan_locks
    WHERE domain = p_domain AND worker_id = p_worker_id;

    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to extend dirscan lock
CREATE OR REPLACE FUNCTION extend_dirscan_lock(p_domain VARCHAR, p_worker_id VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    rows_affected INTEGER := 0;
BEGIN
    UPDATE dirscan_locks
    SET expires_at = NOW() + INTERVAL '30 minutes'
    WHERE domain = p_domain AND worker_id = p_worker_id;

    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql;
