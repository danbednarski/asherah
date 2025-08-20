-- Domain Reliability Tracking
-- This table tracks how reliable each domain is at providing working links

CREATE TABLE IF NOT EXISTS domain_reliability (
    id SERIAL PRIMARY KEY,
    domain VARCHAR(62) UNIQUE NOT NULL,
    links_provided INTEGER DEFAULT 0,    -- Total links this domain has provided
    links_successful INTEGER DEFAULT 0,  -- Links that resulted in successful crawls
    links_failed INTEGER DEFAULT 0,      -- Links that failed to crawl
    success_rate DECIMAL(5,4) DEFAULT 1.0, -- Current success rate (0.0 to 1.0)
    reliability_score INTEGER DEFAULT 100, -- Priority modifier (100 = normal, higher = worse)
    last_updated TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_domain_reliability_domain ON domain_reliability(domain);
CREATE INDEX IF NOT EXISTS idx_domain_reliability_score ON domain_reliability(reliability_score);

-- Add source_domain tracking to crawl_queue if not exists
-- This helps us track which domain provided each URL
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'crawl_queue' AND column_name = 'source_domain'
    ) THEN
        ALTER TABLE crawl_queue ADD COLUMN source_domain VARCHAR(62);
    END IF;
END $$;

-- Create index for source_domain
CREATE INDEX IF NOT EXISTS idx_crawl_queue_source_domain ON crawl_queue(source_domain);