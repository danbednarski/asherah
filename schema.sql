-- Onion Search Engine Database Schema

-- Domains table: Track unique onion domains
CREATE TABLE IF NOT EXISTS domains (
    id SERIAL PRIMARY KEY,
    domain VARCHAR(62) UNIQUE NOT NULL, -- 56 chars + .onion
    first_seen TIMESTAMP DEFAULT NOW(),
    last_crawled TIMESTAMP,
    crawl_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    title VARCHAR(500),
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Pages table: Individual pages/URLs
CREATE TABLE IF NOT EXISTS pages (
    id SERIAL PRIMARY KEY,
    domain_id INTEGER REFERENCES domains(id) ON DELETE CASCADE,
    url TEXT UNIQUE NOT NULL,
    path VARCHAR(2000),
    title VARCHAR(500),
    content_text TEXT, -- Extracted plain text
    content_html TEXT, -- Raw HTML (optional storage)
    status_code INTEGER,
    content_length INTEGER,
    content_type VARCHAR(100),
    language VARCHAR(10),
    meta_description TEXT,
    h1_tags TEXT[], -- Array of H1 content
    last_crawled TIMESTAMP DEFAULT NOW(),
    crawl_count INTEGER DEFAULT 1,
    is_accessible BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Links table: Track all href links found
CREATE TABLE IF NOT EXISTS links (
    id SERIAL PRIMARY KEY,
    source_page_id INTEGER REFERENCES pages(id) ON DELETE CASCADE,
    target_url TEXT NOT NULL,
    target_domain VARCHAR(62), -- If it's an onion domain
    anchor_text TEXT,
    link_type VARCHAR(20) DEFAULT 'internal', -- internal, external, onion
    position_on_page INTEGER, -- Order of link on page
    created_at TIMESTAMP DEFAULT NOW()
);

-- Headers table: Store HTTP response headers
CREATE TABLE IF NOT EXISTS headers (
    id SERIAL PRIMARY KEY,
    page_id INTEGER REFERENCES pages(id) ON DELETE CASCADE,
    header_name VARCHAR(100) NOT NULL,
    header_value TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Crawl queue: Priority queue for URLs to crawl
CREATE TABLE IF NOT EXISTS crawl_queue (
    id SERIAL PRIMARY KEY,
    url TEXT UNIQUE NOT NULL,
    domain VARCHAR(62) NOT NULL,
    priority INTEGER DEFAULT 100, -- Lower = higher priority
    added_at TIMESTAMP DEFAULT NOW(),
    attempts INTEGER DEFAULT 0,
    last_attempt TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    error_message TEXT,
    worker_id VARCHAR(50)
);

-- Crawl logs: Detailed crawl history
CREATE TABLE IF NOT EXISTS crawl_logs (
    id SERIAL PRIMARY KEY,
    url TEXT NOT NULL,
    status VARCHAR(20) NOT NULL, -- success, error, timeout
    status_code INTEGER,
    response_time_ms INTEGER,
    content_length INTEGER,
    error_message TEXT,
    worker_id VARCHAR(50),
    crawled_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_domains_domain ON domains(domain);
CREATE INDEX IF NOT EXISTS idx_domains_last_crawled ON domains(last_crawled);
CREATE INDEX IF NOT EXISTS idx_pages_domain_id ON pages(domain_id);
CREATE INDEX IF NOT EXISTS idx_pages_url ON pages(url);
CREATE INDEX IF NOT EXISTS idx_pages_last_crawled ON pages(last_crawled);
CREATE INDEX IF NOT EXISTS idx_links_source_page ON links(source_page_id);
CREATE INDEX IF NOT EXISTS idx_links_target_domain ON links(target_domain);
CREATE INDEX IF NOT EXISTS idx_headers_page_id ON headers(page_id);
CREATE INDEX IF NOT EXISTS idx_crawl_queue_priority ON crawl_queue(priority, added_at);
CREATE INDEX IF NOT EXISTS idx_crawl_queue_status ON crawl_queue(status);
CREATE INDEX IF NOT EXISTS idx_crawl_logs_url ON crawl_logs(url);
CREATE INDEX IF NOT EXISTS idx_crawl_logs_crawled_at ON crawl_logs(crawled_at);

-- Function to extract domain from URL
CREATE OR REPLACE FUNCTION extract_onion_domain(url TEXT) 
RETURNS VARCHAR(62) AS $$
BEGIN
    RETURN (regexp_match(url, '([a-z2-7]{56}\.onion)', 'i'))[1];
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to determine if URL is base domain
CREATE OR REPLACE FUNCTION is_base_domain(url TEXT) 
RETURNS BOOLEAN AS $$
DECLARE
    path_part TEXT;
BEGIN
    -- Extract path after domain
    path_part := regexp_replace(url, '^https?://[^/]+', '');
    -- Base domain if path is empty, '/', or just query params
    RETURN path_part IS NULL OR path_part = '' OR path_part = '/' OR path_part ~ '^/?\?';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_domains_updated_at 
    BEFORE UPDATE ON domains 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pages_updated_at 
    BEFORE UPDATE ON pages 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();