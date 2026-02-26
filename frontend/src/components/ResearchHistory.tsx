import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { History, GitCompare, Loader2, ChevronRight, Calendar, ChevronDown, Download, Eye } from 'lucide-react'
import { campaignApi, documentApi } from '../api/client'
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
  const [expandedEntries, setExpandedEntries] = useState<Set<number>>(new Set())

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
        <Loader2 className="w-6 h-6 text-accent-green animate-spin" />
      </div>
    )
  }

  if (!historyData) {
    return (
      <div className="bg-surface rounded-xl border border-surface-gray p-6">
        <div className="text-center py-8">
          <History className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-medium text-primary mb-2">Unable to Load Research History</h3>
          <p className="text-text-light text-sm">
            There was an error loading the research history. Please try refreshing the page.
          </p>
        </div>
      </div>
    )
  }

  if (!historyData.history || historyData.history.length === 0) {
    return (
      <div className="bg-surface rounded-xl border border-surface-gray p-6">
        <div className="text-center py-8">
          <History className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-medium text-primary mb-2">No Research History</h3>
          <p className="text-text-light text-sm">
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
          <History className="w-5 h-5 text-accent-green" />
          <h3 className="text-lg font-bold text-primary">Research History</h3>
          {historyData.current_version && (
            <span className="px-2 py-1 text-xs font-medium rounded bg-accent-green/20 text-accent-green">
              Current: v{historyData.current_version}
            </span>
          )}
        </div>
      </div>

      {/* Version Selection for Comparison */}
      {historyData.history.length > 1 && (
        <div className="bg-surface rounded-xl border border-surface-gray p-4">
          <div className="flex items-center gap-4">
            <GitCompare className="w-4 h-4 text-text-light" />
            <span className="text-sm text-text-light">Compare versions:</span>
            <select
              value={selectedVersions.v1 || ''}
              onChange={(e) => setSelectedVersions({ ...selectedVersions, v1: e.target.value ? Number(e.target.value) : null })}
              className="px-3 py-1.5 bg-surface border border-surface-gray rounded-lg text-sm text-primary focus:border-accent-green"
            >
              <option value="">Select version...</option>
              {historyData.history.map((entry) => (
                <option key={entry.version} value={entry.version}>
                  v{entry.version}
                </option>
              ))}
            </select>
            <span className="text-text-light">vs</span>
            <select
              value={selectedVersions.v2 || ''}
              onChange={(e) => setSelectedVersions({ ...selectedVersions, v2: e.target.value ? Number(e.target.value) : null })}
              className="px-3 py-1.5 bg-surface border border-surface-gray rounded-lg text-sm text-primary focus:border-accent-green"
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
              className="px-4 py-1.5 bg-accent-green text-primary text-sm font-medium rounded-lg hover:bg-accent-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Compare
            </button>
          </div>
        </div>
      )}

      {/* Diff View */}
      {showDiff && diffData && (
        <div className="bg-surface rounded-xl border border-surface-gray p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-md font-bold text-primary">Version Comparison</h4>
            <button
              onClick={() => {
                setShowDiff(false)
                setSelectedVersions({ v1: null, v2: null })
              }}
              className="text-text-light hover:text-primary text-sm"
            >
              Close
            </button>
          </div>
          {diffLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-accent-green animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-surface rounded-lg border border-surface-gray">
                  <div className="text-xs text-text-light mb-2">Version {diffData.v1.version}</div>
                  <div className="text-sm text-primary font-medium">{diffData.v1.summary}</div>
                  <div className="text-xs text-text-light mt-1">{formatDate(diffData.v1.timestamp)}</div>
                </div>
                <div className="p-4 bg-surface rounded-lg border border-surface-gray">
                  <div className="text-xs text-text-light mb-2">Version {diffData.v2.version}</div>
                  <div className="text-sm text-primary font-medium">{diffData.v2.summary}</div>
                  <div className="text-xs text-text-light mt-1">{formatDate(diffData.v2.timestamp)}</div>
                </div>
              </div>
              {diffData.note && (
                <div className="p-3 bg-zinc-500/10 border border-zinc-500/30 rounded-lg">
                  <p className="text-xs text-text-light">{diffData.note}</p>
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
      <div className="bg-surface rounded-xl border border-surface-gray overflow-hidden">
        <div className="divide-y divide-surface-gray">
          {historyData.history
            .sort((a, b) => b.version - a.version)
            .map((entry) => {
              const isExpanded = expandedEntries.has(entry.version)
              const toggleExpand = () => {
                const newSet = new Set(expandedEntries)
                if (isExpanded) {
                  newSet.delete(entry.version)
                } else {
                  newSet.add(entry.version)
                }
                setExpandedEntries(newSet)
              }
              
              return (
                <div
                  key={entry.version}
                  className={`${entry.version === historyData.current_version ? 'bg-accent-green/5' : ''}`}
                >
                  <div
                    className="p-4 hover:bg-surface-light transition-colors cursor-pointer"
                    onClick={toggleExpand}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="mt-1">
                          <span className="text-lg">{getTypeIcon(entry.type)}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-primary">
                              Version {entry.version}
                              {entry.version === historyData.current_version && (
                                <span className="ml-2 px-1.5 py-0.5 text-xs rounded bg-accent-green/20 text-accent-green">
                                  Current
                                </span>
                              )}
                            </span>
                            <span className="text-xs text-text-light">{getTypeLabel(entry)}</span>
                          </div>
                          <p className="text-sm text-text-light mb-2">{entry.summary}</p>
                          <div className="flex items-center gap-2 text-xs text-text-light">
                            <Calendar className="w-3 h-3" />
                            <span>{formatDate(entry.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-text-muted" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-text-muted" />
                      )}
                    </div>
                  </div>
                  
                  {/* Expanded Summary */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-surface-gray bg-surface-light">
                      <div className="pt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium text-primary">Research Summary</h4>
                          {(entry as any).document_id && (
                            <div className="flex items-center gap-2">
                              <a
                                href={documentApi.downloadUrl((entry as any).document_id)}
                                download
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-accent-green hover:bg-accent-green/10 rounded transition-colors"
                              >
                                <Download className="w-3 h-3" />
                                Download Report
                              </a>
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-text-light space-y-1">
                          <p><strong>Type:</strong> {getTypeLabel(entry)}</p>
                          <p><strong>Summary:</strong> {entry.summary || 'No summary available'}</p>
                          <p><strong>Timestamp:</strong> {entry.timestamp ? formatDate(entry.timestamp) : 'Unknown'}</p>
                          {(entry as any).document_id ? (
                            <p className="text-accent-green">
                              <strong>Document:</strong> Available in Knowledge Bank
                            </p>
                          ) : (
                            <p className="text-text-muted">
                              <strong>Document:</strong> No document available
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      </div>

      {historyData.last_research_at && (
        <div className="text-xs text-text-light text-center">
          Last research: {formatDate(historyData.last_research_at)}
        </div>
      )}
    </div>
  )
}
