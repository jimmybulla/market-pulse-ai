-- backend/migrations/001_initial_schema.sql

-- Sources
CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    url TEXT,
    credibility_score FLOAT DEFAULT 0.7,
    type TEXT CHECK (type IN ('news', 'press_release', 'sec_filing'))
);

-- Stocks
CREATE TABLE stocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    sector TEXT,
    market_cap NUMERIC,
    last_price NUMERIC,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- News Articles
CREATE TABLE news_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES sources(id),
    headline TEXT NOT NULL,
    body TEXT,
    url TEXT UNIQUE,
    published_at TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    tickers TEXT[],
    sentiment_score FLOAT,
    event_type TEXT CHECK (event_type IN ('earnings','regulation','m&a','product','executive','macro')),
    novelty_score FLOAT DEFAULT 0.5,
    credibility_score FLOAT DEFAULT 0.7,
    severity FLOAT DEFAULT 0.5
);

-- Events
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_id UUID REFERENCES stocks(id),
    article_id UUID REFERENCES news_articles(id),
    event_type TEXT,
    severity FLOAT,
    detected_at TIMESTAMPTZ DEFAULT NOW()
);

-- Signals
CREATE TABLE signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_id UUID REFERENCES stocks(id),
    direction TEXT CHECK (direction IN ('bullish','bearish','crash_risk')),
    confidence FLOAT,
    expected_move_low FLOAT,
    expected_move_high FLOAT,
    horizon_days INT,
    opportunity_score FLOAT,
    crash_risk_score FLOAT,
    rank INT,
    explanation TEXT,
    drivers JSONB,
    evidence JSONB,
    historical_analog JSONB,
    risk_flags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- Signal History
CREATE TABLE signal_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id UUID REFERENCES signals(id),
    stock_id UUID REFERENCES stocks(id),
    direction TEXT,
    confidence FLOAT,
    expected_move_low FLOAT,
    expected_move_high FLOAT,
    horizon_days INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    actual_move FLOAT,
    was_correct BOOL,
    accuracy_notes TEXT
);

-- Indexes
CREATE INDEX idx_news_published ON news_articles(published_at DESC);
CREATE INDEX idx_signals_stock ON signals(stock_id, created_at DESC);
CREATE INDEX idx_signals_rank ON signals(rank ASC);
CREATE INDEX idx_signal_history_stock ON signal_history(stock_id, created_at DESC);
