import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Loader2 } from 'lucide-react'
import { campaignApi } from '../api/client'
import type { Campaign, CampaignUpdate } from '../types'

interface CampaignSettingsProps {
  campaign: Campaign
  campaignId: string
}

export default function CampaignSettings({ campaign, campaignId }: CampaignSettingsProps) {
  const queryClient = useQueryClient()
  const [icp, setIcp] = useState(campaign.icp)
  const [painPoints, setPainPoints] = useState(campaign.pain_points)
  const [offer, setOffer] = useState(campaign.offer)
  const [brief, setBrief] = useState(campaign.brief || '')

  const updateMutation = useMutation({
    mutationFn: (data: CampaignUpdate) => campaignApi.update(campaignId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
      queryClient.invalidateQueries({ queryKey: ['gap-analysis', campaignId] })
    },
  })

  const handleSave = () => {
    updateMutation.mutate({
      icp: icp ?? '',
      pain_points: painPoints ?? '',
      offer: offer ?? '',
      brief: brief || null,
    })
  }

  return (
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
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent-electric text-surface-dark font-medium rounded-xl hover:bg-accent-electric/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {updateMutation.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          Save Settings
        </button>
      </div>

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
