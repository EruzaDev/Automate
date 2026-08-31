import React, { useRef, useEffect, useState } from 'react';
import { fitFontSize } from '../../utils/fitText';
import { evaluateFieldText } from '../../utils/multiColumnEvaluator';
import { parseRichTextTokens, parseStyledTextTokens, stripRichTextFormatting } from '../../utils/richTextParser';
import { parseTemplateTokens, getTagColor } from '../../utils/tagColors';
import { AlignCenterHorizontal, AlignCenterVertical, AlignLeft, AlignRight, ZoomIn, ZoomOut, Maximize2, Edit3, Tag, Eye } from 'lucide-react';

export default function InteractiveStage({
  currentLayout,
  selectedFieldId,
  onSelectField,
  onUpdateField,
  previewRow,
  stageViewMode = 'record', // 'record' | 'tags'
  onToggleFullscreen,
  isFullscreen: isFullscreenProp
}) {
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const [snapLines, setSnapLines] = useState({ showX: false, showY: false, xPos: 0, yPos: 0 });
  const [editingInPlaceFieldId, setEditingInPlaceFieldId] = useState(null);
  const [zoomScale, setZoomScale] = useState(1.0); // 0.75x, 1.0x, 1.25x, 1.5x
  const [isFullscreenLocal, setIsFullscreenLocal] = useState(false);

  const isFullscreen = isFullscreenProp !== undefined ? isFullscreenProp : isFullscreenLocal;

  const toggleFullscreen = () => {
    if (onToggleFullscreen) {
      onToggleFullscreen();
      return;
    }
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreenLocal(true)).catch((err) => console.error(err));
    } else {
      document.exitFullscreen().then(() => setIsFullscreenLocal(false)).catch((err) => console.error(err));
    }
  };

  useEffect(() => {
    const handleFSChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  const baseStageWidth = 880; // Enlarged high-def canvas width for Canva-like clear preview
  const stageWidth = Math.round(baseStageWidth * zoomScale);
  const imageAspect = currentLayout?.image
    ? currentLayout.image.naturalHeight / currentLayout.image.naturalWidth
    : 0.7;
  const stageHeight = Math.round(stageWidth * imageAspect);

  if (!currentLayout) {
    return (
      <div className="w-full h-96 flex flex-col items-center justify-center p-8 text-center rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/40 text-slate-400">
        <span className="text-base font-bold text-slate-300 block mb-1">No Certificate Image Loaded</span>
        <span className="text-xs text-slate-500 max-w-sm">Upload a layout image on the left sidebar to start placing text fields and designing your certificate live.</span>
      </div>
    );
  }

  const selectedField = currentLayout.fields.find((f) => f.id === selectedFieldId);

  // Magnetic Snapping helper
  const applySnapping = (xPct, yPct, wPct, hPct) => {
    const snapThreshold = 0.015;
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

  // Handle Box Drag
  const handleMouseDownDrag = (e, field) => {
    if (editingInPlaceFieldId === field.id) return; // Allow normal typing input focus
    e.stopPropagation();
    const wasAlreadySelected = selectedFieldId === field.id;
    onSelectField(field.id);
    if (!wasAlreadySelected) {
      onUpdateField(field.id, { selectedTag: null });
    }

    const startX = e.clientX;
    const startY = e.clientY;
    const origXPct = field.xPct;
    const origYPct = field.yPct;

    const safeW = stageWidth > 0 ? stageWidth : 880;
    const safeH = stageHeight > 0 ? stageHeight : 616;

    let hasMoved = false;

    const onMouseMove = (moveEvent) => {
      const dist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
      if (!hasMoved && dist < 4) return; // Ignore tiny micro-movements during simple click

      hasMoved = true;
      moveEvent.preventDefault();
      const dx = (moveEvent.clientX - startX) / safeW;
      const dy = (moveEvent.clientY - startY) / safeH;

      const maxAllowedY = Math.max(0, 1 - (field.hPct || 0.08));
      const rawX = Math.max(0, Math.min(1 - field.wPct, origXPct + dx));
      const rawY = Math.max(0, Math.min(maxAllowedY, origYPct + dy));

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

  // Touch Drag Support
  const handleTouchStartDrag = (e, field) => {
    if (editingInPlaceFieldId === field.id) return;
    e.stopPropagation();
    onSelectField(field.id);
    if (!e.touches || e.touches.length === 0) return;

    const startX = e.touches[0].clientX;
    const startY = e.touches[0].clientY;
    const origXPct = field.xPct;
    const origYPct = field.yPct;

    const safeW = stageWidth > 0 ? stageWidth : 880;
    const safeH = stageHeight > 0 ? stageHeight : 616;
    let hasTouchMoved = false;

    const onTouchMove = (moveEvent) => {
      if (!moveEvent.touches || moveEvent.touches.length === 0) return;
      const dist = Math.hypot(moveEvent.touches[0].clientX - startX, moveEvent.touches[0].clientY - startY);
      if (!hasTouchMoved && dist < 4) return;

      hasTouchMoved = true;
      moveEvent.preventDefault();
      const dx = (moveEvent.touches[0].clientX - startX) / safeW;
      const dy = (moveEvent.touches[0].clientY - startY) / safeH;

      const maxAllowedY = Math.max(0, 1 - (field.hPct || 0.08));
      const rawX = Math.max(0, Math.min(1 - field.wPct, origXPct + dx));
      const rawY = Math.max(0, Math.min(maxAllowedY, origYPct + dy));

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

  // Handle Box Resize
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

  // Touch Resize
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

  // Quick Alignments
  const snapSelectedCenterX = () => {
    if (!selectedField) return;
    onUpdateField(selectedField.id, { xPct: 0.5 - selectedField.wPct / 2 });
  };
  const snapSelectedCenterY = () => {
    if (!selectedField) return;
    onUpdateField(selectedField.id, { yPct: 0.5 - selectedField.hPct / 2 });
  };

  return (
    <div ref={containerRef} className={`w-full flex flex-col items-center justify-center space-y-2 ${isFullscreen ? 'bg-slate-950 p-6 overflow-auto' : ''}`}>
      {/* Canvas Viewport Toolbar: Zoom & Quick Align */}
      <div className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Canvas View:</span>
          <button
            onClick={() => setZoomScale((z) => Math.max(0.6, z - 0.15))}
            className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-[11px] font-bold text-amber-400 w-10 text-center">
            {Math.round(zoomScale * 100)}%
          </span>
          <button
            onClick={() => setZoomScale((z) => Math.min(1.6, z + 0.15))}
            className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={toggleFullscreen}
            className={`p-1 rounded hover:bg-slate-800 transition ${isFullscreen ? 'text-amber-400 font-bold bg-amber-500/20' : 'text-slate-400 hover:text-white'}`}
            title={isFullscreen ? "Exit Fullscreen" : "Toggle Stage Fullscreen Mode"}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {selectedField && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">Align:</span>
            <button
              onClick={snapSelectedCenterX}
              className="btn-secondary py-0.5 px-2 text-[10.5px] hover:border-amber-400 text-slate-300"
              title="Snap Center Horizontally"
            >
              <AlignCenterHorizontal className="w-3 h-3" /> Center X
            </button>
            <button
              onClick={snapSelectedCenterY}
              className="btn-secondary py-0.5 px-2 text-[10.5px] hover:border-amber-400 text-slate-300"
              title="Snap Center Vertically"
            >
              <AlignCenterVertical className="w-3 h-3" /> Center Y
            </button>
          </div>
        )}
      </div>

      {/* Large Interactive Stage Canvas */}
      <div className="w-full overflow-x-auto flex justify-center py-2 max-w-full">
        <div
          ref={stageRef}
          onMouseDown={(e) => {
            if (e.target === stageRef.current || e.target.tagName === 'IMG') {
              onSelectField(null);
            }
          }}
          className="relative bg-white shadow-2xl rounded-xl overflow-hidden border border-slate-700 select-none touch-none flex-shrink-0 transition-all duration-150"
          style={{
            width: `${stageWidth}px`,
            height: `${stageHeight}px`,
            backgroundImage: 'repeating-conic-gradient(#f1f5f9 0% 25%, transparent 0% 50%)',
            backgroundSize: '20px 20px'
          }}
        >
          {/* Layout Background Image */}
          <img
            src={currentLayout.dataURL}
            alt={currentLayout.name}
            className="w-full h-full object-contain pointer-events-none cursor-default select-none"
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
            const isEditingInPlace = editingInPlaceFieldId === field.id;

            const rawTemplateClean = stripRichTextFormatting(
              field.isCustomMessage
                ? (field.customTemplate !== undefined ? field.customTemplate : '')
                : (field.key || '')
            );
            const evaluatedText = field.type === 'text'
              ? (stageViewMode === 'tags' ? rawTemplateClean : evaluateFieldText({ ...field, customTemplate: rawTemplateClean }, previewRow))
              : (previewRow && previewRow[field.key]) || field.key || 'https://example.com';

            const fittedFontSize = field.type === 'text'
              ? fitFontSize(
                  evaluatedText,
                  boxW - 8,
                  boxH - 6,
                  field.fontFamily || 'Georgia, serif',
                  field.fontWeight || '600',
                  field.letterSpacing || 0,
                  field.wordSpacing || 0,
                  (field.fontSize || 36) * zoomScale,
                  6,
                  field.allowWrap || field.isFixedFontSize || false
                )
              : 14;

            const templateTokens = parseTemplateTokens(rawTemplateClean);

            const labelChipText = field.name || (
              field.isCustomMessage
                ? `💬 Custom Text`
                : field.isMultiColumn && field.columns?.length > 0
                ? `🔤 ${field.columns.join(' + ')}`
                : `🔤 ${field.key}`
            );

            return (
              <div
                key={field.id}
                onMouseDown={(e) => handleMouseDownDrag(e, field)}
                onTouchStart={(e) => handleTouchStartDrag(e, field)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectField(field.id);
                  onUpdateField(field.id, { selectedTag: null });
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onSelectField(field.id);
                  setEditingInPlaceFieldId(field.id);
                }}
                className={`absolute cursor-move flex items-center border-2 transition-all border-emerald-500 bg-emerald-500/10 ${
                  isSelected ? 'border-amber-400 ring-4 ring-amber-400/40 shadow-2xl z-20 scale-[1.001]' : 'z-10'
                }`}
                style={{
                  left: `${boxX}px`,
                  top: `${boxY}px`,
                  width: `${boxW}px`,
                  minHeight: `${boxH}px`,
                  height: field.allowWrap ? 'auto' : `${boxH}px`,
                  overflow: field.allowWrap ? 'visible' : 'hidden',
                  justifyContent: field.align === 'left' ? 'flex-start' : field.align === 'right' ? 'flex-end' : 'center'
                }}
              >
                {/* Canva-style Field Label Chip */}
                <div className="absolute -top-5 left-0 bg-amber-500 text-slate-950 font-mono font-bold text-[9.5px] px-1.5 py-0.5 rounded-t-sm shadow pointer-events-none whitespace-nowrap flex items-center gap-1">
                  <span>{labelChipText}</span>
                  {isSelected && <span className="opacity-75">(Double-click to type)</span>}
                </div>

                {/* In-Place Live Text Editing Overlay (Clean WYSIWYG typing showing clean rendered text without curly braces) */}
                {isEditingInPlace ? (
                  <textarea
                    autoFocus
                    value={field.customTemplate !== undefined ? field.customTemplate : (field.key || '')}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (field.isCustomMessage) {
                        onUpdateField(field.id, { customTemplate: val });
                      } else {
                        onUpdateField(field.id, { key: val });
                      }
                    }}
                    onBlur={() => setEditingInPlaceFieldId(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setEditingInPlaceFieldId(null);
                        return;
                      }

                      // Rich Text Formatting Hotkeys: Ctrl+B (Bold), Ctrl+I (Italic), Ctrl+U (Underline)
                      if (e.ctrlKey || e.metaKey) {
                        const key = e.key.toLowerCase();
                        if (key === 'b' || key === 'i' || key === 'u' || key === 'x') {
                          e.preventDefault();
                          const textarea = e.target;
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const fullText = textarea.value;

                          if (start !== end) {
                            const selectedChunk = fullText.slice(start, end);
                            let tagOpen = '';
                            let tagClose = '';

                            if (key === 'b') { tagOpen = '**'; tagClose = '**'; }
                            else if (key === 'i') { tagOpen = '*'; tagClose = '*'; }
                            else if (key === 'u') { tagOpen = '<u>'; tagClose = '</u>'; }
                            else if (key === 'x') { tagOpen = '~~'; tagClose = '~~'; }

                            let replacement = `${tagOpen}${selectedChunk}${tagClose}`;
                            if (selectedChunk.startsWith(tagOpen) && selectedChunk.endsWith(tagClose)) {
                              replacement = selectedChunk.slice(tagOpen.length, selectedChunk.length - tagClose.length);
                            }

                            const newFullText = fullText.slice(0, start) + replacement + fullText.slice(end);
                            if (field.isCustomMessage) {
                              onUpdateField(field.id, { customTemplate: newFullText });
                            } else {
                              onUpdateField(field.id, { key: newFullText });
                            }

                            setTimeout(() => {
                              textarea.focus();
                              textarea.setSelectionRange(start, start + replacement.length);
                            }, 10);
                          }
                        }
                      }
                    }}
                    className="w-full h-full bg-slate-950/90 text-white p-1 border-none focus:ring-0 focus:outline-none font-mono resize-none leading-normal"
                    style={{
                      color: field.color || '#ffffff',
                      fontFamily: field.fontFamily || 'Georgia, serif',
                      fontSize: `${Math.max(16, fittedFontSize)}px`,
                      fontWeight: field.fontWeight || '700',
                      fontStyle: field.fontStyle || 'normal',
                      textDecoration: [
                        field.strikethrough ? 'line-through' : '',
                        field.underline ? 'underline' : ''
                      ].filter(Boolean).join(' ') || 'none',
                      textAlign: field.align || 'center',
                      letterSpacing: `${field.letterSpacing || 0}px`,
                      wordSpacing: `${field.wordSpacing || 0}px`
                    }}
                  />
                ) : (
                  /* Standard Canvas Text Rendering with Distinct Dynamic Tag Colors */
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isSelected) {
                        onSelectField(field.id);
                        onUpdateField(field.id, { selectedTag: null });
                      }
                    }}
                    className={`pointer-events-auto cursor-pointer px-1 leading-snug w-full h-full block ${
                      field.align === 'left' ? 'text-left' : field.align === 'right' ? 'text-right' : 'text-center'
                    }`}
                    style={{
                      color: field.color || '#ffffff',
                      fontFamily: field.fontFamily || 'Georgia, serif',
                      fontSize: `${fittedFontSize}px`,
                      fontWeight: field.fontWeight || '400',
                      fontStyle: field.fontStyle || 'normal',
                      textDecoration: [
                        field.strikethrough ? 'line-through' : '',
                        field.underline ? 'underline' : ''
                      ].filter(Boolean).join(' ') || 'none',
                      textAlign: field.align || 'center',
                      letterSpacing: `${field.letterSpacing || 0}px`,
                      wordSpacing: `${field.wordSpacing || 0}px`,
                      whiteSpace: field.allowWrap ? 'pre-wrap' : 'nowrap',
                      wordBreak: field.allowWrap ? 'break-word' : 'normal',
                      overflowWrap: field.allowWrap ? 'anywhere' : 'normal'
                    }}
                  >
                    {evaluatedText ? (
                      (() => {
                        const resolvedStyledTags = {};
                        if (field.styledTags) {
                          Object.keys(field.styledTags).forEach((k) => {
                            if (field.styledTags[k]) {
                              resolvedStyledTags[k] = field.styledTags[k];
                              if (k.startsWith('{') && k.endsWith('}')) {
                                const evalK = evaluateFieldText({ isCustomMessage: true, customTemplate: k, casing: field.casing }, previewRow || {});
                                if (evalK && String(evalK).trim() && !String(evalK).startsWith('{')) {
                                  resolvedStyledTags[String(evalK).trim()] = field.styledTags[k];
                                }
                              }
                            }
                          });
                        }

                        return parseStyledTextTokens(evaluatedText, resolvedStyledTags, {
                          bold: field.fontWeight === '700' || field.fontWeight === 'bold',
                          italic: field.fontStyle === 'italic',
                          strike: Boolean(field.strikethrough),
                          underline: Boolean(field.underline)
                        }).map((tok, tIdx) => {
                          const targetKey = tok.keyName || tok.text;
                          const isTokSelected = targetKey && field.selectedTag === targetKey;

                          return (
                            <span
                              key={tIdx}
                              onClick={(e) => {
                                e.stopPropagation();
                                const wasAlreadySelected = selectedFieldId === field.id;
                                if (!wasAlreadySelected) {
                                  onSelectField(field.id);
                                  onUpdateField(field.id, { selectedTag: null });
                                } else {
                                  onSelectField(field.id);
                                  onUpdateField(field.id, { selectedTag: isTokSelected ? null : targetKey });
                                }
                              }}
                              className={`pointer-events-auto cursor-pointer rounded px-0.5 transition-all ${
                                isTokSelected ? 'ring-2 ring-white shadow-md font-semibold' : ''
                              }`}
                              style={{
                                color: tok.color || field.color || '#ffffff',
                                fontWeight: tok.bold ? (field.fontWeight === '400' ? '700' : (field.fontWeight || '700')) : '400',
                                fontStyle: tok.italic ? 'italic' : 'normal',
                                letterSpacing: `${field.letterSpacing || 0}px`,
                                wordSpacing: `${field.wordSpacing || 0}px`,
                                whiteSpace: field.allowWrap ? 'pre-wrap' : 'pre',
                                wordBreak: field.allowWrap ? 'break-word' : 'normal',
                                textDecoration: [
                                  tok.strike ? 'line-through' : '',
                                  tok.underline ? 'underline' : ''
                                ].filter(Boolean).join(' ') || 'none'
                              }}
                              title={`Click word/phrase "${tok.text}" to format`}
                            >
                              {tok.text}
                            </span>
                          );
                        });
                      })()
                    ) : (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectField(field.id);
                          onUpdateField(field.id, { selectedTag: null });
                        }}
                        className="opacity-40 font-mono text-xs italic pointer-events-auto cursor-pointer"
                      >
                        [ Empty Text Field - Click to Edit ]
                      </span>
                    )}
                  </div>
                )}

                {/* Canva Resize Handle */}
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
