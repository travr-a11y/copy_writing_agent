# CopyWrite - AU Email Drafting System

A local web application for generating AU-centric email copy variants using RAG and Claude Sonnet 4.

## Features

- **Campaign Management**: Create campaigns with structured ICP, pain points, and offers
- **Knowledge Bank**: Upload documents (CSV, DOCX, TXT, MD) with AI-assisted tagging
- **Gap Analysis**: AI-powered analysis of knowledge bank coverage with actionable recommendations
- **Overflow Capture Generation**: Generate lead + follow-up pairs where follow-ups are built from content cut from leads
- **QA Guardrails**: Automatic readability, word count, banned phrases, Americanism detection, and tone checks
- **Chunk Up/Down**: Create length variants of any email (shorter or longer)
- **Inline Editing**: Edit variants directly in the UI with live word count
- **Star & Filter**: Star best variants, filter by touch/chunk/starred
- **Research**: Pain point research via Gemini or Perplexity
- **CSV Export**: Export variants with stable column schema for Clay integration

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- Anthropic API key (required)
- Google Gemini API key (optional, for research)
- Perplexity API key (optional, for research)

### Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env with your API keys
cat > .env << 'EOF'
ANTHROPIC_API_KEY=your-key-here
GEMINI_API_KEY=your-key-here
PERPLEXITY_API_KEY=your-key-here
EOF

# Run the server
python3 -m uvicorn app.main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Access the App

Open http://localhost:5173 in your browser.

## Usage

1. **Create a Campaign**: Fill in name, ICP, pain points, offer, and optional brief
2. **Review Gap Analysis**: Check coverage score and upload recommended documents
3. **Upload Documents**: Add voice samples, VOC data, and campaign context
4. **Tag Documents**: Use AI suggestions to categorize documents
5. **Process Documents**: Chunk and embed documents into the knowledge bank
6. **Generate Variants**: Create lead + follow-up pairs (default 8 pairs)
7. **Refine**: Star best variants, chunk up/down, inline edit
8. **Export**: Export to CSV (all or starred only)

## Tech Stack

- **Frontend**: React 18 + Vite + TailwindCSS + TanStack React Query
- **Backend**: FastAPI + SQLite + ChromaDB
- **Writing LLM**: Claude Sonnet 4
- **Analytics LLM**: Claude Opus 4
- **Research LLMs**: Gemini 2.0 Flash, Perplexity Sonar Pro
- **Embeddings**: sentence-transformers (all-MiniLM-L6-v2)

## CSV Export Schema

| Column | Description |
|--------|-------------|
| campaign_id | Campaign UUID |
| campaign_name | Campaign name |
| variant_id | Variant UUID |
| lead_variant_id | Parent lead (for follow-ups) |
| touch | lead or followup |
| chunk | base, up, or down |
| angle | curiosity, pain, outcome, etc. |
| subject | Subject line (blank for MVP) |
| body | Email body text |
| thesis | Testing hypothesis for the variant |
| starred | Whether the variant is starred |
| word_count | Word count |
| readability_grade | Flesch-Kincaid grade |
| qa_pass | true/false |
| qa_notes | QA failure reasons |
| created_at | ISO timestamp |
| updated_at | ISO timestamp |

## Project Structure

```
msu/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI entry point
│   │   ├── config.py         # Settings & constants
│   │   ├── database.py       # SQLite + SQLAlchemy setup
│   │   ├── models/           # Campaign, Document, Variant, Cache
│   │   ├── routers/          # API endpoints (campaigns, documents, generate, export)
│   │   ├── services/         # Business logic (drafting, QA, ingestion, vectorstore, etc.)
│   │   │   └── llm/          # LLM provider abstraction (Anthropic, Gemini, Perplexity)
│   │   └── prompts/          # Overflow generation & chunk prompts
│   ├── migrations/           # Database migration scripts
│   ├── data/                 # SQLite DB, ChromaDB, uploads (gitignored)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/       # UI components (8 components)
│   │   ├── pages/            # Campaign list, create, detail
│   │   ├── api/              # Axios API client
│   │   └── types/            # TypeScript type definitions
│   └── package.json
├── .gitignore
└── README.md
```

## Production Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for:
- Fixing the `pkg_resources` backend error
- Deploying to Railway (GitHub → Railway)
- Environment variables and data persistence

## License

Private - Internal Use Only
