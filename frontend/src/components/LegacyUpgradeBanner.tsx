import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkles, X, Loader2, ArrowRight } from 'lucide-react'
import { campaignApi } from '../api/client'
import type { Campaign } from '../types'

interface LegacyUpgradeBannerProps {
  campaign: Campaign
}

export default function LegacyUpgradeBanner({ campaign }: LegacyUpgradeBannerProps) {
  const queryClient = useQueryClient()
  const [dismissed, setDismissed] = useState(() => {
    // Check localStorage for dismissed state
    const dismissedKey = `legacy_banner_dismissed_${campaign.id}`
    return localStorage.getItem(dismissedKey) === 'true'
  })
  const [isUpgrading, setIsUpgrading] = useState(false)

  const isLegacyCampaign = () => {
    // Legacy campaign: no research_version or no structured ICP/VOC data
    const hasStructuredICP = campaign.icp_firmographics && Object.keys(campaign.icp_firmographics).length > 0
    const hasStructuredVOC = campaign.voc_pain_themes && campaign.voc_pain_themes.length > 0
    return !campaign.research_version && (!hasStructuredICP || !hasStructuredVOC)
  }

  const handleDismiss = () => {
    const dismissedKey = `legacy_banner_dismissed_${campaign.id}`
    localStorage.setItem(dismissedKey, 'true')
    setDismissed(true)
  }

  const upgradeMutation = useMutation({
    mutationFn: async () => {
      setIsUpgrading(true)
      
      // Run ICP research if industry is available
      if (campaign.industry) {
        try {
          await campaignApi.researchICP(
            campaign.id,
            campaign.industry,
            campaign.geography || 'Australia',
            campaign.service_offering || '',
            campaign.icp || ''
          )
        } catch (error) {
          console.error('ICP research failed:', error)
          // Continue with VOC even if ICP fails
        }
      }

      // Run VOC research
      if (campaign.industry) {
        try {
          const icpSummary = campaign.icp || `${campaign.industry} companies in ${campaign.geography || 'Australia'}`
          await campaignApi.researchVOC(
            campaign.id,
            icpSummary,
            '', // competitors
            '', // platforms_priority
            campaign.pain_points || ''
          )
        } catch (error) {
          console.error('VOC research failed:', error)
        }
      }

      setIsUpgrading(false)
    },
    onSuccess: () => {
      // Refresh campaign data
      queryClient.invalidateQueries({ queryKey: ['campaign', campaign.id] })
      queryClient.invalidateQueries({ queryKey: ['research-history', campaign.id] })
      queryClient.invalidateQueries({ queryKey: ['gap-analysis', campaign.id] })
      
      // Dismiss banner after successful upgrade
      handleDismiss()
    },
    onError: () => {
      setIsUpgrading(false)
    },
  })

  const handleUpgrade = () => {
    if (!campaign.industry) {
      alert('Please add an industry to your campaign settings before upgrading.')
      return
    }
    upgradeMutation.mutate()
  }

  // Don't show if not legacy or already dismissed
  if (!isLegacyCampaign() || dismissed) {
    return null
  }

  return (
    <div className="bg-gradient-to-r from-accent-electric/20 to-blue-500/20 border border-accent-electric/50 rounded-xl p-6 mb-6 relative">
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 p-1 text-zinc-400 hover:text-white transition-colors"
        disabled={isUpgrading}
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-4">
        <div className="mt-1">
          <Sparkles className="w-6 h-6 text-accent-electric" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white mb-2">
            Upgrade Your Campaign with AI Research
          </h3>
          <p className="text-sm text-zinc-300 mb-4">
            This campaign was created before our structured research features. Upgrade now to get:
          </p>
          <ul className="space-y-2 mb-4 text-sm text-zinc-300">
            <li className="flex items-start gap-2">
              <span className="text-accent-electric mt-0.5">✓</span>
              <span><strong>Structured ICP Definition</strong> - Detailed firmographics, buyer personas, and messaging angles</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent-electric mt-0.5">✓</span>
              <span><strong>Voice of Customer Research</strong> - Real customer language, pain themes, and objections</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent-electric mt-0.5">✓</span>
              <span><strong>Version History</strong> - Track research iterations and compare versions</span>
            </li>
          </ul>
          <div className="flex items-center gap-3">
            <button
              onClick={handleUpgrade}
              disabled={isUpgrading || !campaign.industry}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent-electric text-surface-dark font-medium rounded-xl hover:bg-accent-electric/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isUpgrading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Upgrading...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Upgrade Now
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            {!campaign.industry && (
              <p className="text-xs text-zinc-400">
                Add an industry in campaign settings to enable upgrade
              </p>
            )}
            <button
              onClick={handleDismiss}
              disabled={isUpgrading}
              className="text-sm text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>

      {upgradeMutation.isError && (
        <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
          <p className="text-sm text-red-400">
            Upgrade failed. Please try again or contact support if the issue persists.
          </p>
        </div>
      )}
    </div>
  )
}
