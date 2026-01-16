import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Loader2, Check, Sparkles, Users, MessageSquare, Zap } from 'lucide-react'
import { campaignApi } from '../api/client'
import type { CampaignCreate as CampaignCreateType } from '../types'

type Step = 'basic' | 'icp' | 'pain' | 'offer' | 'research'

interface WizardStep {
  key: Step
  title: string
  description: string
  icon: typeof Sparkles
}

const STEPS: WizardStep[] = [
  { key: 'basic', title: 'Campaign Basics', description: 'Name, industry, and service offering', icon: Sparkles },
  { key: 'icp', title: 'Ideal Customer Profile', description: 'Who are you targeting? (optional)', icon: Users },
  { key: 'pain', title: 'Pain Points', description: 'What problems do they face? (optional)', icon: MessageSquare },
  { key: 'offer', title: 'Your Offer', description: 'What are you offering them?', icon: Zap },
  { key: 'research', title: 'Research & Create', description: 'AI will research and create your campaign', icon: Sparkles },
]

export default function CampaignCreate() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<CampaignCreateType & {
    industry?: string
    geography?: string
    service_offering?: string
  }>({
    name: '',
    industry: '',
    geography: 'Australia',
    service_offering: '',
    icp: '',
    pain_points: '',
    offer: '',
    brief: '',
  })

  const [researchStatus, setResearchStatus] = useState<{
    stage: 'idle' | 'creating' | 'icp' | 'voc' | 'complete' | 'error'
    message: string
    error?: string
  }>({
    stage: 'idle',
    message: '',
  })

  const createMutation = useMutation({
    mutationFn: async (data: CampaignCreateType & { industry?: string; geography?: string; service_offering?: string }) => {
      // Create campaign first
      const campaign = await campaignApi.create({
        name: data.name,
        icp: data.icp || '',
        pain_points: data.pain_points || '',
        offer: data.offer,
        brief: data.brief,
      })

      // Update with industry/geography/service_offering if provided
      if (data.industry || data.geography || data.service_offering) {
        await campaignApi.update(campaign.id, {
          ...(data.industry && { industry: data.industry }),
          ...(data.geography && { geography: data.geography }),
          ...(data.service_offering && { service_offering: data.service_offering }),
        } as any)
      }

      return campaign
    },
    onSuccess: async (campaign) => {
      // Run research automatically
      setResearchStatus({ stage: 'creating', message: 'Campaign created. Starting research...' })

      try {
        // Step 1: ICP Research
        if (formData.industry) {
          setResearchStatus({ stage: 'icp', message: 'Running ICP Definition Agent...' })
          await campaignApi.researchICP(
            campaign.id,
            formData.industry,
            formData.geography || 'Australia',
            formData.service_offering || '',
            formData.icp || ''
          )
        }

        // Step 2: VOC Research
        if (formData.industry) {
          setResearchStatus({ stage: 'voc', message: 'Running Audience Voice Research Agent...' })
          const icpSummary = formData.icp || `${formData.industry} companies in ${formData.geography || 'Australia'}`
          await campaignApi.researchVOC(
            campaign.id,
            icpSummary,
            '', // competitors
            '', // platforms_priority
            formData.pain_points || ''
          )
        }

        setResearchStatus({ stage: 'complete', message: 'Research complete! Redirecting...' })
        
        // Navigate to campaign detail after a brief delay
        setTimeout(() => {
          navigate(`/campaigns/${campaign.id}`)
        }, 1500)
      } catch (error: any) {
        setResearchStatus({
          stage: 'error',
          message: 'Research failed, but campaign was created.',
          error: error?.response?.data?.detail || error?.message || 'Unknown error',
        })
        // Still navigate to campaign detail even if research fails
        setTimeout(() => {
          navigate(`/campaigns/${campaign.id}`)
        }, 3000)
      }
    },
  })

  const step = STEPS[currentStep]
  const isLastStep = currentStep === STEPS.length - 1
  const StepIcon = step.icon

  const getValue = () => {
    switch (step.key) {
      case 'basic': return formData.name
      case 'icp': return formData.icp
      case 'pain': return formData.pain_points
      case 'offer': return formData.offer
      default: return ''
    }
  }

  const setValue = (value: string) => {
    switch (step.key) {
      case 'basic': setFormData({ ...formData, name: value }); break
      case 'icp': setFormData({ ...formData, icp: value }); break
      case 'pain': setFormData({ ...formData, pain_points: value }); break
      case 'offer': setFormData({ ...formData, offer: value }); break
    }
  }

  const canProceed = () => {
    if (step.key === 'icp' || step.key === 'pain') return true // Optional
    if (step.key === 'research') return (formData.offer || '').trim().length > 0 && formData.name.trim().length > 0
    const value = getValue()
    return value ? value.trim().length > 0 : false
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
        {STEPS.map((s, index) => {
          const Icon = s.icon
          return (
            <div key={s.key} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  index < currentStep
                    ? 'bg-accent-electric text-surface-dark'
                    : index === currentStep
                    ? 'bg-accent-electric/20 text-accent-electric border-2 border-accent-electric'
                    : 'bg-surface-lighter text-zinc-600'
                }`}
              >
                {index < currentStep ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`w-12 h-0.5 mx-1 transition-colors ${
                    index < currentStep ? 'bg-accent-electric' : 'bg-surface-lighter'
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Form */}
      <div className="bg-surface-light rounded-2xl border border-surface-lighter p-8">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <StepIcon className="w-6 h-6 text-accent-electric" />
            <h2 className="text-2xl font-bold text-white font-display">{step.title}</h2>
          </div>
          <p className="text-zinc-500">{step.description}</p>
        </div>

        {/* Research Status (Step 5) */}
        {step.key === 'research' && (
          <div className="mb-6 space-y-4">
            {researchStatus.stage === 'idle' && (
              <div className="bg-zinc-500/10 border border-zinc-500/30 rounded-lg p-4">
                <p className="text-sm text-zinc-400">
                  Ready to create your campaign and run AI research. Click "Create Campaign" to begin.
                </p>
                <div className="mt-4 space-y-2 text-sm text-zinc-500">
                  <p>✓ Campaign will be created with your information</p>
                  {formData.industry && (
                    <>
                      <p>✓ ICP Definition Agent will analyze your target industry</p>
                      <p>✓ Audience Voice Research Agent will extract customer language</p>
                    </>
                  )}
                  <p>✓ Research results will be saved to your knowledge bank</p>
                </div>
              </div>
            )}

            {researchStatus.stage === 'creating' && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                  <p className="text-sm text-blue-400">{researchStatus.message}</p>
                </div>
              </div>
            )}

            {researchStatus.stage === 'icp' && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                  <p className="text-sm text-blue-400">{researchStatus.message}</p>
                </div>
                <p className="text-xs text-zinc-500 mt-2">This may take 30-60 seconds...</p>
              </div>
            )}

            {researchStatus.stage === 'voc' && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                  <p className="text-sm text-blue-400">{researchStatus.message}</p>
                </div>
                <p className="text-xs text-zinc-500 mt-2">This may take 30-60 seconds...</p>
              </div>
            )}

            {researchStatus.stage === 'complete' && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-400" />
                  <p className="text-sm text-green-400">{researchStatus.message}</p>
                </div>
              </div>
            )}

            {researchStatus.stage === 'error' && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <p className="text-sm text-red-400">{researchStatus.message}</p>
                </div>
                {researchStatus.error && (
                  <p className="text-xs text-red-300 mt-2">{researchStatus.error}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Form Fields */}
        {step.key === 'basic' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Campaign Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Q1 Construction Outreach"
                className="w-full px-4 py-3 bg-surface border border-surface-lighter rounded-xl text-white placeholder-zinc-600 text-lg focus:border-accent-electric focus:ring-1 focus:ring-accent-electric"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Industry *</label>
              <input
                type="text"
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                placeholder="e.g., Mining & Resources, Construction, Logistics"
                className="w-full px-4 py-3 bg-surface border border-surface-lighter rounded-xl text-white placeholder-zinc-600 focus:border-accent-electric focus:ring-1 focus:ring-accent-electric"
              />
              <p className="text-xs text-zinc-500 mt-1">Required for AI research</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Geography</label>
              <input
                type="text"
                value={formData.geography}
                onChange={(e) => setFormData({ ...formData, geography: e.target.value })}
                placeholder="e.g., Australia, NSW, Victoria"
                className="w-full px-4 py-3 bg-surface border border-surface-lighter rounded-xl text-white placeholder-zinc-600 focus:border-accent-electric focus:ring-1 focus:ring-accent-electric"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Service/Product Offering</label>
              <input
                type="text"
                value={formData.service_offering}
                onChange={(e) => setFormData({ ...formData, service_offering: e.target.value })}
                placeholder="e.g., Freight services with Direct Line guarantee"
                className="w-full px-4 py-3 bg-surface border border-surface-lighter rounded-xl text-white placeholder-zinc-600 focus:border-accent-electric focus:ring-1 focus:ring-accent-electric"
              />
            </div>
          </div>
        ) : step.key === 'research' ? (
          <div className="space-y-4">
            <div className="bg-surface rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Campaign Name</span>
                <span className="text-sm text-white font-medium">{formData.name}</span>
              </div>
              {formData.industry && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Industry</span>
                  <span className="text-sm text-white font-medium">{formData.industry}</span>
                </div>
              )}
              {formData.geography && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Geography</span>
                  <span className="text-sm text-white font-medium">{formData.geography}</span>
                </div>
              )}
              {formData.offer && formData.offer.trim() && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Offer</span>
                  <span className="text-sm text-white font-medium line-clamp-1">{formData.offer}</span>
                </div>
              )}
            </div>
          </div>
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
            disabled={createMutation.isPending || researchStatus.stage !== 'idle'}
            className="flex items-center gap-2 px-4 py-2 text-zinc-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <button
            onClick={handleNext}
            disabled={!canProceed() || createMutation.isPending || researchStatus.stage !== 'idle'}
            className="flex items-center gap-2 px-6 py-2.5 bg-accent-electric text-surface-dark font-medium rounded-xl hover:bg-accent-electric/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {createMutation.isPending || researchStatus.stage !== 'idle' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {researchStatus.stage === 'icp' ? 'Researching ICP...' :
                 researchStatus.stage === 'voc' ? 'Researching VOC...' :
                 'Creating...'}
              </>
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
