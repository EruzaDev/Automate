import React, { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon, Upload, Layers, Crop, Download, Loader2, CheckSquare, Square } from 'lucide-react';
import { renderCanvasElement, loadImage } from '../../utils/canvasRenderer';
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
      reader.onload = (evt) => {
        const id = `doc-${Date.now()}-${i}`;
        newItems.push({
          id,
          name: file.name,
          src: evt.target?.result,
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
        setExportStatus({ isExporting: false, isFinished: false, progress: 0, total: 0 });
      });
    }

    onStartExport();
    setExportStatus({ isExporting: true, isFinished: false, progress: 0, total: selectedDocs.length });

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
      onProgress: (current, total) => {
        setExportStatus((prev) => ({ ...prev, progress: current }));
      },
      shouldCancel: () => cancelExportRef.current
    });

    if (cancelExportRef.current) {
      setExportStatus({ isExporting: false, isFinished: false, progress: 0, total: 0 });
      return;
    }

    setExportStatus((prev) => ({ ...prev, isExporting: false, isFinished: true }));

    if (autoClearPhotos) {
      setDocImages([]);
      setSelectedPhotoIds(new Set());
      setActiveDocIdx(0);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
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

            <div className="space-y-2 max-h-56 overflow-auto pr-1">
              {docImages.length === 0 ? (
                <span className="text-xs text-slate-400 block py-4 text-center">No documentation photos uploaded yet.</span>
              ) : (
                docImages.map((doc, idx) => {
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
                        <img src={doc.src} alt="thumb" className="w-9 h-9 rounded-lg object-cover border border-slate-500/30" />
                        <div>
                          <span className="text-xs font-bold block truncate max-w-[150px]">{doc.name}</span>
                          <span className="text-[10px] text-slate-400">Ratio: {doc.ratio || 'Auto'}</span>
                        </div>
                      </div>
                      {activeDocIdx === idx && (
                        <span className="badge badge-purple text-[10px]">Active</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Export Button & Memory Cleanup Control */}
          <div className="space-y-2">
            <button
              onClick={handleBatchExport}
              disabled={docImages.length === 0 || selectedPhotoIds.size === 0}
              className="btn-primary text-sm w-full py-3 justify-center shadow-lg shadow-purple-500/20 disabled:opacity-40 font-bold"
            >
              <Download className="w-4 h-4" />
              {selectedPhotoIds.size === 0
                ? 'No Photos Selected'
                : `Export Selected (${selectedPhotoIds.size} Photos ZIP)`}
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
    </div>
  );
}
