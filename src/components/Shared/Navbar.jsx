import React from 'react';
import { Image as ImageIcon, LayoutGrid, Sun, Moon } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, onLoadPresetData, theme, onToggleTheme }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 glass-panel !rounded-none backdrop-blur-2xl px-4 lg:px-8 py-3 shadow-2xl transition-colors duration-300">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Clean Brand Title */}
        <h1 className="font-black text-2xl tracking-tight">
          Automate
        </h1>

        <div className="flex items-center gap-3">
          {/* Studio Navigation Tabs */}
          <nav className="flex items-center gap-1.5 p-1.5 rounded-2xl glass-panel shadow-inner">
            <button
              onClick={() => setActiveTab('interactive')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'interactive'
                  ? 'bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-slate-950 shadow-lg shadow-amber-500/20'
                  : 'text-slate-400 hover:text-amber-400 hover:bg-amber-500/10'
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
                  : 'text-slate-400 hover:text-purple-400 hover:bg-purple-500/10'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              Automate Framing
            </button>
          </nav>

          {/* Light / Dark Mode Toggle Button */}
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-xl border border-amber-500/30 glass-panel text-amber-400 hover:border-amber-400 transition-all shadow hover:scale-105 active:scale-95 cursor-pointer"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-amber-400" />
            ) : (
              <Moon className="w-5 h-5 text-indigo-500" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
