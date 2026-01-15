import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, FileText, MessageSquare, Award, Phone, Linkedin, AlertTriangle, CheckCircle2, Loader2, TrendingUp, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { campaignApi } from '../api/client'
import type { GapAnalysis, Gap } from '../types'

interface GapAnalysisProps {
  campaignId: string
  onUploadClick: (category: string, docType: string) => void
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
  high: 'border-red-500/50 bg-red-500/10',
  medium: 'border-amber-500/50 bg-amber-500/10',
  low: 'border-zinc-500/50 bg-zinc-500/10',
}

export default function GapAnalysis({ campaignId, onUploadClick }: GapAnalysisProps) {
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
      <div className="bg-surface-light rounded-2xl border border-surface-lighter p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-accent-electric animate-spin mr-3" />
          <span className="text-zinc-400">Analyzing knowledge bank...</span>
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
    <div className="bg-surface-light rounded-2xl border border-surface-lighter p-6 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-lg font-bold text-white font-display">Improve Your Copy</h3>
            <button
              onClick={toggleCollapsed}
              className="p-1 text-zinc-500 hover:text-white hover:bg-surface rounded-lg transition-colors"
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
            <p className="text-sm text-zinc-500">
              {coveredCategories} of 7 categories covered
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-sm text-zinc-500">
                {coveredCategories} of 7 categories covered
              </p>
              {analysis.analyzed_at && (
                <span className="text-xs text-zinc-600">
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
            className="p-2 text-zinc-500 hover:text-accent-electric hover:bg-accent-electric/10 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh analysis"
          >
            <RefreshCw className={`w-4 h-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
          </button>
          <span className="text-sm text-zinc-400">Coverage:</span>
          <div className="flex items-center gap-2">
            <div className="w-32 h-2 bg-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent-electric to-accent-coral transition-all duration-500"
                style={{ width: `${analysis.coverage_score}%` }}
              />
            </div>
            <span className="text-sm font-medium text-white w-12 text-right">
              {analysis.coverage_score}%
            </span>
          </div>
        </div>
      </div>

      {/* Collapsible Content */}
      {!isCollapsed && (
        <div className="mt-6 animate-fade-in">

      {/* High Priority Gaps */}
      {highPriorityGaps.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-medium text-red-400">HIGH PRIORITY</span>
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
            <span className="text-sm font-medium text-amber-400">MEDIUM PRIORITY</span>
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
            <span className="text-sm font-medium text-zinc-500">LOW PRIORITY</span>
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
        <div className="pt-4 border-t border-surface-lighter">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium text-green-400">COVERED</span>
          </div>
          <ul className="space-y-1">
            {analysis.strengths.map((strength, index) => (
              <li key={index} className="text-sm text-zinc-400 flex items-start gap-2">
                <span className="text-green-400 mt-0.5">•</span>
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
          <div className="text-zinc-400 mt-0.5">{icon}</div>
          <div className="flex-1">
            <h4 className="text-sm font-medium text-white mb-1">{gap.title}</h4>
            <p className="text-xs text-zinc-400 mb-2">{gap.description}</p>
            <p className="text-xs text-zinc-500 italic">{gap.suggestion}</p>
          </div>
        </div>
        <button
          onClick={() => onUploadClick(gap.category, docType)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-accent-electric text-surface-dark rounded-lg hover:bg-accent-electric/90 transition-all ml-4"
        >
          <Upload className="w-3 h-3" />
          Upload
        </button>
      </div>
    </div>
  )
}
