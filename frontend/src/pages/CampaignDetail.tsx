import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  Download,
  FileText,
  MessageSquare,
  Filter,
  CheckCircle2,
} from 'lucide-react'
import { campaignApi, generateApi, exportApi } from '../api/client'
import DocumentUploader from '../components/DocumentUploader'
import VariantCard from '../components/VariantCard'
import GapAnalysis from '../components/GapAnalysis'
import CampaignSettings from '../components/CampaignSettings'
import type { Variant } from '../types'

type Tab = 'documents' | 'variants' | 'settings'
type FilterTouch = 'all' | 'lead' | 'followup'
type FilterChunk = 'all' | 'base' | 'up' | 'down'
type FilterStarred = 'all' | 'starred'

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<Tab>('documents')
  const [filterTouch, setFilterTouch] = useState<FilterTouch>('all')
  const [filterChunk, setFilterChunk] = useState<FilterChunk>('all')
  const [filterStarred, setFilterStarred] = useState<FilterStarred>('all')
  const [numVariants, setNumVariants] = useState(8)
  const [preSelectedDocType, setPreSelectedDocType] = useState<string | undefined>()
  const [exportMode, setExportMode] = useState<'all' | 'starred'>('all')

  const { data: campaign, isLoading, error } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => campaignApi.get(id!),
    enabled: !!id,
  })

  // Gap analysis query
  const { data: gapAnalysis } = useQuery({
    queryKey: ['gap-analysis', id],
    queryFn: () => campaignApi.analyzeGaps(id!),
    enabled: !!id,
  })

  const generateMutation = useMutation({
    mutationFn: () => generateApi.variants(id!, numVariants),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', id] })
      setActiveTab('variants')
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-accent-electric animate-spin" />
      </div>
    )
  }

  if (error || !campaign) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">Campaign not found</p>
        <Link to="/" className="text-accent-electric hover:underline mt-2 inline-block">
          Back to campaigns
        </Link>
      </div>
    )
  }

  // Filter variants
  const filteredVariants = (campaign.variants || []).filter((v: Variant) => {
    if (filterTouch !== 'all' && v.touch !== filterTouch) return false
    if (filterChunk !== 'all' && v.chunk !== filterChunk) return false
    if (filterStarred === 'starred' && !v.starred) return false
    return true
  })

  const starredCount = (campaign.variants || []).filter((v: Variant) => v.starred).length

  // Group variants by lead (for showing pairs)
  const leadVariants = filteredVariants.filter((v: Variant) => v.touch === 'lead')
  const followupMap = new Map<string, Variant>()
  filteredVariants.forEach((v: Variant) => {
    if (v.touch === 'followup' && v.lead_variant_id) {
      followupMap.set(v.lead_variant_id, v)
    }
  })

  const processedDocs = (campaign.documents || []).filter((d) => d.processed === 1).length
  const coverageScore = gapAnalysis?.coverage_score || 0
  const showRecommended = coverageScore >= 50

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <Link
            to="/"
            className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to campaigns
          </Link>
          <h1 className="text-3xl font-bold text-white font-display">{campaign.name}</h1>
          <p className="text-zinc-500 mt-1 max-w-2xl line-clamp-2">{campaign.icp}</p>
        </div>

        <div className="flex items-center gap-3">
          {campaign.variants && campaign.variants.length > 0 && (
            <div className="relative inline-block">
              <div className="flex items-center gap-0">
                <button
                  onClick={() => {
                    const url = exportApi.campaignCsv(campaign.id, exportMode === 'starred' ? { starred: true } : undefined)
                    window.open(url, '_blank')
                  }}
                  disabled={exportMode === 'starred' && starredCount === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-surface-light border border-surface-lighter border-r-0 text-white font-medium rounded-l-xl hover:border-zinc-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
                <select
                  value={exportMode}
                  onChange={(e) => setExportMode(e.target.value as 'all' | 'starred')}
                  className="px-3 py-2 bg-surface-light border border-surface-lighter border-l-0 text-sm text-white rounded-r-xl hover:border-zinc-600 focus:border-accent-electric focus:outline-none cursor-pointer transition-all"
                  style={{ minWidth: '100px' }}
                >
                  <option value="all">All</option>
                  <option value="starred" disabled={starredCount === 0}>
                    Starred {starredCount > 0 && `(${starredCount})`}
                  </option>
                </select>
              </div>
            </div>
          )}
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className={`flex items-center gap-2 px-5 py-2.5 bg-accent-electric text-surface-dark font-medium rounded-xl hover:bg-accent-electric/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all relative ${
              showRecommended ? 'pr-24' : ''
            }`}
          >
            {generateMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
            Generate Variants
            {showRecommended && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-0.5 bg-green-500 text-white text-xs font-medium rounded">
                <CheckCircle2 className="w-3 h-3" />
                Recommended
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface-light rounded-xl border border-surface-lighter p-4">
          <div className="flex items-center gap-2 text-zinc-500 mb-1">
            <FileText className="w-4 h-4" />
            <span className="text-xs">Documents</span>
          </div>
          <p className="text-2xl font-bold text-white">{campaign.documents?.length || 0}</p>
          <p className="text-xs text-zinc-500">{processedDocs} processed</p>
        </div>
        <div className="bg-surface-light rounded-xl border border-surface-lighter p-4">
          <div className="flex items-center gap-2 text-zinc-500 mb-1">
            <MessageSquare className="w-4 h-4" />
            <span className="text-xs">Variants</span>
          </div>
          <p className="text-2xl font-bold text-white">{campaign.variants?.length || 0}</p>
          <p className="text-xs text-zinc-500">
            {campaign.variants?.filter((v: Variant) => v.qa_pass).length || 0} QA passed
          </p>
        </div>
        <div className="bg-surface-light rounded-xl border border-surface-lighter p-4">
          <div className="flex items-center gap-2 text-zinc-500 mb-1">
            <span className="text-xs">Lead Variants</span>
          </div>
          <p className="text-2xl font-bold text-accent-electric">
            {campaign.variants?.filter((v: Variant) => v.touch === 'lead').length || 0}
          </p>
        </div>
        <div className="bg-surface-light rounded-xl border border-surface-lighter p-4">
          <div className="flex items-center gap-2 text-zinc-500 mb-1">
            <span className="text-xs">Follow-ups</span>
          </div>
          <p className="text-2xl font-bold text-accent-coral">
            {campaign.variants?.filter((v: Variant) => v.touch === 'followup').length || 0}
          </p>
        </div>
      </div>

      {/* Gap Analysis - Always Visible */}
      {id && (
        <GapAnalysis
          campaignId={id}
          onUploadClick={(_category, docType) => {
            // Switch to documents tab and set pre-selected doc type
            setActiveTab('documents')
            setPreSelectedDocType(docType)
            // Scroll to upload area after a brief delay
            setTimeout(() => {
              const uploadArea = document.querySelector('[data-upload-area]')
              uploadArea?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }, 100)
          }}
        />
      )}

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-surface-lighter mb-6">
        <button
          onClick={() => setActiveTab('documents')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${
            activeTab === 'documents'
              ? 'border-accent-electric text-white'
              : 'border-transparent text-zinc-500 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          Documents
        </button>
        <button
          onClick={() => setActiveTab('variants')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${
            activeTab === 'variants'
              ? 'border-accent-electric text-white'
              : 'border-transparent text-zinc-500 hover:text-white'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Variants
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${
            activeTab === 'settings'
              ? 'border-accent-electric text-white'
              : 'border-transparent text-zinc-500 hover:text-white'
          }`}
        >
          <span className="text-sm">⚙️</span>
          Settings
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'documents' ? (
        <div>
          <div className="mb-6">
            <h3 className="text-lg font-medium text-white mb-2">Knowledge Bank</h3>
            <p className="text-sm text-zinc-500">
              Upload documents to build context for generation. Tag them so the AI knows what they are.
            </p>
          </div>
          <DocumentUploader
            campaignId={campaign.id}
            documents={campaign.documents || []}
            preSelectedDocType={preSelectedDocType}
            onUploadComplete={() => {
              // Clear pre-selected doc type
              setPreSelectedDocType(undefined)
              // Refresh campaign and gap analysis after upload
              queryClient.invalidateQueries({ queryKey: ['campaign', id] })
              queryClient.invalidateQueries({ queryKey: ['gap-analysis', id] })
            }}
          />
        </div>
      ) : activeTab === 'settings' ? (
        <CampaignSettings campaign={campaign} campaignId={campaign.id} />
      ) : (
        <div>
          {/* Filters */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-zinc-500" />
              <span className="text-sm text-zinc-500">Filter:</span>
            </div>
            <select
              value={filterTouch}
              onChange={(e) => setFilterTouch(e.target.value as FilterTouch)}
              className="px-3 py-1.5 bg-surface-light border border-surface-lighter rounded-lg text-sm text-white focus:border-accent-electric"
            >
              <option value="all">All touches</option>
              <option value="lead">Lead only</option>
              <option value="followup">Follow-up only</option>
            </select>
            <select
              value={filterChunk}
              onChange={(e) => setFilterChunk(e.target.value as FilterChunk)}
              className="px-3 py-1.5 bg-surface-light border border-surface-lighter rounded-lg text-sm text-white focus:border-accent-electric"
            >
              <option value="all">All chunks</option>
              <option value="base">Base only</option>
              <option value="up">Chunk up</option>
              <option value="down">Chunk down</option>
            </select>
            <select
              value={filterStarred}
              onChange={(e) => setFilterStarred(e.target.value as FilterStarred)}
              className="px-3 py-1.5 bg-surface-light border border-surface-lighter rounded-lg text-sm text-white focus:border-accent-electric"
            >
              <option value="all">All variants</option>
              <option value="starred">
                Starred only {starredCount > 0 && `(${starredCount})`}
              </option>
            </select>

            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm text-zinc-500">Generate:</span>
              <select
                value={numVariants}
                onChange={(e) => setNumVariants(Number(e.target.value))}
                className="px-3 py-1.5 bg-surface-light border border-surface-lighter rounded-lg text-sm text-white focus:border-accent-electric"
              >
                {[4, 6, 8, 10].map((n) => (
                  <option key={n} value={n}>{n} pairs</option>
                ))}
              </select>
            </div>
          </div>

          {/* Variant grid */}
          {filteredVariants.length > 0 ? (
            <div className="space-y-6">
              {filterTouch === 'all' || filterTouch === 'lead' ? (
                // Show lead variants with their follow-ups
                leadVariants.map((lead: Variant) => (
                  <div key={lead.id} className="space-y-3">
                    <VariantCard
                      variant={lead}
                      linkedVariant={followupMap.get(lead.id)}
                      campaignId={campaign.id}
                    />
                  </div>
                ))
              ) : (
                // Show only follow-ups
                filteredVariants.map((variant: Variant) => (
                  <VariantCard
                    key={variant.id}
                    variant={variant}
                    campaignId={campaign.id}
                  />
                ))
              )}
            </div>
          ) : (
            <div className="text-center py-16 bg-surface-light rounded-2xl border border-surface-lighter">
              <MessageSquare className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No variants yet</h3>
              <p className="text-zinc-500 mb-6">
                Click "Generate Variants" to create email copy
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
