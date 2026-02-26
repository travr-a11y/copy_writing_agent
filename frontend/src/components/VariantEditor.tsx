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

const AVAILABLE_VARIABLES = [
  { name: 'company_name', label: 'Company Name', example: '{{company_name}}' },
  { name: 'industry', label: 'Industry', example: '{{industry}}' },
  { name: 'location', label: 'Location', example: '{{location}}' },
  { name: 'first_name', label: 'First Name', example: '{{first_name}}' },
]

export default function VariantEditor({ variant, campaignId, onClose }: VariantEditorProps) {
  const [body, setBody] = useState(variant.body)
  const [_cursorPosition, setCursorPosition] = useState(0)
  const queryClient = useQueryClient()

  const updateMutation = useMutation({
    mutationFn: () => variantApi.update(variant.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
      onClose()
    },
  })

  const insertVariable = (variable: string) => {
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newBody = body.substring(0, start) + variable + body.substring(end)
      setBody(newBody)
      // Set cursor position after inserted variable
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + variable.length, start + variable.length)
      }, 0)
    }
  }

  const wordCount = body.split(/\s+/).filter(Boolean).length
  const isChanged = body !== variant.body

  return (
    <div className="space-y-3">
      <textarea
        value={body}
        onChange={(e) => {
          setBody(e.target.value)
          setCursorPosition(e.target.selectionStart)
        }}
        onSelect={(e) => {
          const target = e.target as HTMLTextAreaElement
          setCursorPosition(target.selectionStart)
        }}
        rows={6}
        className="w-full px-4 py-3 bg-surface border border-surface-gray rounded-lg text-primary text-sm resize-none focus:border-accent-green focus:ring-1 focus:ring-accent-green"
        placeholder="Email body..."
      />

      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-text-muted self-center">Insert variables:</span>
        {AVAILABLE_VARIABLES.map((variable) => (
          <button
            key={variable.name}
            onClick={() => insertVariable(variable.example)}
            className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded border border-blue-500/30 hover:bg-blue-500/30 transition-colors font-mono"
            title={variable.label}
          >
            {variable.example}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className={`text-xs ${
          variant.touch === 'lead'
            ? wordCount >= 30 && wordCount <= 100 ? 'text-green-600' : 'text-amber-600'
            : wordCount >= 30 && wordCount <= 80 ? 'text-green-600' : 'text-amber-600'
        }`}>
          {wordCount} words
          {variant.touch === 'lead' ? ' (target: 30-100)' : ' (target: 30-80)'}
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-text-light hover:text-primary transition-colors"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
          <button
            onClick={() => updateMutation.mutate()}
            disabled={!isChanged || updateMutation.isPending}
            className="flex items-center gap-1 px-3 py-1.5 bg-accent-green text-primary text-sm font-medium rounded-lg hover:bg-accent-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
