// Campaign types
export interface Campaign {
  id: string
  name: string
  icp: string
  pain_points: string
  offer: string
  brief: string | null
  created_at: string
  updated_at: string
  document_count?: number
  variant_count?: number
  documents?: Document[]
  variants?: Variant[]
}

export interface CampaignCreate {
  name: string
  icp: string
  pain_points: string
  offer: string
  brief?: string
}

// Document types
export interface Document {
  id: string
  campaign_id: string
  filename: string
  file_path: string
  file_type: string
  doc_type: 'voice' | 'voc' | 'campaign_context' | null
  channel: string | null
  industry: string | null
  role: string | null
  chunk_count: number
  processed: number
  created_at: string
}

export interface TagSuggestion {
  doc_type: string
  channel: string | null
  industry: string | null
  role: string | null
  confidence: number
  reasoning: string
}

// Variant types
export interface Variant {
  id: string
  campaign_id: string
  lead_variant_id: string | null
  touch: 'lead' | 'followup'
  chunk: 'base' | 'up' | 'down'
  angle: string
  subject: string
  body: string
  thesis: string | null
  starred: boolean
  word_count: number
  readability_grade: number
  qa_pass: boolean
  qa_notes: string | null
  created_at: string
  updated_at: string
}

export interface VariantPair {
  angle: string
  lead: Variant
  followup: Variant
  cut_content: string
}

export interface GenerateResponse {
  status: string
  count: number
  pairs: VariantPair[]
}

// Gap analysis types
export interface Gap {
  category: string
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  suggestion: string
  file_types: string[]
}

export interface GapAnalysis {
  coverage_score: number
  gaps: Gap[]
  strengths: string[]
  cached?: boolean
  analyzed_at?: string
  error?: string
}

// API response types
export interface ApiError {
  detail: string
}
