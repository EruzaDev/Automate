import React, { useRef, useEffect, useState } from 'react';
import { fitFontSize } from '../../utils/fitText';
import { evaluateFieldText } from '../../utils/multiColumnEvaluator';
import { parseRichTextTokens, parseStyledTextTokens, stripRichTextFormatting } from '../../utils/richTextParser';
import { parseTemplateTokens, getTagColor } from '../../utils/tagColors';
import { AlignCenterHorizontal, AlignCenterVertical, AlignLeft, AlignRight, ZoomIn, ZoomOut, Maximize2, Minimize2, Edit3, Tag, Eye, Magnet, Move } from 'lucide-react';

export default function InteractiveStage({
  currentLayout,
  selectedFieldId,
  onSelectField,
  onUpdateField,
  previewRow,
  stageViewMode = 'record', // 'record' | 'tags'
  onToggleFullscreen,
  isFullscreen: isFullscreenProp,
  isSnappingEnabled: controlledSnapping,
  onToggleSnapping,
  onTextSelectionChange
}) {
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const [snapLines, setSnapLines] = useState({ showX: false, showY: false, xPos: 0, yPos: 0 });
  const [editingInPlaceFieldId, setEditingInPlaceFieldId] = useState(null);
  const [zoomScale, setZoomScale] = useState(1.0); // 0.75x, 1.0x, 1.25x, 1.5x
  const [isFullscreenLocal, setIsFullscreenLocal] = useState(false);
  const [internalSnapping, setInternalSnapping] = useState(true);

  const isSnappingEnabled = controlledSnapping !== undefined ? controlledSnapping : internalSnapping;
  const toggleSnapping = onToggleSnapping || (() => setInternalSnapping((s) => !s));

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

  const [viewportSize, setViewportSize] = useState(() => {
    if (typeof window !== 'undefined') {
      return {
        width: window.innerWidth,
        height: window.innerHeight - (isFullscreen ? 85 : 250)
      };
    }
    return { width: 880, height: 616 };
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setViewportSize({
          width: rect.width || containerRef.current.clientWidth,
          height: rect.height || containerRef.current.clientHeight
        });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(containerRef.current);
    window.addEventListener('resize', updateSize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [isFullscreen]);

  const imageAspect = currentLayout?.image
    ? currentLayout.image.naturalHeight / currentLayout.image.naturalWidth
    : 0.707;

  let baseWidth = 880;

  if (isFullscreen && viewportSize.height > 0 && viewportSize.width > 0) {
    // In fullscreen: fit canvas so it takes the entire vertical space down to the bottom with 12px margin
    const availH = Math.max(200, viewportSize.height - 12);
    const availW = Math.max(200, viewportSize.width - 20);

    const widthForFullHeight = availH / imageAspect;
    if (widthForFullHeight <= availW) {
      baseWidth = widthForFullHeight;
    } else {
      baseWidth = availW;
    }
  } else if (!isFullscreen && viewportSize.width > 0) {
    baseWidth = Math.min(880, Math.max(320, viewportSize.width - 24));
  }

  const stageWidth = Math.round(baseWidth * zoomScale);
  const stageHeight = Math.round(stageWidth * imageAspect);
  const stageScaleRatio = stageWidth / 880;

  if (!currentLayout) {
    return (
      <div className="w-full h-96 flex flex-col items-center justify-center p-8 text-center rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/40 text-slate-400">
        <span className="text-base font-bold text-slate-300 block mb-1">No Certificate Image Loaded</span>
        <span className="text-xs text-slate-500 max-w-sm">Upload a layout image on the left sidebar to start placing text fields and designing your certificate live.</span>
      </div>
    );
  }

  const selectedField = currentLayout.fields.find((f) => f.id === selectedFieldId);

  // Optimized Magnetic Snapping helper (Screen-pixel based, smart center & inter-field)
  const applySnapping = (xPct, yPct, wPct, hPct, currentFieldId, bypassSnap = false) => {
    if (!isSnappingEnabled || bypassSnap) {
      setSnapLines({ showX: false, showY: false, xPos: 0, yPos: 0 });
      return { x: xPct, y: yPct };
    }

    const SNAP_PIXEL_THRESHOLD = 7;
    const safeW = stageWidth > 0 ? stageWidth : 880;
    const safeH = stageHeight > 0 ? stageHeight : 616;
    const snapThresholdX = SNAP_PIXEL_THRESHOLD / safeW;
    const snapThresholdY = SNAP_PIXEL_THRESHOLD / safeH;

    let finalX = xPct;
    let finalY = yPct;
    let isSnappedX = false;
    let isSnappedY = false;
    let snapLineXPos = 0;
    let snapLineYPos = 0;

    // 1. Canvas Center X Snap (50% horizontal center - vital for certificates)
    const canvasCenterX = 0.5 - wPct / 2;
    if (Math.abs(xPct - canvasCenterX) < snapThresholdX) {
      finalX = canvasCenterX;
      isSnappedX = true;
      snapLineXPos = 0.5 * safeW;
    }

    // 2. Canvas Center Y Snap (50% vertical center)
    const canvasCenterY = 0.5 - hPct / 2;
    if (Math.abs(yPct - canvasCenterY) < snapThresholdY) {
      finalY = canvasCenterY;
      isSnappedY = true;
      snapLineYPos = 0.5 * safeH;
    }

    // 3. Smart Inter-Field Snapping (aligning with other text fields on the certificate)
    if (!isSnappedX && currentLayout?.fields) {
      for (const other of currentLayout.fields) {
        if (other.id === currentFieldId) continue;
        // Align center with other field center
        const otherCenterX = other.xPct + other.wPct / 2;
        const targetXForCenter = otherCenterX - wPct / 2;
        if (Math.abs(xPct - targetXForCenter) < snapThresholdX) {
          finalX = targetXForCenter;
          isSnappedX = true;
          snapLineXPos = otherCenterX * safeW;
          break;
        }
        // Align left edge with other field left edge
        if (Math.abs(xPct - other.xPct) < snapThresholdX) {
          finalX = other.xPct;
          isSnappedX = true;
          snapLineXPos = other.xPct * safeW;
          break;
        }
      }
    }

    setSnapLines({
      showX: isSnappedX,
      showY: isSnappedY,
      xPos: snapLineXPos,
      yPos: snapLineYPos
    });

    return { x: finalX, y: finalY };
  };

  // Handle Box Drag (Initiated from Canva-style Move Chip, dedicated move handle, or border grips)
  const handleMouseDownDrag = (e, field) => {
    if (editingInPlaceFieldId === field.id) return;
    e.stopPropagation();
    if (e.cancelable) e.preventDefault(); // Stop native HTML5 drag and selection

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
      // Safety guard: if mouse button is not pressed down, stop drag immediately
      if (moveEvent.buttons === 0) {
        cleanUp();
        return;
      }

      const dist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
      if (!hasMoved && dist < 5) return; // Strict 5px movement threshold before moving

      hasMoved = true;
      if (moveEvent.cancelable) moveEvent.preventDefault();
      const dx = (moveEvent.clientX - startX) / safeW;
      const dy = (moveEvent.clientY - startY) / safeH;

      const maxAllowedY = Math.max(0, 1 - (field.hPct || 0.08));
      const rawX = Math.max(0, Math.min(1 - field.wPct, origXPct + dx));
      const rawY = Math.max(0, Math.min(maxAllowedY, origYPct + dy));

      const bypassSnap = Boolean(moveEvent.altKey || moveEvent.shiftKey);
      const snapped = applySnapping(rawX, rawY, field.wPct, field.hPct, field.id, bypassSnap);
      onUpdateField(field.id, { xPct: snapped.x, yPct: snapped.y });
    };

    const cleanUp = () => {
      setSnapLines({ showX: false, showY: false, xPos: 0, yPos: 0 });
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', cleanUp);
      window.removeEventListener('pointerup', cleanUp);
      window.removeEventListener('dragend', cleanUp);
      window.removeEventListener('blur', cleanUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', cleanUp);
    window.addEventListener('pointerup', cleanUp);
    window.addEventListener('dragend', cleanUp);
    window.addEventListener('blur', cleanUp);
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
      if (!moveEvent.touches || moveEvent.touches.length === 0) {
        cleanUpTouch();
        return;
      }
      const dist = Math.hypot(moveEvent.touches[0].clientX - startX, moveEvent.touches[0].clientY - startY);
      if (!hasTouchMoved && dist < 4) return;

      hasTouchMoved = true;
      if (moveEvent.cancelable) moveEvent.preventDefault();
      const dx = (moveEvent.touches[0].clientX - startX) / safeW;
      const dy = (moveEvent.touches[0].clientY - startY) / safeH;

      const maxAllowedY = Math.max(0, 1 - (field.hPct || 0.08));
      const rawX = Math.max(0, Math.min(1 - field.wPct, origXPct + dx));
      const rawY = Math.max(0, Math.min(maxAllowedY, origYPct + dy));

      const snapped = applySnapping(rawX, rawY, field.wPct, field.hPct, field.id, false);
      onUpdateField(field.id, { xPct: snapped.x, yPct: snapped.y });
    };

    const cleanUpTouch = () => {
      setSnapLines({ showX: false, showY: false, xPos: 0, yPos: 0 });
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', cleanUpTouch);
      window.removeEventListener('touchcancel', cleanUpTouch);
      window.removeEventListener('blur', cleanUpTouch);
    };

    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', cleanUpTouch);
    window.addEventListener('touchcancel', cleanUpTouch);
    window.addEventListener('blur', cleanUpTouch);
  };

  // Handle Box Resize
  const handleMouseDownResize = (e, field) => {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    onSelectField(field.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const origWPct = field.wPct;
    const origHPct = field.hPct;

    const onMouseMove = (moveEvent) => {
      if (moveEvent.buttons === 0) {
        cleanUpResize();
        return;
      }
      const dw = (moveEvent.clientX - startX) / stageWidth;
      const dh = (moveEvent.clientY - startY) / stageHeight;

      const newWPct = Math.max(0.04, Math.min(1 - field.xPct, origWPct + dw));
      const newHPct = Math.max(0.03, Math.min(1 - field.yPct, origHPct + dh));

      onUpdateField(field.id, { wPct: newWPct, hPct: newHPct });
    };

    const cleanUpResize = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', cleanUpResize);
      window.removeEventListener('pointerup', cleanUpResize);
      window.removeEventListener('blur', cleanUpResize);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', cleanUpResize);
    window.addEventListener('pointerup', cleanUpResize);
    window.addEventListener('blur', cleanUpResize);
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
      if (!moveEvent.touches || moveEvent.touches.length === 0) {
        cleanUpTouchResize();
        return;
      }
      const dw = (moveEvent.touches[0].clientX - startX) / stageWidth;
      const dh = (moveEvent.touches[0].clientY - startY) / stageHeight;

      const newWPct = Math.max(0.04, Math.min(1 - field.xPct, origWPct + dw));
      const newHPct = Math.max(0.03, Math.min(1 - field.yPct, origHPct + dh));

      onUpdateField(field.id, { wPct: newWPct, hPct: newHPct });
    };

    const cleanUpTouchResize = () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', cleanUpTouchResize);
      window.removeEventListener('touchcancel', cleanUpTouchResize);
      window.removeEventListener('blur', cleanUpTouchResize);
    };

    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', cleanUpTouchResize);
    window.addEventListener('touchcancel', cleanUpTouchResize);
    window.addEventListener('blur', cleanUpTouchResize);
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
    <div
      ref={containerRef}
      className={`w-full flex flex-col items-center justify-center relative ${
        isFullscreen
          ? 'h-full flex-1 min-h-0 overflow-hidden p-0 m-0 bg-slate-950'
          : 'space-y-2'
      }`}
    >
      {/* Canvas Viewport Toolbar: Shown in standard windowed mode only */}
      {!isFullscreen && (
        <div className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Canvas:</span>
            <button
              onClick={() => setZoomScale((z) => Math.max(0.6, Number((z - 0.15).toFixed(2))))}
              className="h-7 w-7 rounded hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomScale(1)}
              className="font-mono text-[11px] font-bold text-amber-400 hover:underline px-1"
              title="Reset Zoom to 100%"
            >
              {Math.round(zoomScale * 100)}%
            </button>
            <button
              onClick={() => setZoomScale((z) => Math.min(2.5, Number((z + 0.15).toFixed(2))))}
              className="h-7 w-7 rounded hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            <div className="w-[1px] h-3.5 bg-slate-800 mx-0.5" />

            {/* Magnetic Snapping Toggle */}
            <button
              onClick={toggleSnapping}
              className={`h-7 px-2 rounded-lg flex items-center gap-1.5 text-xs font-medium border transition ${
                isSnappingEnabled
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30 font-bold'
                  : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
              }`}
              title="Toggle Magnetic Snapping"
            >
              <Magnet className="w-3.5 h-3.5" />
              <span className="text-[10.5px]">{isSnappingEnabled ? 'Snap: ON' : 'Snap: OFF'}</span>
            </button>

            <button
              onClick={toggleFullscreen}
              className={`h-7 w-7 rounded flex items-center justify-center transition ${isFullscreen ? 'text-amber-400 font-bold bg-amber-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
              title="Toggle Stage Fullscreen Mode"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {selectedField && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">Align:</span>
              <button
                onClick={snapSelectedCenterX}
                className="btn-secondary h-7 px-2 text-[10.5px] hover:border-amber-400 text-slate-300 flex items-center gap-1"
                title="Snap Center Horizontally"
              >
                <AlignCenterHorizontal className="w-3 h-3" /> Center X
              </button>
              <button
                onClick={snapSelectedCenterY}
                className="btn-secondary h-7 px-2 text-[10.5px] hover:border-amber-400 text-slate-300 flex items-center gap-1"
                title="Snap Center Vertically"
              >
                <AlignCenterVertical className="w-3 h-3" /> Center Y
              </button>
            </div>
          )}
        </div>
      )}

      {/* Large Interactive Stage Canvas Viewport */}
      <div className={`w-full h-full flex-1 min-h-0 flex items-center justify-center max-w-full ${
        isFullscreen ? 'p-1' : 'py-2 overflow-x-auto'
      } ${zoomScale > 1 ? 'overflow-auto' : 'overflow-hidden'}`}>
        <div
          ref={stageRef}
          onMouseDown={(e) => {
            if (e.target === stageRef.current || e.target.tagName === 'IMG') {
              onSelectField(null);
            }
          }}
          className="relative bg-white shadow-2xl rounded-xl overflow-hidden border border-slate-700 select-none touch-none flex-shrink-0"
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
              className="absolute top-0 bottom-0 border-r-2 border-dashed border-cyan-400 z-30 pointer-events-none shadow-[0_0_8px_rgba(34,211,238,0.8)]"
              style={{ left: `${snapLines.xPos}px` }}
            />
          )}
          {snapLines.showY && (
            <div
              className="absolute left-0 right-0 border-b-2 border-dashed border-cyan-400 z-30 pointer-events-none shadow-[0_0_8px_rgba(34,211,238,0.8)]"
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
            const rawVal = field.isCustomMessage
              ? (field.customTemplate !== undefined ? field.customTemplate : '')
              : (field.key || '');
            const normalizedVal = (rawVal === 'Input text here...' || rawVal === 'Insert text here...') ? '' : rawVal;
            const rawTemplateClean = stripRichTextFormatting(normalizedVal);
            const evaluatedText = field.type === 'text'
              ? (stageViewMode === 'tags' ? rawTemplateClean : evaluateFieldText({ ...field, customTemplate: rawTemplateClean }, previewRow))
              : (previewRow && previewRow[field.key]) || field.key || '';

            const unscaledMaxFont = field.fontSize || 36;
            const scaledMaxFont = unscaledMaxFont * stageScaleRatio;
            const scaledMinFont = Math.max(6, 6 * stageScaleRatio);
            const scaledLetterSpacing = (field.letterSpacing || 0) * stageScaleRatio;
            const scaledWordSpacing = (field.wordSpacing || 0) * stageScaleRatio;

            const textToMeasure = (evaluatedText && evaluatedText.trim()) ? evaluatedText : 'Insert text here';
            const fittedFontSize = field.type === 'text'
              ? fitFontSize(
                  textToMeasure,
                  boxW - (8 * stageScaleRatio),
                  boxH - (6 * stageScaleRatio),
                  field.fontFamily || 'Georgia, serif',
                  field.fontWeight || '600',
                  scaledLetterSpacing,
                  scaledWordSpacing,
                  scaledMaxFont,
                  scaledMinFont,
                  field.allowWrap || field.isFixedFontSize || false
                )
              : 14;

            const templateTokens = parseTemplateTokens(rawTemplateClean);

            const labelChipText = field.name || (
              field.isCustomMessage
                ? `Custom Text`
                : field.isMultiColumn && field.columns?.length > 0
                ? `${field.columns.join(' + ')}`
                : `${field.key}`
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
                onDragStart={(e) => e.preventDefault()}
                className={`absolute flex items-center border-2 transition-colors border-emerald-500/80 bg-emerald-500/5 select-none ${
                  isSelected ? 'border-amber-400 ring-4 ring-amber-400/40 shadow-2xl z-20 scale-[1.001]' : 'z-10'
                }`}
                style={{
                  left: `${boxX}px`,
                  top: `${boxY}px`,
                  width: `${boxW}px`,
                  minHeight: `${boxH}px`,
                  height: field.allowWrap ? 'auto' : `${boxH}px`,
                  overflow: 'visible',
                  justifyContent: field.align === 'left' ? 'flex-start' : field.align === 'right' ? 'flex-end' : field.align === 'justify' ? 'stretch' : 'center'
                }}
              >
                {/* Canva-style Field Label Chip (Click & Drag to move box) */}
                <div
                  onMouseDown={(e) => handleMouseDownDrag(e, field)}
                  onTouchStart={(e) => handleTouchStartDrag(e, field)}
                  className="absolute -top-6 left-0 bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold text-[10px] px-2 py-0.5 rounded-t shadow-md pointer-events-auto cursor-move whitespace-nowrap flex items-center gap-1.5 select-none z-30 transition-colors"
                  title="Click & Drag to move box"
                >
                  <Move className="w-3 h-3 flex-shrink-0" />
                  <span>{labelChipText}</span>
                  {isSelected && <span className="opacity-75 font-normal">(Double-click text to type)</span>}
                </div>

                {/* Canva-style Dedicated Move Handle Grip when selected */}
                {isSelected && (
                  <div
                    onMouseDown={(e) => handleMouseDownDrag(e, field)}
                    onTouchStart={(e) => handleTouchStartDrag(e, field)}
                    className="absolute -bottom-7 left-1/2 -translate-x-1/2 bg-amber-500 hover:bg-amber-400 text-slate-950 px-2.5 py-1 rounded-full shadow-xl pointer-events-auto cursor-move whitespace-nowrap flex items-center gap-1.5 text-[11px] font-bold select-none z-30 transition-transform hover:scale-105 ring-2 ring-slate-950/60"
                    title="Click and drag to move box"
                  >
                    <Move className="w-3.5 h-3.5" />
                    <span>Move</span>
                  </div>
                )}

                {/* In-Place Live Text Editing Overlay (Canva/Word-style WYSIWYG editing) */}
                {isEditingInPlace ? (
                  <textarea
                    autoFocus
                    value={normalizedVal}
                    placeholder="Insert text here..."
                    onChange={(e) => {
                      const val = e.target.value;
                      if (field.isCustomMessage) {
                        onUpdateField(field.id, { customTemplate: val });
                      } else {
                        onUpdateField(field.id, { key: val });
                      }
                      if (onTextSelectionChange) {
                        onTextSelectionChange({
                          fieldId: field.id,
                          start: e.target.selectionStart,
                          end: e.target.selectionEnd,
                          text: val.slice(e.target.selectionStart, e.target.selectionEnd),
                          fullText: val,
                          textareaRef: e.target
                        });
                      }
                    }}
                    onSelect={(e) => {
                      const textarea = e.target;
                      if (onTextSelectionChange) {
                        onTextSelectionChange({
                          fieldId: field.id,
                          start: textarea.selectionStart,
                          end: textarea.selectionEnd,
                          text: textarea.value.slice(textarea.selectionStart, textarea.selectionEnd),
                          fullText: textarea.value,
                          textareaRef: textarea
                        });
                      }
                    }}
                    onMouseUp={(e) => {
                      const textarea = e.target;
                      if (onTextSelectionChange) {
                        onTextSelectionChange({
                          fieldId: field.id,
                          start: textarea.selectionStart,
                          end: textarea.selectionEnd,
                          text: textarea.value.slice(textarea.selectionStart, textarea.selectionEnd),
                          fullText: textarea.value,
                          textareaRef: textarea
                        });
                      }
                    }}
                    onKeyUp={(e) => {
                      const textarea = e.target;
                      if (onTextSelectionChange) {
                        onTextSelectionChange({
                          fieldId: field.id,
                          start: textarea.selectionStart,
                          end: textarea.selectionEnd,
                          text: textarea.value.slice(textarea.selectionStart, textarea.selectionEnd),
                          fullText: textarea.value,
                          textareaRef: textarea
                        });
                      }
                    }}
                    onBlur={() => setEditingInPlaceFieldId(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setEditingInPlaceFieldId(null);
                        return;
                      }

                      // Rich Text Formatting Hotkeys: Ctrl+B (Bold), Ctrl+I (Italic), Ctrl+U (Underline), Ctrl+X (Strikethrough)
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
                              if (onTextSelectionChange) {
                                onTextSelectionChange({
                                  fieldId: field.id,
                                  start,
                                  end: start + replacement.length,
                                  text: replacement,
                                  fullText: newFullText,
                                  textareaRef: textarea
                                });
                              }
                            }, 10);
                          }
                        }
                      }
                    }}
                    className="w-full h-full bg-slate-950/40 backdrop-blur-[1px] text-white p-1 border border-amber-400/80 rounded focus:ring-2 focus:ring-amber-400 focus:outline-none resize-none leading-snug shadow-2xl"
                    style={{
                      color: field.color || '#ffffff',
                      fontFamily: field.fontFamily || 'Georgia, serif',
                      fontSize: `${Math.max(14, fittedFontSize)}px`,
                      fontWeight: field.fontWeight || '600',
                      fontStyle: field.fontStyle || 'normal',
                      textDecoration: [
                        field.strikethrough ? 'line-through' : '',
                        field.underline ? 'underline' : ''
                      ].filter(Boolean).join(' ') || 'none',
                      textAlign: field.align || 'center',
                      textAlignLast: field.align === 'justify' ? (field.allowWrap ? 'left' : 'justify') : undefined,
                      letterSpacing: `${field.letterSpacing || 0}px`,
                      wordSpacing: `${field.wordSpacing || 0}px`
                    }}
                  />
                ) : (
                  /* Standard Canvas Text Rendering with Dynamic Tag Colors & Arbitrary Selection Support */
                  <div
                    onMouseDown={(e) => {
                      // CRITICAL: Stop mousedown so clicking inside text never initiates box drag
                      e.stopPropagation();
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isSelected) {
                        onSelectField(field.id);
                        onUpdateField(field.id, { selectedTag: null });
                      }
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onSelectField(field.id);
                      setEditingInPlaceFieldId(field.id);
                    }}
                    onMouseUp={(e) => {
                      e.stopPropagation();
                      const selection = window.getSelection();
                      if (selection && !selection.isCollapsed) {
                        const selectedStr = selection.toString().trim();
                        if (selectedStr && onTextSelectionChange) {
                          onTextSelectionChange({
                            fieldId: field.id,
                            text: selectedStr,
                            isCanvasSelection: true
                          });
                        }
                      }
                    }}
                    className={`text-content-wrapper pointer-events-auto cursor-text select-text px-1 leading-snug w-full h-full block ${
                      field.align === 'left' ? 'text-left' : field.align === 'right' ? 'text-right' : field.align === 'justify' ? 'text-justify' : 'text-center'
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
                      textAlignLast: field.align === 'justify' ? (field.allowWrap ? 'left' : 'justify') : undefined,
                      letterSpacing: `${scaledLetterSpacing}px`,
                      wordSpacing: `${scaledWordSpacing}px`,
                      whiteSpace: field.allowWrap ? 'pre-wrap' : 'nowrap',
                      wordBreak: field.allowWrap ? 'break-word' : 'normal',
                      overflowWrap: field.allowWrap ? 'anywhere' : 'normal'
                    }}
                  >
                    {evaluatedText && evaluatedText.trim() ? (
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
                              className={`pointer-events-auto cursor-text rounded px-0.5 transition-all ${
                                isTokSelected ? 'ring-2 ring-white shadow-md font-semibold' : ''
                              }`}
                              style={{
                                color: tok.color || field.color || '#ffffff',
                                fontWeight: tok.bold ? '700' : (field.fontWeight || '400'),
                                fontStyle: tok.italic ? 'italic' : (field.fontStyle || 'normal'),
                                letterSpacing: `${scaledLetterSpacing}px`,
                                wordSpacing: `${scaledWordSpacing}px`,
                                whiteSpace: field.allowWrap ? 'pre-wrap' : 'pre',
                                wordBreak: field.allowWrap ? 'break-word' : 'normal',
                                textDecoration: [
                                  tok.strike ? 'line-through' : '',
                                  tok.underline ? 'underline' : ''
                                ].filter(Boolean).join(' ') || 'none'
                              }}
                              title={`Click or drag to select text`}
                            >
                              {tok.text}
                            </span>
                          );
                        });
                      })()
                    ) : (
                      <span
                        className="opacity-40 italic text-sm text-slate-300 pointer-events-none select-none tracking-normal font-normal block py-0.5"
                      >
                        Insert text here
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

      {/* Fullscreen Floating Controls HUD Pill (Canva/Figma style, zero vertical space stolen) */}
      {isFullscreen && (
        <div className="absolute bottom-4 right-5 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/80 shadow-2xl backdrop-blur-md text-xs animate-fade-in pointer-events-auto">
          <button
            onClick={() => setZoomScale((z) => Math.max(0.6, Number((z - 0.15).toFixed(2))))}
            className="h-6 w-6 rounded hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoomScale(1)}
            className="font-mono text-[11px] font-bold text-amber-400 hover:underline px-1"
            title="Reset Zoom (Fit Full Screen)"
          >
            {Math.round(zoomScale * 100)}%
          </button>
          <button
            onClick={() => setZoomScale((z) => Math.min(2.5, Number((z + 0.15).toFixed(2))))}
            className="h-6 w-6 rounded hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-3.5 bg-slate-700 mx-0.5" />

          {/* Snapping Toggle */}
          <button
            onClick={toggleSnapping}
            className={`h-6 px-2 rounded-md flex items-center gap-1 text-[10px] font-bold border transition ${
              isSnappingEnabled
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
            }`}
            title="Toggle Magnetic Snapping"
          >
            <Magnet className="w-3 h-3" />
            <span>{isSnappingEnabled ? 'Snap: ON' : 'Snap: OFF'}</span>
          </button>

          {/* Align Center buttons in fullscreen HUD if a field is selected */}
          {selectedField && (
            <>
              <div className="w-[1px] h-3.5 bg-slate-700 mx-0.5" />
              <button
                onClick={snapSelectedCenterX}
                className="h-6 px-1.5 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1 text-[10px] transition"
                title="Center Field Horizontally"
              >
                <AlignCenterHorizontal className="w-3 h-3" /> Center X
              </button>
              <button
                onClick={snapSelectedCenterY}
                className="h-6 px-1.5 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1 text-[10px] transition"
                title="Center Field Vertically"
              >
                <AlignCenterVertical className="w-3 h-3" /> Center Y
              </button>
            </>
          )}

          <div className="w-[1px] h-3.5 bg-slate-700 mx-0.5" />

          {/* Exit Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="h-6 px-2 rounded-md flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 font-bold border border-amber-500/30 transition"
            title="Exit Fullscreen (or press Esc)"
          >
            <Minimize2 className="w-3 h-3" />
            <span>Exit Fullscreen</span>
          </button>
        </div>
      )}
    </div>
  );
}
