import React from 'react';
import { AlertTriangle, ArrowRight, X } from 'lucide-react';

export default function UnsavedWarningModal({ isOpen, targetTabName, onConfirm, onCancel }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="glass-panel max-w-md w-full p-6 space-y-5 border-amber-500/40 shadow-2xl bg-slate-900/95 rounded-2xl relative">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Unsaved Progress Warning</h3>
            <p className="text-xs text-slate-300 mt-1">
              Switching tabs will discard any active layout configurations, bounding box edits, or uploaded images in this view.
            </p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-300 text-xs font-mono">
          Target View: <span className="font-bold text-white uppercase">{targetTabName}</span>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button onClick={onCancel} className="btn-secondary text-xs py-2 px-4">
            Cancel & Stay
          </button>

          <button
            onClick={onConfirm}
            className="btn-gold text-xs py-2 px-4 flex items-center gap-2 bg-gradient-to-r from-amber-500 to-red-600 text-white font-bold border-none"
          >
            <span>Discard & Switch</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
