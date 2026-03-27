# 📊 PROJECT: AI Market Intelligence & Prediction Engine (Stocks Only - MVP)

## 🧠 OVERVIEW

Build a web application that:
- Scours global news sources in near real-time
- Extracts market-moving events for stocks
- Uses predictive analysis (rules + ML + LLM explanations)
- Outputs ranked stock opportunities and crash risks
- Provides explainable, actionable insights

⚠️ Scope: STOCKS ONLY (US large-cap focus for MVP)  
🚫 Crypto will be added later (V2)

---

## 🎯 CORE OBJECTIVES

The system must:

1. Identify trading opportunities
2. Detect early crash risks
3. Summarize market-moving news
4. Rank stocks by upside/downside potential
5. Generate trade ideas with confidence scores
6. Provide explainability for every prediction

---

## ⏱️ TIME HORIZONS

- Near-term: 1–7 days  
- Medium-term: 1–6 months  

---

## 🧩 MVP FEATURES (CRITICAL)

### 1. Signal Engine
- Bullish / Bearish / Crash Risk signals
- Confidence score (%)
- Expected move range (%)
- Time horizon
- Ranking system

---

### 2. News Intelligence
- Ingest news from:
  - Financial media
  - Company press releases
  - SEC filings
  - Twitter/X (optional MVP+)
- Deduplicate similar stories
- Extract:
  - Tickers
  - Event type
  - Sentiment
  - Entities

---

### 3. Explainability Layer
Each signal must include:
- Top drivers
- Evidence sources
- Historical analog comparison
- Confidence explanation

---

## 🧠 SIGNAL FORMAT (FINAL)

### Dashboard View

TSLA  
Bullish ↑  
Confidence: 72%  
Expected Move: +3% to +7%  
Horizon: 5 days  

Key Drivers:
- Strong earnings sentiment
- High social momentum
- Positive sector trend  

Risk: Medium  
Rank: #5  

---

### Expanded View

#### Prediction
- Signal: Bullish  
- Confidence: 72%  
- Expected Move: +3% to +7%  
- Horizon: 5 days  
- Crash Risk: 12%  

#### Why This Call
- Earnings beat expectations  
- Positive forward guidance  
- Increased institutional interest  

#### Evidence
- Number of articles
- Source credibility
- Official filings

#### Historical Analog
- Avg move: +4.8%  
- Hit rate: 64%  

#### Risk Flags
- Overextended rally  
- Sector volatility  

---

## ⚙️ TECH STACK (MANDATORY)

### Frontend
- Next.js (React)
- TypeScript
- Tailwind CSS

---

### Backend
- Python
- FastAPI

---

### Database
- Supabase (PostgreSQL)

---

### Background Jobs
- Celery
- Redis

---

### Hosting
- Frontend: Vercel
- Backend: Railway or Render
- Database: Supabase

---

### APIs / DATA SOURCES

#### Market Data
- Yahoo Finance (free)
- Finnhub (optional)

#### News
- NewsAPI
- GDELT

---

## 🧠 SYSTEM ARCHITECTURE

### Pipeline

1. Data Ingestion
   - Pull news articles
   - Normalize data

2. Event Detection
   - Classify:
     - Earnings
     - Regulation
     - M&A
     - Product launches
     - Executive changes

3. Feature Engineering
   - Sentiment score
   - Source credibility
   - Novelty score
   - Event severity
   - Social velocity (optional)

4. Scoring Engine (RULES FIRST)
   - Opportunity score
   - Crash risk score

5. Prediction Layer
   - Convert score → expected move + confidence

6. Explanation Layer
   - LLM explains reasoning
   - Does NOT generate prediction

---

## 🧮 SCORING LOGIC (INITIAL)

Score =  
+ (Sentiment × Credibility)  
+ (Event Severity × Novelty)  
+ (Historical Reaction Weight)  
+ (Social Momentum)  

Outputs:
- Opportunity Score
- Crash Risk Score

---

## 📊 DATABASE STRUCTURE (HIGH LEVEL)

Tables:

- users
- stocks
- news_articles
- events
- signals
- signal_history
- sources

---

## 🖥️ UI STRUCTURE

### Home Dashboard
- Top Opportunities
- Crash Risk Alerts
- Breaking News Feed
- Sector Heatmap

---

### Stock Page
- Signal summary
- Charts:
  - Price
  - Sentiment
  - News volume
- Explanation panel
- Source links

---

## 🔔 ALERT SYSTEM

Triggers:
- High confidence signal
- Crash risk spike
- Major news detected
- Signal change

Format:
TSLA → Bullish (72%)  
Expected +3–7% (5d)

---

## 🧪 BACKTESTING (REQUIRED)

Track:
- Signal
- Timestamp
- Prediction
- Actual outcome

Metrics:
- Accuracy
- Hit rate
- Confidence calibration

---

## ⚠️ CONSTRAINTS

- Minimize cost (use free tiers first)
- Monolith architecture for MVP
- No crypto yet
- No broker integrations
- No social features

---

## 🚀 MVP SUCCESS CRITERIA

- ≥50% prediction accuracy
- Signals are:
  - Timely
  - Actionable
  - Explainable

---

## 📈 FUTURE (DO NOT BUILD NOW)

- Crypto integration
- Portfolio tracking
- Paper trading
- ML models replacing rules
- Advanced alerts
- Social features

---

## 🧠 FINAL NOTES

- Prioritize **accuracy over complexity**
- Prioritize **clarity over “AI magic”**
- Every signal must answer:
  → “Why should I care?”
  → “What might happen next?”

---

## 🎯 TASK FOR CLAUDE

Break this project into:

1. File structure
2. Backend architecture
3. Frontend pages
4. Database schema (detailed)
5. First working MVP implementation

Build step-by-step, starting with the simplest working version.