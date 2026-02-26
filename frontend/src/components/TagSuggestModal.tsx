import { useState, useEffect } from 'react'
import { X, Loader2, Wand2, Check } from 'lucide-react'
import type { Document, TagSuggestion } from '../types'

interface TagSuggestModalProps {
  document: Document
  suggestions: TagSuggestion | null
  isLoading: boolean
  onApply: (tags: Partial<Document>) => void
  onClose: () => void
}

const DOC_TYPES = ['voice', 'voc', 'campaign_context']
const CHANNELS = ['email', 'linkedin', 'call']

export default function TagSuggestModal({
  document,
  suggestions,
  isLoading,
  onApply,
  onClose,
}: TagSuggestModalProps) {
  const [tags, setTags] = useState<Partial<Document>>({
    doc_type: document.doc_type || undefined,
    channel: document.channel || undefined,
    industry: document.industry || undefined,
    role: document.role || undefined,
  })

  useEffect(() => {
    if (suggestions) {
      setTags({
        doc_type: (suggestions.doc_type as Document['doc_type']) || undefined,
        channel: suggestions.channel || undefined,
        industry: suggestions.industry || undefined,
        role: suggestions.role || undefined,
      })
    }
  }, [suggestions])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-surface-light rounded-2xl border border-surface-lighter w-full max-w-md mx-4 overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface-lighter">
          <div className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-accent-electric" />
            <h3 className="font-bold text-white">Tag Document</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-500 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-accent-electric animate-spin mb-3" />
              <p className="text-sm text-zinc-400">Analyzing document...</p>
            </div>
          ) : (
            <>
              {suggestions && (
                <div className="p-3 bg-accent-electric/10 rounded-lg border border-accent-electric/20">
                  <p className="text-xs text-accent-electric mb-1">
                    AI Confidence: {Math.round(suggestions.confidence * 100)}%
                  </p>
                  <p className="text-xs text-zinc-400">{suggestions.reasoning}</p>
                </div>
              )}

              {/* Doc Type */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Document Type
                </label>
                <div className="flex gap-2">
                  {DOC_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => setTags({ ...tags, doc_type: type as Document['doc_type'] })}
                      className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                        tags.doc_type === type
                          ? 'bg-accent-electric text-surface-dark border-accent-electric'
                          : 'bg-surface border-surface-lighter text-zinc-400 hover:border-zinc-600'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Channel */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Channel (optional)
                </label>
                <div className="flex gap-2">
                  {CHANNELS.map((channel) => (
                    <button
                      key={channel}
                      onClick={() => setTags({ ...tags, channel: tags.channel === channel ? undefined : channel })}
                      className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                        tags.channel === channel
                          ? 'bg-accent-coral/20 text-accent-coral border-accent-coral/50'
                          : 'bg-surface border-surface-lighter text-zinc-400 hover:border-zinc-600'
                      }`}
                    >
                      {channel}
                    </button>
                  ))}
                </div>
              </div>

              {/* Industry */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Industry (optional)
                </label>
                <input
                  type="text"
                  value={tags.industry ?? ''}
                  onChange={(e) => setTags({ ...tags, industry: e.target.value })}
                  placeholder="e.g., construction, logistics"
                  className="w-full px-4 py-2 bg-surface border border-surface-lighter rounded-lg text-white placeholder-zinc-600 focus:border-accent-electric"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Role (optional)
                </label>
                <input
                  type="text"
                  value={tags.role ?? ''}
                  onChange={(e) => setTags({ ...tags, role: e.target.value })}
                  placeholder="e.g., owner, director"
                  className="w-full px-4 py-2 bg-surface border border-surface-lighter rounded-lg text-white placeholder-zinc-600 focus:border-accent-electric"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!isLoading && (
          <div className="flex items-center justify-end gap-3 p-4 border-t border-surface-lighter">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onApply(tags)}
              disabled={!tags.doc_type}
              className="flex items-center gap-2 px-4 py-2 bg-accent-electric text-surface-dark font-medium text-sm rounded-lg hover:bg-accent-electric/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Check className="w-4 h-4" />
              Apply & Process
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
