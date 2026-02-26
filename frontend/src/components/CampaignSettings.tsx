import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Loader2, Settings, User, MessageSquare, History, Sparkles, RefreshCw } from 'lucide-react'
import { campaignApi } from '../api/client'
import type { Campaign, CampaignCreate, ICPFirmographics, ICPTechnographics, BuyerPersona, ICPPsychographics, ICPTriggers, ICPQualification, ICPBuyingJourney, ICPMessagingAngles, ICPChannels, PainTheme, VOCLanguageBank, VOCObjection, VOCImplications } from '../types'
import ResearchHistory from './ResearchHistory'
import { ToastContainer, type ToastType } from './Toast'

interface CampaignSettingsProps {
  campaign: Campaign
  campaignId: string
}

type SettingsTab = 'icp-overview' | 'voc' | 'history'
type ResearchStage = 'idle' | 'analyzing' | 'researching' | 'saving' | 'complete' | 'error'

export default function CampaignSettings({ campaign, campaignId }: CampaignSettingsProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<SettingsTab>('icp-overview')
  const [icpStage, setIcpStage] = useState<ResearchStage>('idle')
  const [vocStage, setVocStage] = useState<ResearchStage>('idle')
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: ToastType }>>([])
  const [showICPComparison, setShowICPComparison] = useState(false)
  const [showVOCComparison, setShowVOCComparison] = useState(false)
  const [icpWarningDismissed, setIcpWarningDismissed] = useState(false)
  const [vocWarningDismissed, setVocWarningDismissed] = useState(false)
  const [previousICPSnapshot, setPreviousICPSnapshot] = useState<{
    buyerPersonas: BuyerPersona[]
    firmographics: ICPFirmographics
    version: number | null
  } | null>(null)
  const [previousVOCSnapshot, setPreviousVOCSnapshot] = useState<{
    painThemes: PainTheme[]
    languageBank: VOCLanguageBank
    objections: VOCObjection[]
    version: number | null
  } | null>(null)
  
  const addToast = (message: string, type: ToastType) => {
    const id = Math.random().toString(36).substr(2, 9)
    setToasts((prev) => [...prev, { id, message, type }])
  }
  
  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }
  
  // Basic settings state
  const [icp, setIcp] = useState(campaign.icp || '')
  const [painPoints, setPainPoints] = useState(campaign.pain_points || '')
  const [offer, setOffer] = useState(campaign.offer || '')
  const [brief, setBrief] = useState(campaign.brief || '')
  
  // ICP structured state
  const [firmographics, setFirmographics] = useState<ICPFirmographics>(campaign.icp_firmographics || {})
  const [technographics, setTechnographics] = useState<ICPTechnographics>(campaign.icp_technographics || {})
  const [buyerPersonas, setBuyerPersonas] = useState<BuyerPersona[]>(campaign.icp_buyer_personas || [])
  const [psychographics, setPsychographics] = useState<ICPPsychographics>(campaign.icp_psychographics || {})
  const [triggers, setTriggers] = useState<ICPTriggers>(campaign.icp_triggers || {})
  const [qualification, setQualification] = useState<ICPQualification>(campaign.icp_qualification || {})
  const [buyingJourney, setBuyingJourney] = useState<ICPBuyingJourney>(campaign.icp_buying_journey || {})
  const [messagingAngles, setMessagingAngles] = useState<ICPMessagingAngles>(campaign.icp_messaging_angles || {})
  const [channels, setChannels] = useState<ICPChannels>(campaign.icp_channels || {})
  
  // VOC state
  const [painThemes, setPainThemes] = useState<PainTheme[]>(campaign.voc_pain_themes || [])
  const [languageBank, setLanguageBank] = useState<VOCLanguageBank>(campaign.voc_language_bank || {})
  const [objections, setObjections] = useState<VOCObjection[]>(campaign.voc_objections || [])
  const [implications, setImplications] = useState<VOCImplications>(campaign.voc_implications || {})

  useEffect(() => {
    setFirmographics(campaign.icp_firmographics || {})
    setTechnographics(campaign.icp_technographics || {})
    setBuyerPersonas(campaign.icp_buyer_personas || [])
    setPsychographics(campaign.icp_psychographics || {})
    setTriggers(campaign.icp_triggers || {})
    setQualification(campaign.icp_qualification || {})
    setBuyingJourney(campaign.icp_buying_journey || {})
    setMessagingAngles(campaign.icp_messaging_angles || {})
    setChannels(campaign.icp_channels || {})
    setPainThemes(campaign.voc_pain_themes || [])
    setLanguageBank(campaign.voc_language_bank || {})
    setObjections(campaign.voc_objections || [])
    setImplications(campaign.voc_implications || {})
    
    // Update ICP text from structured data if available, otherwise use legacy field
    if (campaign.icp_firmographics && Object.keys(campaign.icp_firmographics).length > 0) {
      // Will be formatted by formatICPAsReadableText when displayed
      const parts: string[] = []
      if (campaign.icp_firmographics.industry) parts.push(`Industry: ${campaign.icp_firmographics.industry}`)
      if (campaign.icp_firmographics.revenue_range_aud) parts.push(`Revenue Range: ${campaign.icp_firmographics.revenue_range_aud}`)
      if (campaign.icp_firmographics.employee_range) parts.push(`Employee Range: ${campaign.icp_firmographics.employee_range}`)
      if (campaign.icp_buyer_personas && campaign.icp_buyer_personas.length > 0) {
        parts.push('\nBuyer Personas:')
        campaign.icp_buyer_personas.forEach((p: any, idx: number) => {
          parts.push(`\n${idx + 1}. ${p.role || 'Unnamed Role'}`)
          if (p.responsibilities) parts.push(`   Responsibilities: ${p.responsibilities}`)
        })
      }
      if (campaign.icp_messaging_angles?.positioning_statement) {
        parts.push('\nPositioning Statement:')
        parts.push(campaign.icp_messaging_angles.positioning_statement)
      }
      setIcp(parts.join('\n') || campaign.icp || '')
    } else {
      setIcp(campaign.icp || '')
    }
    
    // Update Pain Points from VOC if available
    if (campaign.voc_pain_themes && campaign.voc_pain_themes.length > 0) {
      const parts: string[] = []
      campaign.voc_pain_themes.forEach((theme: any) => {
        parts.push(`• ${theme.theme || 'Unnamed Theme'}: ${theme.normalised_pain || ''}`)
      })
      if (campaign.voc_language_bank?.key_phrases) {
        const phrases = Object.values(campaign.voc_language_bank.key_phrases).flat()
        if (phrases.length > 0) {
          parts.push('\nKey Phrases:')
          parts.push(phrases.join(', '))
        }
      }
      setPainPoints(parts.join('\n') || campaign.pain_points || '')
    } else {
      setPainPoints(campaign.pain_points || '')
    }
    
    setOffer(campaign.offer || '')
    setBrief(campaign.brief || '')
  }, [campaign])

  const updateMutation = useMutation({
    mutationFn: (data: Partial<CampaignCreate>) => campaignApi.update(campaignId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
      queryClient.invalidateQueries({ queryKey: ['gap-analysis', campaignId] })
    },
  })

  // Research mutations with stage tracking
  const icpResearchMutation = useMutation({
    mutationFn: async () => {
      if (!campaign.industry) {
        throw new Error('Industry is required to run ICP research')
      }
      
      // Store previous snapshot if research exists
      if (hasICP) {
        setPreviousICPSnapshot({
          buyerPersonas: [...buyerPersonas],
          firmographics: { ...firmographics },
          version: campaign.research_version,
        })
      }
      
      // Stage 1: Analyzing
      setIcpStage('analyzing')
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Stage 2: Researching
      setIcpStage('researching')
      const result = await campaignApi.researchICP(
        campaignId,
        campaign.industry,
        campaign.geography || 'Australia',
        campaign.service_offering || '',
        campaign.additional_learnings || campaign.icp || ''
      )
      
      // Stage 3: Saving
      setIcpStage('saving')
      await new Promise(resolve => setTimeout(resolve, 300))
      
      return result
    },
    onSuccess: () => {
      setIcpStage('complete')
      addToast('ICP research completed successfully!', 'success')
      if (previousICPSnapshot) {
        setShowICPComparison(true)
      }
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
      queryClient.invalidateQueries({ queryKey: ['gap-analysis', campaignId] })
      setTimeout(() => setIcpStage('idle'), 2000)
    },
    onError: (error: Error) => {
      setIcpStage('error')
      addToast(`ICP research failed: ${error.message}`, 'error')
      setTimeout(() => setIcpStage('idle'), 3000)
    },
  })

  const vocResearchMutation = useMutation({
    mutationFn: async () => {
      if (!campaign.industry) {
        throw new Error('Industry is required to run VOC research')
      }
      
      // Store previous snapshot if research exists
      if (hasVOC) {
        setPreviousVOCSnapshot({
          painThemes: [...painThemes],
          languageBank: { ...languageBank },
          objections: [...objections],
          version: campaign.research_version,
        })
      }
      
      // Stage 1: Analyzing
      setVocStage('analyzing')
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Stage 2: Researching
      setVocStage('researching')
      const icpSummary = campaign.icp || 
        (campaign.icp_firmographics?.industry ? `${campaign.icp_firmographics.industry} companies` : `${campaign.industry} companies in ${campaign.geography || 'Australia'}`)
      const result = await campaignApi.researchVOC(
        campaignId,
        icpSummary,
        '',
        '',
        campaign.additional_learnings || campaign.pain_points || ''
      )
      
      // Stage 3: Saving
      setVocStage('saving')
      await new Promise(resolve => setTimeout(resolve, 300))
      
      return result
    },
    onSuccess: async () => {
      setVocStage('complete')
      addToast('Pain Points research completed successfully!', 'success')
      if (previousVOCSnapshot) {
        setShowVOCComparison(true)
      }
      
      // Auto-sync VOC results to Pain Points
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
      queryClient.invalidateQueries({ queryKey: ['gap-analysis', campaignId] })
      
      // Update pain points after a short delay to allow data to refresh
      setTimeout(async () => {
        const updatedCampaign = await campaignApi.get(campaignId)
        if (updatedCampaign.voc_pain_themes && updatedCampaign.voc_pain_themes.length > 0) {
          const parts: string[] = []
          updatedCampaign.voc_pain_themes.forEach((theme: any) => {
            parts.push(`• ${theme.theme || 'Unnamed Theme'}: ${theme.normalised_pain || ''}`)
          })
          if (updatedCampaign.voc_language_bank?.key_phrases) {
            const phrases = Object.values(updatedCampaign.voc_language_bank.key_phrases).flat()
            if (phrases.length > 0) {
              parts.push('\nKey Phrases:')
              parts.push(phrases.join(', '))
            }
          }
          setPainPoints(parts.join('\n'))
          addToast('Pain Points updated with VOC research findings', 'success')
        }
      }, 500)
      
      setTimeout(() => setVocStage('idle'), 2000)
    },
    onError: (error: Error) => {
      setVocStage('error')
      addToast(`Pain Points research failed: ${error.message}`, 'error')
      setTimeout(() => setVocStage('idle'), 3000)
    },
  })

  // Research status checks
  const hasICP = campaign.research_version !== null
  const hasVOC = campaign.voc_pain_themes && campaign.voc_pain_themes.length > 0
  const isStale = campaign.docs_last_processed_at && campaign.last_research_at &&
    new Date(campaign.docs_last_processed_at) > new Date(campaign.last_research_at)
  
  // Check if additional context is missing
  const hasAdditionalContext = !!(campaign.additional_learnings && campaign.additional_learnings.trim().length > 0) ||
    !!(campaign.brief && campaign.brief.trim().length > 0)
  
  const formatDate = (timestamp: string | null | undefined) => {
    if (!timestamp) return 'Never'
    const date = new Date(timestamp)
    return date.toLocaleString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Format ICP data as readable text
  const formatICPAsReadableText = (): string => {
    const parts: string[] = []
    
    if (firmographics.industry) {
      parts.push(`Industry: ${firmographics.industry}`)
    }
    if (firmographics.revenue_range_aud) {
      parts.push(`Revenue Range: ${firmographics.revenue_range_aud}`)
    }
    if (firmographics.employee_range) {
      parts.push(`Employee Range: ${firmographics.employee_range}`)
    }
    
    if (buyerPersonas.length > 0) {
      parts.push('\nBuyer Personas:')
      buyerPersonas.forEach((persona, idx) => {
        parts.push(`\n${idx + 1}. ${persona.role || 'Unnamed Role'}`)
        if (persona.responsibilities) {
          parts.push(`   Responsibilities: ${persona.responsibilities}`)
        }
      })
    }
    
    if (messagingAngles.positioning_statement) {
      parts.push('\nPositioning Statement:')
      parts.push(messagingAngles.positioning_statement)
    }
    
    return parts.join('\n')
  }

  // Format VOC data as readable text
  const formatVOCAsReadableText = (): string => {
    const parts: string[] = []
    
    if (painThemes.length > 0) {
      parts.push('Pain Themes:')
      painThemes.forEach((theme) => {
        const themeName = theme.theme || 'Unnamed Theme'
        const pain = theme.normalised_pain || ''
        parts.push(`• ${themeName}: ${pain}`)
      })
      parts.push('')
    }
    
    if (languageBank.key_phrases && Object.keys(languageBank.key_phrases).length > 0) {
      parts.push('Key Phrases:')
      const phrases = Object.values(languageBank.key_phrases).flat()
      parts.push(phrases.join(', '))
      parts.push('')
    }
    
    if (objections.length > 0) {
      parts.push('Objections:')
      objections.forEach((obj) => {
        const objection = obj.objection || 'Unnamed objection'
        const handling = obj.how_to_handle || ''
        parts.push(`• ${objection}: ${handling}`)
      })
    }
    
    return parts.join('\n')
  }

  // Progress indicator component
  const ProgressIndicator = ({ stage, type }: { stage: ResearchStage, type: 'icp' | 'voc' }) => {
    const stages = [
      { id: 'analyzing', label: 'Analyzing', icon: '🔍' },
      { id: 'researching', label: 'Researching', icon: '🤖' },
      { id: 'saving', label: 'Saving', icon: '💾' },
    ]
    
    const currentStageIndex = stages.findIndex(s => s.id === stage)
    const isActive = stage !== 'idle' && stage !== 'complete' && stage !== 'error'
    
    if (!isActive) return null
    
    return (
      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-4">
          {stages.map((s, idx) => {
            const isCompleted = idx < currentStageIndex
            const isCurrent = idx === currentStageIndex
            const isPending = idx > currentStageIndex
            
            return (
              <div key={s.id} className="flex items-center gap-2">
                <div className={`flex items-center gap-2 ${isCurrent ? 'font-medium' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                    isCompleted ? 'bg-green-500 text-white' :
                    isCurrent ? 'bg-blue-600 text-white animate-pulse' :
                    'bg-gray-200 text-gray-400'
                  }`}>
                    {isCompleted ? '✓' : isCurrent ? <Loader2 className="w-4 h-4 animate-spin" /> : s.icon}
                  </div>
                  <span className={`text-sm ${
                    isCompleted ? 'text-green-600' :
                    isCurrent ? 'text-blue-600' :
                    'text-gray-400'
                  }`}>
                    {s.label}
                  </span>
                </div>
                {idx < stages.length - 1 && (
                  <div className={`w-12 h-0.5 ${
                    isCompleted ? 'bg-green-500' :
                    isCurrent ? 'bg-blue-600' :
                    'bg-gray-200'
                  }`} />
                )}
              </div>
            )
          })}
        </div>
        {stage === 'complete' && (
          <div className="mt-2 text-sm text-green-600 font-medium">
            ✓ Research completed successfully!
          </div>
        )}
        {stage === 'error' && (
          <div className="mt-2 text-sm text-red-600 font-medium">
            ✗ Research failed. Please try again.
          </div>
        )}
      </div>
    )
  }

  const handleSaveBasic = () => {
    const updateData: Partial<CampaignCreate> = {}
    if (icp) updateData.icp = icp
    if (painPoints) updateData.pain_points = painPoints
    if (offer) updateData.offer = offer
    if (brief) updateData.brief = brief
    updateMutation.mutate(updateData)
  }

  const handleSaveICP = () => {
    // For now, we'll save structured ICP as JSON in the legacy icp field
    // In a full implementation, we'd have dedicated endpoints for structured data
    const icpJson = JSON.stringify({
      firmographics,
      technographics,
      buyer_personas: buyerPersonas,
      psychographics,
      triggers,
      qualification,
      buying_journey: buyingJourney,
      messaging_angles: messagingAngles,
      channels,
    }, null, 2)
    
    updateMutation.mutate({ icp: icpJson })
  }

  const handleSaveVOC = () => {
    // Similar to ICP, save as JSON in pain_points for now
    const vocJson = JSON.stringify({
      pain_themes: painThemes,
      language_bank: languageBank,
      objections,
      implications,
    }, null, 2)
    
    updateMutation.mutate({ pain_points: vocJson })
  }

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex items-center gap-4 border-b border-surface-gray">
        <button
          onClick={() => setActiveTab('icp-overview')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${
            activeTab === 'icp-overview'
              ? 'border-accent-green text-primary'
              : 'border-transparent text-text-light hover:text-primary'
          }`}
        >
          <User className="w-4 h-4" />
          ICP Overview
        </button>
        <button
          onClick={() => setActiveTab('voc')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${
            activeTab === 'voc'
              ? 'border-accent-green text-primary'
              : 'border-transparent text-text-light hover:text-primary'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Voice of Customer
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${
            activeTab === 'history'
              ? 'border-accent-green text-primary'
              : 'border-transparent text-text-light hover:text-primary'
          }`}
        >
          <History className="w-4 h-4" />
          History
        </button>
      </div>

      {/* ICP Overview Tab */}
      {activeTab === 'icp-overview' && (
        <div className="space-y-6">
          {/* Research Actions Section */}
          <div className="bg-surface rounded-xl border border-surface-gray p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-primary mb-1">ICP Research</h3>
                <p className="text-sm text-text-light">
                  Run ICP research to generate structured ICP data from your campaign information.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm text-text-light">
                  <span>Status:</span>
                  {icpStage === 'complete' || (hasICP && icpStage === 'idle') ? (
                    <span className="text-green-600 font-medium flex items-center gap-1">
                      <span>✓</span> Completed
                    </span>
                  ) : icpStage === 'error' ? (
                    <span className="text-red-600 font-medium">Error</span>
                  ) : icpStage !== 'idle' ? (
                    <span className="text-blue-600 font-medium">Running...</span>
                  ) : (
                    <span className="text-amber-600 font-medium">Not Run</span>
                  )}
                </div>
                {hasICP && campaign.last_research_at && icpStage === 'idle' && (
                  <div className="text-xs text-text-muted mt-1">
                    Last run: {formatDate(campaign.last_research_at)}
                  </div>
                )}
                {hasICP && icpStage === 'idle' && (
                  <div className="text-xs text-text-light mt-1">
                    Found {buyerPersonas.length} buyer persona{buyerPersonas.length !== 1 ? 's' : ''}, {Object.keys(firmographics).length > 0 ? 'firmographics' : ''} data
                  </div>
                )}
                {isStale && icpStage === 'idle' && (
                  <div className="text-xs text-blue-600 mt-1">
                    ⚠️ New documents available - refresh recommended
                  </div>
                )}
              </div>
              <button
                onClick={() => icpResearchMutation.mutate()}
                disabled={icpResearchMutation.isPending || !campaign.industry || icpStage !== 'idle'}
                className="flex items-center gap-2 px-4 py-2 bg-accent-green text-primary font-medium rounded-lg hover:bg-accent-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {icpResearchMutation.isPending || icpStage !== 'idle' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {hasICP ? 'Refresh ICP Research' : 'Run ICP Research'}
                  </>
                )}
              </button>
            </div>
            <ProgressIndicator stage={icpStage} type="icp" />
            
            {/* Comparison View */}
            {showICPComparison && previousICPSnapshot && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-primary">Research Comparison</h4>
                  <button
                    onClick={() => setShowICPComparison(false)}
                    className="text-xs text-text-light hover:text-primary"
                  >
                    Hide
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="opacity-60">
                    <div className="font-medium text-text-light mb-2">
                      Previous (v{previousICPSnapshot.version || '?'})
                    </div>
                    <div className="space-y-1 text-text-muted">
                      <div>{previousICPSnapshot.buyerPersonas.length} buyer persona{previousICPSnapshot.buyerPersonas.length !== 1 ? 's' : ''}</div>
                      <div>{previousICPSnapshot.firmographics.industry || 'No industry'}</div>
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-primary mb-2">
                      Current (v{campaign.research_version || '?'})
                    </div>
                    <div className="space-y-1 text-text-light">
                      <div className={buyerPersonas.length > previousICPSnapshot.buyerPersonas.length ? 'text-green-600 font-medium' : ''}>
                        {buyerPersonas.length} buyer persona{buyerPersonas.length !== 1 ? 's' : ''}
                        {buyerPersonas.length > previousICPSnapshot.buyerPersonas.length && ` (+${buyerPersonas.length - previousICPSnapshot.buyerPersonas.length})`}
                      </div>
                      <div className={firmographics.industry && firmographics.industry !== previousICPSnapshot.firmographics.industry ? 'text-green-600 font-medium' : ''}>
                        {firmographics.industry || 'No industry'}
                        {firmographics.industry && firmographics.industry !== previousICPSnapshot.firmographics.industry && ' (updated)'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Readable ICP Summary */}
          <div className="bg-surface rounded-xl border border-surface-gray p-6">
            <h3 className="text-lg font-bold text-primary mb-4">Ideal Customer Profile (ICP)</h3>
            <textarea
              value={icp}
              onChange={(e) => setIcp(e.target.value)}
              placeholder="Describe your ideal customer profile..."
              className="w-full min-h-[8rem] px-4 py-3 bg-surface-light border border-surface-gray rounded-lg text-primary placeholder-text-muted focus:border-accent-green focus:outline-none resize-y"
            />
            <p className="text-xs text-text-light mt-2">
              Who is your target customer? Include demographics, firmographics, and psychographics.
            </p>
          </div>

          {/* Structured ICP Data Sections */}
          <div className="bg-surface-light border border-surface-gray rounded-lg p-4 text-sm text-text-light mb-6">
            <p className="font-medium mb-1">Structured ICP Data</p>
            <p>This section displays structured ICP data generated by the ICP Definition Agent. Use the research endpoints to populate this data.</p>
          </div>

          {/* Firmographics */}
          <div className="bg-surface rounded-xl border border-surface-gray p-6">
            <h3 className="text-lg font-bold text-primary mb-4">Firmographics</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-text-light mb-1">Industry</label>
                <input
                  type="text"
                  value={firmographics.industry || ''}
                  onChange={(e) => setFirmographics({ ...firmographics, industry: e.target.value })}
                  className="w-full px-4 py-2 bg-surface-light border border-surface-gray rounded-lg text-primary"
                  placeholder="e.g., Mining & Resources"
                />
              </div>
              <div>
                <label className="block text-sm text-text-light mb-1">Revenue Range (AUD)</label>
                <input
                  type="text"
                  value={firmographics.revenue_range_aud || ''}
                  onChange={(e) => setFirmographics({ ...firmographics, revenue_range_aud: e.target.value })}
                  className="w-full px-4 py-2 bg-surface-light border border-surface-gray rounded-lg text-primary"
                  placeholder="e.g., $10M - $50M"
                />
              </div>
              <div>
                <label className="block text-sm text-text-light mb-1">Employee Range</label>
                <input
                  type="text"
                  value={firmographics.employee_range || ''}
                  onChange={(e) => setFirmographics({ ...firmographics, employee_range: e.target.value })}
                  className="w-full px-4 py-2 bg-surface-light border border-surface-gray rounded-lg text-primary"
                  placeholder="e.g., 50-200"
                />
              </div>
            </div>
          </div>

          {/* Buyer Personas */}
          <div className="bg-surface rounded-xl border border-surface-gray p-6">
            <h3 className="text-lg font-bold text-primary mb-4">Buyer Personas</h3>
            {buyerPersonas.length > 0 ? (
              <div className="space-y-4">
                {buyerPersonas.map((persona, idx) => (
                  <div key={idx} className="p-4 bg-surface-light rounded-lg border border-surface-gray">
                    <div className="mb-2">
                      <label className="block text-sm text-text-light mb-1">Role</label>
                      <input
                        type="text"
                        value={persona.role || ''}
                        onChange={(e) => {
                          const updated = [...buyerPersonas]
                          updated[idx] = { ...persona, role: e.target.value }
                          setBuyerPersonas(updated)
                        }}
                        className="w-full px-4 py-2 bg-surface border border-surface-gray rounded-lg text-primary"
                      />
                    </div>
                    <div className="mb-2">
                      <label className="block text-sm text-text-light mb-1">Responsibilities</label>
                      <textarea
                        value={persona.responsibilities || ''}
                        onChange={(e) => {
                          const updated = [...buyerPersonas]
                          updated[idx] = { ...persona, responsibilities: e.target.value }
                          setBuyerPersonas(updated)
                        }}
                        className="w-full px-4 py-2 bg-surface border border-surface-gray rounded-lg text-primary"
                        rows={2}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-light text-sm">No buyer personas defined. Run ICP research to populate.</p>
            )}
          </div>

          {/* Messaging Angles */}
          <div className="bg-surface rounded-xl border border-surface-gray p-6">
            <h3 className="text-lg font-bold text-primary mb-4">Messaging Angles</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-text-light mb-1">Positioning Statement</label>
                <textarea
                  value={messagingAngles.positioning_statement || ''}
                  onChange={(e) => setMessagingAngles({ ...messagingAngles, positioning_statement: e.target.value })}
                  className="w-full px-4 py-2 bg-surface-light border border-surface-gray rounded-lg text-primary"
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Pain Points */}
          <div className="bg-surface rounded-xl border border-surface-gray p-6">
            <h3 className="text-lg font-bold text-primary mb-4">Pain Points</h3>
            <textarea
              value={painPoints}
              onChange={(e) => setPainPoints(e.target.value)}
              placeholder="What problems does your ideal customer face?"
              className="w-full min-h-[8rem] px-4 py-3 bg-surface-light border border-surface-gray rounded-lg text-primary placeholder-text-muted focus:border-accent-green focus:outline-none resize-y"
            />
            <p className="text-xs text-text-light mt-2">
              List the key challenges, frustrations, or pain points your customers experience.
            </p>
          </div>

          {/* Offer */}
          <div className="bg-surface rounded-xl border border-surface-gray p-6">
            <h3 className="text-lg font-bold text-primary mb-4">Offer</h3>
            <textarea
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              placeholder="What are you offering?"
              className="w-full min-h-[8rem] px-4 py-3 bg-surface-light border border-surface-gray rounded-lg text-primary placeholder-text-muted focus:border-accent-green focus:outline-none resize-y"
            />
            <p className="text-xs text-text-light mt-2">
              Describe your offer, solution, or value proposition clearly.
            </p>
          </div>

          {/* Additional Context */}
          <div className="bg-surface rounded-xl border border-surface-gray p-6" data-context-field>
            <h3 className="text-lg font-bold text-primary mb-4">Additional Context</h3>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Any additional context, notes, or requirements..."
              className="w-full min-h-[8rem] px-4 py-3 bg-surface-light border border-surface-gray rounded-lg text-primary placeholder-text-muted focus:border-accent-green focus:outline-none resize-y"
            />
            <p className="text-xs text-text-light mt-2">
              Optional: Add any additional context that might help with copy generation.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={handleSaveICP}
              disabled={updateMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent-green text-primary font-medium rounded-xl hover:bg-accent-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {updateMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              Save ICP Overview
            </button>
          </div>
        </div>
      )}

      {/* ICP Tab - REMOVED - Content merged into ICP Overview */}
      {false && activeTab === 'icp' && (
        <div className="space-y-6">
          {/* Research Actions Section */}
          <div className="bg-surface rounded-xl border border-surface-gray p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-primary mb-1">ICP Research</h3>
                <p className="text-sm text-text-light">
                  Run ICP research to generate structured ICP data from your campaign information.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm text-text-light">
                  <span>Status:</span>
                  {icpStage === 'complete' || (hasICP && icpStage === 'idle') ? (
                    <span className="text-green-600 font-medium flex items-center gap-1">
                      <span>✓</span> Completed
                    </span>
                  ) : icpStage === 'error' ? (
                    <span className="text-red-600 font-medium">Error</span>
                  ) : icpStage !== 'idle' ? (
                    <span className="text-blue-600 font-medium">Running...</span>
                  ) : (
                    <span className="text-amber-600 font-medium">Not Run</span>
                  )}
                </div>
                {hasICP && campaign.last_research_at && icpStage === 'idle' && (
                  <div className="text-xs text-text-muted mt-1">
                    Last run: {formatDate(campaign.last_research_at)}
                  </div>
                )}
                {hasICP && icpStage === 'idle' && (
                  <div className="text-xs text-text-light mt-1">
                    Found {buyerPersonas.length} buyer persona{buyerPersonas.length !== 1 ? 's' : ''}, {Object.keys(firmographics).length > 0 ? 'firmographics' : ''} data
                  </div>
                )}
                {isStale && icpStage === 'idle' && (
                  <div className="text-xs text-blue-600 mt-1">
                    ⚠️ New documents available - refresh recommended
                  </div>
                )}
              </div>
              <button
                onClick={() => icpResearchMutation.mutate()}
                disabled={icpResearchMutation.isPending || !campaign.industry || icpStage !== 'idle'}
                className="flex items-center gap-2 px-4 py-2 bg-accent-green text-primary font-medium rounded-lg hover:bg-accent-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {icpResearchMutation.isPending || icpStage !== 'idle' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {hasICP ? 'Refresh ICP Research' : 'Run ICP Research'}
                  </>
                )}
              </button>
            </div>
            <ProgressIndicator stage={icpStage} type="icp" />
            
            {/* Comparison View */}
            {showICPComparison && previousICPSnapshot && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-primary">Research Comparison</h4>
                  <button
                    onClick={() => setShowICPComparison(false)}
                    className="text-xs text-text-light hover:text-primary"
                  >
                    Hide
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="opacity-60">
                    <div className="font-medium text-text-light mb-2">
                      Previous (v{previousICPSnapshot.version || '?'})
                    </div>
                    <div className="space-y-1 text-text-muted">
                      <div>{previousICPSnapshot.buyerPersonas.length} buyer persona{previousICPSnapshot.buyerPersonas.length !== 1 ? 's' : ''}</div>
                      <div>{previousICPSnapshot.firmographics.industry || 'No industry'}</div>
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-primary mb-2">
                      Current (v{campaign.research_version || '?'})
                    </div>
                    <div className="space-y-1 text-text-light">
                      <div className={buyerPersonas.length > previousICPSnapshot.buyerPersonas.length ? 'text-green-600 font-medium' : ''}>
                        {buyerPersonas.length} buyer persona{buyerPersonas.length !== 1 ? 's' : ''}
                        {buyerPersonas.length > previousICPSnapshot.buyerPersonas.length && ` (+${buyerPersonas.length - previousICPSnapshot.buyerPersonas.length})`}
                      </div>
                      <div className={firmographics.industry && firmographics.industry !== previousICPSnapshot.firmographics.industry ? 'text-green-600 font-medium' : ''}>
                        {firmographics.industry || 'No industry'}
                        {firmographics.industry && firmographics.industry !== previousICPSnapshot.firmographics.industry && ' (updated)'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-surface-light border border-surface-gray rounded-lg p-4 text-sm text-text-light">
            <p className="font-medium mb-1">Structured ICP Data</p>
            <p>This section displays structured ICP data generated by the ICP Definition Agent. Use the research endpoints to populate this data.</p>
          </div>

          {/* Firmographics */}
          <div className="bg-surface rounded-xl border border-surface-gray p-6">
            <h3 className="text-lg font-bold text-primary mb-4">Firmographics</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-text-light mb-1">Industry</label>
                <input
                  type="text"
                  value={firmographics.industry || ''}
                  onChange={(e) => setFirmographics({ ...firmographics, industry: e.target.value })}
                  className="w-full px-4 py-2 bg-surface border border-surface-gray rounded-lg text-primary"
                  placeholder="e.g., Mining & Resources"
                />
              </div>
              <div>
                <label className="block text-sm text-text-light mb-1">Revenue Range (AUD)</label>
                <input
                  type="text"
                  value={firmographics.revenue_range_aud || ''}
                  onChange={(e) => setFirmographics({ ...firmographics, revenue_range_aud: e.target.value })}
                  className="w-full px-4 py-2 bg-surface border border-surface-gray rounded-lg text-primary"
                  placeholder="e.g., $10M - $50M"
                />
              </div>
              <div>
                <label className="block text-sm text-text-light mb-1">Employee Range</label>
                <input
                  type="text"
                  value={firmographics.employee_range || ''}
                  onChange={(e) => setFirmographics({ ...firmographics, employee_range: e.target.value })}
                  className="w-full px-4 py-2 bg-surface border border-surface-gray rounded-lg text-primary"
                  placeholder="e.g., 50-200"
                />
              </div>
            </div>
          </div>

          {/* Buyer Personas */}
          <div className="bg-surface rounded-xl border border-surface-gray p-6">
            <h3 className="text-lg font-bold text-primary mb-4">Buyer Personas</h3>
            {buyerPersonas.length > 0 ? (
              <div className="space-y-4">
                {buyerPersonas.map((persona, idx) => (
                  <div key={idx} className="p-4 bg-surface rounded-lg border border-surface-gray">
                    <div className="mb-2">
                      <label className="block text-sm text-text-light mb-1">Role</label>
                      <input
                        type="text"
                        value={persona.role || ''}
                        onChange={(e) => {
                          const updated = [...buyerPersonas]
                          updated[idx] = { ...persona, role: e.target.value }
                          setBuyerPersonas(updated)
                        }}
                        className="w-full px-4 py-2 bg-surfaceer border border-surface-gray rounded-lg text-primary"
                      />
                    </div>
                    <div className="mb-2">
                      <label className="block text-sm text-text-light mb-1">Responsibilities</label>
                      <textarea
                        value={persona.responsibilities || ''}
                        onChange={(e) => {
                          const updated = [...buyerPersonas]
                          updated[idx] = { ...persona, responsibilities: e.target.value }
                          setBuyerPersonas(updated)
                        }}
                        className="w-full px-4 py-2 bg-surfaceer border border-surface-gray rounded-lg text-primary"
                        rows={2}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-light text-sm">No buyer personas defined. Run ICP research to populate.</p>
            )}
          </div>

          {/* Messaging Angles */}
          <div className="bg-surface rounded-xl border border-surface-gray p-6">
            <h3 className="text-lg font-bold text-primary mb-4">Messaging Angles</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-text-light mb-1">Positioning Statement</label>
                <textarea
                  value={messagingAngles.positioning_statement || ''}
                  onChange={(e) => setMessagingAngles({ ...messagingAngles, positioning_statement: e.target.value })}
                  className="w-full px-4 py-2 bg-surface border border-surface-gray rounded-lg text-primary"
                  rows={3}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={handleSaveICP}
              disabled={updateMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent-green text-primary font-medium rounded-xl hover:bg-accent-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {updateMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              Save ICP Data
            </button>
          </div>
        </div>
      )}

      {/* VOC Tab */}
      {activeTab === 'voc' && (
        <div className="space-y-6">
          {/* Research Actions Section */}
          <div className="bg-surface rounded-xl border border-surface-gray p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-primary mb-1">Pain Points Research</h3>
                <p className="text-sm text-text-light">
                  Run Pain Points research to extract customer language, pain themes, and objections.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm text-text-light">
                  <span>Status:</span>
                  {vocStage === 'complete' || (hasVOC && vocStage === 'idle') ? (
                    <span className="text-green-600 font-medium flex items-center gap-1">
                      <span>✓</span> Completed
                    </span>
                  ) : vocStage === 'error' ? (
                    <span className="text-red-600 font-medium">Error</span>
                  ) : vocStage !== 'idle' ? (
                    <span className="text-blue-600 font-medium">Running...</span>
                  ) : (
                    <span className="text-amber-600 font-medium">Not Run</span>
                  )}
                </div>
                {hasVOC && campaign.last_research_at && vocStage === 'idle' && (
                  <div className="text-xs text-text-muted mt-1">
                    Last run: {formatDate(campaign.last_research_at)}
                  </div>
                )}
                {hasVOC && vocStage === 'idle' && (
                  <div className="text-xs text-text-light mt-1">
                    Found {painThemes.length} pain theme{painThemes.length !== 1 ? 's' : ''}, {Object.keys(languageBank.key_phrases || {}).length || 0} key phrase{Object.keys(languageBank.key_phrases || {}).length !== 1 ? 's' : ''}, {objections.length} objection{objections.length !== 1 ? 's' : ''}
                  </div>
                )}
                {isStale && vocStage === 'idle' && (
                  <div className="text-xs text-blue-600 mt-1">
                    ⚠️ New documents available - refresh recommended
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setVocWarningDismissed(false)
                  vocResearchMutation.mutate()
                }}
                disabled={vocResearchMutation.isPending || !campaign.industry || vocStage !== 'idle'}
                className="flex items-center gap-2 px-4 py-2 bg-accent-green text-primary font-medium rounded-lg hover:bg-accent-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {vocResearchMutation.isPending || vocStage !== 'idle' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {hasVOC ? 'Refresh Pain Points Research' : 'Run Pain Points Research'}
                  </>
                )}
              </button>
            </div>
            
            {/* Inline Warning Banner */}
            {!hasAdditionalContext && !vocWarningDismissed && vocStage === 'idle' && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <span className="text-amber-600 text-xl">⚠️</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-900 mb-1">No additional context provided</p>
                    <p className="text-xs text-amber-700 mb-3">
                      Running research without context may produce generic results. Consider adding specific industry knowledge, customer pain points, or competitor information.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setActiveTab('icp-overview')
                          setTimeout(() => {
                            const contextField = document.querySelector('[data-context-field]')
                            contextField?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                          }, 100)
                        }}
                        className="px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                      >
                        Add Context
                      </button>
                      <button
                        onClick={() => {
                          setVocWarningDismissed(true)
                          vocResearchMutation.mutate()
                        }}
                        className="px-3 py-1.5 text-xs font-medium bg-surface border border-surface-gray text-text-light rounded-lg hover:bg-surface-light transition-colors"
                      >
                        Proceed Anyway
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <ProgressIndicator stage={vocStage} type="voc" />
            
            {/* Comparison View */}
            {showVOCComparison && previousVOCSnapshot && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-primary">Research Comparison</h4>
                  <button
                    onClick={() => setShowVOCComparison(false)}
                    className="text-xs text-text-light hover:text-primary"
                  >
                    Hide
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="opacity-60">
                    <div className="font-medium text-text-light mb-2">
                      Previous (v{previousVOCSnapshot.version || '?'})
                    </div>
                    <div className="space-y-1 text-text-muted">
                      <div>{previousVOCSnapshot.painThemes.length} pain theme{previousVOCSnapshot.painThemes.length !== 1 ? 's' : ''}</div>
                      <div>{Object.keys(previousVOCSnapshot.languageBank.key_phrases || {}).length} key phrase{Object.keys(previousVOCSnapshot.languageBank.key_phrases || {}).length !== 1 ? 's' : ''}</div>
                      <div>{previousVOCSnapshot.objections.length} objection{previousVOCSnapshot.objections.length !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-primary mb-2">
                      Current (v{campaign.research_version || '?'})
                    </div>
                    <div className="space-y-1 text-text-light">
                      <div className={painThemes.length > previousVOCSnapshot.painThemes.length ? 'text-green-600 font-medium' : ''}>
                        {painThemes.length} pain theme{painThemes.length !== 1 ? 's' : ''}
                        {painThemes.length > previousVOCSnapshot.painThemes.length && ` (+${painThemes.length - previousVOCSnapshot.painThemes.length})`}
                      </div>
                      <div className={Object.keys(languageBank.key_phrases || {}).length > Object.keys(previousVOCSnapshot.languageBank.key_phrases || {}).length ? 'text-green-600 font-medium' : ''}>
                        {Object.keys(languageBank.key_phrases || {}).length} key phrase{Object.keys(languageBank.key_phrases || {}).length !== 1 ? 's' : ''}
                        {Object.keys(languageBank.key_phrases || {}).length > Object.keys(previousVOCSnapshot.languageBank.key_phrases || {}).length && ` (+${Object.keys(languageBank.key_phrases || {}).length - Object.keys(previousVOCSnapshot.languageBank.key_phrases || {}).length})`}
                      </div>
                      <div className={objections.length > previousVOCSnapshot.objections.length ? 'text-green-600 font-medium' : ''}>
                        {objections.length} objection{objections.length !== 1 ? 's' : ''}
                        {objections.length > previousVOCSnapshot.objections.length && ` (+${objections.length - previousVOCSnapshot.objections.length})`}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-surface-light border border-surface-gray rounded-lg p-4 text-sm text-text-light">
            <p className="font-medium mb-1">Voice of Customer Data</p>
            <p>This section displays VOC data extracted by the Audience Voice Research Agent. Use the research endpoints to populate this data.</p>
          </div>

          {/* Pain Themes */}
          <div className="bg-surface rounded-xl border border-surface-gray p-6">
            <h3 className="text-lg font-bold text-primary mb-4">Pain Themes</h3>
            {painThemes.length > 0 ? (
              <div className="space-y-4">
                {painThemes.map((theme, idx) => (
                  <div key={idx} className="p-4 bg-surface rounded-lg border border-surface-gray">
                    <div className="mb-2">
                      <label className="block text-sm text-text-light mb-1">Theme</label>
                      <input
                        type="text"
                        value={theme.theme || ''}
                        onChange={(e) => {
                          const updated = [...painThemes]
                          updated[idx] = { ...theme, theme: e.target.value }
                          setPainThemes(updated)
                        }}
                        className="w-full px-4 py-2 bg-surfaceer border border-surface-gray rounded-lg text-primary"
                      />
                    </div>
                    <div className="mb-2">
                      <label className="block text-sm text-text-light mb-1">Normalised Pain</label>
                      <textarea
                        value={theme.normalised_pain || ''}
                        onChange={(e) => {
                          const updated = [...painThemes]
                          updated[idx] = { ...theme, normalised_pain: e.target.value }
                          setPainThemes(updated)
                        }}
                        className="w-full px-4 py-2 bg-surfaceer border border-surface-gray rounded-lg text-primary"
                        rows={2}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-light text-sm">No pain themes defined. Run VOC research to populate.</p>
            )}
          </div>

          {/* Language Bank */}
          <div className="bg-surface rounded-xl border border-surface-gray p-6">
            <h3 className="text-lg font-bold text-primary mb-4">Language Bank</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-text-light mb-1">Key Phrases</label>
                <textarea
                  value={Array.isArray(languageBank.phrases) ? languageBank.phrases.join(', ') : ''}
                  onChange={(e) => setLanguageBank({ ...languageBank, phrases: e.target.value.split(', ').filter(p => p) })}
                  className="w-full px-4 py-2 bg-surface border border-surface-gray rounded-lg text-primary"
                  rows={3}
                  placeholder="Comma-separated phrases"
                />
              </div>
            </div>
          </div>

          {/* Objections */}
          <div className="bg-surface rounded-xl border border-surface-gray p-6">
            <h3 className="text-lg font-bold text-primary mb-4">Objections</h3>
            {objections.length > 0 ? (
              <div className="space-y-4">
                {objections.map((obj, idx) => (
                  <div key={idx} className="p-4 bg-surface rounded-lg border border-surface-gray">
                    <label className="block text-sm text-text-light mb-1">Objection</label>
                    <textarea
                      value={obj.objection || ''}
                      onChange={(e) => {
                        const updated = [...objections]
                        updated[idx] = { ...obj, objection: e.target.value }
                        setObjections(updated)
                      }}
                      className="w-full px-4 py-2 bg-surfaceer border border-surface-gray rounded-lg text-primary"
                      rows={2}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-light text-sm">No objections defined. Run VOC research to populate.</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={handleSaveVOC}
              disabled={updateMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent-green text-primary font-medium rounded-xl hover:bg-accent-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {updateMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              Save VOC Data
            </button>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <ResearchHistory campaignId={campaignId} />
      )}

      {/* Success/Error Messages */}
      {updateMutation.isSuccess && (
        <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 text-green-400 text-sm">
          Settings saved successfully. Campaign context document will be regenerated automatically.
        </div>
      )}

      {updateMutation.isError && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-400 text-sm">
          Failed to save settings. Please try again.
        </div>
      )}
      </div>
    </>
  )
}
