import { useState } from 'react'
import { Check, X, Edit3, ChevronUp, ChevronDown, Copy, Trash2, ChevronRight, Star } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { variantApi, generateApi } from '../api/client'
import type { Variant } from '../types'
import VariantEditor from './VariantEditor'

interface VariantCardProps {
  variant: Variant
  linkedVariant?: Variant
  campaignId: string
}

export default function VariantCard({ variant, linkedVariant, campaignId }: VariantCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isFollowupExpanded, setIsFollowupExpanded] = useState(false)
  const [isEditingFollowup, setIsEditingFollowup] = useState(false)
  const [copied, setCopied] = useState(false)
  const queryClient = useQueryClient()

  const starMutation = useMutation({
    mutationFn: (variantId: string) => generateApi.toggleStar(variantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (variantId: string) => variantApi.delete(variantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
      if (linkedVariant) {
        setIsFollowupExpanded(false)
      }
    },
  })

  const chunkMutation = useMutation({
    mutationFn: ({ variantId, direction }: { variantId: string; direction: 'up' | 'down' }) => {
      return generateApi.chunk(variantId, direction)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
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
    <div className="bg-surface-light rounded-xl border border-surface-lighter overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-surface-lighter">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className={`px-2 py-1 text-xs font-medium rounded ${
              variant.touch === 'lead' ? 'bg-accent-electric/20 text-accent-electric' : 'bg-accent-coral/20 text-accent-coral'
            }`}>
              {variant.touch}
            </span>
            <span className={`px-2 py-1 text-xs font-medium rounded ${angleColors[variant.angle] || 'bg-zinc-500/20 text-zinc-400'}`}>
              {variant.angle}
            </span>
            {variant.chunk !== 'base' && (
              <span className="px-2 py-1 text-xs font-medium rounded bg-zinc-500/20 text-zinc-400">
                chunk {variant.chunk}
              </span>
            )}
          </div>
          {variant.thesis && (
            <p className="text-xs italic text-zinc-400 mt-1" title={variant.thesis}>
              Thesis: {variant.thesis}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {variant.qa_pass ? (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <Check className="w-3 h-3" />
              QA Pass
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-red-400" title={variant.qa_notes || ''}>
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
          <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
            {variant.body}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 bg-surface border-t border-surface-lighter">
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <span>{variant.word_count} words</span>
          <span>Grade {variant.readability_grade.toFixed(1)}</span>
        </div>

        <div className="flex items-center gap-1">
          {variant.chunk === 'base' && (
            <>
              <button
                onClick={() => chunkMutation.mutate({ variantId: variant.id, direction: 'up' })}
                disabled={chunkMutation.isPending}
                className="p-2 text-zinc-500 hover:text-white hover:bg-surface-lighter rounded-lg transition-colors"
                title="Chunk up (add context)"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                onClick={() => chunkMutation.mutate({ variantId: variant.id, direction: 'down' })}
                disabled={chunkMutation.isPending}
                className="p-2 text-zinc-500 hover:text-white hover:bg-surface-lighter rounded-lg transition-colors"
                title="Chunk down (more direct)"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={() => setIsEditing(true)}
            className="p-2 text-zinc-500 hover:text-accent-electric hover:bg-accent-electric/10 rounded-lg transition-colors"
            title="Edit"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={copyToClipboard}
            className={`p-2 rounded-lg transition-colors ${
              copied ? 'text-green-400 bg-green-400/10' : 'text-zinc-500 hover:text-white hover:bg-surface-lighter'
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
                ? 'text-amber-400 bg-amber-400/10 hover:bg-amber-400/20'
                : 'text-zinc-500 hover:text-amber-400 hover:bg-amber-400/10'
            }`}
            title={variant.starred ? 'Unstar' : 'Star'}
          >
            <Star className={`w-4 h-4 ${variant.starred ? 'fill-current' : ''}`} />
          </button>
          <button
            onClick={() => deleteMutation.mutate(variant.id)}
            className="p-2 text-zinc-500 hover:text-accent-coral hover:bg-accent-coral/10 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Linked follow-up preview/expanded */}
      {linkedVariant && variant.touch === 'lead' && (
        <div className="px-4 pb-4">
          {!isFollowupExpanded ? (
            <div className="p-3 bg-surface rounded-lg border border-surface-lighter">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-accent-coral/20 text-accent-coral">
                    follow-up
                  </span>
                </div>
                <button
                  onClick={() => setIsFollowupExpanded(true)}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-500 hover:text-accent-electric hover:bg-accent-electric/10 rounded-lg transition-colors"
                  title="Expand to edit"
                >
                  <ChevronRight className="w-3 h-3" />
                  Expand
                </button>
              </div>
              <p className="text-xs text-zinc-400 line-clamp-3">
                {linkedVariant.body}
              </p>
            </div>
          ) : (
            <div className="mt-3 bg-surface-light rounded-xl border border-surface-lighter overflow-hidden transition-all duration-300">
              {/* Follow-up Header */}
              <div className="flex items-center justify-between p-4 border-b border-surface-lighter">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 text-xs font-medium rounded bg-accent-coral/20 text-accent-coral">
                      follow-up
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${angleColors[linkedVariant.angle] || 'bg-zinc-500/20 text-zinc-400'}`}>
                      {linkedVariant.angle}
                    </span>
                    {linkedVariant.chunk !== 'base' && (
                      <span className="px-2 py-1 text-xs font-medium rounded bg-zinc-500/20 text-zinc-400">
                        chunk {linkedVariant.chunk}
                      </span>
                    )}
                  </div>
                  {linkedVariant.thesis && (
                    <p className="text-xs italic text-zinc-400 mt-1" title={linkedVariant.thesis}>
                      Thesis: {linkedVariant.thesis}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {linkedVariant.qa_pass ? (
                    <span className="flex items-center gap-1 text-xs text-green-400">
                      <Check className="w-3 h-3" />
                      QA Pass
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-red-400" title={linkedVariant.qa_notes || ''}>
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
                  <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
                    {linkedVariant.body}
                  </p>
                )}
              </div>

              {/* Follow-up Footer */}
              <div className="flex items-center justify-between px-4 py-3 bg-surface border-t border-surface-lighter">
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <span>{linkedVariant.word_count} words</span>
                  <span>Grade {linkedVariant.readability_grade.toFixed(1)}</span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsFollowupExpanded(false)}
                    className="p-2 text-zinc-500 hover:text-white hover:bg-surface-lighter rounded-lg transition-colors"
                    title="Collapse"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {linkedVariant.chunk === 'base' && (
                    <>
                      <button
                        onClick={() => chunkMutation.mutate({ variantId: linkedVariant.id, direction: 'up' })}
                        disabled={chunkMutation.isPending}
                        className="p-2 text-zinc-500 hover:text-white hover:bg-surface-lighter rounded-lg transition-colors"
                        title="Chunk up (add context)"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => chunkMutation.mutate({ variantId: linkedVariant.id, direction: 'down' })}
                        disabled={chunkMutation.isPending}
                        className="p-2 text-zinc-500 hover:text-white hover:bg-surface-lighter rounded-lg transition-colors"
                        title="Chunk down (more direct)"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setIsEditingFollowup(true)}
                    className="p-2 text-zinc-500 hover:text-accent-electric hover:bg-accent-electric/10 rounded-lg transition-colors"
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
                      copied ? 'text-green-400 bg-green-400/10' : 'text-zinc-500 hover:text-white hover:bg-surface-lighter'
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
                        ? 'text-amber-400 bg-amber-400/10 hover:bg-amber-400/20'
                        : 'text-zinc-500 hover:text-amber-400 hover:bg-amber-400/10'
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
                    className="p-2 text-zinc-500 hover:text-accent-coral hover:bg-accent-coral/10 rounded-lg transition-colors"
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
    </div>
  )
}
