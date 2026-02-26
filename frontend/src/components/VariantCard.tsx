import { useState } from 'react'
import { Check, X, Edit3, ChevronUp, ChevronDown, Copy, Trash2, ChevronRight, Star, Archive, RotateCcw } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { variantApi, generateApi } from '../api/client'
import type { Variant } from '../types'
import VariantEditor from './VariantEditor'

interface VariantCardProps {
  variant: Variant
  linkedVariant?: Variant
  chunkedVariants?: Variant[]
  campaignId: string
}

export default function VariantCard({ variant, linkedVariant, chunkedVariants, campaignId }: VariantCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isFollowupExpanded, setIsFollowupExpanded] = useState(false)
  const [isEditingFollowup, setIsEditingFollowup] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isEditingThesis, setIsEditingThesis] = useState(false)
  const [thesisText, setThesisText] = useState(variant.thesis || '')
  const queryClient = useQueryClient()

  const starMutation = useMutation({
    mutationFn: (variantId: string) => generateApi.toggleStar(variantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
    },
  })

  const archiveMutation = useMutation({
    mutationFn: (variantId: string) => variantApi.archive(variantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
    },
  })

  const restoreMutation = useMutation({
    mutationFn: (variantId: string) => variantApi.restore(variantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (variantId?: string) => variantApi.delete(variantId || variant.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
      if (linkedVariant) {
        setIsFollowupExpanded(false)
      }
    },
  })

  // Highlight variables in text
  const highlightVariables = (text: string) => {
    const parts = []
    const regex = /\{\{(\w+)\}\}/g
    let lastIndex = 0
    let match

    while ((match = regex.exec(text)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        parts.push({ text: text.substring(lastIndex, match.index), isVariable: false })
      }
      // Add variable
      parts.push({ text: match[0], variable: match[1], isVariable: true })
      lastIndex = regex.lastIndex
    }
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({ text: text.substring(lastIndex), isVariable: false })
    }

    if (parts.length === 0) {
      return <>{text}</>
    }

    return (
      <>
        {parts.map((part, idx) =>
          part.isVariable ? (
            <span
              key={idx}
              className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30 font-mono text-xs"
              title={`Variable: ${part.variable}`}
            >
              {part.text}
            </span>
          ) : (
            <span key={idx}>{part.text}</span>
          )
        )}
      </>
    )
  }

  const chunkMutation = useMutation({
    mutationFn: ({ variantId, direction }: { variantId: string; direction: 'up' | 'down' }) => {
      return generateApi.chunk(variantId, direction)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
    },
  })

  const updateThesisMutation = useMutation({
    mutationFn: (thesis: string) => variantApi.updateThesis(variant.id, thesis),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
      setIsEditingThesis(false)
    },
  })

  const copyToClipboard = () => {
    navigator.clipboard.writeText(variant.body)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const angleColors: Record<string, string> = {
    curiosity: 'bg-purple-500/20 text-purple-400',
    pain: 'bg-red-500/20 text-red-400',
    outcome: 'bg-green-500/20 text-green-400',
    proof: 'bg-blue-500/20 text-blue-400',
    authority: 'bg-amber-500/20 text-amber-400',
    empathy: 'bg-pink-500/20 text-pink-400',
    challenge: 'bg-orange-500/20 text-orange-400',
    insight: 'bg-cyan-500/20 text-cyan-400',
  }

  return (
    <div className={`bg-surface rounded-xl border shadow-sm overflow-hidden ${
      variant.archived ? 'border-amber-500/50 opacity-75' : 'border-surface-gray'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-surface-gray">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {variant.archived && (
              <span className="px-2 py-1 text-xs font-medium rounded bg-amber-500/20 text-amber-400">
                Archived
              </span>
            )}
            <span className={`px-2 py-1 text-xs font-medium rounded ${
              variant.touch === 'lead' ? 'bg-accent-green/20 text-accent-green' : 'bg-accent-green/20 text-accent-green'
            }`}>
              {variant.touch}
            </span>
            <span className={`px-2 py-1 text-xs font-medium rounded ${angleColors[variant.angle.toLowerCase()] || 'bg-surface-gray text-text-light'}`}>
              {variant.angle}
            </span>
            {variant.chunk !== 'base' && (
              <span className="px-2 py-1 text-xs font-medium rounded bg-surface-gray text-text-light">
                chunk {variant.chunk}
              </span>
            )}
          </div>
          {variant.thesis && (
            <div className="mt-3 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-indigo-400">Testing Assumption</span>
                <button
                  onClick={() => setIsEditingThesis(true)}
                  className="text-xs text-text-light hover:text-indigo-400 transition-colors"
                  title="Edit thesis"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
              </div>
              {isEditingThesis ? (
                <div className="space-y-2">
                  <textarea
                    value={thesisText}
                    onChange={(e) => setThesisText(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-surface-gray rounded-lg text-sm text-primary resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    rows={2}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        updateThesisMutation.mutate(thesisText)
                      }}
                      disabled={updateThesisMutation.isPending}
                      className="px-3 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingThesis(false)
                        setThesisText(variant.thesis || '')
                      }}
                      className="px-3 py-1 text-xs bg-surface-light text-text-light rounded hover:bg-surface-gray transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-primary">{variant.thesis}</p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {variant.qa_pass ? (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <Check className="w-3 h-3" />
              QA Pass
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-red-600" title={variant.qa_notes || ''}>
              <X className="w-3 h-3" />
              QA Fail
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        {isEditing ? (
          <VariantEditor
            variant={variant}
            campaignId={campaignId}
            onClose={() => setIsEditing(false)}
          />
        ) : (
          <p className="text-sm text-primary whitespace-pre-wrap leading-relaxed">
            {highlightVariables(variant.body)}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 bg-surface-light border-t border-surface-gray">
        <div className="flex items-center gap-4 text-xs text-text-light">
          <span>{variant.word_count} words</span>
          <span>Grade {variant.readability_grade.toFixed(1)}</span>
        </div>

        <div className="flex items-center gap-1">
          {variant.chunk === 'base' && (
            <>
              <button
                onClick={() => chunkMutation.mutate({ variantId: variant.id, direction: 'up' })}
                disabled={chunkMutation.isPending}
                className="p-2 text-text-light hover:text-primary hover:bg-surface-gray rounded-lg transition-colors"
                title="Chunk up (add context)"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                onClick={() => chunkMutation.mutate({ variantId: variant.id, direction: 'down' })}
                disabled={chunkMutation.isPending}
                className="p-2 text-text-light hover:text-primary hover:bg-surface-gray rounded-lg transition-colors"
                title="Chunk down (more direct)"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={() => setIsEditing(true)}
            className="p-2 text-text-light hover:text-accent-green hover:bg-accent-green/10 rounded-lg transition-colors"
            title="Edit"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={copyToClipboard}
            className={`p-2 rounded-lg transition-colors ${
              copied ? 'text-green-600 bg-green-100' : 'text-text-light hover:text-primary hover:bg-surface-gray'
            }`}
            title="Copy"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={() => starMutation.mutate(variant.id)}
            disabled={starMutation.isPending}
            className={`p-2 rounded-lg transition-colors ${
              variant.starred
                ? 'text-amber-600 bg-amber-100 hover:bg-amber-200'
                : 'text-text-light hover:text-amber-600 hover:bg-amber-100'
            }`}
            title={variant.starred ? 'Unstar' : 'Star'}
          >
            <Star className={`w-4 h-4 ${variant.starred ? 'fill-current' : ''}`} />
          </button>
          {variant.archived ? (
            <>
              <button
                onClick={() => restoreMutation.mutate(variant.id)}
                disabled={restoreMutation.isPending}
                className="p-2 text-text-light hover:text-accent-green hover:bg-accent-green/10 rounded-lg transition-colors"
                title="Restore"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => deleteMutation.mutate(variant.id)}
                className="p-2 text-text-light hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                title="Delete permanently"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={() => archiveMutation.mutate(variant.id)}
              disabled={archiveMutation.isPending}
              className="p-2 text-text-light hover:text-amber-600 hover:bg-amber-100 rounded-lg transition-colors"
              title="Archive"
            >
              <Archive className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Linked follow-up preview/expanded */}
      {linkedVariant && variant.touch === 'lead' && (
        <div className="px-4 pb-4">
          {!isFollowupExpanded ? (
            <div className="p-3 bg-surface-light rounded-lg border border-surface-gray">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-accent-green/20 text-accent-green">
                    follow-up
                  </span>
                </div>
                <button
                  onClick={() => setIsFollowupExpanded(true)}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-text-light hover:text-accent-green hover:bg-accent-green/10 rounded-lg transition-colors"
                  title="Expand to edit"
                >
                  <ChevronRight className="w-3 h-3" />
                  Expand
                </button>
              </div>
              <p className="text-xs text-text-muted line-clamp-3">
                {linkedVariant.body}
              </p>
            </div>
          ) : (
            <div className="mt-3 bg-surface rounded-xl border border-surface-gray shadow-sm overflow-hidden transition-all duration-300">
              {/* Follow-up Header */}
              <div className="flex items-center justify-between p-4 border-b border-surface-gray">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 text-xs font-medium rounded bg-accent-green/20 text-accent-green">
                      follow-up
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${angleColors[linkedVariant.angle] || 'bg-surface-gray text-text-light'}`}>
                      {linkedVariant.angle}
                    </span>
                    {linkedVariant.chunk !== 'base' && (
                      <span className="px-2 py-1 text-xs font-medium rounded bg-surface-gray text-text-light">
                        chunk {linkedVariant.chunk}
                      </span>
                    )}
                  </div>
                  {linkedVariant.thesis && (
                    <p className="text-xs italic text-text-muted mt-1" title={linkedVariant.thesis}>
                      Thesis: {linkedVariant.thesis}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {linkedVariant.qa_pass ? (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <Check className="w-3 h-3" />
                      QA Pass
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-red-600" title={linkedVariant.qa_notes || ''}>
                      <X className="w-3 h-3" />
                      QA Fail
                    </span>
                  )}
                </div>
              </div>

              {/* Follow-up Body */}
              <div className="p-4">
                {isEditingFollowup ? (
                  <VariantEditor
                    variant={linkedVariant}
                    campaignId={campaignId}
                    onClose={() => setIsEditingFollowup(false)}
                  />
                ) : (
                  <p className="text-sm text-primary whitespace-pre-wrap leading-relaxed">
                    {linkedVariant.body}
                  </p>
                )}
              </div>

              {/* Follow-up Footer */}
              <div className="flex items-center justify-between px-4 py-3 bg-surface-light border-t border-surface-gray">
                <div className="flex items-center gap-4 text-xs text-text-light">
                  <span>{linkedVariant.word_count} words</span>
                  <span>Grade {linkedVariant.readability_grade.toFixed(1)}</span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsFollowupExpanded(false)}
                    className="p-2 text-text-light hover:text-primary hover:bg-surface-gray rounded-lg transition-colors"
                    title="Collapse"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {linkedVariant.chunk === 'base' && (
                    <>
                      <button
                        onClick={() => chunkMutation.mutate({ variantId: linkedVariant.id, direction: 'up' })}
                        disabled={chunkMutation.isPending}
                        className="p-2 text-text-light hover:text-primary hover:bg-surface-gray rounded-lg transition-colors"
                        title="Chunk up (add context)"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => chunkMutation.mutate({ variantId: linkedVariant.id, direction: 'down' })}
                        disabled={chunkMutation.isPending}
                        className="p-2 text-text-light hover:text-primary hover:bg-surface-gray rounded-lg transition-colors"
                        title="Chunk down (more direct)"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setIsEditingFollowup(true)}
                    className="p-2 text-text-light hover:text-accent-green hover:bg-accent-green/10 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(linkedVariant.body)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    }}
                    className={`p-2 rounded-lg transition-colors ${
                      copied ? 'text-green-600 bg-green-100' : 'text-text-light hover:text-primary hover:bg-surface-gray'
                    }`}
                    title="Copy"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => starMutation.mutate(linkedVariant.id)}
                    disabled={starMutation.isPending}
                    className={`p-2 rounded-lg transition-colors ${
                      linkedVariant.starred
                        ? 'text-amber-600 bg-amber-100 hover:bg-amber-200'
                        : 'text-text-light hover:text-amber-600 hover:bg-amber-100'
                    }`}
                    title={linkedVariant.starred ? 'Unstar' : 'Star'}
                  >
                    <Star className={`w-4 h-4 ${linkedVariant.starred ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Delete this follow-up variant?')) {
                        deleteMutation.mutate(linkedVariant.id)
                      }
                    }}
                    className="p-2 text-text-light hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chunked variants nested below base */}
      {chunkedVariants && chunkedVariants.length > 0 && variant.chunk === 'base' && (
        <div className="ml-6 mt-3 space-y-3 border-l-2 border-surface-gray pl-4">
          {chunkedVariants.map(cv => (
            <VariantCard
              key={cv.id}
              variant={cv}
              campaignId={campaignId}
            />
          ))}
        </div>
      )}
    </div>
  )
}
