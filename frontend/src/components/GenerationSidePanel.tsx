import { useState } from 'react'
import { X, Sparkles, Loader2 } from 'lucide-react'
import { generateApi } from '../api/client'

interface GenerationSidePanelProps {
  campaignId: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const AVAILABLE_ANGLES = [
  'Curiosity',
  'Pain',
  'Value',
  'Authority',
  'Scarcity',
  'Social Proof',
  'Contrast',
  'Direct',
]

export default function GenerationSidePanel({
  campaignId,
  isOpen,
  onClose,
  onSuccess,
}: GenerationSidePanelProps) {
  const [numVariants, setNumVariants] = useState(4)
  const [selectedAngles, setSelectedAngles] = useState<string[]>(['Curiosity', 'Pain'])
  const [chunkPreference, setChunkPreference] = useState<'base' | 'up' | 'down'>('base')
  const [customInstructions, setCustomInstructions] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [progressStage, setProgressStage] = useState<string>('')
  const [progressCurrent, setProgressCurrent] = useState<number>(0)
  const [progressTotal, setProgressTotal] = useState<number>(0)

  const toggleAngle = (angle: string) => {
    if (selectedAngles.includes(angle)) {
      setSelectedAngles(selectedAngles.filter(a => a !== angle))
    } else {
      setSelectedAngles([...selectedAngles, angle])
    }
  }

  const handleGenerate = async () => {
    if (selectedAngles.length === 0) {
      alert('Please select at least one angle')
      return
    }

    setIsGenerating(true)
    setProgressStage('Starting generation...')
    setProgressCurrent(0)
    setProgressTotal(selectedAngles.length)

    try {
      // Build SSE URL
      const params = new URLSearchParams()
      params.append('num_variants', numVariants.toString())
      params.append('angles', selectedAngles.join(','))
      if (chunkPreference !== 'base') {
        params.append('chunk_preference', chunkPreference)
      }
      if (customInstructions) {
        params.append('custom_instructions', customInstructions)
      }

      const eventSource = new EventSource(
        `/api/campaigns/${campaignId}/generate/stream?${params.toString()}`
      )

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data)
        
        if (data.stage === 'error') {
          eventSource.close()
          alert(`Generation failed: ${data.message}`)
          setIsGenerating(false)
          return
        }

        if (data.stage === 'done') {
          eventSource.close()
          setProgressStage('Completed')
          // Wait for backend to commit all variants
          setTimeout(() => {
            onSuccess()
            onClose()
            // Reset form
            setNumVariants(4)
            setSelectedAngles(['Curiosity', 'Pain'])
            setChunkPreference('base')
            setCustomInstructions('')
            setIsGenerating(false)
            setProgressStage('')
          }, 1000)
          return
        }

        // Update progress
        setProgressStage(data.stage || '')
        if (data.current !== undefined && data.total !== undefined) {
          setProgressCurrent(data.current)
          setProgressTotal(data.total)
        }
      }

      eventSource.onerror = (error) => {
        console.error('SSE error:', error)
        eventSource.close()
        alert('Connection error. Please try again.')
        setIsGenerating(false)
        setProgressStage('')
      }
    } catch (error) {
      console.error('Failed to generate variants:', error)
      alert('Failed to generate variants. Please try again.')
      setIsGenerating(false)
      setProgressStage('')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      
      {/* Side Panel */}
      <div className="relative ml-auto w-full max-w-md bg-surface border-l border-surface-gray shadow-xl flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-surface-gray">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent-green" />
            <h2 className="text-xl font-semibold text-primary">Generate Custom Variants</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-light rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-text-light" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Number of Variants */}
          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              Number of Variants
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="12"
                value={numVariants}
                onChange={(e) => setNumVariants(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-medium text-accent-green w-8 text-center">
                {numVariants}
              </span>
            </div>
          </div>

          {/* Angles */}
          <div>
            <label className="block text-sm font-medium text-primary mb-3">
              Angles (select multiple)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_ANGLES.map((angle) => (
                <button
                  key={angle}
                  onClick={() => toggleAngle(angle)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    selectedAngles.includes(angle)
                      ? 'bg-accent-green/20 border-accent-green text-accent-green'
                      : 'bg-surface-light border-surface-gray text-text-light hover:border-accent-green/50'
                  }`}
                >
                  {angle}
                </button>
              ))}
            </div>
          </div>

          {/* Chunk Preference */}
          <div>
            <label className="block text-sm font-medium text-primary mb-3">
              Chunk Preference
            </label>
            <div className="flex gap-3">
              {(['base', 'up', 'down'] as const).map((pref) => (
                <button
                  key={pref}
                  onClick={() => setChunkPreference(pref)}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    chunkPreference === pref
                      ? 'bg-accent-green/20 border-accent-green text-accent-green'
                      : 'bg-surface-light border-surface-gray text-text-light hover:border-accent-green/50'
                  }`}
                >
                  {pref === 'base' ? 'Base' : pref === 'up' ? 'Chunked Up' : 'Chunked Down'}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Instructions */}
          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              Custom Instructions
            </label>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="e.g., Use testimonials more to show real work examples..."
              className="w-full px-4 py-3 bg-surface-light border border-surface-gray rounded-lg text-sm text-primary placeholder-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent-green focus:border-transparent"
              rows={4}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-surface-gray space-y-3">
          {isGenerating && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-light">{progressStage || 'Generating...'}</span>
                {progressTotal > 0 && (
                  <span className="text-accent-green font-medium">
                    {progressCurrent}/{progressTotal}
                  </span>
                )}
              </div>
              {progressTotal > 0 && (
                <div className="w-full bg-surface-light rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-accent-green h-full transition-all duration-300"
                    style={{ width: `${(progressCurrent / progressTotal) * 100}%` }}
                  />
                </div>
              )}
            </div>
          )}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || selectedAngles.length === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent-green text-primary font-medium rounded-lg hover:bg-accent-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Variants
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
