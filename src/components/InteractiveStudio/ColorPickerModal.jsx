import React, { useState, useEffect, useRef } from 'react';
import { Pipette, Sparkles, X, Check, Copy, Palette, Eye } from 'lucide-react';
import { hexToHsl, hslToHex, extractImagePalette, generateColorTheories } from '../../utils/colorPaletteExtractor';

export default function ColorPickerModal({
  isOpen,
  onClose,
  color = '#FFFFFF',
  onChange,
  bgImage = null
}) {
  const [hsl, setHsl] = useState(() => hexToHsl(color));
  const [hexInput, setHexInput] = useState(color.toUpperCase());
  const [imagePalette, setImagePalette] = useState([]);
  const [activeTab, setActiveTab] = useState('palette');
  const [copied, setCopied] = useState(false);

  const satValRef = useRef(null);
  const isDraggingSatVal = useRef(false);

  // Sync internal HSL state when external color prop changes
  useEffect(() => {
    if (color && color !== hexInput) {
      setHsl(hexToHsl(color));
      setHexInput(color.toUpperCase());
    }
  }, [color]);

  // Extract background image palette whenever bgImage changes
  useEffect(() => {
    if (bgImage) {
      const palette = extractImagePalette(bgImage, 8);
      setImagePalette(palette);
    }
  }, [bgImage]);

  if (!isOpen) return null;

  const currentHex = hslToHex(hsl.h, hsl.s, hsl.l);
  const colorTheories = generateColorTheories(currentHex);

  const updateColorFromHsl = (newHsl) => {
    setHsl(newHsl);
    const newHex = hslToHex(newHsl.h, newHsl.s, newHsl.l);
    setHexInput(newHex);
    if (onChange) onChange(newHex);
  };

  const handleHexInputChange = (e) => {
    const val = e.target.value;
    setHexInput(val);
    let clean = val.replace('#', '').trim();
    if (clean.length === 6 || clean.length === 3) {
      const parsed = hexToHsl(val);
      setHsl(parsed);
      const formatted = hslToHex(parsed.h, parsed.s, parsed.l);
      if (onChange) onChange(formatted);
    }
  };

  const handleSelectSwatch = (swatchHex) => {
    const parsed = hexToHsl(swatchHex);
    setHsl(parsed);
    setHexInput(swatchHex.toUpperCase());
    if (onChange) onChange(swatchHex.toUpperCase());
  };

  // 2D Saturation / Lightness Canvas Drag Handler
  const handleSatValPointer = (e) => {
    if (!satValRef.current) return;
    const rect = satValRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    const s = Math.round((x / rect.width) * 100);
    const l = Math.round((1 - y / rect.height) * 100);

    updateColorFromHsl({ ...hsl, s, l: Math.max(10, Math.min(90, l)) });
  };

  const handleMouseDownSatVal = (e) => {
    isDraggingSatVal.current = true;
    handleSatValPointer(e);

    const handleMouseMove = (moveEvent) => {
      if (isDraggingSatVal.current) handleSatValPointer(moveEvent);
    };

    const handleMouseUp = () => {
      isDraggingSatVal.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Native Browser EyeDropper API Tool
  const handleEyeDropper = async () => {
    if (typeof window !== 'undefined' && 'EyeDropper' in window) {
      try {
        const eyeDropper = new window.EyeDropper();
        const result = await eyeDropper.open();
        if (result && result.sRGBHex) {
          handleSelectSwatch(result.sRGBHex);
        }
      } catch (err) {
        console.log('EyeDropper closed or cancelled');
      }
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(currentHex);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const presetSwatches = [
    '#FFFFFF', '#F59E0B', '#EAB308', '#10B981', '#06B6D4',
    '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#EF4444',
    '#0F172A', '#475569', '#94A3B8', '#CBD5E1', '#F8FAFC'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">Interactive Color Studio</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {/* 2D Drag-Type Color Picker Box (Saturation & Lightness Plane) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>DRAG TO PICK COLOR:</span>
              <span className="font-bold text-amber-300">{currentHex}</span>
            </div>

            <div
              ref={satValRef}
              onMouseDown={handleMouseDownSatVal}
              className="relative w-full h-44 rounded-2xl cursor-crosshair overflow-hidden shadow-inner border border-slate-700/80 select-none"
              style={{
                backgroundColor: `hsl(${hsl.h}, 100%, 50%)`,
                backgroundImage: `
                  linear-gradient(to top, #000, transparent),
                  linear-gradient(to right, #fff, transparent)
                `
              }}
            >
              {/* Drag Handle Cursor Indicator */}
              <div
                className="absolute w-5 h-5 rounded-full border-2 border-white shadow-lg pointer-events-none -translate-x-1/2 -translate-y-1/2 transition-transform scale-110"
                style={{
                  left: `${hsl.s}%`,
                  top: `${100 - hsl.l}%`,
                  backgroundColor: currentHex
                }}
              />
            </div>
          </div>

          {/* 1D Hue Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-mono text-slate-400">
              <span>HUE WHEEL:</span>
              <span>{hsl.h}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              value={hsl.h}
              onChange={(e) => updateColorFromHsl({ ...hsl, h: Number(e.target.value) })}
              className="w-full h-3.5 rounded-full appearance-none cursor-pointer outline-none shadow-inner"
              style={{
                background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)'
              }}
            />
          </div>

          {/* HEX Input Box + Preview + Eyedropper */}
          <div className="flex items-center gap-2 pt-1">
            {/* Color Swatch Preview */}
            <div
              className="w-10 h-10 rounded-xl border border-slate-700 shadow-md flex-shrink-0"
              style={{ backgroundColor: currentHex }}
              title="Current Selected Color"
            />

            {/* Hex Input */}
            <div className="relative flex-1">
              <input
                type="text"
                value={hexInput}
                onChange={handleHexInputChange}
                className="w-full bg-slate-950 text-white font-mono text-xs px-3 py-2.5 rounded-xl border border-slate-800 focus:border-amber-400 focus:outline-none uppercase tracking-wider"
                placeholder="#FFFFFF"
              />
              <button
                onClick={copyToClipboard}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white transition"
                title="Copy HEX Code"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Browser EyeDropper API Button */}
            {typeof window !== 'undefined' && 'EyeDropper' in window && (
              <button
                onClick={handleEyeDropper}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl border border-slate-700 transition"
                title="Pick Screen Color (Eyedropper)"
              >
                <Pipette className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Color Theories & Suggested Image Palette Tabs */}
          <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Smart Color Theories & Image Palette
              </span>
            </div>

            {/* Theory Tabs */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveTab('palette')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider transition ${
                  activeTab === 'palette' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                🖼️ Image Colors
              </button>
              <button
                onClick={() => setActiveTab('complementary')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider transition ${
                  activeTab === 'complementary' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                ☯️ Complementary
              </button>
              <button
                onClick={() => setActiveTab('analogous')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider transition ${
                  activeTab === 'analogous' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                🎨 Analogous
              </button>
              <button
                onClick={() => setActiveTab('triadic')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider transition ${
                  activeTab === 'triadic' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                🔺 Triadic
              </button>
            </div>

            {/* Tab Swatch Grids */}
            <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80">
              {activeTab === 'palette' && (
                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-400 block font-mono">EXTRACTED BACKGROUND IMAGE PALETTE:</span>
                  <div className="grid grid-cols-8 gap-1.5">
                    {imagePalette.length > 0 ? (
                      imagePalette.map((swatch, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSelectSwatch(swatch)}
                          className="w-full aspect-square rounded-lg border border-slate-700/80 shadow hover:scale-110 transition cursor-pointer"
                          style={{ backgroundColor: swatch }}
                          title={`Select Extracted Color ${swatch}`}
                        />
                      ))
                    ) : (
                      <span className="text-xs text-slate-500 col-span-8">No layout background loaded yet</span>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'complementary' && (
                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-400 block font-mono">180° OPPOSITE HIGH-CONTRAST PAIRS:</span>
                  <div className="flex items-center gap-2">
                    {colorTheories.complementary.map((swatch, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectSwatch(swatch)}
                        className="flex-1 h-8 rounded-xl border border-slate-700 shadow hover:scale-105 transition flex items-center justify-center font-mono text-[10px] font-bold text-white drop-shadow"
                        style={{ backgroundColor: swatch }}
                      >
                        {swatch}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'analogous' && (
                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-400 block font-mono">30° ADJACENT HARMONIOUS SHADES:</span>
                  <div className="flex items-center gap-2">
                    {colorTheories.analogous.map((swatch, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectSwatch(swatch)}
                        className="flex-1 h-8 rounded-xl border border-slate-700 shadow hover:scale-105 transition flex items-center justify-center font-mono text-[10px] font-bold text-white drop-shadow"
                        style={{ backgroundColor: swatch }}
                      >
                        {swatch}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'triadic' && (
                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-400 block font-mono">120° BALANCED TRIADIC SCHEME:</span>
                  <div className="flex items-center gap-2">
                    {colorTheories.triadic.map((swatch, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectSwatch(swatch)}
                        className="flex-1 h-8 rounded-xl border border-slate-700 shadow hover:scale-105 transition flex items-center justify-center font-mono text-[10px] font-bold text-white drop-shadow"
                        style={{ backgroundColor: swatch }}
                      >
                        {swatch}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Presets Row */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-mono text-slate-400 block">QUICK POPULAR SWATCHES:</span>
              <div className="grid grid-cols-10 gap-1.5">
                {presetSwatches.map((swatch, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectSwatch(swatch)}
                    className="w-full aspect-square rounded-lg border border-slate-700/80 hover:scale-110 transition cursor-pointer"
                    style={{ backgroundColor: swatch }}
                    title={swatch}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer / Apply */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
