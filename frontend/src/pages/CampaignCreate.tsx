import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Loader2, Check } from 'lucide-react'
import { campaignApi } from '../api/client'
import type { CampaignCreate as CampaignCreateType } from '../types'

type Step = 'name' | 'icp' | 'pain' | 'offer' | 'brief'

const STEPS: { key: Step; title: string; description: string }[] = [
  { key: 'name', title: 'Campaign Name', description: 'Give your campaign a memorable name' },
  { key: 'icp', title: 'Ideal Customer Profile', description: 'Who are you targeting?' },
  { key: 'pain', title: 'Pain Points', description: 'What problems do they face?' },
  { key: 'offer', title: 'Your Offer', description: 'What are you offering them?' },
  { key: 'brief', title: 'Additional Context', description: 'Any other relevant details (optional)' },
]

export default function CampaignCreate() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<CampaignCreateType>({
    name: '',
    icp: '',
    pain_points: '',
    offer: '',
    brief: '',
  })

  const createMutation = useMutation({
    mutationFn: campaignApi.create,
    onSuccess: (campaign) => {
      navigate(`/campaigns/${campaign.id}`)
    },
  })

  const step = STEPS[currentStep]
  const isLastStep = currentStep === STEPS.length - 1

  const getValue = () => {
    switch (step.key) {
      case 'name': return formData.name
      case 'icp': return formData.icp
      case 'pain': return formData.pain_points
      case 'offer': return formData.offer
      case 'brief': return formData.brief || ''
    }
  }

  const setValue = (value: string) => {
    switch (step.key) {
      case 'name': setFormData({ ...formData, name: value }); break
      case 'icp': setFormData({ ...formData, icp: value }); break
      case 'pain': setFormData({ ...formData, pain_points: value }); break
      case 'offer': setFormData({ ...formData, offer: value }); break
      case 'brief': setFormData({ ...formData, brief: value }); break
    }
  }

  const canProceed = () => {
    if (step.key === 'brief') return true // Optional
    return getValue().trim().length > 0
  }

  const handleNext = () => {
    if (isLastStep) {
      createMutation.mutate(formData)
    } else {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, index) => (
          <div key={s.key} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                index < currentStep
                  ? 'bg-accent-electric text-surface-dark'
                  : index === currentStep
                  ? 'bg-accent-electric/20 text-accent-electric border-2 border-accent-electric'
                  : 'bg-surface-lighter text-zinc-600'
              }`}
            >
              {index < currentStep ? <Check className="w-4 h-4" /> : index + 1}
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={`w-12 h-0.5 mx-1 transition-colors ${
                  index < currentStep ? 'bg-accent-electric' : 'bg-surface-lighter'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Form */}
      <div className="bg-surface-light rounded-2xl border border-surface-lighter p-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white font-display">{step.title}</h2>
          <p className="text-zinc-500 mt-1">{step.description}</p>
        </div>

        {step.key === 'name' ? (
          <input
            type="text"
            value={getValue()}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g., Q1 Construction Outreach"
            className="w-full px-4 py-3 bg-surface border border-surface-lighter rounded-xl text-white placeholder-zinc-600 text-lg focus:border-accent-electric focus:ring-1 focus:ring-accent-electric"
            autoFocus
          />
        ) : (
          <textarea
            value={getValue()}
            onChange={(e) => setValue(e.target.value)}
            placeholder={
              step.key === 'icp' ? 'e.g., Construction company owners in NSW, 10-50 employees, $2-10M revenue...' :
              step.key === 'pain' ? 'e.g., Struggling with project delays, cash flow issues, finding reliable subbies...' :
              step.key === 'offer' ? 'e.g., Advisory services for streamlining operations and improving margins...' :
              'Any additional context that might help generate better copy...'
            }
            rows={6}
            className="w-full px-4 py-3 bg-surface border border-surface-lighter rounded-xl text-white placeholder-zinc-600 resize-none focus:border-accent-electric focus:ring-1 focus:ring-accent-electric"
            autoFocus
          />
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-4 py-2 text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <button
            onClick={handleNext}
            disabled={!canProceed() || createMutation.isPending}
            className="flex items-center gap-2 px-6 py-2.5 bg-accent-electric text-surface-dark font-medium rounded-xl hover:bg-accent-electric/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {createMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isLastStep ? (
              <>
                Create Campaign
                <Check className="w-4 h-4" />
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
