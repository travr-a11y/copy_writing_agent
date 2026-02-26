import { useState, useEffect } from 'react'
import { X, Loader2, Wand2, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Document, TagSuggestion } from '../types'

interface TagSuggestModalProps {
  doc: Document
  suggestions: TagSuggestion | null
  isLoading: boolean
  onApply: (tags: Partial<Document>) => void
  onClose: () => void
}

// Document types with display names
const DOC_TYPES: Array<{
  key: Document['doc_type']
  label: string
}> = [
  { key: 'company_voice', label: 'Company Voice' },
  { key: 'voice_of_customer', label: 'Voice of Customer' },
  { key: 'call_transcript', label: 'Call Transcript' },
  { key: 'research', label: 'Research' },
  { key: 'campaign_context', label: 'Campaign Context' },
]

const CHANNELS = ['email', 'linkedin', 'call']
const SOURCE_TYPES: Array<{ key: 'internal' | 'market_feedback'; label: string }> = [
  { key: 'internal', label: 'Internal' },
  { key: 'market_feedback', label: 'Market Feedback' },
]

export default function TagSuggestModal({
  doc,
  suggestions,
  isLoading,
  onApply,
  onClose,
}: TagSuggestModalProps) {
  const [tags, setTags] = useState<Partial<Document>>({
    doc_type: doc.doc_type || null,
    channel: doc.channel || null,
    industry: doc.industry || null,
    role: doc.role || null,
    source_type: doc.source_type || null,
    additional_context: doc.additional_context || null,
  })

  useEffect(() => {
    if (suggestions) {
      const docType = suggestions.doc_type as Document['doc_type']
      setTags({
        doc_type: docType || null,
        channel: suggestions.channel || null,
        industry: suggestions.industry || null,
        role: suggestions.role || null,
        source_type: doc.source_type || null, // Preserve existing source_type
        additional_context: doc.additional_context || null, // Preserve existing context
      })
    }
  }, [suggestions, doc.source_type, doc.additional_context])

  const scrollDocTypes = (direction: 'left' | 'right') => {
    const container = document.getElementById('doc-types-scroll')
    if (container) {
      const scrollAmount = 200
      const newPosition = direction === 'left' 
        ? container.scrollLeft - scrollAmount 
        : container.scrollLeft + scrollAmount
      container.scrollTo({ left: newPosition, behavior: 'smooth' })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-surface rounded-xl border border-surface-gray shadow-lg w-full max-w-md mx-4 overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface-gray">
          <div className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-accent-green" />
            <h3 className="font-bold text-primary">Tag Document</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-text-light hover:text-primary rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-accent-green animate-spin mb-3" />
              <p className="text-sm text-text-light">Analyzing document...</p>
            </div>
          ) : (
            <>
              {suggestions && (
                <div className="p-3 bg-accent-green/10 rounded-lg border border-accent-green/20">
                  <p className="text-xs text-accent-green mb-1">
                    AI Confidence: {Math.round(suggestions.confidence * 100)}%
                  </p>
                  <p className="text-xs text-text-light">{suggestions.reasoning}</p>
                </div>
              )}

              {/* Doc Type - Horizontal Scrollable */}
              <div>
                <label className="block text-sm font-medium text-text-light mb-2">
                  Document Type
                </label>
                <div className="relative">
                  <div
                    id="doc-types-scroll"
                    className="flex gap-2 overflow-x-auto scrollbar-hide pb-2"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {DOC_TYPES.map((type) => (
                      <button
                        key={type.key || 'null'}
                        onClick={() => setTags({ ...tags, doc_type: type.key })}
                        className={`px-4 py-2 text-sm whitespace-nowrap rounded-lg border transition-all flex-shrink-0 ${
                          tags.doc_type === type.key
                            ? 'bg-accent-green text-primary border-accent-green'
                            : 'bg-surface-light border-surface-gray text-text-light hover:border-accent-green'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                  {/* Scroll indicators */}
                  <button
                    onClick={() => scrollDocTypes('left')}
                    className="absolute left-0 top-1/2 -translate-y-1/2 p-1 bg-surface/80 hover:bg-surface rounded-full border border-surface-gray"
                    aria-label="Scroll left"
                  >
                    <ChevronLeft className="w-4 h-4 text-text-light" />
                  </button>
                  <button
                    onClick={() => scrollDocTypes('right')}
                    className="absolute right-0 top-1/2 -translate-y-1/2 p-1 bg-surface/80 hover:bg-surface rounded-full border border-surface-gray"
                    aria-label="Scroll right"
                  >
                    <ChevronRight className="w-4 h-4 text-text-light" />
                  </button>
                </div>
              </div>

              {/* Source Type */}
              <div>
                <label className="block text-sm font-medium text-text-light mb-2">
                  Source <span className="text-text-muted">(required)</span>
                </label>
                <div className="flex gap-2">
                  {SOURCE_TYPES.map((source) => (
                    <button
                      key={source.key}
                      onClick={() => setTags({ ...tags, source_type: source.key })}
                      className={`px-4 py-2 text-sm rounded-lg border transition-all flex-1 ${
                        tags.source_type === source.key
                          ? 'bg-accent-green text-primary border-accent-green'
                          : 'bg-surface-light border-surface-gray text-text-light hover:border-accent-green'
                      }`}
                    >
                      {source.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-text-muted mt-1">
                  Internal: Discussions with client/team about improving copy. Market Feedback: Actual feedback from prospects/customers.
                </p>
              </div>

              {/* Channel */}
              <div>
                <label className="block text-sm font-medium text-text-light mb-2">
                  Channel (optional)
                </label>
                <div className="flex gap-2">
                  {CHANNELS.map((channel) => (
                    <button
                      key={channel}
                      onClick={() => setTags({ ...tags, channel: tags.channel === channel ? '' : channel })}
                      className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                        tags.channel === channel
                          ? 'bg-accent-green/20 text-accent-green border-accent-green/50'
                          : 'bg-surface-light border-surface-gray text-text-light hover:border-accent-green'
                      }`}
                    >
                      {channel}
                    </button>
                  ))}
                </div>
              </div>

              {/* Industry */}
              <div>
                <label className="block text-sm font-medium text-text-light mb-2">
                  Industry (optional)
                </label>
                <input
                  type="text"
                  value={tags.industry || ''}
                  onChange={(e) => setTags({ ...tags, industry: e.target.value || null })}
                  placeholder="e.g., construction, logistics"
                  className="w-full px-4 py-2 bg-surface-light border border-surface-gray rounded-lg text-primary placeholder-text-muted focus:border-accent-green"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-text-light mb-2">
                  Role (optional)
                </label>
                <input
                  type="text"
                  value={tags.role || ''}
                  onChange={(e) => setTags({ ...tags, role: e.target.value || null })}
                  placeholder="e.g., owner, director"
                  className="w-full px-4 py-2 bg-surface-light border border-surface-gray rounded-lg text-primary placeholder-text-muted focus:border-accent-green"
                />
              </div>

              {/* Additional Context */}
              <div>
                <label className="block text-sm font-medium text-text-light mb-2">
                  Additional Context (optional)
                </label>
                <textarea
                  value={tags.additional_context || ''}
                  onChange={(e) => setTags({ ...tags, additional_context: e.target.value || null })}
                  placeholder="Tell the AI what this document is about... e.g., 'Internal discussion about XYZ offer positioning'"
                  rows={3}
                  className="w-full px-4 py-2 bg-surface-light border border-surface-gray rounded-lg text-primary placeholder-text-muted focus:border-accent-green resize-none"
                />
                <p className="text-xs text-text-muted mt-1">
                  Provide context to help the AI understand and use this document correctly.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!isLoading && (
          <div className="flex items-center justify-end gap-3 p-4 border-t border-surface-gray">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-text-light hover:text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onApply(tags)}
              disabled={!tags.doc_type || !tags.source_type}
              className="flex items-center gap-2 px-4 py-2 bg-accent-green text-primary font-medium text-sm rounded-lg hover:bg-accent-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
