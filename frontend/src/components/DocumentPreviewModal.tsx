import { useState, useEffect } from 'react'
import { X, Download, Loader2 } from 'lucide-react'
import { documentApi } from '../api/client'
import type { Document } from '../types'

interface DocumentPreviewModalProps {
  document: Document
  isOpen: boolean
  onClose: () => void
}

export default function DocumentPreviewModal({ document, isOpen, onClose }: DocumentPreviewModalProps) {
  const [content, setContent] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && document) {
      setIsLoading(true)
      setError(null)
      documentApi.getContent(document.id)
        .then((data) => {
          setContent(data.content || '')
          setIsLoading(false)
        })
        .catch((err) => {
          setError(err.message || 'Failed to load document content')
          setIsLoading(false)
        })
    }
  }, [isOpen, document])

  const handleDownload = () => {
    const downloadUrl = `/api/documents/${document.id}/download`
    const link = window.document.createElement('a')
    link.href = downloadUrl
    link.download = document.filename
    window.document.body.appendChild(link)
    link.click()
    window.document.body.removeChild(link)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div 
        className="bg-surface rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface-gray">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-primary">{document.filename}</h3>
            <span className="text-xs text-text-muted px-2 py-1 bg-surface-light rounded">
              {document.file_type.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-surface-light rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
            <button
              onClick={onClose}
              className="p-2 text-text-light hover:text-primary hover:bg-surface-light rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-accent-green animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 mb-2">Error loading document</p>
              <p className="text-sm text-text-light">{error}</p>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap font-mono text-sm text-primary bg-surface-light p-4 rounded-lg border border-surface-gray max-h-full overflow-auto">
              {content || 'No content available'}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}
