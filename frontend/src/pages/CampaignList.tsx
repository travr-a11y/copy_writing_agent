import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, FileText, Loader2 } from 'lucide-react'
import { campaignApi } from '../api/client'
import CampaignCard from '../components/CampaignCard'

export default function CampaignList() {
  const { data: campaigns, isLoading, error } = useQuery({
    queryKey: ['campaigns'],
    queryFn: campaignApi.list,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-accent-green animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Error loading campaigns</p>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary font-display">Campaigns</h1>
        <p className="text-text-light mt-1">Manage your email copy campaigns</p>
        <div className="h-1 w-20 bg-accent-green mt-3"></div>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div></div>
        <Link
          to="/campaigns/new"
          className="flex items-center gap-2 px-5 py-2.5 bg-accent-green text-primary font-medium rounded-lg hover:bg-accent-green/90 transition-all"
        >
          <Plus className="w-5 h-5" />
          New Campaign
        </Link>
      </div>

      {/* Campaign grid */}
      {campaigns && campaigns.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((campaign, index) => (
            <div
              key={campaign.id}
              className="animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <CampaignCard campaign={campaign} />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-surface rounded-xl border border-surface-gray shadow-sm">
          <FileText className="w-12 h-12 text-text-light mx-auto mb-4" />
          <h3 className="text-lg font-medium text-primary mb-2">No campaigns yet</h3>
          <p className="text-text-light mb-6">Create your first campaign to get started</p>
          <Link
            to="/campaigns/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-green text-primary font-medium rounded-lg hover:bg-accent-green/90 transition-all"
          >
            <Plus className="w-5 h-5" />
            Create Campaign
          </Link>
        </div>
      )}
    </div>
  )
}
