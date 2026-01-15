# CopyWrite - AU Email Drafting System

A local web application for generating AU-centric email copy variants using RAG and Claude 4.5 Sonnet.

## Features

- **Campaign Management**: Create campaigns with structured ICP, pain points, and offers
- **Knowledge Bank**: Upload documents (CSV, DOCX, TXT, MD) with AI-assisted tagging
- **Overflow Capture Generation**: Generate lead + follow-up pairs where follow-ups are built from content cut from leads
- **QA Guardrails**: Automatic readability, word count, banned phrases, and tone checks
- **Inline Editing**: Edit variants directly in the UI
- **CSV Export**: Export variants with stable column schema for Clay integration

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- Anthropic API key

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set your API key in .env (already configured)

# Run the server
python -m uvicorn app.main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev
```

### Access the App

Open http://localhost:5173 in your browser.

## Usage

1. **Create a Campaign**: Fill in name, ICP, pain points, offer, and optional brief
2. **Upload Documents**: Add your voice samples, VOC data, and campaign context
3. **Tag Documents**: Use AI suggestions to categorize documents
4. **Process Documents**: Chunk and embed documents into the knowledge bank
5. **Generate Variants**: Create 6-10 lead + follow-up pairs
6. **Edit & Export**: Fine-tune copy and export to CSV

## Tech Stack

- **Frontend**: React + Vite + TailwindCSS
- **Backend**: FastAPI + SQLite + Chroma
- **LLM**: Claude 4.5 Sonnet
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
| subject | (blank for MVP) |
| body | Email body text |
| word_count | Word count |
| readability_grade | Flesch-Kincaid grade |
| qa_pass | true/false |
| qa_notes | QA failure reasons |
| created_at | ISO timestamp |
| updated_at | ISO timestamp |

## Project Structure

```
copy_write_MVP/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI entry
│   │   ├── config.py         # Settings
│   │   ├── database.py       # SQLite setup
│   │   ├── models/           # SQLAlchemy models
│   │   ├── routers/          # API endpoints
│   │   ├── services/         # Business logic
│   │   └── prompts/          # Claude prompts
│   ├── data/                 # Persisted data
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── pages/            # Page components
│   │   ├── api/              # API client
│   │   └── types/            # TypeScript types
│   └── package.json
└── README.md
```

## License

Private - Internal Use Only
