import React, { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon, Upload, Layers, Crop, Download } from 'lucide-react';
import { renderCanvasElement, loadImage } from '../../utils/canvasRenderer';
import { exportBatchToZip } from '../../utils/zipExporter';

export default function FrameEditor({ onStartExport, setExportStatus, onProgressChange }) {
  const [frameSrc, setFrameSrc] = useState(null);
  const [frameImgObj, setFrameImgObj] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1000, height: 1000 });
  const [frameOpacity, setFrameOpacity] = useState(1.0);

  const [docImages, setDocImages] = useState([]);
  const [activeDocIdx, setActiveDocIdx] = useState(0);
  const [activeDocImgObj, setActiveDocImgObj] = useState(null);

  const [docAlignment, setDocAlignment] = useState('center');

  const canvasRef = useRef(null);
  const frameInputRef = useRef(null);
  const docBatchInputRef = useRef(null);

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
    const reader = new FileReader();
    reader.onload = (evt) => {
      setFrameSrc(evt.target?.result);
    };
    reader.readAsDataURL(file);
  };

  const handleBatchDocUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newItems = [];
    let readCount = 0;

    files.forEach((file, i) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        newItems.push({
          id: `doc-${Date.now()}-${i}`,
          name: file.name,
          src: evt.target?.result,
          ratio: 'Custom'
        });
        readCount++;
        if (readCount === files.length) {
          setDocImages((prev) => [...prev, ...newItems]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleBatchExport = async () => {
    if (docImages.length === 0) {
      alert('Please upload documentation photos first!');
      return;
    }

    onStartExport();
    setExportStatus({ isExporting: true, isFinished: false, progress: 0, total: docImages.length });

    const records = docImages.map((doc, idx) => ({
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
      }
    });

    setExportStatus((prev) => ({ ...prev, isExporting: false, isFinished: true }));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Clean Header */}
      <div className="glass-panel p-4 flex items-center gap-3 border-purple-500/30 bg-gradient-to-r from-purple-950/20 via-slate-900 to-pink-950/20">
        <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
          <ImageIcon className="w-5 h-5" />
        </div>
        <h2 className="text-2xl font-black text-white tracking-tight">Automate Framing</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side Controls */}
        <div className="lg:col-span-5 space-y-5">
          {/* Step 1: Frame Overlay */}
          <div className="glass-panel p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <h3 className="font-bold text-sm text-white">Step 1: Top Company Frame Overlay</h3>
            </div>

            <input
              type="file"
              ref={frameInputRef}
              onChange={handleFrameUpload}
              accept="image/*"
              className="hidden"
            />

            <div
              onClick={() => frameInputRef.current?.click()}
              className="dropzone flex flex-col items-center gap-2 py-4 border-purple-500/30 hover:border-purple-400 cursor-pointer"
            >
              <Upload className="w-5 h-5 text-purple-400" />
              <span className="text-xs font-bold text-purple-300">Upload Transparent PNG Frame Overlay</span>
              <span className="text-[10px] text-slate-400">Frame bounds: {canvasSize.width} x {canvasSize.height} px</span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-slate-300">
                <span>Frame Opacity:</span>
                <span className="text-purple-400">{Math.round(frameOpacity * 100)}%</span>
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
              <Crop className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-sm text-white">Step 2: Smart Center-Crop Alignment</h3>
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
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
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
                <ImageIcon className="w-4 h-4 text-pink-400" />
                <h3 className="font-bold text-sm text-white">Step 3: Documentation Photos ({docImages.length})</h3>
              </div>

              <input
                type="file"
                ref={docBatchInputRef}
                onChange={handleBatchDocUpload}
                accept="image/*"
                multiple
                className="hidden"
              />
              <button
                onClick={() => docBatchInputRef.current?.click()}
                className="btn-secondary text-xs py-1 px-3"
              >
                + Upload Batch
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-auto pr-1">
              {docImages.length === 0 ? (
                <span className="text-xs text-slate-500 block py-4 text-center">No documentation photos uploaded yet.</span>
              ) : (
                docImages.map((doc, idx) => (
                  <div
                    key={doc.id}
                    onClick={() => setActiveDocIdx(idx)}
                    className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      activeDocIdx === idx
                        ? 'bg-purple-600/20 border-purple-500 text-white shadow-md'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <img src={doc.src} alt="thumb" className="w-9 h-9 rounded-lg object-cover border border-slate-700" />
                      <div>
                        <span className="text-xs font-bold block truncate max-w-[170px]">{doc.name}</span>
                        <span className="text-[10px] text-slate-400">Ratio: {doc.ratio || 'Auto'}</span>
                      </div>
                    </div>
                    {activeDocIdx === idx && (
                      <span className="badge badge-purple text-[10px]">Active</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Export Button moved to bottom */}
          <button
            onClick={handleBatchExport}
            disabled={docImages.length === 0}
            className="btn-primary text-sm w-full py-3 justify-center shadow-lg shadow-purple-500/20 disabled:opacity-40 font-bold"
          >
            <Download className="w-4 h-4" />
            Export Framed ZIP ({docImages.length} Photos)
          </button>
        </div>

        {/* Right Preview Viewport */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-panel p-5 space-y-4 sticky top-20">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-white">Framed Output Preview</h3>
              <span className="text-xs text-slate-400 font-mono">Frame (Top Layer) → Smart Crop Photo (Bottom)</span>
            </div>

            <div className="w-full overflow-auto bg-slate-950/90 p-4 rounded-2xl border border-slate-800 flex justify-center shadow-inner min-h-[300px]">
              <canvas
                ref={canvasRef}
                width={canvasSize.width}
                height={canvasSize.height}
                className="max-w-full h-auto rounded-lg shadow-2xl border border-slate-800/80"
              />
            </div>

            <div className="flex justify-between text-xs text-slate-400 px-1 font-medium">
              <span>{docImages.length > 0 ? `Previewing #${activeDocIdx + 1}: ${docImages[activeDocIdx]?.name}` : 'No photos loaded'}</span>
              <span className="text-emerald-400">100% Fit & Scaled Without Distortion</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
