import { useState } from 'react'
import { Save, X, Loader2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { variantApi } from '../api/client'
import type { Variant } from '../types'

interface VariantEditorProps {
  variant: Variant
  campaignId: string
  onClose: () => void
}

export default function VariantEditor({ variant, campaignId, onClose }: VariantEditorProps) {
  const [body, setBody] = useState(variant.body)
  const queryClient = useQueryClient()

  const updateMutation = useMutation({
    mutationFn: () => variantApi.update(variant.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
      onClose()
    },
  })

  const wordCount = body.split(/\s+/).filter(Boolean).length
  const isChanged = body !== variant.body

  return (
    <div className="space-y-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={6}
        className="w-full px-4 py-3 bg-surface border border-surface-lighter rounded-lg text-white text-sm resize-none focus:border-accent-electric focus:ring-1 focus:ring-accent-electric"
        placeholder="Email body..."
      />

      <div className="flex items-center justify-between">
        <span className={`text-xs ${
          variant.touch === 'lead'
            ? wordCount >= 30 && wordCount <= 100 ? 'text-green-400' : 'text-amber-400'
            : wordCount >= 30 && wordCount <= 80 ? 'text-green-400' : 'text-amber-400'
        }`}>
          {wordCount} words
          {variant.touch === 'lead' ? ' (target: 30-100)' : ' (target: 30-80)'}
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
          <button
            onClick={() => updateMutation.mutate()}
            disabled={!isChanged || updateMutation.isPending}
            className="flex items-center gap-1 px-3 py-1.5 bg-accent-electric text-surface-dark text-sm font-medium rounded-lg hover:bg-accent-electric/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
