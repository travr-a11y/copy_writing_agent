import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Loader2, Settings, User, MessageSquare, History } from 'lucide-react'
import { campaignApi } from '../api/client'
import type { Campaign, CampaignCreate, ICPFirmographics, ICPTechnographics, BuyerPersona, ICPPsychographics, ICPTriggers, ICPQualification, ICPBuyingJourney, ICPMessagingAngles, ICPChannels, PainTheme, VOCLanguageBank, VOCObjection, VOCImplications } from '../types'
import ResearchHistory from './ResearchHistory'

interface CampaignSettingsProps {
  campaign: Campaign
  campaignId: string
}

type SettingsTab = 'basic' | 'icp' | 'voc' | 'history'

export default function CampaignSettings({ campaign, campaignId }: CampaignSettingsProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<SettingsTab>('basic')
  
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
    setIcp(campaign.icp || '')
    setPainPoints(campaign.pain_points || '')
    setOffer(campaign.offer || '')
    setBrief(campaign.brief || '')
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
  }, [campaign])

  const updateMutation = useMutation({
    mutationFn: (data: Partial<CampaignCreate>) => campaignApi.update(campaignId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
      queryClient.invalidateQueries({ queryKey: ['gap-analysis', campaignId] })
    },
  })

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
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex items-center gap-4 border-b border-surface-lighter">
        <button
          onClick={() => setActiveTab('basic')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${
            activeTab === 'basic'
              ? 'border-accent-electric text-white'
              : 'border-transparent text-zinc-500 hover:text-white'
          }`}
        >
          <Settings className="w-4 h-4" />
          Basic Settings
        </button>
        <button
          onClick={() => setActiveTab('icp')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${
            activeTab === 'icp'
              ? 'border-accent-electric text-white'
              : 'border-transparent text-zinc-500 hover:text-white'
          }`}
        >
          <User className="w-4 h-4" />
          ICP
        </button>
        <button
          onClick={() => setActiveTab('voc')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${
            activeTab === 'voc'
              ? 'border-accent-electric text-white'
              : 'border-transparent text-zinc-500 hover:text-white'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Voice of Customer
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${
            activeTab === 'history'
              ? 'border-accent-electric text-white'
              : 'border-transparent text-zinc-500 hover:text-white'
          }`}
        >
          <History className="w-4 h-4" />
          History
        </button>
      </div>

      {/* Basic Settings Tab */}
      {activeTab === 'basic' && (
        <div className="space-y-6">
          <div className="bg-surface-light rounded-xl border border-surface-lighter p-6">
            <h3 className="text-lg font-bold text-white mb-4">Ideal Customer Profile (ICP)</h3>
            <textarea
              value={icp}
              onChange={(e) => setIcp(e.target.value)}
              placeholder="Describe your ideal customer profile..."
              className="w-full h-32 px-4 py-3 bg-surface border border-surface-lighter rounded-lg text-white placeholder-zinc-500 focus:border-accent-electric focus:outline-none resize-none"
            />
            <p className="text-xs text-zinc-500 mt-2">
              Who is your target customer? Include demographics, firmographics, and psychographics.
            </p>
          </div>

          <div className="bg-surface-light rounded-xl border border-surface-lighter p-6">
            <h3 className="text-lg font-bold text-white mb-4">Pain Points</h3>
            <textarea
              value={painPoints}
              onChange={(e) => setPainPoints(e.target.value)}
              placeholder="What problems does your ideal customer face?"
              className="w-full h-32 px-4 py-3 bg-surface border border-surface-lighter rounded-lg text-white placeholder-zinc-500 focus:border-accent-electric focus:outline-none resize-none"
            />
            <p className="text-xs text-zinc-500 mt-2">
              List the key challenges, frustrations, or pain points your customers experience.
            </p>
          </div>

          <div className="bg-surface-light rounded-xl border border-surface-lighter p-6">
            <h3 className="text-lg font-bold text-white mb-4">Offer</h3>
            <textarea
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              placeholder="What are you offering?"
              className="w-full h-32 px-4 py-3 bg-surface border border-surface-lighter rounded-lg text-white placeholder-zinc-500 focus:border-accent-electric focus:outline-none resize-none"
            />
            <p className="text-xs text-zinc-500 mt-2">
              Describe your offer, solution, or value proposition clearly.
            </p>
          </div>

          <div className="bg-surface-light rounded-xl border border-surface-lighter p-6">
            <h3 className="text-lg font-bold text-white mb-4">Additional Context</h3>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Any additional context, notes, or requirements..."
              className="w-full h-32 px-4 py-3 bg-surface border border-surface-lighter rounded-lg text-white placeholder-zinc-500 focus:border-accent-electric focus:outline-none resize-none"
            />
            <p className="text-xs text-zinc-500 mt-2">
              Optional: Add any additional context that might help with copy generation.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={handleSaveBasic}
              disabled={updateMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent-electric text-surface-dark font-medium rounded-xl hover:bg-accent-electric/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {updateMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              Save Basic Settings
            </button>
          </div>
        </div>
      )}

      {/* ICP Tab */}
      {activeTab === 'icp' && (
        <div className="space-y-6">
          <div className="bg-zinc-500/10 border border-zinc-500/30 rounded-lg p-4 text-sm text-zinc-400">
            <p className="font-medium mb-1">Structured ICP Data</p>
            <p>This section displays structured ICP data generated by the ICP Definition Agent. Use the research endpoints to populate this data.</p>
          </div>

          {/* Firmographics */}
          <div className="bg-surface-light rounded-xl border border-surface-lighter p-6">
            <h3 className="text-lg font-bold text-white mb-4">Firmographics</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Industry</label>
                <input
                  type="text"
                  value={firmographics.industry || ''}
                  onChange={(e) => setFirmographics({ ...firmographics, industry: e.target.value })}
                  className="w-full px-4 py-2 bg-surface border border-surface-lighter rounded-lg text-white"
                  placeholder="e.g., Mining & Resources"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Revenue Range (AUD)</label>
                <input
                  type="text"
                  value={firmographics.revenue_range_aud || ''}
                  onChange={(e) => setFirmographics({ ...firmographics, revenue_range_aud: e.target.value })}
                  className="w-full px-4 py-2 bg-surface border border-surface-lighter rounded-lg text-white"
                  placeholder="e.g., $10M - $50M"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Employee Range</label>
                <input
                  type="text"
                  value={firmographics.employee_range || ''}
                  onChange={(e) => setFirmographics({ ...firmographics, employee_range: e.target.value })}
                  className="w-full px-4 py-2 bg-surface border border-surface-lighter rounded-lg text-white"
                  placeholder="e.g., 50-200"
                />
              </div>
            </div>
          </div>

          {/* Buyer Personas */}
          <div className="bg-surface-light rounded-xl border border-surface-lighter p-6">
            <h3 className="text-lg font-bold text-white mb-4">Buyer Personas</h3>
            {buyerPersonas.length > 0 ? (
              <div className="space-y-4">
                {buyerPersonas.map((persona, idx) => (
                  <div key={idx} className="p-4 bg-surface rounded-lg border border-surface-lighter">
                    <div className="mb-2">
                      <label className="block text-sm text-zinc-400 mb-1">Role</label>
                      <input
                        type="text"
                        value={persona.role || ''}
                        onChange={(e) => {
                          const updated = [...buyerPersonas]
                          updated[idx] = { ...persona, role: e.target.value }
                          setBuyerPersonas(updated)
                        }}
                        className="w-full px-4 py-2 bg-surface-lighter border border-surface-lighter rounded-lg text-white"
                      />
                    </div>
                    <div className="mb-2">
                      <label className="block text-sm text-zinc-400 mb-1">Responsibilities</label>
                      <textarea
                        value={persona.responsibilities || ''}
                        onChange={(e) => {
                          const updated = [...buyerPersonas]
                          updated[idx] = { ...persona, responsibilities: e.target.value }
                          setBuyerPersonas(updated)
                        }}
                        className="w-full px-4 py-2 bg-surface-lighter border border-surface-lighter rounded-lg text-white"
                        rows={2}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-500 text-sm">No buyer personas defined. Run ICP research to populate.</p>
            )}
          </div>

          {/* Messaging Angles */}
          <div className="bg-surface-light rounded-xl border border-surface-lighter p-6">
            <h3 className="text-lg font-bold text-white mb-4">Messaging Angles</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Positioning Statement</label>
                <textarea
                  value={messagingAngles.positioning_statement || ''}
                  onChange={(e) => setMessagingAngles({ ...messagingAngles, positioning_statement: e.target.value })}
                  className="w-full px-4 py-2 bg-surface border border-surface-lighter rounded-lg text-white"
                  rows={3}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={handleSaveICP}
              disabled={updateMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent-electric text-surface-dark font-medium rounded-xl hover:bg-accent-electric/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
          <div className="bg-zinc-500/10 border border-zinc-500/30 rounded-lg p-4 text-sm text-zinc-400">
            <p className="font-medium mb-1">Voice of Customer Data</p>
            <p>This section displays VOC data extracted by the Audience Voice Research Agent. Use the research endpoints to populate this data.</p>
          </div>

          {/* Pain Themes */}
          <div className="bg-surface-light rounded-xl border border-surface-lighter p-6">
            <h3 className="text-lg font-bold text-white mb-4">Pain Themes</h3>
            {painThemes.length > 0 ? (
              <div className="space-y-4">
                {painThemes.map((theme, idx) => (
                  <div key={idx} className="p-4 bg-surface rounded-lg border border-surface-lighter">
                    <div className="mb-2">
                      <label className="block text-sm text-zinc-400 mb-1">Theme</label>
                      <input
                        type="text"
                        value={theme.theme || ''}
                        onChange={(e) => {
                          const updated = [...painThemes]
                          updated[idx] = { ...theme, theme: e.target.value }
                          setPainThemes(updated)
                        }}
                        className="w-full px-4 py-2 bg-surface-lighter border border-surface-lighter rounded-lg text-white"
                      />
                    </div>
                    <div className="mb-2">
                      <label className="block text-sm text-zinc-400 mb-1">Normalised Pain</label>
                      <textarea
                        value={theme.normalised_pain || ''}
                        onChange={(e) => {
                          const updated = [...painThemes]
                          updated[idx] = { ...theme, normalised_pain: e.target.value }
                          setPainThemes(updated)
                        }}
                        className="w-full px-4 py-2 bg-surface-lighter border border-surface-lighter rounded-lg text-white"
                        rows={2}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-500 text-sm">No pain themes defined. Run VOC research to populate.</p>
            )}
          </div>

          {/* Language Bank */}
          <div className="bg-surface-light rounded-xl border border-surface-lighter p-6">
            <h3 className="text-lg font-bold text-white mb-4">Language Bank</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Key Phrases</label>
                <textarea
                  value={Array.isArray(languageBank.phrases) ? languageBank.phrases.join(', ') : ''}
                  onChange={(e) => setLanguageBank({ ...languageBank, phrases: e.target.value.split(', ').filter(p => p) })}
                  className="w-full px-4 py-2 bg-surface border border-surface-lighter rounded-lg text-white"
                  rows={3}
                  placeholder="Comma-separated phrases"
                />
              </div>
            </div>
          </div>

          {/* Objections */}
          <div className="bg-surface-light rounded-xl border border-surface-lighter p-6">
            <h3 className="text-lg font-bold text-white mb-4">Objections</h3>
            {objections.length > 0 ? (
              <div className="space-y-4">
                {objections.map((obj, idx) => (
                  <div key={idx} className="p-4 bg-surface rounded-lg border border-surface-lighter">
                    <label className="block text-sm text-zinc-400 mb-1">Objection</label>
                    <textarea
                      value={obj.objection || ''}
                      onChange={(e) => {
                        const updated = [...objections]
                        updated[idx] = { ...obj, objection: e.target.value }
                        setObjections(updated)
                      }}
                      className="w-full px-4 py-2 bg-surface-lighter border border-surface-lighter rounded-lg text-white"
                      rows={2}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-500 text-sm">No objections defined. Run VOC research to populate.</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={handleSaveVOC}
              disabled={updateMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent-electric text-surface-dark font-medium rounded-xl hover:bg-accent-electric/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
  )
}
