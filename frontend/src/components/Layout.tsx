import { Link, useLocation } from 'react-router-dom'
import { FileText, Plus, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="border-b border-surface-lighter bg-surface-dark/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-electric to-accent-coral flex items-center justify-center transform group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white font-display">CopyWrite</h1>
                <p className="text-xs text-zinc-500">AU Email Drafting</p>
              </div>
            </Link>

            <nav className="flex items-center gap-4">
              <Link
                to="/"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  location.pathname === '/'
                    ? 'bg-surface-lighter text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-surface-light'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span className="text-sm font-medium">Campaigns</span>
              </Link>

              <Link
                to="/campaigns/new"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-electric text-surface-dark font-medium text-sm hover:bg-accent-electric/90 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>New Campaign</span>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-lighter mt-auto">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <p className="text-xs text-zinc-600 text-center">
            AU-centric email copy drafting system • Local MVP
          </p>
        </div>
      </footer>
    </div>
  )
}
