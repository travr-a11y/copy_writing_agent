import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, FileText, MessageSquare, Award, Phone, Linkedin, AlertTriangle, CheckCircle2, Loader2, TrendingUp, ChevronDown, ChevronUp, RefreshCw, Sparkles } from 'lucide-react'
import { campaignApi } from '../api/client'
import type { GapAnalysis, Gap, Campaign } from '../types'

interface GapAnalysisProps {
  campaignId: string
  campaign: Campaign
  onUploadClick: (category: string, docType: string) => void
  onResearchComplete?: () => void
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  voice_samples: <FileText className="w-5 h-5" />,
  voc: <MessageSquare className="w-5 h-5" />,
  testimonials: <Award className="w-5 h-5" />,
  call_transcripts: <Phone className="w-5 h-5" />,
  linkedin_social: <Linkedin className="w-5 h-5" />,
  objection_handling: <AlertTriangle className="w-5 h-5" />,
  competitor_context: <TrendingUp className="w-5 h-5" />,
}

const CATEGORY_DOC_TYPES: Record<string, string> = {
  voice_samples: 'voice',
  voc: 'voc',
  testimonials: 'campaign_context',
  call_transcripts: 'voice',
  linkedin_social: 'voice',
  objection_handling: 'campaign_context',
  competitor_context: 'campaign_context',
}

const PRIORITY_COLORS = {
  high: 'border-red-300 bg-red-50',
  medium: 'border-amber-300 bg-amber-50',
  low: 'border-surface-gray bg-surface-light',
}

export default function GapAnalysis({ campaignId, campaign, onUploadClick, onResearchComplete }: GapAnalysisProps) {
  const queryClient = useQueryClient()
  
  const { data: analysis, isLoading } = useQuery({
    queryKey: ['gap-analysis', campaignId],
    queryFn: () => campaignApi.analyzeGaps(campaignId),
    staleTime: 0, // Always refetch when query is invalidated
  })

  const refreshMutation = useMutation({
    mutationFn: () => campaignApi.analyzeGaps(campaignId, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gap-analysis', campaignId] })
    },
  })

  // Research status checks
  const hasICP = campaign.research_version !== null
  const hasVOC = campaign.voc_pain_themes && campaign.voc_pain_themes.length > 0
  const isStale = campaign.docs_last_processed_at && campaign.last_research_at &&
    new Date(campaign.docs_last_processed_at) > new Date(campaign.last_research_at)

  // Research mutations
  const fullResearchMutation = useMutation({
    mutationFn: () => {
      if (!campaign.industry) {
        throw new Error('Industry is required to run research')
      }
      return campaignApi.researchFull(
        campaignId,
        campaign.industry,
        campaign.geography || 'Australia',
        campaign.service_offering || '',
        campaign.additional_learnings || '',
        '',
        ''
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
      queryClient.invalidateQueries({ queryKey: ['gap-analysis', campaignId] })
      onResearchComplete?.()
    },
  })

  const icpResearchMutation = useMutation({
    mutationFn: () => {
      if (!campaign.industry) {
        throw new Error('Industry is required to run ICP research')
      }
      return campaignApi.researchICP(
        campaignId,
        campaign.industry,
        campaign.geography || 'Australia',
        campaign.service_offering || '',
        campaign.additional_learnings || ''
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
      queryClient.invalidateQueries({ queryKey: ['gap-analysis', campaignId] })
      onResearchComplete?.()
    },
  })

  const vocResearchMutation = useMutation({
    mutationFn: () => {
      if (!campaign.industry) {
        throw new Error('Industry is required to run VOC research')
      }
      const icpSummary = campaign.icp || 
        (campaign.icp_firmographics?.industry ? `${campaign.icp_firmographics.industry} companies` : `${campaign.industry} companies in ${campaign.geography || 'Australia'}`)
      return campaignApi.researchVOC(
        campaignId,
        icpSummary,
        '',
        '',
        campaign.additional_learnings || ''
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
      queryClient.invalidateQueries({ queryKey: ['gap-analysis', campaignId] })
      onResearchComplete?.()
    },
  })

  const formatTimeAgo = (isoString: string | undefined): string => {
    if (!isoString) return 'Unknown'
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  }

  // Smart default: expanded when coverage < 80%, collapsed when >= 80%
  const smartDefault = analysis ? analysis.coverage_score < 80 : true
  
  // Check localStorage for manual override
  const storageKey = `gap-analysis-collapsed-${campaignId}`
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    const stored = localStorage.getItem(storageKey)
    if (stored !== null) {
      return stored === 'true'
    }
    return !smartDefault
  })

  // Update collapsed state when analysis changes (smart default)
  useEffect(() => {
    const stored = localStorage.getItem(storageKey)
    if (stored === null && analysis) {
      setIsCollapsed(analysis.coverage_score >= 80)
    }
  }, [analysis, storageKey])

  const toggleCollapsed = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem(storageKey, String(newState))
  }

  if (isLoading) {
    return (
      <div className="bg-surface rounded-2xl border border-surface-gray p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-accent-green animate-spin mr-3" />
          <span className="text-text-light">Analyzing knowledge bank...</span>
        </div>
      </div>
    )
  }

  if (!analysis) {
    return null
  }

  const highPriorityGaps = analysis.gaps.filter((g) => g.priority === 'high')
  const mediumPriorityGaps = analysis.gaps.filter((g) => g.priority === 'medium')
  const lowPriorityGaps = analysis.gaps.filter((g) => g.priority === 'low')
  const coveredCategories = 7 - analysis.gaps.length // Assuming 7 total categories

  return (
    <div className="bg-surface rounded-2xl border border-surface-gray p-6 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-lg font-bold text-primary font-display">Improve Your Copy</h3>
            <button
              onClick={toggleCollapsed}
              className="p-1 text-text-light hover:text-primary hover:bg-surface rounded-lg transition-colors"
              title={isCollapsed ? 'Expand' : 'Collapse'}
            >
              {isCollapsed ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
            </button>
          </div>
          {isCollapsed ? (
            <p className="text-sm text-text-light">
              {coveredCategories} of 7 categories covered
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-sm text-text-light">
                {coveredCategories} of 7 categories covered
              </p>
              {analysis.analyzed_at && (
                <span className="text-xs text-text-muted">
                  • Last analyzed: {formatTimeAgo(analysis.analyzed_at)}
                  {analysis.cached && ' (cached)'}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            className="p-2 text-text-light hover:text-accent-green hover:bg-accent-green/10 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh analysis"
          >
            <RefreshCw className={`w-4 h-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
          </button>
          <span className="text-sm text-text-light">Coverage:</span>
          <div className="flex items-center gap-2">
            <div className="w-32 h-2 bg-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent-green to-accent-green transition-all duration-500"
                style={{ width: `${analysis.coverage_score}%` }}
              />
            </div>
            <span className="text-sm font-medium text-primary w-12 text-right">
              {analysis.coverage_score}%
            </span>
          </div>
        </div>
      </div>

      {/* Collapsible Content */}
      {!isCollapsed && (
        <div className="mt-6 animate-fade-in">
          
          {/* Research Status Banners */}
          {!hasICP && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <div>
                    <p className="text-sm font-medium text-red-600">ICP Research Required</p>
                    <p className="text-xs text-text-light mt-1">Run research to generate variants</p>
                  </div>
                </div>
                <button
                  onClick={() => fullResearchMutation.mutate()}
                  disabled={fullResearchMutation.isPending || !campaign.industry}
                  className="flex items-center gap-2 px-4 py-2 bg-accent-green text-primary font-medium text-sm rounded-lg hover:bg-accent-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {fullResearchMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Run Research
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {hasICP && !hasVOC && (
            <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/50 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="text-sm font-medium text-amber-600">Pain Points Research Required</p>
                    <p className="text-xs text-text-light mt-1">Run Pain Points research to generate variants</p>
                  </div>
                </div>
                <button
                  onClick={() => vocResearchMutation.mutate()}
                  disabled={vocResearchMutation.isPending || !campaign.industry}
                  className="flex items-center gap-2 px-4 py-2 bg-accent-green text-primary font-medium text-sm rounded-lg hover:bg-accent-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {vocResearchMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Run Pain Points Research
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {hasICP && hasVOC && isStale && (
            <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/50 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <RefreshCw className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-blue-600">New Documents Available</p>
                    <p className="text-xs text-text-light mt-1">Refresh research to include new documents</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => icpResearchMutation.mutate()}
                    disabled={icpResearchMutation.isPending || !campaign.industry}
                    className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-surface-gray text-primary font-medium text-sm rounded-lg hover:border-accent-green disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {icpResearchMutation.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      'Refresh ICP'
                    )}
                  </button>
                  <button
                    onClick={() => vocResearchMutation.mutate()}
                    disabled={vocResearchMutation.isPending || !campaign.industry}
                    className="flex items-center gap-2 px-3 py-1.5 bg-accent-green text-primary font-medium text-sm rounded-lg hover:bg-accent-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {vocResearchMutation.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      'Refresh Pain Points'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

      {/* High Priority Gaps */}
      {highPriorityGaps.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span className="text-sm font-medium text-red-600">HIGH PRIORITY</span>
          </div>
          <div className="space-y-3">
            {highPriorityGaps.map((gap, index) => (
              <GapCard key={index} gap={gap} onUploadClick={onUploadClick} />
            ))}
          </div>
        </div>
      )}

      {/* Medium Priority Gaps */}
      {mediumPriorityGaps.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-medium text-amber-600">MEDIUM PRIORITY</span>
          </div>
          <div className="space-y-3">
            {mediumPriorityGaps.map((gap, index) => (
              <GapCard key={index} gap={gap} onUploadClick={onUploadClick} />
            ))}
          </div>
        </div>
      )}

      {/* Low Priority Gaps */}
      {lowPriorityGaps.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-medium text-text-light">LOW PRIORITY</span>
          </div>
          <div className="space-y-3">
            {lowPriorityGaps.map((gap, index) => (
              <GapCard key={index} gap={gap} onUploadClick={onUploadClick} />
            ))}
          </div>
        </div>
      )}

      {/* Strengths */}
      {analysis.strengths && analysis.strengths.length > 0 && (
        <div className="pt-4 border-t border-surface-gray">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-600">COVERED</span>
          </div>
          <ul className="space-y-1">
            {analysis.strengths.map((strength, index) => (
              <li key={index} className="text-sm text-text-light flex items-start gap-2">
                <span className="text-green-600 mt-0.5">•</span>
                <span>{strength}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
        </div>
      )}
    </div>
  )
}

function GapCard({ gap, onUploadClick }: { gap: Gap; onUploadClick: (category: string, docType: string) => void }) {
  const icon = CATEGORY_ICONS[gap.category] || <FileText className="w-5 h-5" />
  const docType = CATEGORY_DOC_TYPES[gap.category] || 'campaign_context'
  const priorityColor = PRIORITY_COLORS[gap.priority] || PRIORITY_COLORS.low

  return (
    <div className={`p-4 rounded-xl border ${priorityColor}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div className="text-text-light mt-0.5">{icon}</div>
          <div className="flex-1">
            <h4 className="text-sm font-medium text-primary mb-1">{gap.title}</h4>
            <p className="text-xs text-text-light mb-2">{gap.description}</p>
            <p className="text-xs text-text-light italic">{gap.suggestion}</p>
          </div>
        </div>
        <button
          onClick={() => onUploadClick(gap.category, docType)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-accent-green text-primary rounded-lg hover:bg-accent-green/90 transition-all ml-4"
        >
          <Upload className="w-3 h-3" />
          Upload
        </button>
      </div>
    </div>
  )
}
