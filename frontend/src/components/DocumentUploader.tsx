import { useState, useCallback, useEffect } from 'react'
import { Upload, FileText, X, Loader2, Wand2, RefreshCw, Sparkles, Eye, Download } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { documentApi } from '../api/client'
import type { Document, TagSuggestion, Campaign } from '../types'
import TagSuggestModal from './TagSuggestModal'
import DocumentPreviewModal from './DocumentPreviewModal'

interface DocumentUploaderProps {
  campaignId: string
  campaign?: Campaign
  documents: Document[]
  preSelectedDocType?: string
  onUploadComplete?: () => void
  onRunICPResearch?: () => void
  onRunVOCResearch?: () => void
  isICPResearchPending?: boolean
  isVOCResearchPending?: boolean
}

export default function DocumentUploader({ 
  campaignId, 
  campaign,
  documents,
  preSelectedDocType,
  onUploadComplete,
  onRunICPResearch,
  onRunVOCResearch,
  isICPResearchPending = false,
  isVOCResearchPending = false,
}: DocumentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [suggestingDoc, setSuggestingDoc] = useState<Document | null>(null)
  const [suggestions, setSuggestions] = useState<TagSuggestion | null>(null)
  const [showResearchBanner, setShowResearchBanner] = useState(false)
  const [previousDocCount, setPreviousDocCount] = useState(documents.length)
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null)
  const queryClient = useQueryClient()

  // Check if research is stale after document upload
  useEffect(() => {
    if (campaign && documents.length > previousDocCount) {
      // Document was just uploaded
      const hasICP = campaign.research_version !== null
      const hasVOC = campaign.voc_pain_themes && campaign.voc_pain_themes.length > 0
      const isStale = campaign.docs_last_processed_at && campaign.last_research_at &&
        new Date(campaign.docs_last_processed_at) > new Date(campaign.last_research_at)
      
      if (hasICP && hasVOC && isStale) {
        setShowResearchBanner(true)
      }
      setPreviousDocCount(documents.length)
    } else if (documents.length !== previousDocCount) {
      // Update count even if banner doesn't show
      setPreviousDocCount(documents.length)
    }
  }, [documents.length, campaign, previousDocCount])

  // Check research status
  const hasICP = campaign?.research_version !== null
  const hasVOC = campaign?.voc_pain_themes && campaign.voc_pain_themes.length > 0
  const isStale = campaign?.docs_last_processed_at && campaign?.last_research_at &&
    new Date(campaign.docs_last_processed_at) > new Date(campaign.last_research_at)

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const metadata: Partial<Document> = {}
      if (preSelectedDocType) {
        metadata.doc_type = preSelectedDocType as any
      }
      return documentApi.upload(campaignId, file, metadata)
    },
    onSuccess: async (document) => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
      
      // If doc_type was pre-selected, auto-process
      if (preSelectedDocType && document.processed === 0) {
        try {
          await processMutation.mutateAsync(document.id)
          onUploadComplete?.()
        } catch (e) {
          // If processing fails, still call callback
          onUploadComplete?.()
        }
      } else {
        onUploadComplete?.()
      }
    },
  })

  const suggestMutation = useMutation({
    mutationFn: (docId: string) => documentApi.suggestTags(docId),
    onSuccess: (data) => {
      setSuggestions(data)
    },
  })

  const processMutation = useMutation({
    mutationFn: (docId: string) => documentApi.process(docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
      queryClient.invalidateQueries({ queryKey: ['gap-analysis', campaignId] })
      onUploadComplete?.()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => documentApi.delete(docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
    },
  })

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    files.forEach((file) => uploadMutation.mutate(file))
  }, [uploadMutation])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    files.forEach((file) => uploadMutation.mutate(file))
  }

  const handleSuggestTags = async (doc: Document) => {
    // Reset any previous state
    setSuggestingDoc(null)
    setSuggestions(null)
    
    // Set the document and trigger suggestion
    setSuggestingDoc(doc)
    try {
      const result = await suggestMutation.mutateAsync(doc.id)
      setSuggestions(result)
    } catch (error) {
      console.error('Failed to suggest tags:', error)
      setSuggestingDoc(null)
    }
  }

  const handleApplyTags = async (tags: Partial<Document>) => {
    if (suggestingDoc) {
      await documentApi.update(suggestingDoc.id, tags)
      await processMutation.mutateAsync(suggestingDoc.id)
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
      queryClient.invalidateQueries({ queryKey: ['gap-analysis', campaignId] })
      setSuggestingDoc(null)
      setSuggestions(null)
      onUploadComplete?.()
    }
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        data-upload-area
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all bg-surface ${
          isDragging
            ? 'border-accent-green bg-accent-green/10'
            : preSelectedDocType
            ? 'border-accent-green bg-accent-green/5'
            : 'border-surface-gray hover:border-accent-green'
        }`}
      >
        <input
          type="file"
          multiple
          accept=".csv,.docx,.txt,.md"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <Upload className={`w-8 h-8 mx-auto mb-3 ${isDragging || preSelectedDocType ? 'text-accent-green' : 'text-text-light'}`} />
        <p className="text-sm text-text-light">
          Drop files here or click to upload
        </p>
        {preSelectedDocType && (
          <p className="text-xs text-accent-green mt-1 font-medium">
            Will be tagged as: {preSelectedDocType}
          </p>
        )}
        <p className="text-xs text-text-muted mt-1">
          CSV, DOCX, TXT, MD
        </p>
        {uploadMutation.isPending && (
          <div className="absolute inset-0 bg-surface/80 flex items-center justify-center rounded-xl">
            <Loader2 className="w-6 h-6 text-accent-green animate-spin" />
          </div>
        )}
      </div>

      {/* Research Refresh Banner - Show after upload when research is stale */}
      {showResearchBanner && campaign && hasICP && hasVOC && isStale && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <RefreshCw className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900 mb-1">
                  New documents uploaded
                </p>
                <p className="text-xs text-blue-700">
                  Refresh research to include new documents in your knowledge bank.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowResearchBanner(false)}
              className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3">
            {onRunICPResearch && (
              <button
                onClick={() => {
                  onRunICPResearch()
                  setShowResearchBanner(false)
                }}
                disabled={isICPResearchPending || !campaign.industry}
                className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-surface-gray text-primary font-medium text-sm rounded-lg hover:border-accent-green disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isICPResearchPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                Refresh ICP Research
              </button>
            )}
            {onRunVOCResearch && (
              <button
                onClick={() => {
                  onRunVOCResearch()
                  setShowResearchBanner(false)
                }}
                disabled={isVOCResearchPending || !campaign.industry}
                className="flex items-center gap-2 px-3 py-1.5 bg-accent-green text-primary font-medium text-sm rounded-lg hover:bg-accent-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isVOCResearchPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                Refresh Pain Points Research
              </button>
            )}
          </div>
        </div>
      )}

      {/* Document list */}
      {documents.length > 0 && (
        <div className="space-y-2">
          {/* De-duplicate by document ID */}
          {Array.from(
            new Map(documents.map(doc => [doc.id, doc])).values()
          ).map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-4 bg-surface rounded-xl border border-surface-gray shadow-sm"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-text-light" />
                <div>
                  <p className="text-sm font-medium text-primary">{doc.filename}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {doc.doc_type && (
                      <span className="text-xs px-2 py-0.5 bg-accent-green/20 text-accent-green rounded">
                        {doc.doc_type}
                      </span>
                    )}
                    {doc.processed === 1 && (
                      <span className="text-xs text-text-muted">
                        {doc.chunk_count} chunks
                      </span>
                    )}
                    {doc.processed === 0 && !doc.doc_type && (
                      <span className="text-xs text-amber-600">
                        Needs tagging
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewDoc(doc)}
                  className="p-1.5 text-text-light hover:text-accent-green hover:bg-accent-green/10 rounded-lg transition-colors"
                  title="Preview document"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <a
                  href={documentApi.downloadUrl(doc.id)}
                  download={doc.filename}
                  className="p-1.5 text-text-light hover:text-accent-green hover:bg-accent-green/10 rounded-lg transition-colors"
                  title="Download document"
                >
                  <Download className="w-4 h-4" />
                </a>
                {doc.processed === 0 && (
                  <button
                    onClick={() => handleSuggestTags(doc)}
                    disabled={suggestMutation.isPending || suggestingDoc?.id === doc.id}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-accent-green hover:bg-accent-green/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {suggestMutation.isPending && suggestingDoc?.id === doc.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Wand2 className="w-3 h-3" />
                    )}
                    AI Tags
                  </button>
                )}
                <button
                  onClick={() => deleteMutation.mutate(doc.id)}
                  className="p-1.5 text-text-light hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                  title="Delete document"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tag suggestion modal */}
      {suggestingDoc && (
        <TagSuggestModal
          document={suggestingDoc}
          suggestions={suggestions}
          isLoading={suggestMutation.isPending}
          onApply={handleApplyTags}
          onClose={() => {
            setSuggestingDoc(null)
            setSuggestions(null)
          }}
        />
      )}

      {/* Document preview modal */}
      {previewDoc && (
        <DocumentPreviewModal
          document={previewDoc}
          isOpen={!!previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  )
}
