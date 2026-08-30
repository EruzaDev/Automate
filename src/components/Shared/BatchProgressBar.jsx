import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Loader2, CheckCircle2, Download, XCircle } from 'lucide-react';

export default function BatchProgressBar({
  progress,
  total,
  zipPercent = 0,
  currentFile = '',
  phase = 'rendering',
  currentVolume = 1,
  totalVolumes = 1,
  isExporting,
  isFinished,
  onClose,
  onCancel
}) {
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

  const isPacking = phase === 'packing';
  const renderPercentage = total > 0 ? Math.round((progress / total) * 100) : 0;
  const currentPercent = isPacking ? zipPercent : renderPercentage;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
      <div className="glass-panel-accent p-6 max-w-md w-full text-center space-y-5 shadow-2xl">
        {isFinished ? (
          <>
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
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
              className="btn-primary w-full justify-center font-bold"
            >
              <Download className="w-4 h-4" />
              Done
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 flex items-center justify-center mx-auto animate-pulse">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            </div>
            <div className="space-y-1">
              {totalVolumes > 1 && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-mono font-bold mb-1">
                  <span>ZIP Volume {currentVolume || 1} of {totalVolumes}</span>
                </div>
              )}
              <h3 className="text-xl font-bold text-white">
                {isPacking
                  ? (totalVolumes > 1 ? `Packing Volume ${currentVolume} of ${totalVolumes}...` : 'Packing ZIP Archive...')
                  : 'Generating Batch Assets...'}
              </h3>
              <p className="text-sm text-[var(--text-muted)] mt-1 font-mono">
                {isPacking
                  ? `Compressing & packaging ZIP file (${zipPercent}%)...`
                  : `Rendering item ${progress} of ${total}`}
              </p>
              {isPacking && currentFile && (
                <div className="mt-2 p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-amber-300 truncate shadow-inner">
                  📦 {currentFile}
                </div>
              )}
            </div>
            
            {/* Progress Bar Container */}
            <div className="space-y-2">
              <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isPacking
                      ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-400 shadow-lg shadow-amber-500/50'
                      : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500'
                  }`}
                  style={{ width: `${currentPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-xs font-semibold text-[var(--text-muted)] font-mono">
                <span>{currentPercent}%</span>
                <span>
                  {isPacking ? `Packing ${zipPercent}%` : `${progress} / ${total} Assets`}
                </span>
              </div>
            </div>

            {/* Cancel Button */}
            {onCancel && (
              <button
                onClick={onCancel}
                className="w-full py-2.5 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer"
              >
                <XCircle className="w-4 h-4" /> Cancel Generation
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
