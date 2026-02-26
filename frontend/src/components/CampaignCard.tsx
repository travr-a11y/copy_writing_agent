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
      className="group block bg-surface rounded-xl border border-surface-gray hover:border-accent-green shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-primary group-hover:text-accent-green transition-colors">
              {campaign.name}
            </h3>
            <div className="flex items-center gap-2 mt-1 text-text-light text-xs">
              <Clock className="w-3 h-3" />
              <span>{createdDate}</span>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-text-light group-hover:text-accent-green group-hover:translate-x-1 transition-all flex-shrink-0 ml-2" />
        </div>

        {/* ICP Preview */}
        {campaign.icp && (
          <p className="text-sm text-text-light line-clamp-2 mb-4">
            {campaign.icp}
          </p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 pt-4 border-t border-surface-gray">
          <div className="flex items-center gap-2 text-text-light">
            <FileText className="w-4 h-4" />
            <span className="text-sm">{docCount} docs</span>
          </div>
          <div className="flex items-center gap-2 text-text-light">
            <MessageSquare className="w-4 h-4" />
            <span className="text-sm">{variantCount} variants</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
