import React, { useState } from 'react';
import { Activity, BarChart3, ChevronLeft, ChevronRight, Droplets, Palette, SlidersHorizontal, Sun, X } from 'lucide-react';
import { DEFAULT_PHOTO_ADJUSTMENTS, hasPhotoAdjustments } from '../../utils/photoAdjustments';

const groups = [
  { title: 'Light', icon: Sun, controls: [
    ['brightness', 'Brightness', -100, 100], ['contrast', 'Contrast', -100, 100]
  ] },
  { title: 'Color', icon: Palette, controls: [
    ['hue', 'Hue', -180, 180, '°'], ['saturation', 'Saturation', -100, 100]
  ] },
  { title: 'Tone', icon: SlidersHorizontal, controls: [
    ['exposure', 'Exposure', -2, 2, ' EV', 0.1],
    ['highlights', 'Highlights', -100, 100], ['shadows', 'Shadows', -100, 100],
    ['whites', 'Whites', -100, 100], ['blacks', 'Blacks', -100, 100]
  ] },
  { title: 'Balance', icon: Droplets, controls: [
    ['redCyan', 'Cyan / Red', -100, 100],
    ['greenMagenta', 'Magenta / Green', -100, 100],
    ['blueYellow', 'Yellow / Blue', -100, 100]
  ] },
  { title: 'Levels', icon: BarChart3, controls: [
    ['levelBlack', 'Black point', 0, 254], ['gamma', 'Midtone gamma', 0.2, 3, '', 0.05],
    ['levelWhite', 'White point', 1, 255]
  ] },
  { title: 'Curves', icon: Activity, controls: [
    ['curveShadows', 'Shadows', -100, 100],
    ['curveMidtones', 'Midtones', -100, 100],
    ['curveHighlights', 'Highlights', -100, 100]
  ] }
];

function CurveGraph({ adjustments }) {
  const points = Array.from({ length: 65 }, (_, index) => {
    const x = index / 64;
    const shift = (
      adjustments.curveShadows * Math.exp(-(((x - 0.18) / 0.2) ** 2)) +
      adjustments.curveMidtones * Math.exp(-(((x - 0.5) / 0.23) ** 2)) +
      adjustments.curveHighlights * Math.exp(-(((x - 0.82) / 0.2) ** 2))
    ) / 200;
    const y = Math.max(0, Math.min(1, x + shift));
    return `${index === 0 ? 'M' : 'L'}${(x * 100).toFixed(1)},${((1 - y) * 100).toFixed(1)}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label="Tone curve preview" className="col-span-full w-full h-20 rounded-lg bg-slate-950 border border-slate-700">
      <path d="M0 100 L100 0" stroke="#475569" strokeWidth="0.7" fill="none" />
      <path d="M25 0 V100 M50 0 V100 M75 0 V100 M0 25 H100 M0 50 H100 M0 75 H100" stroke="#334155" strokeWidth="0.4" fill="none" />
      <path d={points} stroke="#c084fc" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function LevelsGraph({ adjustments }) {
  const black = adjustments.levelBlack / 255;
  const white = adjustments.levelWhite / 255;
  const points = Array.from({ length: 65 }, (_, index) => {
    const x = index / 64;
    const y = Math.pow(Math.max(0, Math.min(1, (x - black) / (white - black))), 1 / adjustments.gamma);
    return `${index === 0 ? 'M' : 'L'}${(x * 100).toFixed(1)},${((1 - y) * 100).toFixed(1)}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label="Levels transfer graph" className="col-span-full w-full h-20 rounded-lg bg-slate-950 border border-slate-700">
      <path d="M0 100 L100 0" stroke="#475569" strokeWidth="0.7" fill="none" />
      <path d="M25 0 V100 M50 0 V100 M75 0 V100 M0 25 H100 M0 50 H100 M0 75 H100" stroke="#334155" strokeWidth="0.4" fill="none" />
      <path d={points} stroke="#c084fc" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

export default function PhotoAdjustmentsPanel({ photoName, photoIndex, photoCount, onSelectPhoto, adjustments, onChange }) {
  const [activeGroup, setActiveGroup] = useState(null);
  const selectedGroup = groups.find((group) => group.title === activeGroup);
  const update = (key, value) => {
    const next = { ...adjustments, [key]: Number(value) };
    if (next.levelBlack >= next.levelWhite) {
      if (key === 'levelBlack') next.levelWhite = Math.min(255, next.levelBlack + 1);
      else next.levelBlack = Math.max(0, next.levelWhite - 1);
    }
    onChange(next);
  };

  return (
    <div className="rounded-xl border border-purple-500/40 bg-slate-900/90 p-1.5 shadow-sm" aria-label="Photo adjustments">
      <div className="flex items-center gap-1.5 min-w-0">
        <div className="flex items-center gap-0.5 shrink-0 border-r border-slate-700 pr-1.5" aria-label="Choose photo to adjust">
          <button type="button" onClick={() => onSelectPhoto(Math.max(0, photoIndex - 1))}
            disabled={!photoName || photoIndex === 0} aria-label="Previous photo"
            className="h-7 w-6 rounded-md flex items-center justify-center text-slate-200 hover:bg-slate-800 disabled:opacity-30"><ChevronLeft className="w-3.5 h-3.5" /></button>
          <span className="font-mono text-[11px] text-purple-200 whitespace-nowrap">{photoName ? `${photoIndex + 1}/${photoCount}` : '0/0'}</span>
          <button type="button" onClick={() => onSelectPhoto(Math.min(photoCount - 1, photoIndex + 1))}
            disabled={!photoName || photoIndex >= photoCount - 1} aria-label="Next photo"
            className="h-7 w-6 rounded-md flex items-center justify-center text-slate-200 hover:bg-slate-800 disabled:opacity-30"><ChevronRight className="w-3.5 h-3.5" /></button>
        </div>
        <div className="flex items-center gap-0.5 overflow-x-auto min-w-0 flex-1" aria-label="Adjustment categories">
          {groups.map((group) => {
            const Icon = group.icon;
            const changed = group.controls.some(([key]) => adjustments[key] !== DEFAULT_PHOTO_ADJUSTMENTS[key]);
            return (
              <button key={group.title} type="button" disabled={!photoName}
                onClick={() => setActiveGroup(activeGroup === group.title ? null : group.title)}
                aria-pressed={activeGroup === group.title}
                title={`${group.title} adjustments${changed ? ' (edited)' : ''}`}
                className={`h-7 px-2 shrink-0 rounded-md flex items-center gap-1 text-[11px] font-semibold transition-colors disabled:opacity-30 ${
                  activeGroup === group.title ? 'bg-purple-600 text-white' : changed ? 'bg-purple-500/20 text-purple-200 hover:bg-purple-500/30' : 'text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />{group.title}{changed && <span className="w-1 h-1 rounded-full bg-amber-300" />}
              </button>
            );
          })}
        </div>
        <button type="button" disabled={!photoName || !hasPhotoAdjustments(adjustments)}
          onClick={() => onChange({ ...DEFAULT_PHOTO_ADJUSTMENTS })}
          className="h-7 px-1.5 shrink-0 rounded-md text-[11px] font-semibold text-purple-300 hover:bg-slate-800 disabled:opacity-30" title="Reset this photo">Reset</button>
      </div>
      <div className="truncate text-[11px] text-slate-400 px-1 pt-0.5" title={photoName || ''}>
        {photoName ? `Adjusting: ${photoName}` : 'Upload a photo to adjust it'}
      </div>
      {selectedGroup && photoName && (
        <div className="mt-1.5 rounded-lg border border-purple-500/40 bg-slate-950 p-2.5">
          <div className="flex items-center justify-between mb-2 text-xs font-bold text-slate-100">
            <span>{selectedGroup.title} · {photoName}</span>
            <button type="button" onClick={() => setActiveGroup(null)} aria-label="Close adjustments"
              className="p-0.5 rounded hover:bg-slate-800"><X className="w-3.5 h-3.5" /></button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2">
            {selectedGroup.title === 'Levels' && <LevelsGraph adjustments={adjustments} />}
            {selectedGroup.title === 'Curves' && <CurveGraph adjustments={adjustments} />}
            {selectedGroup.controls.map(([key, label, min, max, suffix = '', step = 1]) => (
              <label key={key} className="block text-[11px] text-slate-300 min-w-0">
                <span className="flex justify-between gap-1 mb-0.5">
                  <span>{label}</span><span className="font-mono text-purple-300">{adjustments[key]}{suffix}</span>
                </span>
                <input type="range" min={min} max={max} step={step} value={adjustments[key]}
                  onChange={(event) => update(key, event.target.value)}
                  className="w-full h-3 accent-purple-500 cursor-pointer" />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
