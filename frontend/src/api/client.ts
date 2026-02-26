import axios from 'axios'
import type { Campaign, CampaignCreate, CampaignUpdate, Document, Variant, TagSuggestion, GenerateResponse, GapAnalysis, ICPResearchResponse, VOCResearchResponse, ResearchHistoryResponse, ResearchDiffResponse } from '../types'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Campaign endpoints
export const campaignApi = {
  list: async (): Promise<Campaign[]> => {
    const { data } = await api.get('/campaigns')
    return data
  },

  get: async (id: string): Promise<Campaign> => {
    const { data } = await api.get(`/campaigns/${id}`)
    return data
  },

  create: async (campaign: CampaignCreate): Promise<Campaign> => {
    const { data } = await api.post('/campaigns', campaign)
    return data
  },

  update: async (id: string, campaign: CampaignUpdate): Promise<Campaign> => {
    const { data } = await api.put(`/campaigns/${id}`, campaign)
    return data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/campaigns/${id}`)
  },

  analyzeGaps: async (id: string, forceRefresh: boolean = false): Promise<GapAnalysis> => {
    const { data } = await api.post(`/campaigns/${id}/analyze-gaps?force_refresh=${forceRefresh}`)
    return data
  },

  migrateContext: async (): Promise<{ status: string; migrated: number; skipped: number }> => {
    const { data } = await api.post('/campaigns/migrate-context')
    return data
  },

  researchICP: async (
    campaignId: string,
    industry: string,
    geography: string,
    serviceOffering: string,
    additionalContext: string
  ): Promise<ICPResearchResponse> => {
    const { data } = await api.post(`/campaigns/${campaignId}/research/icp`, {
      industry, geography, service_offering: serviceOffering, additional_context: additionalContext,
    })
    return data
  },

  researchVOC: async (
    campaignId: string,
    icpSummary: string,
    competitors: string,
    platformsPriority: string,
    additionalContext: string
  ): Promise<VOCResearchResponse> => {
    const { data } = await api.post(`/campaigns/${campaignId}/research/voc`, {
      icp_summary: icpSummary, competitors, platforms_priority: platformsPriority, additional_context: additionalContext,
    })
    return data
  },

  researchFull: async (
    campaignId: string,
    industry: string,
    geography: string,
    serviceOffering: string,
    additionalContext: string,
    competitors: string,
    platformsPriority: string
  ): Promise<ICPResearchResponse> => {
    const { data } = await api.post(`/campaigns/${campaignId}/research/full`, {
      industry, geography, service_offering: serviceOffering, additional_context: additionalContext,
      competitors, platforms_priority: platformsPriority,
    })
    return data
  },

  getResearchHistory: async (campaignId: string): Promise<ResearchHistoryResponse> => {
    const { data } = await api.get(`/campaigns/${campaignId}/research/history`)
    return data
  },

  getResearchDiff: async (campaignId: string, v1: number, v2: number): Promise<ResearchDiffResponse> => {
    const { data } = await api.get(`/campaigns/${campaignId}/research/diff?v1=${v1}&v2=${v2}`)
    return data
  },
}

// Document endpoints
export const documentApi = {
  upload: async (campaignId: string, file: File, metadata?: Partial<Document>): Promise<Document> => {
    const formData = new FormData()
    formData.append('file', file)
    if (metadata?.doc_type) formData.append('doc_type', metadata.doc_type)
    if (metadata?.channel) formData.append('channel', metadata.channel)
    if (metadata?.industry) formData.append('industry', metadata.industry)
    if (metadata?.role) formData.append('role', metadata.role)

    const { data } = await api.post(`/documents/campaigns/${campaignId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  suggestTags: async (documentId: string): Promise<TagSuggestion> => {
    const { data } = await api.post(`/documents/${documentId}/suggest-tags`)
    return data
  },

  process: async (documentId: string): Promise<{ status: string; chunk_count: number }> => {
    const { data } = await api.post(`/documents/${documentId}/process`)
    return data
  },

  update: async (documentId: string, metadata: Partial<Document>): Promise<Document> => {
    const { data } = await api.put(`/documents/${documentId}`, metadata)
    return data
  },

  delete: async (documentId: string): Promise<void> => {
    await api.delete(`/documents/${documentId}`)
  },

  getContent: async (documentId: string): Promise<{ content: string }> => {
    const { data } = await api.get(`/documents/${documentId}/content`)
    return data
  },

  downloadUrl: (documentId: string): string => {
    return `/api/documents/${documentId}/download`
  },
}

// Generate endpoints
export const generateApi = {
  variants: async (campaignId: string, numVariants?: number, angles?: string[]): Promise<GenerateResponse> => {
    const { data } = await api.post(`/campaigns/${campaignId}/generate`, {
      num_variants: numVariants,
      angles,
    })
    return data
  },

  chunk: async (variantId: string, direction: 'up' | 'down'): Promise<Variant> => {
    const { data } = await api.post(`/variants/${variantId}/chunk`, { direction })
    return data
  },

  toggleStar: async (variantId: string): Promise<Variant> => {
    const { data } = await api.put(`/variants/${variantId}/star`)
    return data
  },

  regenerate: async (variantId: string): Promise<{ status: string; pair: any }> => {
    const { data } = await api.post(`/variants/${variantId}/regenerate`)
    return data
  },
}

// Variant endpoints
export const variantApi = {
  list: async (campaignId: string, filters?: { touch?: string; chunk?: string; qa_pass?: boolean }): Promise<Variant[]> => {
    const params = new URLSearchParams()
    if (filters?.touch) params.append('touch', filters.touch)
    if (filters?.chunk) params.append('chunk', filters.chunk)
    if (filters?.qa_pass !== undefined) params.append('qa_pass', String(filters.qa_pass))
    
    const { data } = await api.get(`/campaigns/${campaignId}/variants?${params}`)
    return data
  },

  get: async (variantId: string): Promise<Variant> => {
    const { data } = await api.get(`/variants/${variantId}`)
    return data
  },

  update: async (variantId: string, body: string): Promise<Variant> => {
    const { data } = await api.put(`/variants/${variantId}`, { body })
    return data
  },

  delete: async (variantId: string): Promise<void> => {
    await api.delete(`/variants/${variantId}`)
  },
}

// Export endpoints
export const exportApi = {
  campaignCsv: (campaignId: string, filters?: { touch?: string; chunk?: string; qa_pass?: boolean; starred?: boolean }): string => {
    const params = new URLSearchParams()
    if (filters?.touch) params.append('touch', filters.touch)
    if (filters?.chunk) params.append('chunk', filters.chunk)
    if (filters?.qa_pass !== undefined) params.append('qa_pass', String(filters.qa_pass))
    if (filters?.starred !== undefined) params.append('starred', String(filters.starred))
    
    return `/api/campaigns/${campaignId}/export/csv?${params}`
  },

  bulkCsv: (campaignIds: string[]): string => {
    return `/api/export/csv?campaign_ids=${campaignIds.join(',')}`
  },
}
