-- Add domain-level locking to prevent multiple workers crawling same domain

-- Domain locks table
CREATE TABLE IF NOT EXISTS domain_locks (
    id SERIAL PRIMARY KEY,
    domain VARCHAR(62) UNIQUE NOT NULL,
    worker_id VARCHAR(50) NOT NULL,
    locked_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '10 minutes',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_domain_locks_domain ON domain_locks(domain);
CREATE INDEX IF NOT EXISTS idx_domain_locks_expires ON domain_locks(expires_at);

-- Add domain status to track crawling state
ALTER TABLE domains ADD COLUMN IF NOT EXISTS crawl_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE domains ADD COLUMN IF NOT EXISTS last_worker_id VARCHAR(50);
ALTER TABLE domains ADD COLUMN IF NOT EXISTS crawl_started_at TIMESTAMP;

-- Index for domain status
CREATE INDEX IF NOT EXISTS idx_domains_crawl_status ON domains(crawl_status);

-- Function to acquire domain lock
CREATE OR REPLACE FUNCTION acquire_domain_lock(p_domain VARCHAR(62), p_worker_id VARCHAR(50))
RETURNS BOOLEAN AS $$
DECLARE
    lock_acquired BOOLEAN := FALSE;
BEGIN
    -- Clean up expired locks first
    DELETE FROM domain_locks WHERE expires_at < NOW();
    
    -- Try to acquire lock
    INSERT INTO domain_locks (domain, worker_id, expires_at)
    VALUES (p_domain, p_worker_id, NOW() + INTERVAL '10 minutes')
    ON CONFLICT (domain) DO NOTHING;
    
    -- Check if we got the lock
    SELECT EXISTS(
        SELECT 1 FROM domain_locks 
        WHERE domain = p_domain AND worker_id = p_worker_id
    ) INTO lock_acquired;
    
    RETURN lock_acquired;
END;
$$ LANGUAGE plpgsql;

-- Function to release domain lock
CREATE OR REPLACE FUNCTION release_domain_lock(p_domain VARCHAR(62), p_worker_id VARCHAR(50))
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM domain_locks 
    WHERE domain = p_domain AND worker_id = p_worker_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to extend domain lock
CREATE OR REPLACE FUNCTION extend_domain_lock(p_domain VARCHAR(62), p_worker_id VARCHAR(50))
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE domain_locks 
    SET expires_at = NOW() + INTERVAL '10 minutes'
    WHERE domain = p_domain AND worker_id = p_worker_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;