-- Combined lock + status operations to reduce DB round-trips
-- Run this migration to add the combined functions

-- Acquires domain lock AND sets crawl_status='crawling' in one call
CREATE OR REPLACE FUNCTION acquire_domain_lock_and_set_crawling(p_domain TEXT, p_worker_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_acquired BOOLEAN;
BEGIN
  -- Try to acquire the domain lock
  SELECT acquire_domain_lock(p_domain, p_worker_id) INTO v_acquired;

  IF v_acquired THEN
    -- Also set domain status to crawling
    UPDATE domains
    SET crawl_status = 'crawling',
        last_worker_id = p_worker_id,
        crawl_started_at = NOW()
    WHERE domain = p_domain;
  END IF;

  RETURN v_acquired;
END;
$$ LANGUAGE plpgsql;

-- Releases domain lock AND sets crawl_status='completed' in one call
CREATE OR REPLACE FUNCTION release_domain_lock_and_set_completed(p_domain TEXT, p_worker_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_released BOOLEAN;
BEGIN
  -- Release the domain lock
  SELECT release_domain_lock(p_domain, p_worker_id) INTO v_released;

  IF v_released THEN
    -- Also set domain status to completed
    UPDATE domains
    SET crawl_status = 'completed',
        last_worker_id = NULL
    WHERE domain = p_domain;
  END IF;

  RETURN v_released;
END;
$$ LANGUAGE plpgsql;
