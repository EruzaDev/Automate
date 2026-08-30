import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Loader2, CheckCircle2, Download } from 'lucide-react';

export default function BatchProgressBar({ progress, total, isExporting, isFinished, onClose }) {
  useEffect(() => {
    if (isFinished) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [isFinished]);

  if (!isExporting && !isFinished) return null;

  const percentage = total > 0 ? Math.round((progress / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
      <div className="glass-panel-accent p-6 max-w-md w-full text-center space-y-5">
        {isFinished ? (
          <>
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Batch Export Complete!</h3>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                Successfully processed {total} assets and generated ZIP archive.
              </p>
            </div>
            <button
              onClick={onClose}
              className="btn-primary w-full justify-center"
            >
              <Download className="w-4 h-4" />
              Done
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 flex items-center justify-center mx-auto animate-pulse">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Generating Batch Assets...</h3>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                Rendering item {progress} of {total}
              </p>
            </div>
            
            {/* Progress Bar Container */}
            <div className="space-y-2">
              <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <div className="flex justify-between text-xs font-semibold text-[var(--text-muted)]">
                <span>{percentage}%</span>
                <span>{progress} / {total} Assets</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
