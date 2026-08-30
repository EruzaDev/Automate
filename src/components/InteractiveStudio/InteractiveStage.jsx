import React, { useRef, useEffect, useState } from 'react';
import { fitFontSize } from '../../utils/fitText';
import { evaluateFieldText } from '../../utils/multiColumnEvaluator';
import { parseRichTextTokens } from '../../utils/richTextParser';
import QRCode from 'qrcode';
import { AlignCenterHorizontal, AlignCenterVertical, AlignLeft, AlignRight } from 'lucide-react';

export default function InteractiveStage({
  currentLayout,
  selectedFieldId,
  onSelectField,
  onUpdateField,
  previewRow
}) {
  const stageRef = useRef(null);
  const [qrDataUrls, setQrDataUrls] = useState({});
  const [snapLines, setSnapLines] = useState({ showX: false, showY: false, xPos: 0, yPos: 0 });

  const stageWidth = 620;
  const imageAspect = currentLayout?.image
    ? currentLayout.image.naturalHeight / currentLayout.image.naturalWidth
    : 0.7;
  const stageHeight = Math.round(stageWidth * imageAspect);

  // Render QR previews for stage
  useEffect(() => {
    if (!currentLayout) return;
    currentLayout.fields.forEach(async (f) => {
      if (f.type === 'qr') {
        const val = (previewRow && previewRow[f.key]) || f.key || 'https://example.com';
        try {
          const url = await QRCode.toDataURL(String(val), { margin: 1, width: 140 });
          setQrDataUrls((prev) => ({ ...prev, [f.id]: url }));
        } catch (err) {
          console.error(err);
        }
      }
    });
  }, [currentLayout, previewRow]);

  if (!currentLayout) {
    return (
      <div className="w-full h-80 flex flex-col items-center justify-center p-8 text-center rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/40 text-slate-400">
        <span className="text-sm font-semibold text-slate-300 block mb-1">No Layout Image Selected</span>
        <span className="text-xs text-slate-500">Upload one or more layout image files on the left panel to start placing interactive fields.</span>
      </div>
    );
  }

  const selectedField = currentLayout.fields.find((f) => f.id === selectedFieldId);

  // Magnetic Snapping helper
  const applySnapping = (xPct, yPct, wPct, hPct) => {
    const snapThreshold = 0.018; // ~10px snap zone
    let finalX = xPct;
    let finalY = yPct;
    let isSnappedX = false;
    let isSnappedY = false;

    // Center X Snap (50% stage width)
    const centerX = 0.5 - wPct / 2;
    if (Math.abs(xPct - centerX) < snapThreshold) {
      finalX = centerX;
      isSnappedX = true;
    }

    // Center Y Snap (50% stage height)
    const centerY = 0.5 - hPct / 2;
    if (Math.abs(yPct - centerY) < snapThreshold) {
      finalY = centerY;
      isSnappedY = true;
    }

    // Left Edge Snap (0)
    if (Math.abs(xPct) < snapThreshold) {
      finalX = 0;
      isSnappedX = true;
    }
    // Right Edge Snap (1 - wPct)
    if (Math.abs(xPct - (1 - wPct)) < snapThreshold) {
      finalX = 1 - wPct;
      isSnappedX = true;
    }

    // Top Edge Snap (0)
    if (Math.abs(yPct) < snapThreshold) {
      finalY = 0;
      isSnappedY = true;
    }
    // Bottom Edge Snap (1 - hPct)
    if (Math.abs(yPct - (1 - hPct)) < snapThreshold) {
      finalY = 1 - hPct;
      isSnappedY = true;
    }

    setSnapLines({
      showX: isSnappedX,
      showY: isSnappedY,
      xPos: (finalX + wPct / 2) * stageWidth,
      yPos: (finalY + hPct / 2) * stageHeight
    });

    return { x: finalX, y: finalY };
  };

  // Handle Box Drag (Moving Position with Snapping)
  const handleMouseDownDrag = (e, field) => {
    e.stopPropagation();
    onSelectField(field.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const origXPct = field.xPct;
    const origYPct = field.yPct;

    const onMouseMove = (moveEvent) => {
      const dx = (moveEvent.clientX - startX) / stageWidth;
      const dy = (moveEvent.clientY - startY) / stageHeight;

      const rawX = Math.max(0, Math.min(1 - field.wPct, origXPct + dx));
      const rawY = Math.max(0, Math.min(1 - field.hPct, origYPct + dy));

      const snapped = applySnapping(rawX, rawY, field.wPct, field.hPct);

      onUpdateField(field.id, { xPct: snapped.x, yPct: snapped.y });
    };

    const onMouseUp = () => {
      setSnapLines({ showX: false, showY: false, xPos: 0, yPos: 0 });
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Touch Drag Support for Tablets & Touch Devices
  const handleTouchStartDrag = (e, field) => {
    e.stopPropagation();
    onSelectField(field.id);
    if (!e.touches || e.touches.length === 0) return;

    const startX = e.touches[0].clientX;
    const startY = e.touches[0].clientY;
    const origXPct = field.xPct;
    const origYPct = field.yPct;

    const onTouchMove = (moveEvent) => {
      if (!moveEvent.touches || moveEvent.touches.length === 0) return;
      const dx = (moveEvent.touches[0].clientX - startX) / stageWidth;
      const dy = (moveEvent.touches[0].clientY - startY) / stageHeight;

      const rawX = Math.max(0, Math.min(1 - field.wPct, origXPct + dx));
      const rawY = Math.max(0, Math.min(1 - field.hPct, origYPct + dy));

      const snapped = applySnapping(rawX, rawY, field.wPct, field.hPct);
      onUpdateField(field.id, { xPct: snapped.x, yPct: snapped.y });
    };

    const onTouchEnd = () => {
      setSnapLines({ showX: false, showY: false, xPos: 0, yPos: 0 });
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };

    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);
  };

  // Handle Handle Drag (Resizing Bounding Box)
  const handleMouseDownResize = (e, field) => {
    e.stopPropagation();
    e.preventDefault();
    onSelectField(field.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const origWPct = field.wPct;
    const origHPct = field.hPct;

    const onMouseMove = (moveEvent) => {
      const dw = (moveEvent.clientX - startX) / stageWidth;
      const dh = (moveEvent.clientY - startY) / stageHeight;

      const newWPct = Math.max(0.04, Math.min(1 - field.xPct, origWPct + dw));
      const newHPct = Math.max(0.03, Math.min(1 - field.yPct, origHPct + dh));

      onUpdateField(field.id, { wPct: newWPct, hPct: newHPct });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Touch Resize Support for Tablets & Touch Devices
  const handleTouchStartResize = (e, field) => {
    e.stopPropagation();
    onSelectField(field.id);
    if (!e.touches || e.touches.length === 0) return;

    const startX = e.touches[0].clientX;
    const startY = e.touches[0].clientY;
    const origWPct = field.wPct;
    const origHPct = field.hPct;

    const onTouchMove = (moveEvent) => {
      if (!moveEvent.touches || moveEvent.touches.length === 0) return;
      const dw = (moveEvent.touches[0].clientX - startX) / stageWidth;
      const dh = (moveEvent.touches[0].clientY - startY) / stageHeight;

      const newWPct = Math.max(0.04, Math.min(1 - field.xPct, origWPct + dw));
      const newHPct = Math.max(0.03, Math.min(1 - field.yPct, origHPct + dh));

      onUpdateField(field.id, { wPct: newWPct, hPct: newHPct });
    };

    const onTouchEnd = () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };

    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);
  };

  // Quick Snap Button Helpers
  const snapSelectedCenterX = () => {
    if (!selectedField) return;
    onUpdateField(selectedField.id, { xPct: 0.5 - selectedField.wPct / 2 });
  };

  const snapSelectedCenterY = () => {
    if (!selectedField) return;
    onUpdateField(selectedField.id, { yPct: 0.5 - selectedField.hPct / 2 });
  };

  const snapSelectedLeft = () => {
    if (!selectedField) return;
    onUpdateField(selectedField.id, { xPct: 0.05 });
  };

  const snapSelectedRight = () => {
    if (!selectedField) return;
    onUpdateField(selectedField.id, { xPct: 0.95 - selectedField.wPct });
  };

  const snapSelectedTop = () => {
    if (!selectedField) return;
    onUpdateField(selectedField.id, { yPct: 0.05 });
  };

  const snapSelectedBottom = () => {
    if (!selectedField) return;
    onUpdateField(selectedField.id, { yPct: 0.95 - selectedField.hPct });
  };

  return (
    <div className="w-full flex flex-col items-center justify-center space-y-3">
      {/* Quick Alignment Action Toolbar */}
      {selectedField && (
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-lg text-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Alignment:</span>

          <button
            onClick={snapSelectedCenterX}
            className="btn-secondary py-1 px-2 text-[11px] hover:border-amber-400 hover:text-amber-300"
            title="Snap Center Horizontally (X = 50%)"
          >
            <AlignCenterHorizontal className="w-3.5 h-3.5" /> Center X
          </button>

          <button
            onClick={snapSelectedCenterY}
            className="btn-secondary py-1 px-2 text-[11px] hover:border-amber-400 hover:text-amber-300"
            title="Snap Center Vertically (Y = 50%)"
          >
            <AlignCenterVertical className="w-3.5 h-3.5" /> Center Y
          </button>

          <button
            onClick={snapSelectedLeft}
            className="btn-secondary py-1 px-2 text-[11px]"
            title="Align Left Edge"
          >
            <AlignLeft className="w-3.5 h-3.5" /> Left
          </button>

          <button
            onClick={snapSelectedRight}
            className="btn-secondary py-1 px-2 text-[11px]"
            title="Align Right Edge"
          >
            <AlignRight className="w-3.5 h-3.5" /> Right
          </button>

          <button
            onClick={snapSelectedTop}
            className="btn-secondary py-1 px-2 text-[11px]"
            title="Align Top Edge"
          >
            Top
          </button>

          <button
            onClick={snapSelectedBottom}
            className="btn-secondary py-1 px-2 text-[11px]"
            title="Align Bottom Edge"
          >
            Bottom
          </button>
        </div>
      )}

      {/* Stage Canvas Viewport */}
      <div className="w-full overflow-x-auto flex justify-center py-1 max-w-full">
        <div
          ref={stageRef}
          className="relative bg-white shadow-2xl rounded-lg overflow-hidden border border-slate-700 select-none touch-none flex-shrink-0"
          style={{
            width: `${stageWidth}px`,
            height: `${stageHeight}px`,
            backgroundImage: 'repeating-conic-gradient(#f1f5f9 0% 25%, transparent 0% 50%)',
            backgroundSize: '16px 16px'
          }}
        >
        {/* Layout Background Image */}
        <img
          src={currentLayout.dataURL}
          alt={currentLayout.name}
          className="w-full h-full object-contain pointer-events-none"
        />

        {/* Visual Snap Guide Lines */}
        {snapLines.showX && (
          <div
            className="absolute top-0 bottom-0 border-r-2 border-dashed border-cyan-400 z-30 pointer-events-none shadow-lg"
            style={{ left: `${snapLines.xPos}px` }}
          />
        )}
        {snapLines.showY && (
          <div
            className="absolute left-0 right-0 border-b-2 border-dashed border-cyan-400 z-30 pointer-events-none shadow-lg"
            style={{ top: `${snapLines.yPos}px` }}
          />
        )}

        {/* Interactive Bounding Boxes Overlay */}
        {currentLayout.fields.map((field) => {
          const boxX = field.xPct * stageWidth;
          const boxY = field.yPct * stageHeight;
          const boxW = field.wPct * stageWidth;
          const boxH = field.hPct * stageHeight;

          const isSelected = selectedFieldId === field.id;
          const evaluatedText = field.type === 'text' ? evaluateFieldText(field, previewRow) : (previewRow && previewRow[field.key]) || field.key || 'https://example.com';

          const fittedFontSize = field.type === 'text'
            ? fitFontSize(
                evaluatedText,
                boxW - 6,
                boxH - 4,
                field.fontFamily || 'Georgia, serif',
                field.fontWeight || '600',
                field.letterSpacing || 0,
                field.wordSpacing || 0,
                field.fontSize || null,
                6,
                field.isFixedFontSize || false
              )
            : 14;

          const tokens = field.type === 'text' ? parseRichTextTokens(evaluatedText) : [];

          const labelChipText = field.isCustomMessage
            ? `💬 Message`
            : field.isMultiColumn && field.columns?.length > 0
            ? `🔤 ${field.columns.join(' + ')}`
            : field.type === 'qr'
            ? `📷 QR: ${field.key}`
            : `🔤 ${field.key}`;

          return (
            <div
              key={field.id}
              onMouseDown={(e) => handleMouseDownDrag(e, field)}
              onTouchStart={(e) => handleTouchStartDrag(e, field)}
              className={`absolute cursor-move flex items-center overflow-hidden border-2 transition-all ${
                field.type === 'qr'
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-emerald-500 bg-emerald-500/10'
              } ${
                isSelected ? 'border-amber-400 ring-4 ring-amber-400/40 shadow-2xl z-20 scale-[1.002]' : 'z-10'
              }`}
              style={{
                left: `${boxX}px`,
                top: `${boxY}px`,
                width: `${boxW}px`,
                height: `${boxH}px`,
                justifyContent: field.align === 'left' ? 'flex-start' : field.align === 'right' ? 'flex-end' : 'center'
              }}
            >
              {/* Canva-style Field Label Chip */}
              <div className="absolute -top-5 left-0 bg-amber-500 text-slate-950 font-mono font-bold text-[9.5px] px-1.5 py-0.5 rounded-t-sm shadow pointer-events-none whitespace-nowrap">
                {labelChipText}
              </div>

              {/* Box Content Rendering with Markdown Rich Text Support */}
              {field.type === 'text' ? (
                <div
                  className="pointer-events-none px-1 font-semibold leading-none flex items-center"
                  style={{
                    color: field.color || '#ffffff',
                    fontFamily: field.fontFamily || 'Georgia, serif',
                    fontSize: `${fittedFontSize}px`,
                    textAlign: field.align || 'center',
                    letterSpacing: `${field.letterSpacing || 0}px`,
                    wordSpacing: `${field.wordSpacing || 0}px`,
                    whiteSpace: 'pre'
                  }}
                >
                  {tokens.map((tok, tIdx) => (
                    <span
                      key={tIdx}
                      style={{
                        fontWeight: tok.bold ? '700' : (field.fontWeight || '600'),
                        fontStyle: tok.italic ? 'italic' : 'normal',
                        textDecoration: [
                          tok.underline ? 'underline' : '',
                          tok.strike ? 'line-through' : ''
                        ].filter(Boolean).join(' ') || 'none',
                        whiteSpace: 'pre'
                      }}
                    >
                      {tok.text}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="w-full h-full pointer-events-none flex items-center justify-center p-0.5">
                  {qrDataUrls[field.id] ? (
                    <img src={qrDataUrls[field.id]} alt="qr" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-[10px] font-mono font-bold text-purple-300">QR Code</span>
                  )}
                </div>
              )}

              {/* Bottom-Right Canva Resize Handle (Optimized for Mouse & Touch) */}
              {isSelected && (
                <div
                  onMouseDown={(e) => handleMouseDownResize(e, field)}
                  onTouchStart={(e) => handleTouchStartResize(e, field)}
                  className="absolute -right-2 -bottom-2 w-5 h-5 sm:w-4 sm:h-4 bg-amber-400 border-2 border-white rounded-full cursor-nwse-resize hover:scale-125 transition-transform z-30 shadow-md ring-2 ring-amber-500/50"
                  title="Drag to resize box"
                />
              )}
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
