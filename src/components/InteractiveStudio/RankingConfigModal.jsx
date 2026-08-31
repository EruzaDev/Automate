import React, { useState } from 'react';
import { Trophy, X, Check, Award, Sliders, Users, Sparkles } from 'lucide-react';

export default function RankingConfigModal({
  isOpen,
  onClose,
  headers = [],
  scoreColumn = '',
  setScoreColumn,
  titleScheme = 'championship',
  setTitleScheme,
  onApplyRanking
}) {
  const [selectedScoreCol, setSelectedScoreCol] = useState(scoreColumn || (headers[0] || ''));
  const [selectedScheme, setSelectedScheme] = useState(titleScheme || 'championship');
  const [teamCount, setTeamCount] = useState(3);
  const [customTitles, setCustomTitles] = useState({
    1: 'Champion',
    2: '1st Runner-Up',
    3: '2nd Runner-Up',
    4: '4th Place',
    5: '5th Place'
  });

  if (!isOpen) return null;

  const handleSave = () => {
    setScoreColumn(selectedScoreCol);
    setTitleScheme(selectedScheme);
    if (onApplyRanking) {
      onApplyRanking({
        scoreColumn: selectedScoreCol,
        titleScheme: selectedScheme,
        teamCount: Number(teamCount) || 3,
        customTitles
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-100 flex items-center gap-2">
                Configure Ranking & Awards
              </h2>
              <p className="text-xs text-slate-400">
                Set up scores, top winners print count, and placement award titles
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
          {/* 1. Score Column Picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              1. Select Score / Ranking Column:
            </label>
            <select
              value={selectedScoreCol}
              onChange={(e) => setSelectedScoreCol(e.target.value)}
              className="select-dark text-xs py-2 w-full font-mono text-amber-300"
            >
              <option value="">(No Sorting / File Order)</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  Sorted by Score Column: "{h}"
                </option>
              ))}
            </select>
          </div>

          {/* 2. Number of Teams / Winners */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              2. How many Top Teams / Winners to generate?
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="500"
                value={teamCount}
                onChange={(e) => setTeamCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="input-dark text-xs py-1.5 px-3 w-28 font-mono text-cyan-300 font-bold"
              />
              <span className="text-xs text-slate-400">top ranking participants</span>
            </div>
          </div>

          {/* 3. Award Title Scheme */}
          <div className="space-y-2 pt-1 border-t border-slate-800">
            <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              3. Award Title Scheme:
            </label>

            <div className="grid grid-cols-1 gap-2">
              <label
                onClick={() => setSelectedScheme('championship')}
                className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                  selectedScheme === 'championship'
                    ? 'bg-amber-500/10 border-amber-400 text-amber-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="font-bold text-xs">Champion Scheme</div>
                  <div className="text-[11px] text-slate-400">Champion, 1st Runner-Up, 2nd Runner-Up</div>
                </div>
                {selectedScheme === 'championship' && <Check className="w-4 h-4 text-amber-400" />}
              </label>

              <label
                onClick={() => setSelectedScheme('ordinal_words')}
                className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                  selectedScheme === 'ordinal_words'
                    ? 'bg-amber-500/10 border-amber-400 text-amber-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="font-bold text-xs">First Place Scheme</div>
                  <div className="text-[11px] text-slate-400">First Place, Second Place, Third Place</div>
                </div>
                {selectedScheme === 'ordinal_words' && <Check className="w-4 h-4 text-amber-400" />}
              </label>

              <label
                onClick={() => setSelectedScheme('mixed')}
                className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                  selectedScheme === 'mixed'
                    ? 'bg-amber-500/10 border-amber-400 text-amber-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="font-bold text-xs">Mixed Champion & Placement</div>
                  <div className="text-[11px] text-slate-400">Champion, Second Place, Third Place</div>
                </div>
                {selectedScheme === 'mixed' && <Check className="w-4 h-4 text-amber-400" />}
              </label>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="btn-secondary text-xs px-4 py-1.5"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn-primary text-xs px-5 py-1.5 font-bold flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950"
          >
            <Sparkles className="w-3.5 h-3.5" /> Apply Ranking & Print Settings
          </button>
        </div>
      </div>
    </div>
  );
}
