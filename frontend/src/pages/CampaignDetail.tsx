import { useState, useMemo } from 'react'
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
import LegacyUpgradeBanner from '../components/LegacyUpgradeBanner'
import GenerationSidePanel from '../components/GenerationSidePanel'
import type { Variant, Campaign } from '../types'

type Tab = 'documents' | 'variants' | 'more'
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
  const [showArchived, setShowArchived] = useState(false)
  const [showGenerationPanel, setShowGenerationPanel] = useState(false)
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

  const [isGenerating, setIsGenerating] = useState(false)
  const [progressStage, setProgressStage] = useState<string>('')
  const [progressCurrent, setProgressCurrent] = useState<number>(0)
  const [progressTotal, setProgressTotal] = useState<number>(0)

  const handleGenerate = async () => {
    if (!canGenerate) return

    setIsGenerating(true)
    setProgressStage('Starting generation...')
    setProgressCurrent(0)
    setProgressTotal(numVariants)

    try {
      const params = new URLSearchParams()
      params.append('num_variants', numVariants.toString())

      const eventSource = new EventSource(
        `/api/campaigns/${id}/generate/stream?${params.toString()}`
      )

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data)
        
        if (data.stage === 'error') {
          eventSource.close()
          alert(`Generation failed: ${data.message}`)
          setIsGenerating(false)
          return
        }

        if (data.stage === 'done') {
          eventSource.close()
          setProgressStage('Completed')
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['campaign', id] })
            setActiveTab('variants')
            setIsGenerating(false)
            setProgressStage('')
          }, 1000)
          return
        }

        setProgressStage(data.stage || '')
        if (data.current !== undefined && data.total !== undefined) {
          setProgressCurrent(data.current)
          setProgressTotal(data.total)
        }
      }

      eventSource.onerror = (error) => {
        console.error('SSE error:', error)
        eventSource.close()
        alert('Connection error. Please try again.')
        setIsGenerating(false)
        setProgressStage('')
      }
    } catch (error) {
      console.error('Failed to generate variants:', error)
      alert('Failed to generate variants. Please try again.')
      setIsGenerating(false)
      setProgressStage('')
    }
  }

  // Research mutations for DocumentUploader
  const icpResearchMutation = useMutation({
    mutationFn: () => {
      if (!campaign?.industry) {
        throw new Error('Industry is required to run ICP research')
      }
      return campaignApi.researchICP(
        id!,
        campaign.industry,
        campaign.geography || 'Australia',
        campaign.service_offering || '',
        campaign.additional_learnings || campaign.icp || ''
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', id] })
      queryClient.invalidateQueries({ queryKey: ['gap-analysis', id] })
    },
  })

  const vocResearchMutation = useMutation({
    mutationFn: () => {
      if (!campaign?.industry) {
        throw new Error('Industry is required to run VOC research')
      }
      const icpSummary = campaign.icp || 
        (campaign.icp_firmographics?.industry ? `${campaign.icp_firmographics.industry} companies` : `${campaign.industry} companies in ${campaign.geography || 'Australia'}`)
      return campaignApi.researchVOC(
        id!,
        icpSummary,
        '',
        '',
        campaign.additional_learnings || campaign.pain_points || ''
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', id] })
      queryClient.invalidateQueries({ queryKey: ['gap-analysis', id] })
    },
  })

  // Filter variants - MUST be before early returns (React hooks rule)
  const filteredVariants = useMemo(() => {
    if (!campaign?.variants) return []
    return campaign.variants.filter((v: Variant) => {
      if (!showArchived && v.archived) return false
      if (filterTouch !== 'all' && v.touch !== filterTouch) return false
      if (filterChunk !== 'all' && v.chunk !== filterChunk) return false
      if (filterStarred === 'starred' && !v.starred) return false
      return true
    })
  }, [campaign?.variants, showArchived, filterTouch, filterChunk, filterStarred])

  const starredCount = useMemo(() => {
    if (!campaign?.variants) return 0
    return campaign.variants.filter((v: Variant) => v.starred).length
  }, [campaign?.variants])

  // Group variants by base with chunked nested
  const variantGroups = useMemo(() => {
    const groups = new Map<string, { base: Variant; chunked: Variant[]; followup?: Variant }>()
    
    // First pass: find all base lead variants
    filteredVariants
      .filter(v => v.chunk === 'base' && v.touch === 'lead')
      .forEach(v => {
        groups.set(v.id, { base: v, chunked: [] })
      })
    
    // Second pass: attach chunked variants and followups to their base
    filteredVariants.forEach(v => {
      if (v.chunk !== 'base' && v.touch === 'lead') {
        // Find the base variant this was chunked from
        // Try multiple strategies to match chunked to base:
        // 1. Check if there's a lead_variant_id (for followups that were chunked)
        // 2. Match by angle, campaign_id, and created_at proximity
        let baseId: string | undefined
        
        // Strategy 1: Direct link (if chunked variant has lead_variant_id pointing to base)
        if (v.lead_variant_id && groups.has(v.lead_variant_id)) {
          baseId = v.lead_variant_id
        } else {
          // Strategy 2: Match by angle and campaign_id, prefer closest created_at
          const matchingBases = Array.from(groups.values())
            .filter(g => 
              g.base.angle === v.angle && 
              g.base.campaign_id === v.campaign_id &&
              g.base.chunk === 'base'
            )
            .sort((a, b) => {
              // Prefer base variant created closest to chunked variant
              const aTime = new Date(a.base.created_at).getTime()
              const bTime = new Date(b.base.created_at).getTime()
              const vTime = new Date(v.created_at).getTime()
              return Math.abs(aTime - vTime) - Math.abs(bTime - vTime)
            })
          
          if (matchingBases.length > 0) {
            baseId = matchingBases[0].base.id
          }
        }
        
        if (baseId && groups.has(baseId)) {
          groups.get(baseId)!.chunked.push(v)
        }
      } else if (v.touch === 'followup' && v.lead_variant_id) {
        // Attach followup to its lead variant
        if (groups.has(v.lead_variant_id)) {
          groups.get(v.lead_variant_id)!.followup = v
        }
      }
    })
    
    return Array.from(groups.values())
  }, [filteredVariants])

  // Legacy grouping for backward compatibility
  const leadVariants = useMemo(() => {
    return filteredVariants.filter((v: Variant) => v.touch === 'lead' && v.chunk === 'base')
  }, [filteredVariants])

  const followupMap = useMemo(() => {
    const map = new Map<string, Variant>()
    filteredVariants.forEach((v: Variant) => {
      if (v.touch === 'followup' && v.lead_variant_id) {
        map.set(v.lead_variant_id, v)
      }
    })
    return map
  }, [filteredVariants])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-accent-green animate-spin" />
      </div>
    )
  }

  if (error || !campaign) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Campaign not found</p>
        <Link to="/" className="text-accent-green hover:underline mt-2 inline-block">
          Back to campaigns
        </Link>
      </div>
    )
  }

  const processedDocs = (campaign.documents || []).filter((d) => d.processed === 1).length
  const coverageScore = gapAnalysis?.coverage_score || 0
  const showRecommended = coverageScore >= 50

  // Research readiness checks
  const hasICP = campaign.research_version !== null
  const hasVOC = campaign.voc_pain_themes && campaign.voc_pain_themes.length > 0
  const isStale = campaign.docs_last_processed_at && campaign.last_research_at &&
    new Date(campaign.docs_last_processed_at) > new Date(campaign.last_research_at)
  const canGenerate = hasICP && hasVOC && !isStale

  // Determine blocking reason
  const getBlockReason = () => {
    if (!hasICP) return "Run ICP research first"
    if (!hasVOC) return "Run Pain Points research first"
    if (isStale) return "Refresh research with new documents"
    return null
  }

  // Human-readable ICP summary
  const getICPSummary = (campaign: Campaign): string => {
    const parts = []
    
    if (campaign.icp_firmographics?.industry) {
      parts.push(campaign.icp_firmographics.industry)
    }
    if (campaign.icp_firmographics?.employee_range) {
      parts.push(`${campaign.icp_firmographics.employee_range} employees`)
    }
    if (campaign.icp_firmographics?.revenue_range_aud) {
      parts.push(campaign.icp_firmographics.revenue_range_aud)
    }
    if (campaign.geography) {
      parts.push(campaign.geography)
    }
    
    // Fallback to legacy ICP field if no structured data
    if (parts.length === 0 && campaign.icp) {
      return campaign.icp.substring(0, 150) + (campaign.icp.length > 150 ? '...' : '')
    }
    
    return parts.join(' • ') || 'No ICP defined'
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <Link
          to="/"
          className="flex items-center gap-2 text-text-light hover:text-primary transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to campaigns
        </Link>
        <h1 className="text-3xl font-bold text-primary font-display">{campaign.name}</h1>
        <p className="text-text-light mt-1 max-w-2xl line-clamp-2">{getICPSummary(campaign)}</p>
        <div className="h-1 w-20 bg-accent-green mt-3"></div>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div></div>

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
                  className="flex items-center gap-2 px-4 py-2 bg-surface border border-surface-gray border-r-0 text-primary font-medium rounded-l-lg hover:border-accent-green transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
                <select
                  value={exportMode}
                  onChange={(e) => setExportMode(e.target.value as 'all' | 'starred')}
                  className="px-3 py-2 bg-surface border border-surface-gray border-l-0 text-sm text-primary rounded-r-lg hover:border-accent-green focus:border-accent-green focus:outline-none cursor-pointer transition-all"
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
          <div className="flex flex-col items-end gap-2">
            {isGenerating && (
              <div className="text-right space-y-1 min-w-[200px]">
                <div className="text-xs text-text-light">{progressStage || 'Generating...'}</div>
                {progressTotal > 0 && (
                  <>
                    <div className="text-xs text-accent-green font-medium">
                      {progressCurrent}/{progressTotal} variants
                    </div>
                    <div className="w-full bg-surface-light rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-accent-green h-full transition-all duration-300"
                        style={{ width: `${(progressCurrent / progressTotal) * 100}%` }}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
            <button
              onClick={handleGenerate}
              disabled={!canGenerate || isGenerating}
              title={getBlockReason() || "Generate email variants"}
              className={`flex items-center gap-2 px-5 py-2.5 bg-accent-green text-primary font-medium rounded-lg hover:bg-accent-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all relative ${
                showRecommended ? 'pr-24' : ''
              }`}
            >
              {isGenerating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
              Generate Variants
              {showRecommended && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-0.5 bg-green-600 text-white text-xs font-medium rounded">
                  <CheckCircle2 className="w-3 h-3" />
                  Recommended
                </span>
              )}
            </button>
            <button
              onClick={() => setShowGenerationPanel(true)}
              disabled={!canGenerate}
              title={getBlockReason() || "Generate custom variants"}
              className="flex items-center gap-2 px-5 py-2.5 bg-surface border border-accent-green text-accent-green font-medium rounded-lg hover:bg-accent-green/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Sparkles className="w-5 h-5" />
              Generate Custom
            </button>
            {!canGenerate && (
              <p className="text-amber-600 text-xs text-right max-w-xs">
                {getBlockReason()}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface rounded-xl border border-surface-gray shadow-sm p-4">
          <div className="flex items-center gap-2 text-text-light mb-1">
            <FileText className="w-4 h-4" />
            <span className="text-xs">Documents</span>
          </div>
          <p className="text-2xl font-bold text-primary">{campaign.documents?.length || 0}</p>
          <p className="text-xs text-text-muted">{processedDocs} processed</p>
        </div>
        <div className="bg-surface rounded-xl border border-surface-gray shadow-sm p-4">
          <div className="flex items-center gap-2 text-text-light mb-1">
            <MessageSquare className="w-4 h-4" />
            <span className="text-xs">Variants</span>
          </div>
          <p className="text-2xl font-bold text-primary">{campaign.variants?.length || 0}</p>
          <p className="text-xs text-text-muted">
            {campaign.variants?.filter((v: Variant) => v.qa_pass).length || 0} QA passed
          </p>
        </div>
        <div className="bg-surface rounded-xl border border-surface-gray shadow-sm p-4">
          <div className="flex items-center gap-2 text-text-light mb-1">
            <span className="text-xs">Lead Variants</span>
          </div>
          <p className="text-2xl font-bold text-accent-green">
            {campaign.variants?.filter((v: Variant) => v.touch === 'lead').length || 0}
          </p>
        </div>
        <div className="bg-surface rounded-xl border border-surface-gray shadow-sm p-4">
          <div className="flex items-center gap-2 text-text-light mb-1">
            <span className="text-xs">Follow-ups</span>
          </div>
          <p className="text-2xl font-bold text-accent-green">
            {campaign.variants?.filter((v: Variant) => v.touch === 'followup').length || 0}
          </p>
        </div>
      </div>

      {/* Legacy Upgrade Banner */}
      {campaign && <LegacyUpgradeBanner campaign={campaign} />}

      {/* Gap Analysis - Always Visible */}
      {id && campaign && (
        <GapAnalysis
          campaignId={id}
          campaign={campaign}
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
          onResearchComplete={() => {
            queryClient.invalidateQueries({ queryKey: ['campaign', id] })
          }}
        />
      )}

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-surface-gray mb-6">
        <button
          onClick={() => setActiveTab('documents')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${
            activeTab === 'documents'
              ? 'border-accent-green text-primary font-medium'
              : 'border-transparent text-text-light hover:text-primary'
          }`}
        >
          <FileText className="w-4 h-4" />
          Documents
        </button>
        <button
          onClick={() => setActiveTab('variants')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${
            activeTab === 'variants'
              ? 'border-accent-green text-primary font-medium'
              : 'border-transparent text-text-light hover:text-primary'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Variants
        </button>
        <button
          onClick={() => setActiveTab('more')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${
            activeTab === 'more'
              ? 'border-accent-green text-primary font-medium'
              : 'border-transparent text-text-light hover:text-primary'
          }`}
        >
          <span className="text-sm">⚙️</span>
          More
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'documents' ? (
        <div>
          <div className="mb-6">
            <h3 className="text-lg font-medium text-primary mb-2">Knowledge Bank</h3>
            <p className="text-sm text-text-light">
              Upload documents to build context for generation. Tag them so the AI knows what they are.
            </p>
          </div>
          <DocumentUploader
            campaignId={campaign.id}
            campaign={campaign}
            documents={campaign.documents || []}
            preSelectedDocType={preSelectedDocType}
            onUploadComplete={() => {
              // Clear pre-selected doc type
              setPreSelectedDocType(undefined)
              // Refresh campaign and gap analysis after upload
              queryClient.invalidateQueries({ queryKey: ['campaign', id] })
              queryClient.invalidateQueries({ queryKey: ['gap-analysis', id] })
            }}
            onRunICPResearch={() => icpResearchMutation.mutate()}
            onRunVOCResearch={() => vocResearchMutation.mutate()}
            isICPResearchPending={icpResearchMutation.isPending}
            isVOCResearchPending={vocResearchMutation.isPending}
          />
        </div>
      ) : activeTab === 'more' ? (
        <CampaignSettings campaign={campaign} campaignId={campaign.id} />
      ) : (
        <div>
          {/* Filters */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-text-light" />
              <span className="text-sm text-text-light">Filter:</span>
            </div>
            <select
              value={filterTouch}
              onChange={(e) => setFilterTouch(e.target.value as FilterTouch)}
              className="px-3 py-1.5 bg-surface border border-surface-gray rounded-lg text-sm text-primary focus:border-accent-green"
            >
              <option value="all">All touches</option>
              <option value="lead">Lead only</option>
              <option value="followup">Follow-up only</option>
            </select>
            <select
              value={filterChunk}
              onChange={(e) => setFilterChunk(e.target.value as FilterChunk)}
              className="px-3 py-1.5 bg-surface border border-surface-gray rounded-lg text-sm text-primary focus:border-accent-green"
            >
              <option value="all">All chunks</option>
              <option value="base">Base only</option>
              <option value="up">Chunk up</option>
              <option value="down">Chunk down</option>
            </select>
            <select
              value={filterStarred}
              onChange={(e) => setFilterStarred(e.target.value as FilterStarred)}
              className="px-3 py-1.5 bg-surface border border-surface-gray rounded-lg text-sm text-primary focus:border-accent-green"
            >
              <option value="all">All variants</option>
              <option value="starred">
                Starred only {starredCount > 0 && `(${starredCount})`}
              </option>
            </select>
            <label className="flex items-center gap-2 text-sm text-text-light cursor-pointer">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="w-4 h-4 text-accent-green border-surface-gray rounded focus:ring-accent-green"
              />
              Show Archived
            </label>

            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm text-text-light">Generate:</span>
              <select
                value={numVariants}
                onChange={(e) => setNumVariants(Number(e.target.value))}
                className="px-3 py-1.5 bg-surface border border-surface-gray rounded-lg text-sm text-primary focus:border-accent-green"
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
                // Show grouped variants: base with chunked nested below
                variantGroups.map((group) => (
                  <div key={group.base.id} className="space-y-3">
                    <VariantCard
                      variant={group.base}
                      linkedVariant={group.followup}
                      chunkedVariants={group.chunked}
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
            <div className="text-center py-16 bg-surface rounded-xl border border-surface-gray shadow-sm">
              <MessageSquare className="w-12 h-12 text-text-light mx-auto mb-4" />
              <h3 className="text-lg font-medium text-primary mb-2">No variants yet</h3>
              <p className="text-text-light mb-6">
                Click "Generate Variants" to create email copy
              </p>
            </div>
          )}
        </div>
      )}

      {/* Generation Side Panel */}
      {campaign && (
        <GenerationSidePanel
          campaignId={campaign.id}
          isOpen={showGenerationPanel}
          onClose={() => setShowGenerationPanel(false)}
          onSuccess={async () => {
            await queryClient.refetchQueries({ queryKey: ['campaign', id] })
            setActiveTab('variants')
          }}
        />
      )}
    </div>
  )
}
