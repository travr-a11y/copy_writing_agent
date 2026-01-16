import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { History, GitCompare, Loader2, ChevronRight, Calendar } from 'lucide-react'
import { campaignApi } from '../api/client'
import type { ResearchHistoryResponse, ResearchHistoryEntry, ResearchDiffResponse } from '../types'

interface ResearchHistoryProps {
  campaignId: string
}

export default function ResearchHistory({ campaignId }: ResearchHistoryProps) {
  const [selectedVersions, setSelectedVersions] = useState<{ v1: number | null; v2: number | null }>({
    v1: null,
    v2: null,
  })
  const [showDiff, setShowDiff] = useState(false)

  const { data: historyData, isLoading } = useQuery<ResearchHistoryResponse>({
    queryKey: ['research-history', campaignId],
    queryFn: () => campaignApi.getResearchHistory(campaignId),
  })

  const { data: diffData, isLoading: diffLoading } = useQuery<ResearchDiffResponse | null>({
    queryKey: ['research-diff', campaignId, selectedVersions.v1, selectedVersions.v2],
    queryFn: () => {
      if (selectedVersions.v1 && selectedVersions.v2) {
        return campaignApi.getResearchDiff(campaignId, selectedVersions.v1, selectedVersions.v2)
      }
      return null
    },
    enabled: showDiff && selectedVersions.v1 !== null && selectedVersions.v2 !== null,
  })

  const handleCompare = () => {
    if (selectedVersions.v1 && selectedVersions.v2) {
      setShowDiff(true)
    }
  }

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'icp':
        return '👤'
      case 'voc':
        return '💬'
      case 'refinement':
        return '✨'
      default:
        return '📊'
    }
  }

  const getTypeLabel = (entry: ResearchHistoryEntry) => {
    if (entry.type === 'refinement') {
      const parts = []
      if (entry.refined_icp) parts.push('ICP')
      if (entry.refined_voc) parts.push('VOC')
      return `Refined ${parts.join(' + ')}`
    }
    return entry.type === 'icp' ? 'ICP Research' : 'VOC Research'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-accent-electric animate-spin" />
      </div>
    )
  }

  if (!historyData || !historyData.history || historyData.history.length === 0) {
    return (
      <div className="bg-surface-light rounded-xl border border-surface-lighter p-6">
        <div className="text-center py-8">
          <History className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No Research History</h3>
          <p className="text-zinc-500 text-sm">
            Research history will appear here after you run ICP or VOC research.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <History className="w-5 h-5 text-accent-electric" />
          <h3 className="text-lg font-bold text-white">Research History</h3>
          {historyData.current_version && (
            <span className="px-2 py-1 text-xs font-medium rounded bg-accent-electric/20 text-accent-electric">
              Current: v{historyData.current_version}
            </span>
          )}
        </div>
      </div>

      {/* Version Selection for Comparison */}
      {historyData.history.length > 1 && (
        <div className="bg-surface-light rounded-xl border border-surface-lighter p-4">
          <div className="flex items-center gap-4">
            <GitCompare className="w-4 h-4 text-zinc-400" />
            <span className="text-sm text-zinc-400">Compare versions:</span>
            <select
              value={selectedVersions.v1 || ''}
              onChange={(e) => setSelectedVersions({ ...selectedVersions, v1: e.target.value ? Number(e.target.value) : null })}
              className="px-3 py-1.5 bg-surface border border-surface-lighter rounded-lg text-sm text-white focus:border-accent-electric"
            >
              <option value="">Select version...</option>
              {historyData.history.map((entry) => (
                <option key={entry.version} value={entry.version}>
                  v{entry.version}
                </option>
              ))}
            </select>
            <span className="text-zinc-500">vs</span>
            <select
              value={selectedVersions.v2 || ''}
              onChange={(e) => setSelectedVersions({ ...selectedVersions, v2: e.target.value ? Number(e.target.value) : null })}
              className="px-3 py-1.5 bg-surface border border-surface-lighter rounded-lg text-sm text-white focus:border-accent-electric"
            >
              <option value="">Select version...</option>
              {historyData.history.map((entry) => (
                <option key={entry.version} value={entry.version}>
                  v{entry.version}
                </option>
              ))}
            </select>
            <button
              onClick={handleCompare}
              disabled={!selectedVersions.v1 || !selectedVersions.v2 || selectedVersions.v1 === selectedVersions.v2}
              className="px-4 py-1.5 bg-accent-electric text-surface-dark text-sm font-medium rounded-lg hover:bg-accent-electric/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Compare
            </button>
          </div>
        </div>
      )}

      {/* Diff View */}
      {showDiff && diffData && (
        <div className="bg-surface-light rounded-xl border border-surface-lighter p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-md font-bold text-white">Version Comparison</h4>
            <button
              onClick={() => {
                setShowDiff(false)
                setSelectedVersions({ v1: null, v2: null })
              }}
              className="text-zinc-400 hover:text-white text-sm"
            >
              Close
            </button>
          </div>
          {diffLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-accent-electric animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-surface rounded-lg border border-surface-lighter">
                  <div className="text-xs text-zinc-400 mb-2">Version {diffData.v1.version}</div>
                  <div className="text-sm text-white font-medium">{diffData.v1.summary}</div>
                  <div className="text-xs text-zinc-500 mt-1">{formatDate(diffData.v1.timestamp)}</div>
                </div>
                <div className="p-4 bg-surface rounded-lg border border-surface-lighter">
                  <div className="text-xs text-zinc-400 mb-2">Version {diffData.v2.version}</div>
                  <div className="text-sm text-white font-medium">{diffData.v2.summary}</div>
                  <div className="text-xs text-zinc-500 mt-1">{formatDate(diffData.v2.timestamp)}</div>
                </div>
              </div>
              {diffData.note && (
                <div className="p-3 bg-zinc-500/10 border border-zinc-500/30 rounded-lg">
                  <p className="text-xs text-zinc-400">{diffData.note}</p>
                </div>
              )}
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-sm text-blue-400">{diffData.summary}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* History List */}
      <div className="bg-surface-light rounded-xl border border-surface-lighter overflow-hidden">
        <div className="divide-y divide-surface-lighter">
          {historyData.history
            .sort((a, b) => b.version - a.version)
            .map((entry) => (
              <div
                key={entry.version}
                className={`p-4 hover:bg-surface transition-colors ${
                  entry.version === historyData.current_version ? 'bg-accent-electric/5' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-1">
                      <span className="text-lg">{getTypeIcon(entry.type)}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white">
                          Version {entry.version}
                          {entry.version === historyData.current_version && (
                            <span className="ml-2 px-1.5 py-0.5 text-xs rounded bg-accent-electric/20 text-accent-electric">
                              Current
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-zinc-500">{getTypeLabel(entry)}</span>
                      </div>
                      <p className="text-sm text-zinc-400 mb-2">{entry.summary}</p>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(entry.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600" />
                </div>
              </div>
            ))}
        </div>
      </div>

      {historyData.last_research_at && (
        <div className="text-xs text-zinc-500 text-center">
          Last research: {formatDate(historyData.last_research_at)}
        </div>
      )}
    </div>
  )
}
