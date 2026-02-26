// Structured ICP types
export interface ICPFirmographics {
  industry?: string
  sub_sector?: string
  revenue_range_aud?: string
  employee_range?: string
  locations?: string[]
  spend_indicators?: string
  business_model?: string
}

export interface ICPTechnographics {
  erp_stack?: string
  tms_stack?: string
  crm_stack?: string
  digital_maturity?: string
  api_edi_capability?: string
  online_presence?: string
}

export interface BuyerPersona {
  role: string
  responsibilities?: string
  kpis?: string[]
  decision_authority?: string
  triggers?: string[]
  risk_factors?: string[]
  success_metrics?: string[]
  preferred_channels?: string[]
}

export interface ICPPsychographics {
  values?: string[]
  motivations?: string[]
  risk_appetite?: string
  supplier_perception?: string
}

export interface ICPTriggers {
  project_based?: string[]
  operational?: string[]
  market_based?: string[]
  digital_signals?: string[]
}

export interface ICPQualification {
  ideal_fit_criteria?: {
    revenue_threshold?: string
    spend_threshold?: string
    integration_readiness?: string
    engagement_signals?: string
  }
  disqualifiers?: string[]
}

export interface ICPBuyingJourney {
  awareness?: string
  consideration?: string
  decision?: string
  cycle_length?: string
}

export interface ICPMessagingAngles {
  positioning_statement?: string
  proof_points?: string[]
  emotional_hook?: string
  rational_hook?: string
  cta_by_role?: {
    ops?: string
    cfo?: string
    md?: string
  }
}

export interface ICPChannels {
  linkedin?: string
  email?: string
  trade_events?: string
  associations?: string
  content_assets?: string[]
}

// VOC types
export interface PainTheme {
  theme: string
  frequency: 'High' | 'Medium' | 'Low'
  raw_quotes: string[]
  emotion_signal?: string
  trigger_context?: string
  normalised_pain?: string
}

export interface VOCLanguageBank {
  phrases?: string[]
  idioms?: string[]
  industry_shorthand?: string[]
  alternative_language?: {
    instead_of_strategy?: string
    instead_of_scale?: string
    instead_of_growth?: string
  }
}

export interface VOCObjection {
  objection: string
  quotes?: string[]
  frequency?: 'High' | 'Medium' | 'Low'
}

export interface VOCImplications {
  never_say?: string[]
  acknowledge_early?: string[]
  disengaging_tone?: string
  engaging_tone?: string
}

export interface VOCData {
  icp_summary?: string
  pain_themes: PainTheme[]
  language_bank: VOCLanguageBank
  objections: VOCObjection[]
  implications: VOCImplications
  sources_used?: string[]
  sources_limited?: string[]
  data_recency?: string
}

// Research history types
export interface ResearchHistoryEntry {
  version: number
  timestamp: string
  summary: string
  type: 'icp' | 'voc' | 'refinement'
  refined_icp?: boolean
  refined_voc?: boolean
}

// Campaign types
export interface Campaign {
  id: string
  name: string
  // Basics
  industry?: string
  geography?: string
  service_offering?: string
  // Structured ICP
  icp_firmographics?: ICPFirmographics
  icp_technographics?: ICPTechnographics
  icp_buyer_personas?: BuyerPersona[]
  icp_psychographics?: ICPPsychographics
  icp_triggers?: ICPTriggers
  icp_qualification?: ICPQualification
  icp_buying_journey?: ICPBuyingJourney
  icp_messaging_angles?: ICPMessagingAngles
  icp_channels?: ICPChannels
  // VOC
  voc_pain_themes?: PainTheme[]
  voc_language_bank?: VOCLanguageBank
  voc_objections?: VOCObjection[]
  voc_implications?: VOCImplications
  // Legacy/Merged fields
  icp: string | null
  pain_points: string | null
  offer: string | null
  brief: string | null
  // Research management
  additional_learnings?: string
  research_version?: number | null
  research_history?: ResearchHistoryEntry[]
  last_research_at?: string | null
  docs_last_processed_at?: string | null
  research_skipped?: boolean
  // Timestamps
  created_at: string
  updated_at: string
  // Counts
  document_count?: number
  variant_count?: number
  documents?: Document[]
  variants?: Variant[]
}

export interface CampaignCreate {
  name: string
  industry?: string
  geography?: string
  service_offering?: string
  icp?: string
  pain_points?: string
  offer?: string
  brief?: string
}

export interface CampaignUpdate {
  name?: string
  icp?: string
  pain_points?: string
  offer?: string
  brief?: string | null
}

// Document types
export interface Document {
  id: string
  campaign_id: string
  filename: string
  file_path: string
  file_type: string
  doc_type: 'company_voice' | 'voice_of_customer' | 'call_transcript' | 'research' | 'campaign_context' | null
  channel: string | null
  industry: string | null
  role: string | null
  source_type: 'internal' | 'market_feedback' | null
  additional_context: string | null
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
  archived?: boolean
  archived_at?: string | null
  archive_reason?: string | null
  variables_used?: string | null
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

// Offer types
export interface Offer {
  id: string
  campaign_id: string | null
  name: string
  headline: string
  subheadline: string | null
  benefits: string[]
  proof_points: string[]
  cta: string
  created_at: string
  updated_at: string
}

// ICP types
export interface ICP {
  id: string
  campaign_id: string | null
  name: string
  demographics: Record<string, any>
  firmographics: Record<string, any>
  psychographics: Record<string, any>
  pain_points: string[]
  goals: string[]
  created_at: string
  updated_at: string
}

// Research API response types
export interface ICPResearchResponse {
  success: boolean
  icp: {
    firmographics: ICPFirmographics
    technographics: ICPTechnographics
    buyer_personas: BuyerPersona[]
    psychographics: ICPPsychographics
    triggers: ICPTriggers
    qualification: ICPQualification
    buying_journey: ICPBuyingJourney
    messaging_angles: ICPMessagingAngles
    channels: ICPChannels
  }
  research_version: number
  processing_time_seconds: number
  model: string
}

export interface VOCResearchResponse {
  success: boolean
  voc: VOCData
  document_id: string
  research_version: number
  processing_time_seconds: number
  model: string
}

export interface RefineResearchResponse {
  success: boolean
  new_version: number
  diff: {
    icp_changes: string[]
    voc_changes: string[]
  }
}

export interface ResearchHistoryResponse {
  campaign_id: string
  current_version: number | null
  history: ResearchHistoryEntry[]
  last_research_at: string | null
}

export interface ResearchDiffResponse {
  v1: ResearchHistoryEntry
  v2: ResearchHistoryEntry
  summary: string
  note?: string
}

// API response types
export interface ApiError {
  detail: string
}
