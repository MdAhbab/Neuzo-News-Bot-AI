# Neuzo - Agentic News Bot

An intelligent news aggregation and verification system that fetches, verifies, and synthesizes news articles using advanced Natural Language Processing (NLP) and Machine Learning.

[![Python 3.13+](https://img.shields.io/badge/python-3.13+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

---

## 🚀 Quick Start

```bash
# 1. Clone and setup
python setup.py

# 2. Configure (edit config.yaml with your settings)
#    - Set database password
#    - Add your NewsAPI key from https://newsapi.org/

# 3. Start the backend
.\.venv\Scripts\Activate.ps1  # Windows
python api_server.py

# 4. Start the frontend (new terminal)
cd Frontend
npm run dev

# 5. Open http://localhost:3000 and login with:
#    Email: test@neuzo.com | Password: test123
```

---

## 🎯 Overview

Neuzo is a full-stack application that:

- **Fetches** real-time news from NewsAPI based on user-selected categories
- **Verifies** news authenticity using NLP semantic similarity analysis
- **Synthesizes** comprehensive reports with confidence scores
- **Generates** professional Word documents with verified articles
- **Provides** a modern React frontend for seamless user interaction

### 🔒 Security Features (v2.0)

- **Bcrypt password hashing** - Industry-standard password security
- **Session expiration** - 24-hour token TTL with Redis support
- **Rate limiting** - Protection against brute force attacks
- **Input validation** - Email format and password strength checks

---

## 🏗️ Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     NEUZO ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐      ┌──────────────┐     ┌────────────┐ │
│  │   Frontend   │──────│  Flask API   │─────│   MySQL    │ │
│  │ React + TS   │      │   Backend    │     │  Database  │ │
│  └──────────────┘      └──────────────┘     └────────────┘ │
│         │                      │                             │
│         │              ┌───────┴────────┐                   │
│         │              │                 │                   │
│         │      ┌───────▼──────┐  ┌─────▼──────┐           │
│         │      │ News Fetcher │  │   Models   │           │
│         │      │   (NewsAPI)  │  │ (Database) │           │
│         │      └──────┬───────┘  └────────────┘           │
│         │             │                                      │
│         │      ┌──────▼─────────┐                          │
│         │      │ News Verifier  │                          │
│         │      │  (NLP + ML)    │                          │
│         │      └──────┬─────────┘                          │
│         │             │                                      │
│         │      ┌──────▼──────────┐                         │
│         └──────│   Document      │                         │
│                │   Generator     │                         │
│                └─────────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Backend:**

- Python 3.13+
- Flask 3.0+ (REST API)
- MySQL 8.0+ (Database)
- NewsAPI (News Source)
- Sentence-Transformers (NLP)
- Bcrypt (Password Security)

**Frontend:**

- React 19.2.0
- TypeScript
- Vite (Build Tool)
- Tailwind CSS (Styling)

**Machine Learning:**

- Model: `sentence-transformers/all-MiniLM-L6-v2`
- Framework: PyTorch
- Task: Semantic Similarity Analysis

---

## 🤖 How It Works

### 1. News Fetching Process

```python
# NewsFetcherAgent - news_fetcher.py
┌─────────────────────────────────────────────┐
│ 1. User selects category (Technology, etc.) │
│ 2. System queries NewsAPI                   │
│ 3. Fetches up to 100 articles               │
│ 4. Parses metadata (title, description,     │
│    source, URL, publish date)               │
│ 5. Returns NewsArticle objects              │
└─────────────────────────────────────────────┘
```

**NewsAPI Integration:**

- Endpoint: `get_top_headlines(category, language, page_size)`
- Returns: JSON with articles
- Free tier: Up to 100 requests/day
- Fields used: title, description, source, url, publishedAt, content

### 2. News Verification Process

```python
# NewsVerificationAgent - news_verifier.py
┌──────────────────────────────────────────────────┐
│ 1. Load NLP Model (all-MiniLM-L6-v2)            │
│    - 384-dimensional embeddings                  │
│    - Optimized for semantic similarity          │
│                                                  │
│ 2. Generate Embeddings                          │
│    - Combine title + description                │
│    - Encode using Sentence-Transformers         │
│    - Create vector representations              │
│                                                  │
│ 3. Calculate Similarity Matrix                  │
│    - Use cosine similarity                      │
│    - Compare all articles against each other    │
│    - Score: 0.0 (no match) to 1.0 (identical)  │
│                                                  │
│ 4. Verify Each Article                          │
│    - Find similar articles (threshold > 0.3)    │
│    - Base confidence: 60% for valid content     │
│    - Boost confidence with similar sources      │
│    - Final threshold: 70% for verification      │
│                                                  │
│ 5. Return VerificationResults                   │
│    - verified: bool (true if confidence >= 0.7) │
│    - confidence: float (0.0 to 1.0)             │
│    - similar_sources: list of cross-references  │
└──────────────────────────────────────────────────┘
```

**NLP Model Details:**

- **Model:** sentence-transformers/all-MiniLM-L6-v2
- **Type:** Transformer-based sentence encoder
- **Size:** 22.7M parameters
- **Speed:** ~3000 sentences/second on CPU
- **Output:** 384-dimensional dense vectors
- **Training:** Multi-Task Learning on 1B+ sentence pairs

**Verification Algorithm:**

```python
def verify_article(article):
    # 1. Check content quality
    has_content = bool(article.title and article.description)
    
    # 2. Find similar articles (cosine similarity > 0.3)
    similar_articles = find_similar(article, threshold=0.3)
    
    # 3. Calculate confidence
    base_confidence = 0.6  # 60% for having content
    
    if similar_articles:
        avg_similarity = mean([s.similarity for s in similar_articles])
        confidence = min(base_confidence + (avg_similarity * 0.4), 1.0)
    else:
        confidence = base_confidence
    
    # 4. Verify if confidence >= 0.7 (70%)
    verified = confidence >= 0.7
    
    return VerificationResult(article, verified, confidence, similar_articles)
```

### 3. Document Generation Process

```python
# DocumentGenerator - document_generator.py
┌─────────────────────────────────────────────────┐
│ 1. Create Word Document                         │
│    - Title: "Neuzo News Report"                 │
│    - Metadata: Category, Date, Time             │
│                                                  │
│ 2. Generate Executive Summary                   │
│    - Total articles analyzed                    │
│    - Verification rate                          │
│    - Average confidence score                   │
│    - Top 5 verified stories                     │
│    - Coverage analysis                          │
│                                                  │
│ 3. Add Verified Articles Section                │
│    For each verified article:                   │
│    - Title (Heading 2)                          │
│    - Verification badge (✓ VERIFIED)            │
│    - Confidence percentage                      │
│    - Source name                                │
│    - Publication date                           │
│    - Full description                           │
│    - Article URL                                │
│    - Cross-references (similar articles)        │
│                                                  │
│ 4. Add References Section                       │
│    - All unique news sources                    │
│    - Verification methodology                   │
│                                                  │
│ 5. Save to output/neuzo_news_<category>_<timestamp>.docx │
└─────────────────────────────────────────────────┘
```

### 4. Database Schema

```sql
-- MySQL Database: neuzo_db
┌─────────────────────────────────────────────────┐
│                                                  │
│  users                                           │
│  ├── id (PK, AUTO_INCREMENT)                    │
│  ├── email (UNIQUE)                             │
│  ├── password_hash (SHA-256)                    │
│  ├── full_name                                  │
│  └── created_at                                 │
│                                                  │
│  categories                                      │
│  ├── id (PK, AUTO_INCREMENT)                    │
│  ├── category_id (UNIQUE, e.g., 'technology')  │
│  ├── name (e.g., 'Technology')                  │
│  ├── icon_name                                  │
│  ├── is_custom                                  │
│  └── created_by (FK -> users.id)               │
│                                                  │
│  news_sources                                    │
│  ├── id (PK, AUTO_INCREMENT)                    │
│  ├── category_id (FK -> categories.id)         │
│  ├── source_url                                 │
│  ├── source_name                                │
│  ├── source_type (web, rss, api)               │
│  ├── reliability_score (0.0 to 1.0)            │
│  ├── is_active                                  │
│  └── last_checked                               │
│                                                  │
│  user_categories                                 │
│  ├── user_id (FK -> users.id)                  │
│  └── category_id (FK -> categories.id)         │
│                                                  │
│  jobs                                            │
│  ├── id (PK, AUTO_INCREMENT)                    │
│  ├── job_id (UNIQUE, e.g., 'job-20251118...')  │
│  ├── user_id (FK -> users.id)                  │
│  ├── category_id (FK -> categories.id)         │
│  ├── status (Pending, Processing, Complete)    │
│  ├── step (current processing step)            │
│  ├── sources_used (JSON array)                 │
│  ├── report_path (file path)                   │
│  ├── report_name (filename)                    │
│  ├── articles_count                             │
│  ├── verified_count                             │
│  ├── created_at                                 │
│  └── completed_at                               │
│                                                  │
└─────────────────────────────────────────────────┘
```

### 5. API Flow

```
User Action → Frontend → Backend API → Database/Services → Response
```

**Authentication Flow:**

```
1. POST /api/auth/signup
   → Create user with SHA-256 hashed password
   → Generate session token
   → Store in active_sessions dictionary
   → Return token to frontend
   → Frontend stores in localStorage

2. POST /api/auth/login
   → Validate credentials
   → Generate session token
   → Return token

3. All subsequent requests
   → Include "Authorization: Bearer <token>" header
   → @require_auth decorator validates token
   → Proceed if valid, return 401 if invalid
```

**Report Generation Flow:**

```
1. POST /api/jobs/start
   Body: { category: "technology", sources: [...] }
   
   → Create job record in database
   → Start background thread for processing
   → Return job_id immediately
   
2. Background Thread Processing:
   Step 1: Initialize agent
   Step 2: Fetch news from NewsAPI
   Step 3: Parse articles
   Step 4: Verify using NLP
   Step 5: Detect duplicates
   Step 6: Synthesize report
   Step 7: Generate Word document
   
   → Update job status after each step
   → Store report path in database
   
3. GET /api/jobs/<job_id>/status
   → Poll every 2.5 seconds from frontend
   → Return current status and step
   → When complete, show download button
   
4. GET /api/jobs/<job_id>/download
   → Validate authentication
   → Verify job ownership
   → Send .docx file with proper headers
```

---

## 📊 Data Flow Diagram

```
┌─────────────┐
│   User      │
│  Browser    │
└─────┬───────┘
      │ 1. Login (email/password)
      ▼
┌─────────────────────────────┐
│   Frontend (React)          │
│  - AuthScreen               │
│  - Category Selection       │
│  - Source Management        │
│  - Report View              │
└─────┬───────────────────────┘
      │ 2. POST /api/jobs/start
      │    { category: "technology", sources: [...] }
      ▼
┌─────────────────────────────┐
│   Flask API Server          │
│  - Authentication           │
│  - Job Management           │
│  - Background Processing    │
└─────┬───────────────────────┘
      │ 3. Create job in DB
      ▼
┌─────────────────────────────┐
│   MySQL Database            │
│  - Store job record         │
│  - Status: "Pending"        │
└─────────────────────────────┘
      │
      ▼
┌─────────────────────────────┐
│  Background Thread          │
│  1. NewsFetcherAgent        │
│     ├─ Query NewsAPI        │
│     └─ Return 20 articles   │
│                             │
│  2. NewsVerificationAgent   │
│     ├─ Load NLP model       │
│     ├─ Generate embeddings  │
│     ├─ Calculate similarity │
│     └─ Verify articles      │
│                             │
│  3. DocumentGenerator       │
│     ├─ Create Word doc      │
│     ├─ Add summary          │
│     ├─ Add articles         │
│     └─ Save to output/      │
└─────┬───────────────────────┘
      │ 4. Update job: Status="Complete"
      ▼
┌─────────────────────────────┐
│   MySQL Database            │
│  - Update report_path       │
│  - Update verified_count    │
└─────────────────────────────┘
      │
      │ 5. Frontend polls GET /api/jobs/<id>/status
      ▼
┌─────────────────────────────┐
│   Frontend                  │
│  - Show "Download Report"   │
│  - Display summary          │
└─────┬───────────────────────┘
      │ 6. Click download
      ▼
┌─────────────────────────────┐
│   GET /api/jobs/<id>/download│
│  - Validate token           │
│  - Send .docx file          │
└─────────────────────────────┘
```

---

## 🔧 Setup Instructions

### Prerequisites

- **Python:** 3.13.7 or higher
- **Node.js:** 18.0 or higher
- **MySQL:** 8.0 or higher
- **NewsAPI Key:** Free from [newsapi.org](https://newsapi.org/)

### Installation

Run the setup script:

```bash
python setup.py
```

This will:

1. ✅ Check Python and Node.js versions
2. ✅ Create Python virtual environment
3. ✅ Install Python dependencies
4. ✅ Install frontend dependencies
5. ✅ Set up MySQL database
6. ✅ Create configuration files
7. ✅ Initialize database schema
8. ✅ Create test user

### Manual Setup (Alternative)

If automated setup fails, follow these steps:

**1. Backend Setup:**

```bash
# Create virtual environment
python -m venv .venv

# Activate (Windows)
.\.venv\Scripts\Activate.ps1

# Activate (Linux/Mac)
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

**2. Database Setup:**

```bash
# Login to MySQL
mysql -u root -p

# Create database and import schema
CREATE DATABASE neuzo_db;
USE neuzo_db;
SOURCE database_schema.sql;
EXIT;
```

**3. Configuration:**

Edit `config.yaml`:

```yaml
database:
  host: "localhost"
  port: 3306
  database: "neuzo_db"
  user: "root"
  password: "YOUR_MYSQL_PASSWORD"

news_api:
  api_key: "YOUR_NEWSAPI_KEY"
```

**4. Frontend Setup:**

```bash
cd Frontend
npm install
```

---

## 🚀 Running the Application

### Start Backend

```bash
# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Run Flask server
python api_server.py
```

Server runs at: `http://localhost:5000`

### Start Frontend

```bash
cd Frontend
npm run dev
```

Frontend runs at: `http://localhost:3000`

### Access the Application

1. Open browser: `http://localhost:3000`
2. Login with test credentials:
   - Email: `test@neuzo.com`
   - Password: `test123`
3. Select a category (Technology, Sports, etc.)
4. Click "Generate Report"
5. Wait for processing (~15-20 seconds)
6. Download the Word document

---

## 📁 Project Structure

```
Neuzo/
├── api_server.py              # Flask REST API server
├── database.py                # Database connection manager
├── models.py                  # Database models (User, Job, etc.)
├── news_fetcher.py            # NewsAPI integration
├── news_verifier.py           # NLP verification engine
├── document_generator.py      # Word document generator
├── config.yaml                # Configuration file
├── database_schema.sql        # MySQL schema with sample data
├── requirements.txt           # Python dependencies
├── setup.py                   # Automated setup script
├── README.md                  # This file
│
├── Frontend/                  # React frontend
│   ├── App.tsx                # Main React component
│   ├── components/            # UI components
│   │   ├── AuthScreen.tsx     # Login/signup
│   │   ├── CategoryCard.tsx   # Category selection
│   │   ├── ProcessingStatus.tsx # Progress indicator
│   │   ├── ReportView.tsx     # Report display
│   │   └── AddSourceModal.tsx # Add news sources
│   ├── services/
│   │   └── neuzoApi.ts        # API integration
│   ├── package.json           # Node dependencies
│   └── vite.config.ts         # Vite configuration
│
├── output/                    # Generated Word documents
└── .venv/                     # Python virtual environment
```

---

## 🔍 Key Features

### 1. Real-time News Fetching

- Integrates with NewsAPI for live news data
- Supports 6 categories: Technology, Business, Science, Health, Sports, World News
- Fetches up to 100 articles per request

### 2. AI-Powered Verification

- Uses Sentence-Transformers for semantic analysis
- Cross-references articles for authenticity
- Calculates confidence scores (0-100%)
- Identifies similar sources

### 3. Intelligent Report Generation

- Professional Word document formatting
- Executive summary with key findings
- Top 5 verified stories
- Coverage analysis and insights
- Complete references section

### 4. User Management

- Secure authentication with SHA-256
- Session-based token management
- User-specific job history
- Custom category creation

### 5. Source Management

- Add custom news sources to database
- Manage source reliability scores
- Support for Web, RSS, and API sources

---

## 🧠 Machine Learning Model Details

### Sentence-Transformers: all-MiniLM-L6-v2

**Architecture:**

- Based on Microsoft's MiniLM
- 6-layer transformer encoder
- 384 hidden dimensions
- 12 attention heads per layer

**Training Data:**

- 1 billion sentence pairs
- Multi-task learning approach
- Tasks: NLI, paraphrase detection, semantic similarity

**Performance:**

- Speed: ~3000 sentences/second (CPU)
- Accuracy: 78.9% on STS benchmark
- Memory: ~90MB model size

**How It Works:**

```python
# 1. Tokenization
input_text = "Google AI advances"
tokens = tokenizer.encode(input_text)  # [101, 2054, 3058, ...]

# 2. Embedding Generation
hidden_states = transformer_model(tokens)  # [batch, seq_len, 384]

# 3. Pooling (mean pooling)
embedding = mean(hidden_states, dim=1)  # [384]

# 4. Normalization
embedding = normalize(embedding)  # L2 normalized vector

# 5. Similarity Calculation
similarity = cosine_similarity(embedding1, embedding2)
# Returns: 0.0 (unrelated) to 1.0 (identical)
```

**Why This Model?**

- ✅ Fast inference on CPU
- ✅ Good balance of speed vs accuracy
- ✅ Pre-trained on news/web text
- ✅ Low memory footprint
- ✅ No GPU required

---

## 📈 Processing Steps Explained

### Step 1: Initiating Agent

- Initialize Flask background thread
- Load configuration from config.yaml
- Prepare job tracking

### Step 2: Fetching News

- Query NewsAPI with category filter
- Parse JSON response
- Extract: title, description, source, URL, publishedAt
- Create NewsArticle objects

### Step 3: Parsing Articles

- Clean text (remove HTML, special chars)
- Validate required fields
- Structure data for verification

### Step 4: Verifying News

- Load Sentence-Transformer model
- Generate 384-dim embeddings for each article
- Calculate similarity matrix (cosine similarity)
- Score each article based on cross-references
- Assign confidence levels

### Step 5: Detecting Duplicates

- Identify articles with >80% similarity
- Group related stories
- Keep highest-confidence version

### Step 6: Synthesizing Report

- Aggregate verified articles
- Calculate statistics
- Generate insights
- Prepare document structure

### Step 7: Generating Document

- Create Word document with python-docx
- Add formatted sections
- Include metadata and references
- Save to output/ directory

---

## 🔒 Security Features

1. **Password Security:**
   - SHA-256 hashing with salt
   - Passwords never stored in plain text

2. **Session Management:**
   - Random 32-byte URL-safe tokens
   - Token validation on every request
   - Auto-expiration on server restart

3. **API Security:**
   - CORS enabled for localhost
   - Authentication required for all endpoints
   - User ownership validation for downloads

4. **Input Validation:**
   - Email format validation
   - URL validation for sources
   - SQL injection prevention via parameterized queries

---

## 🐛 Troubleshooting

### Backend Won't Start

```bash
# Check Python version
python --version  # Should be 3.13+

# Check virtual environment
.\.venv\Scripts\Activate.ps1

# Reinstall dependencies
pip install -r requirements.txt
```

### Database Connection Failed

```bash
# Check MySQL is running
Get-Service MySQL80

# Test connection
mysql -u root -p

# Verify config.yaml has correct password
```

### NewsAPI Returning 0 Articles

- **Check API key** in config.yaml
- **Verify quota:** Free tier = 100 requests/day
- **Check category:** Use valid categories (technology, business, etc.)

### Session Expired Error

- **Cause:** Backend server restarted (sessions stored in memory)
- **Solution:** Log out and log in again

### Download Returns 401

- **Cause:** Missing or invalid authentication token
- **Solution:** Refresh page and log in again

---

## 📝 License

MIT License - Free for personal and commercial use.

---

## 👨‍💻 Developer Notes

### Adding New Categories

1. Add to `database_schema.sql`:

```sql
INSERT INTO categories (category_id, name, icon_name) 
VALUES ('education', 'Education', 'academicCap');
```

1. Add icon to `Frontend/components/icons.tsx`

2. Update category mapping in `api_server.py`

### Adjusting Verification Threshold

Edit `config.yaml`:

```yaml
nlp:
  similarity_threshold: 0.6  # Lower = more lenient
```

### Changing Time Window

```yaml
time_window_hours: 24  # Fetch news from last 24 hours
```

---

## 🎓 Learning Resources

- **Sentence-Transformers:** <https://www.sbert.net/>
- **NewsAPI Documentation:** <https://newsapi.org/docs>
- **Flask REST API:** <https://flask.palletsprojects.com/>
- **React Hooks:** <https://react.dev/reference/react>

---

**Built By Ahbab using Python, React, and Machine Learning**
