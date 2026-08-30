import React, { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon, Upload, Layers, Crop, Download, Loader2, CheckSquare, Square, HelpCircle, ShieldAlert, ShieldCheck } from 'lucide-react';
import { renderCanvasElement, loadImage, createCompressedThumbnail } from '../../utils/canvasRenderer';
import { exportBatchToZip } from '../../utils/zipExporter';

export default function FrameEditor({ onStartExport, setExportStatus, onProgressChange, onRegisterCancel }) {
  const [frameSrc, setFrameSrc] = useState(null);
  const [frameImgObj, setFrameImgObj] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1000, height: 1000 });
  const [frameOpacity, setFrameOpacity] = useState(1.0);

  const [docImages, setDocImages] = useState([]);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState(new Set());
  const [activeDocIdx, setActiveDocIdx] = useState(0);
  const [activeDocImgObj, setActiveDocImgObj] = useState(null);

  const [docAlignment, setDocAlignment] = useState('center');
  const [autoClearPhotos, setAutoClearPhotos] = useState(true);

  // Export Quality & Safe Memory Settings
  const [exportResolution, setExportResolution] = useState(0); // Default 0 = Original (100% Native Quality)
  const [safeMemoryMode, setSafeMemoryMode] = useState(() => typeof window !== 'undefined' && ('ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0)));
  const [isLargeBatchModalOpen, setIsLargeBatchModalOpen] = useState(false);
  const [localExportStatus, setLocalExportStatus] = useState({ isExporting: false, isFinished: false, progress: 0, total: 0, phase: 'rendering', zipPercent: 0, currentZipFile: '', currentVolume: 1, totalVolumes: 1 });

  // Virtual Scroll State for Batch Photos List (renders only visible items)
  const [listScrollTop, setListScrollTop] = useState(0);
  const listContainerRef = useRef(null);

  // Uploading Loading State
  const [isUploadingFrame, setIsUploadingFrame] = useState(false);
  const [isUploadingDocs, setIsUploadingDocs] = useState(false);

  const canvasRef = useRef(null);
  const frameInputRef = useRef(null);
  const docBatchInputRef = useRef(null);

  const handleSelectAllPhotos = () => {
    setSelectedPhotoIds(new Set(docImages.map((d) => d.id)));
  };

  const handleDeselectAllPhotos = () => {
    setSelectedPhotoIds(new Set());
  };

  const handleTogglePhotoSelection = (id) => {
    setSelectedPhotoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Notify parent of progress status
  useEffect(() => {
    if (onProgressChange) {
      onProgressChange(frameSrc !== null || docImages.length > 0);
    }
  }, [frameSrc, docImages, onProgressChange]);

  useEffect(() => {
    if (frameSrc) {
      loadImage(frameSrc).then((img) => {
        if (img) {
          setFrameImgObj(img);
          setCanvasSize({ width: img.naturalWidth || 1000, height: img.naturalHeight || 1000 });
        }
      });
    } else {
      setFrameImgObj(null);
    }
  }, [frameSrc]);

  useEffect(() => {
    const current = docImages[activeDocIdx];
    if (current && current.src) {
      loadImage(current.src).then((img) => {
        setActiveDocImgObj(img);
      });
    } else {
      setActiveDocImgObj(null);
    }
  }, [activeDocIdx, docImages]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    renderCanvasElement(ctx, canvasSize.width, canvasSize.height, {
      frameOverlayImage: frameImgObj,
      frameOpacity,
      docImage: activeDocImgObj,
      docCropArea: { x: 0, y: 0, width: canvasSize.width, height: canvasSize.height },
      docAlignment
    });
  }, [frameImgObj, frameOpacity, activeDocImgObj, canvasSize, docAlignment]);

  const handleFrameUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingFrame(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      setFrameSrc(evt.target?.result);
      setIsUploadingFrame(false);
    };
    reader.onerror = () => setIsUploadingFrame(false);
    reader.readAsDataURL(file);
    if (frameInputRef.current) frameInputRef.current.value = '';
  };

  const handleBatchDocUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploadingDocs(true);
    const newItems = [];
    let readCount = 0;

    files.forEach((file, i) => {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const rawSrc = evt.target?.result;
        const thumbSrc = await createCompressedThumbnail(rawSrc, 120, 0.6);
        const id = `doc-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`;
        newItems.push({
          id,
          name: file.name,
          src: rawSrc,
          thumbSrc,
          ratio: 'Custom'
        });
        readCount++;
        if (readCount === files.length) {
          setDocImages((prev) => [...prev, ...newItems]);
          setSelectedPhotoIds((prev) => new Set([...prev, ...newItems.map((item) => item.id)]));
          setIsUploadingDocs(false);
        }
      };
      reader.onerror = () => {
        readCount++;
        if (readCount === files.length) setIsUploadingDocs(false);
      };
      reader.readAsDataURL(file);
    });

    if (docBatchInputRef.current) docBatchInputRef.current.value = '';
  };

  const cancelExportRef = useRef(false);

  const handleInitiateBatchExport = () => {
    const selectedCount = selectedPhotoIds.size > 0 ? selectedPhotoIds.size : docImages.length;
    if (selectedCount >= 100 && !safeMemoryMode) {
      setIsLargeBatchModalOpen(true);
      return;
    }
    handleBatchExport();
  };

  const handleBatchExport = async () => {
    const selectedDocs = docImages.filter((doc) => selectedPhotoIds.has(doc.id));

    if (selectedDocs.length === 0) {
      alert('Please select at least 1 documentation photo to export!');
      return;
    }

    cancelExportRef.current = false;
    if (onRegisterCancel) {
      onRegisterCancel(() => {
        cancelExportRef.current = true;
        const resetStatus = { isExporting: false, isFinished: false, progress: 0, total: 0 };
        setLocalExportStatus(resetStatus);
        if (setExportStatus) setExportStatus(resetStatus);
      });
    }

    if (onStartExport) onStartExport();
    const initialStatus = { isExporting: true, isFinished: false, progress: 0, total: selectedDocs.length };
    setLocalExportStatus(initialStatus);
    if (setExportStatus) setExportStatus(initialStatus);

    const records = selectedDocs.map((doc) => ({
      name: doc.name.replace(/\.[^/.]+$/, ''),
      _docImageSrc: doc.src,
      id: doc.id
    }));

    await exportBatchToZip({
      records,
      layerConfig: {
        frameOverlayImage: frameImgObj,
        frameOpacity,
        docAlignment,
        docCropArea: { x: 0, y: 0, width: canvasSize.width, height: canvasSize.height }
      },
      width: canvasSize.width,
      height: canvasSize.height,
      fileNamePattern: 'framed_{name}',
      zipName: 'Framed_Documentation_Batch.zip',
      maxDimension: exportResolution,
      safeMemoryMode,
      batchChunkSize: 500,
      onProgress: (current, total, volInfo) => {
        const curStatus = {
          isExporting: true,
          isFinished: false,
          progress: current,
          total,
          phase: 'rendering',
          zipPercent: 0,
          currentVolume: volInfo?.currentVolume || 1,
          totalVolumes: volInfo?.totalVolumes || 1
        };
        setLocalExportStatus(curStatus);
        if (setExportStatus) setExportStatus(curStatus);
      },
      onZipProgress: (percent, currentFile, volInfo) => {
        const packingStatus = {
          isExporting: true,
          isFinished: false,
          progress: selectedDocs.length,
          total: selectedDocs.length,
          phase: 'packing',
          zipPercent: percent,
          currentZipFile: currentFile,
          currentVolume: volInfo?.currentVolume || 1,
          totalVolumes: volInfo?.totalVolumes || 1
        };
        setLocalExportStatus(packingStatus);
        if (setExportStatus) setExportStatus(packingStatus);
      },
      shouldCancel: () => cancelExportRef.current
    });

    if (cancelExportRef.current) {
      const resetStatus = { isExporting: false, isFinished: false, progress: 0, total: 0 };
      setLocalExportStatus(resetStatus);
      if (setExportStatus) setExportStatus(resetStatus);
      return;
    }

    const doneStatus = { isExporting: false, isFinished: true, progress: selectedDocs.length, total: selectedDocs.length, phase: 'complete' };
    setLocalExportStatus(doneStatus);
    if (setExportStatus) setExportStatus(doneStatus);

    if (autoClearPhotos) {
      setDocImages([]);
      setSelectedPhotoIds(new Set());
      setActiveDocIdx(0);
    }
  };

  // Keyboard Shortcuts for FrameEditor
  useEffect(() => {
    const handleKeyDown = (e) => {
      const target = e.target;
      const isInputFocused =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) ||
        target?.isContentEditable;

      if (isInputFocused) return;

      // Batch Export Hotkey (Ctrl + Enter / Cmd + Enter)
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleBatchExport();
        return;
      }

      // Select All / Deselect All Photos (Ctrl + A / Cmd + A)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        if (selectedPhotoIds.size === docImages.length && docImages.length > 0) {
          handleDeselectAllPhotos();
        } else {
          handleSelectAllPhotos();
        }
        return;
      }

      // Cycle Photo Preview (Up / Down, [ / ])
      if (['ArrowUp', 'ArrowDown', '[', ']'].includes(e.key) && docImages.length > 0) {
        e.preventDefault();
        if (e.key === 'ArrowUp' || e.key === '[') {
          setActiveDocIdx((prev) => (prev > 0 ? prev - 1 : docImages.length - 1));
        } else if (e.key === 'ArrowDown' || e.key === ']') {
          setActiveDocIdx((prev) => (prev < docImages.length - 1 ? prev + 1 : 0));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [docImages, selectedPhotoIds, frameImgObj, canvasSize, docAlignment, autoClearPhotos]);

  // Drag and Drop State & Handlers for FrameEditor
  const [isDragOverFrameEditor, setIsDragOverFrameEditor] = useState(false);
  const [isDragOverFrameZone, setIsDragOverFrameZone] = useState(false);

  const handleFrameEditorDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragOverFrameEditor) setIsDragOverFrameEditor(true);
  };

  const handleFrameEditorDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragOverFrameEditor(false);
  };

  const handleFrameEditorDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverFrameEditor(false);
    setIsDragOverFrameZone(false);

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;

    const imageFiles = files.filter((f) => /\.(png|jpg|jpeg|webp|gif|svg|bmp)$/i.test(f.name));
    if (imageFiles.length === 0) return;

    // If only 1 file is dropped and contains 'frame' or transparent png, check if frame or batch
    if (imageFiles.length === 1 && /frame|border|overlay/i.test(imageFiles[0].name)) {
      handleFrameUpload({ target: { files: [imageFiles[0]] } });
    } else {
      // Treat dropped image files as documentation batch
      handleBatchDocUpload({ target: { files: imageFiles } });
    }
  };

  // Virtual list windowing parameters (only renders items currently in sight)
  const ITEM_HEIGHT = 60; // 52px item height + 8px gap
  const CONTAINER_HEIGHT = 224; // max-h-56 = 14rem = 224px
  const OVERSCAN = 3;
  const totalDocCount = docImages.length;
  const virtStartIndex = Math.max(0, Math.floor(listScrollTop / ITEM_HEIGHT) - OVERSCAN);
  const virtEndIndex = Math.min(
    totalDocCount,
    Math.ceil((listScrollTop + (listContainerRef.current?.clientHeight || CONTAINER_HEIGHT)) / ITEM_HEIGHT) + OVERSCAN
  );
  const virtTopSpacerHeight = virtStartIndex * ITEM_HEIGHT;
  const virtBottomSpacerHeight = Math.max(0, (totalDocCount - virtEndIndex) * ITEM_HEIGHT);
  const visibleDocImages = docImages.slice(virtStartIndex, virtEndIndex);

  return (
    <div
      onDragOver={handleFrameEditorDragOver}
      onDragLeave={handleFrameEditorDragLeave}
      onDrop={handleFrameEditorDrop}
      className={`space-y-6 animate-fade-in relative transition-all duration-200 rounded-3xl ${
        isDragOverFrameEditor ? 'ring-4 ring-purple-500/60 bg-purple-500/5' : ''
      }`}
    >
      {/* Drag & Drop Visual Overlay */}
      {isDragOverFrameEditor && (
        <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm rounded-3xl border-2 border-dashed border-purple-400 flex flex-col items-center justify-center gap-3 p-8 animate-fade-in pointer-events-none">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/40 animate-bounce">
            <ImageIcon className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-purple-300">Drop Images to Load into Framing Studio</h3>
          <p className="text-xs text-slate-300 text-center max-w-md">
            Drop transparent <strong className="text-white">PNG Frames</strong> or <strong className="text-white">Batch Documentation Photos</strong>.
          </p>
        </div>
      )}
      {/* Clean Header */}
      <div className="glass-panel p-4 flex items-center gap-3 border-purple-500/30">
        <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-500 flex items-center justify-center border border-purple-500/30">
          <ImageIcon className="w-5 h-5" />
        </div>
        <h2 className="text-2xl font-black text-main tracking-tight">Automate Framing</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side Controls */}
        <div className="lg:col-span-5 md:col-span-12 space-y-5">
          {/* Step 1: Frame Overlay */}
          <div className="glass-panel p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-500" />
              <h3 className="font-bold text-sm text-main">Step 1: Top Company Frame Overlay</h3>
            </div>

            <input
              type="file"
              ref={frameInputRef}
              onChange={handleFrameUpload}
              accept="image/*"
              className="hidden"
              disabled={isUploadingFrame}
            />

            <div
              onClick={() => !isUploadingFrame && frameInputRef.current?.click()}
              className={`dropzone flex flex-col items-center gap-2 py-4 border-purple-500/30 hover:border-purple-400 ${
                isUploadingFrame ? 'opacity-75 cursor-wait' : 'cursor-pointer'
              }`}
            >
              {isUploadingFrame ? (
                <>
                  <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
                  <span className="text-xs font-bold text-purple-500">Loading Frame PNG...</span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 text-purple-500" />
                  <span className="text-xs font-bold text-purple-500">Upload Transparent PNG Frame Overlay</span>
                  <span className="text-[10px] text-slate-400">Frame bounds: {canvasSize.width} x {canvasSize.height} px</span>
                </>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-slate-400">
                <span>Frame Opacity:</span>
                <span className="text-purple-500 font-bold">{Math.round(frameOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={frameOpacity}
                onChange={(e) => setFrameOpacity(Number(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Step 2: Smart Crop Alignment */}
          <div className="glass-panel p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Crop className="w-4 h-4 text-emerald-500" />
              <h3 className="font-bold text-sm text-main">Step 2: Smart Center-Crop Alignment</h3>
            </div>
            <p className="text-xs text-slate-400">
              Photos extending outside the frame dimensions are clipped and centered seamlessly.
            </p>

            <div className="grid grid-cols-3 gap-2">
              {['center', 'top', 'bottom'].map((align) => (
                <button
                  key={align}
                  onClick={() => setDocAlignment(align)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold capitalize border transition-all ${
                    docAlignment === align
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                      : 'btn-secondary text-slate-400 hover:text-main'
                  }`}
                >
                  {align === 'center' ? 'Center Cover' : `${align} Cover`}
                </button>
              ))}
            </div>
          </div>

          {/* Step 3: Batch Photos Uploader & List */}
          <div className="glass-panel p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-pink-500" />
                <h3 className="font-bold text-sm text-main">
                  Step 3: Documentation Photos ({docImages.length})
                </h3>
              </div>

              <input
                type="file"
                ref={docBatchInputRef}
                onChange={handleBatchDocUpload}
                accept="image/*"
                multiple
                className="hidden"
                disabled={isUploadingDocs}
              />
              <button
                onClick={() => !isUploadingDocs && docBatchInputRef.current?.click()}
                disabled={isUploadingDocs}
                className="btn-secondary text-xs py-1 px-3 flex items-center gap-1.5"
              >
                {isUploadingDocs ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" /> Loading...
                  </>
                ) : (
                  '+ Upload Batch'
                )}
              </button>
            </div>

            {/* Select All / Deselect All Toolbar */}
            {docImages.length > 0 && (
              <div className="flex items-center justify-between gap-1 py-1 border-y border-slate-700/20 text-xs">
                <button
                  onClick={handleSelectAllPhotos}
                  className="text-[11px] font-bold text-purple-500 hover:underline flex items-center gap-1"
                >
                  <CheckSquare className="w-3.5 h-3.5" /> Select All ({docImages.length})
                </button>
                <button
                  onClick={handleDeselectAllPhotos}
                  className="text-[11px] font-bold text-slate-400 hover:underline flex items-center gap-1"
                >
                  <Square className="w-3.5 h-3.5" /> Deselect All
                </button>
                <span className="badge badge-purple text-[10px] ml-auto">
                  {selectedPhotoIds.size} Selected
                </span>
              </div>
            )}

            <div
              ref={listContainerRef}
              onScroll={(e) => setListScrollTop(e.target.scrollTop)}
              className="max-h-56 overflow-auto pr-1 relative"
            >
              {docImages.length === 0 ? (
                <span className="text-xs text-slate-400 block py-4 text-center">No documentation photos uploaded yet.</span>
              ) : (
                <div className="flex flex-col gap-2">
                  {virtTopSpacerHeight > 0 && (
                    <div style={{ height: `${virtTopSpacerHeight}px` }} aria-hidden="true" />
                  )}
                  {visibleDocImages.map((doc, relIdx) => {
                    const idx = virtStartIndex + relIdx;
                    const isSelected = selectedPhotoIds.has(doc.id);
                    return (
                      <div
                        key={doc.id}
                        onClick={() => setActiveDocIdx(idx)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          activeDocIdx === idx
                            ? 'bg-purple-500/15 border-purple-500 text-main shadow-md'
                            : 'glass-panel text-slate-400 hover:border-purple-500/40'
                        }`}
                        style={{ height: '52px' }}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleTogglePhotoSelection(doc.id);
                            }}
                            className="accent-purple-500 cursor-pointer w-4 h-4 flex-shrink-0"
                          />
                          <img
                            src={doc.thumbSrc || doc.src}
                            alt="thumb"
                            loading="lazy"
                            decoding="async"
                            className="w-9 h-9 rounded-lg object-cover border border-slate-500/30 flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="text-xs font-bold block truncate max-w-[150px]">{doc.name}</span>
                            <span className="text-[10px] text-slate-400">Ratio: {doc.ratio || 'Auto'}</span>
                          </div>
                        </div>
                        {activeDocIdx === idx && (
                          <span className="badge badge-purple text-[10px] flex-shrink-0">Active</span>
                        )}
                      </div>
                    );
                  })}
                  {virtBottomSpacerHeight > 0 && (
                    <div style={{ height: `${virtBottomSpacerHeight}px` }} aria-hidden="true" />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Step 4: Export Quality & Safe Memory Settings */}
          <div className="glass-panel p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-main flex items-center gap-2">
                <Download className="w-4 h-4 text-purple-400" />
                Step 4: Export Quality & Memory
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Export Resolution (Max Dimension):
                </label>
                <select
                  value={exportResolution}
                  onChange={(e) => setExportResolution(Number(e.target.value))}
                  className="w-full text-xs py-2 px-3 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-purple-500 transition-all cursor-pointer"
                >
                  <option value={0}>Original (100% Native Quality)</option>
                  <option value={2560}>Ultra (2560px Cap - High Quality)</option>
                  <option value={1920}>HD (1920px Cap - Balanced)</option>
                  <option value={1280}>Compact (1280px Cap - Mobile/Web)</option>
                </select>
              </div>

              {/* Safe Memory Mode Toggle */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={safeMemoryMode}
                      onChange={(e) => setSafeMemoryMode(e.target.checked)}
                      className="accent-purple-500 rounded w-4 h-4 cursor-pointer"
                    />
                    <span>Safe Memory Mode (Anti-Crash)</span>
                  </label>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    safeMemoryMode 
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' 
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {safeMemoryMode ? 'ACTIVE' : 'OFF'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Forces Garbage Collection breaks and instant GPU texture cleanup to prevent browser tab crashes on mobile/tablets.
                </p>

                {/* Safe Memory Mode Instructions Box */}
                <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-purple-300 font-bold text-[11px]">
                    <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
                    <span>Safe Memory Mode Guide:</span>
                  </div>
                  <ul className="list-disc list-inside text-[10px] text-slate-400 space-y-1 leading-normal">
                    <li><strong className="text-slate-300">Mobile / Tablets / 50+ Items:</strong> Keep <span className="text-purple-300">ENABLED</span> to guarantee 100% crash protection.</li>
                    <li><strong className="text-slate-300">High-Spec Desktop:</strong> You can turn <span className="text-slate-300">OFF</span> for up to 3x faster generation speed.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Export Button */}
            <div className="space-y-2 pt-1">
              <button
                onClick={handleInitiateBatchExport}
                disabled={docImages.length === 0 || selectedPhotoIds.size === 0 || localExportStatus.isExporting}
                className="btn-primary text-sm w-full py-3 justify-center shadow-lg shadow-purple-500/20 disabled:opacity-40 font-bold flex items-center gap-2"
              >
                {localExportStatus.isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Generating ({localExportStatus.progress}/{localExportStatus.total})...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>
                      {selectedPhotoIds.size === 0
                        ? 'No Photos Selected'
                        : `Export Selected (${selectedPhotoIds.size} Photos ZIP)`}
                    </span>
                  </>
                )}
              </button>

              <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer select-none px-1">
                <input
                  type="checkbox"
                  checked={autoClearPhotos}
                  onChange={(e) => setAutoClearPhotos(e.target.checked)}
                  className="accent-purple-500 rounded w-3.5 h-3.5"
                />
                <span>Auto-clear photo buffer after download (prevents space buildup)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Right Preview Viewport */}
        <div className="lg:col-span-7 md:col-span-12 space-y-4">
          <div className="glass-panel p-5 space-y-4 sticky top-20">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-main">Framed Output Preview</h3>
              <span className="text-xs text-slate-400 font-mono">Frame (Top Layer) → Smart Crop Photo (Bottom)</span>
            </div>

            <div className="w-full overflow-auto glass-panel p-4 rounded-2xl flex justify-center shadow-inner min-h-[300px]">
              <canvas
                ref={canvasRef}
                width={canvasSize.width}
                height={canvasSize.height}
                className="max-w-full h-auto rounded-lg shadow-2xl border border-slate-700/40"
              />
            </div>

            <div className="flex justify-between text-xs text-slate-400 px-1 font-medium">
              <span>{docImages.length > 0 ? `Previewing #${activeDocIdx + 1}: ${docImages[activeDocIdx]?.name}` : 'No photos loaded'}</span>
              <span className="text-emerald-500">100% Fit & Scaled Without Distortion</span>
            </div>
          </div>
        </div>
      </div>

      {/* Large Batch Safe Mode Advisory Modal */}
      {isLargeBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-purple-500/40 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3 text-purple-400">
              <div className="p-3 rounded-xl bg-purple-500/20 border border-purple-500/30">
                <ShieldAlert className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Large Batch Optimization Advisory</h3>
                <p className="text-xs text-purple-300 font-medium">
                  {(selectedPhotoIds.size || docImages.length).toLocaleString()} Photos Selected
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              You are exporting a large batch of <strong>{(selectedPhotoIds.size || docImages.length).toLocaleString()} framed photos</strong>. 
              Enabling <strong>Safe Memory Mode</strong> is recommended for batches over 100 items to prevent browser memory exhaustion and ensure 100% stable ZIP generation.
            </p>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between text-purple-300 font-bold">
                <span>Recommended Setup:</span>
              </div>
              <ul className="list-disc list-inside text-slate-400 space-y-1">
                <li><strong>Safe Memory Mode:</strong> Enabled (Prevents memory leaks & crashes)</li>
                <li><strong>ZIP Streaming:</strong> Fast STORE Mode Enabled</li>
              </ul>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => {
                  setSafeMemoryMode(true);
                  setIsLargeBatchModalOpen(false);
                  setTimeout(() => handleBatchExport(), 50);
                }}
                className="btn-primary text-xs py-2.5 justify-center font-bold flex items-center gap-1.5 shadow-md shadow-purple-500/20"
              >
                <ShieldCheck className="w-4 h-4 text-white" />
                <span>Enable Safe & Start</span>
              </button>
              <button
                onClick={() => {
                  setIsLargeBatchModalOpen(false);
                  setTimeout(() => handleBatchExport(), 50);
                }}
                className="btn-secondary text-xs py-2.5 justify-center text-slate-300 hover:text-white"
              >
                Proceed Fast
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Generation Progress & Loading Modal */}
      {(localExportStatus.isExporting || localExportStatus.isFinished) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6 text-center space-y-5">
            {localExportStatus.isExporting ? (
              <>
                <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-purple-500/20 animate-ping"></div>
                  <div className="w-16 h-16 rounded-full border-4 border-purple-400 border-t-transparent animate-spin"></div>
                  <Download className="w-6 h-6 text-purple-400 absolute" />
                </div>

                <div className="space-y-1">
                  {localExportStatus.totalVolumes > 1 && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-mono font-bold mb-1">
                      <span>ZIP Volume {localExportStatus.currentVolume || 1} of {localExportStatus.totalVolumes}</span>
                    </div>
                  )}

                  <h3 className="text-lg font-bold text-white">
                    {localExportStatus.phase === 'packing' 
                      ? (localExportStatus.totalVolumes > 1 ? `Packing Volume ${localExportStatus.currentVolume} of ${localExportStatus.totalVolumes}...` : 'Packing ZIP Archive...')
                      : 'Generating Framed Photos'}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    {localExportStatus.phase === 'packing'
                      ? `Compressing & packaging ZIP file (${localExportStatus.zipPercent || 0}%)...`
                      : `Rendering photo ${localExportStatus.progress} of ${localExportStatus.total}...`}
                  </p>

                  {/* Live File Packing Ticker */}
                  {localExportStatus.phase === 'packing' && localExportStatus.currentZipFile && (
                    <div className="mt-2 p-2 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-purple-300 truncate shadow-inner">
                      📦 Packing: {localExportStatus.currentZipFile}
                    </div>
                  )}
                </div>

                {/* Progress Bar & Percentage */}
                <div className="space-y-1.5">
                  <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800 p-0.5">
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${
                        localExportStatus.phase === 'packing'
                          ? 'bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 shadow-lg shadow-purple-500/50'
                          : 'bg-gradient-to-r from-purple-500 to-indigo-500 shadow-lg shadow-purple-500/50'
                      }`}
                      style={{
                        width: `${
                          localExportStatus.phase === 'packing'
                            ? (localExportStatus.zipPercent || 0)
                            : (localExportStatus.total > 0 ? Math.round((localExportStatus.progress / localExportStatus.total) * 100) : 0)
                        }%`
                      }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[11px] font-mono text-slate-400">
                    <span>
                      {localExportStatus.phase === 'packing'
                        ? `${localExportStatus.zipPercent || 0}% Packed`
                        : `${Math.round((localExportStatus.progress / (localExportStatus.total || 1)) * 100)}% Rendered`}
                    </span>
                    <span>
                      {localExportStatus.phase === 'packing'
                        ? `Packing ZIP • ${localExportStatus.zipPercent || 0}%`
                        : `${localExportStatus.progress} / ${localExportStatus.total}`}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    cancelExportRef.current = true;
                  }}
                  className="btn-secondary text-xs py-1.5 px-4 text-red-400 hover:text-red-300 border-red-500/30 font-bold"
                >
                  Cancel Export
                </button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto">
                  <Download className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Batch Framing Complete!</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Successfully processed {localExportStatus.total} assets and generated ZIP archive.
                  </p>
                </div>
                <button
                  onClick={() => {
                    const doneStatus = { isExporting: false, isFinished: false, progress: 0, total: 0 };
                    setLocalExportStatus(doneStatus);
                    if (setExportStatus) setExportStatus(doneStatus);
                  }}
                  className="btn-primary w-full justify-center font-bold"
                >
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
