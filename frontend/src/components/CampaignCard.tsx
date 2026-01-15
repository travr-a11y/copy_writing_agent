import { Link } from 'react-router-dom'
import { FileText, MessageSquare, ChevronRight, Clock } from 'lucide-react'
import type { Campaign } from '../types'

interface CampaignCardProps {
  campaign: Campaign
}

export default function CampaignCard({ campaign }: CampaignCardProps) {
  const docCount = campaign.document_count ?? campaign.documents?.length ?? 0
  const variantCount = campaign.variant_count ?? campaign.variants?.length ?? 0
  const createdDate = new Date(campaign.created_at).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <Link
      to={`/campaigns/${campaign.id}`}
      className="group block bg-surface-light rounded-2xl border border-surface-lighter hover:border-accent-electric/50 transition-all duration-300 overflow-hidden"
    >
      {/* Top accent bar */}
      <div className="h-1 bg-gradient-to-r from-accent-electric via-accent-coral to-accent-lime opacity-60 group-hover:opacity-100 transition-opacity" />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-white group-hover:text-accent-electric transition-colors">
              {campaign.name}
            </h3>
            <div className="flex items-center gap-2 mt-1 text-zinc-500 text-xs">
              <Clock className="w-3 h-3" />
              <span>{createdDate}</span>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-accent-electric group-hover:translate-x-1 transition-all" />
        </div>

        {/* ICP Preview */}
        <p className="text-sm text-zinc-400 line-clamp-2 mb-4">
          {campaign.icp}
        </p>

        {/* Stats */}
        <div className="flex items-center gap-4 pt-4 border-t border-surface-lighter">
          <div className="flex items-center gap-2 text-zinc-500">
            <FileText className="w-4 h-4" />
            <span className="text-sm">{docCount} docs</span>
          </div>
          <div className="flex items-center gap-2 text-zinc-500">
            <MessageSquare className="w-4 h-4" />
            <span className="text-sm">{variantCount} variants</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
