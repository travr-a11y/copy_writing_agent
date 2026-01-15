import { useState, useCallback } from 'react'
import { Upload, FileText, X, Loader2, Wand2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { documentApi } from '../api/client'
import type { Document, TagSuggestion } from '../types'
import TagSuggestModal from './TagSuggestModal'

interface DocumentUploaderProps {
  campaignId: string
  documents: Document[]
  preSelectedDocType?: string
  onUploadComplete?: () => void
}

export default function DocumentUploader({ 
  campaignId, 
  documents,
  preSelectedDocType,
  onUploadComplete 
}: DocumentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [suggestingDoc, setSuggestingDoc] = useState<Document | null>(null)
  const [suggestions, setSuggestions] = useState<TagSuggestion | null>(null)
  const queryClient = useQueryClient()

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
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
          isDragging
            ? 'border-accent-electric bg-accent-electric/10'
            : preSelectedDocType
            ? 'border-accent-electric bg-accent-electric/5'
            : 'border-surface-lighter hover:border-zinc-600'
        }`}
      >
        <input
          type="file"
          multiple
          accept=".csv,.docx,.txt,.md"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <Upload className={`w-8 h-8 mx-auto mb-3 ${isDragging || preSelectedDocType ? 'text-accent-electric' : 'text-zinc-600'}`} />
        <p className="text-sm text-zinc-400">
          Drop files here or click to upload
        </p>
        {preSelectedDocType && (
          <p className="text-xs text-accent-electric mt-1 font-medium">
            Will be tagged as: {preSelectedDocType}
          </p>
        )}
        <p className="text-xs text-zinc-600 mt-1">
          CSV, DOCX, TXT, MD
        </p>
        {uploadMutation.isPending && (
          <div className="absolute inset-0 bg-surface/80 flex items-center justify-center rounded-xl">
            <Loader2 className="w-6 h-6 text-accent-electric animate-spin" />
          </div>
        )}
      </div>

      {/* Document list */}
      {documents.length > 0 && (
        <div className="space-y-2">
          {/* De-duplicate by document ID */}
          {Array.from(
            new Map(documents.map(doc => [doc.id, doc])).values()
          ).map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-4 bg-surface-light rounded-xl border border-surface-lighter"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-zinc-500" />
                <div>
                  <p className="text-sm font-medium text-white">{doc.filename}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {doc.doc_type && (
                      <span className="text-xs px-2 py-0.5 bg-accent-electric/20 text-accent-electric rounded">
                        {doc.doc_type}
                      </span>
                    )}
                    {doc.processed === 1 && (
                      <span className="text-xs text-zinc-500">
                        {doc.chunk_count} chunks
                      </span>
                    )}
                    {doc.processed === 0 && !doc.doc_type && (
                      <span className="text-xs text-amber-500">
                        Needs tagging
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {doc.processed === 0 && (
                  <button
                    onClick={() => handleSuggestTags(doc)}
                    disabled={suggestMutation.isPending || suggestingDoc?.id === doc.id}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-accent-electric hover:bg-accent-electric/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="p-1.5 text-zinc-500 hover:text-accent-coral hover:bg-accent-coral/10 rounded-lg transition-colors"
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
    </div>
  )
}
