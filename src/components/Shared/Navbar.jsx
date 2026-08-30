import React from 'react';
import { Image as ImageIcon, Contact, LayoutGrid } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, onLoadPresetData }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#080c14]/90 backdrop-blur-2xl px-4 lg:px-8 py-3 shadow-2xl">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Clean Brand Title */}
        <h1 className="font-black text-2xl tracking-tight text-white">
          Automate
        </h1>

        {/* Studio Navigation Tabs */}
        <nav className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-950/90 border border-slate-800/80 shadow-inner">
          <button
            onClick={() => setActiveTab('interactive')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'interactive'
                ? 'bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            Certificate
          </button>

          <button
            onClick={() => setActiveTab('frames')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'frames'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            Automate Framing
          </button>
        </nav>
      </div>
    </header>
  );
}
