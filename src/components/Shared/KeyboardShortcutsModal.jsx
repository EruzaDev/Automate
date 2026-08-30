import React from 'react';
import { X, Keyboard, Command, Layout, Image as ImageIcon, FileSpreadsheet, Sparkles } from 'lucide-react';

export default function KeyboardShortcutsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const shortcutGroups = [
    {
      title: 'Global & Navigation',
      icon: <Command className="w-4 h-4 text-indigo-400" />,
      items: [
        { keys: ['Ctrl', '1'], label: 'Switch to Certificate Layout Studio' },
        { keys: ['Ctrl', '2'], label: 'Switch to Frame Compositor' },
        { keys: ['Ctrl', 'Shift', 'D'], label: 'Toggle Dark / Light Theme' },
        { keys: ['?'], label: 'Open / Close Shortcuts Help' },
        { keys: ['Esc'], label: 'Close Active Modal / Deselect Field' }
      ]
    },
    {
      title: 'Certificate Layout Studio',
      icon: <Layout className="w-4 h-4 text-amber-400" />,
      items: [
        { keys: ['Enter'], label: 'Deselect Active Canvas Box' },
        { keys: ['Delete'], label: 'Delete Selected Canvas Box' },
        { keys: ['Ctrl', 'D'], label: 'Duplicate Selected Canvas Box' },
        { keys: ['↑', '↓', '←', '→'], label: 'Nudge Selected Box position (1%)' },
        { keys: ['Shift', 'Arrows'], label: 'Fast Nudge Selected Box position (5%)' },
        { keys: ['←', '→'], label: 'Next / Previous CSV Record Preview (No selection)' },
        { keys: ['Ctrl', 'Enter'], label: 'Trigger Batch Zip Export' }
      ]
    },
    {
      title: 'Frame Compositor',
      icon: <ImageIcon className="w-4 h-4 text-purple-400" />,
      items: [
        { keys: ['↑', '↓'] , label: 'Cycle Documentation Photo Preview' },
        { keys: ['[' , ']'], label: 'Previous / Next Photo Record' },
        { keys: ['Ctrl', 'A'], label: 'Select All / Deselect All Photos' },
        { keys: ['Ctrl', 'Enter'], label: 'Trigger Frame Batch Export' }
      ]
    },
    {
      title: 'Smart Drag & Drop Uploads',
      icon: <FileSpreadsheet className="w-4 h-4 text-emerald-400" />,
      items: [
        { keys: ['.csv', '.xlsx'], label: 'Drop anywhere to import CSV/Excel records' },
        { keys: ['.png', '.jpg'], label: 'Drop onto stage to load Layouts or Frames' },
        { keys: ['.ttf', '.otf'], label: 'Drop font files to register Custom Fonts' }
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
      <div className="glass-panel w-full max-w-2xl overflow-hidden shadow-2xl border-indigo-500/30 flex flex-col max-h-[85vh] animate-scale-up">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-700/40 flex items-center justify-between bg-indigo-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-main flex items-center gap-2">
                Keyboard Shortcuts & Hotkeys <Sparkles className="w-4 h-4 text-amber-400" />
              </h2>
              <p className="text-xs text-slate-400">Boost your design productivity with quick key controls</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {shortcutGroups.map((group, idx) => (
              <div key={idx} className="glass-panel p-4 space-y-3 border-slate-800/80">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-800/60">
                  {group.icon}
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-300">
                    {group.title}
                  </h3>
                </div>

                <div className="space-y-2.5">
                  {group.items.map((item, itemIdx) => (
                    <div key={itemIdx} className="flex items-center justify-between text-xs gap-3">
                      <span className="text-slate-400 font-medium">{item.label}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {item.keys.map((key, kIdx) => (
                          <kbd
                            key={kIdx}
                            className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-800/80 text-amber-400 border border-slate-700 shadow-sm"
                          >
                            {key}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400 bg-slate-900/40">
          <span>Tip: Press <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-amber-400 border border-slate-700">?</kbd> anytime to open this guide.</span>
          <button onClick={onClose} className="btn-primary text-xs py-1.5 px-4">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
