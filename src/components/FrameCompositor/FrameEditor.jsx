import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Image as ImageIcon, 
  Upload, 
  Layers, 
  Crop, 
  Download, 
  Loader2, 
  CheckSquare, 
  Square, 
  HelpCircle, 
  ShieldAlert, 
  ShieldCheck, 
  Crosshair, 
  ZoomIn, 
  ZoomOut, 
  Eye, 
  EyeOff, 
  BoxSelect, 
  Sparkles,
  Maximize2,
  Move,
  RotateCcw
} from 'lucide-react';
import { renderCanvasElement, loadImage, createCompressedThumbnail } from '../../utils/canvasRenderer';
import { exportBatchToZip } from '../../utils/zipExporter';
import { DEFAULT_PHOTO_ADJUSTMENTS } from '../../utils/photoAdjustments';
import PhotoAdjustmentsPanel from './PhotoAdjustmentsPanel';
import { calculatePhotoPlacement, DEFAULT_PHOTO_TRANSFORM } from '../../utils/smartCrop';

export default function FrameEditor({ onStartExport, setExportStatus, onProgressChange, onRegisterCancel }) {
  const [frameSrc, setFrameSrc] = useState(null);
  const [frameImgObj, setFrameImgObj] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1000, height: 1000 });
  const [frameOpacity, setFrameOpacity] = useState(1.0);

  const [docImages, setDocImages] = useState([]);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState(new Set());
  const [activeDocIdx, setActiveDocIdx] = useState(0);
  const [activeDocImgObj, setActiveDocImgObj] = useState(null);
  const activeDoc = docImages[activeDocIdx] || null;
  const photoAdjustments = activeDoc?.photoAdjustments || DEFAULT_PHOTO_ADJUSTMENTS;
  const photoTransform = activeDoc?.photoTransform || DEFAULT_PHOTO_TRANSFORM;
  const [isEditingPhoto, setIsEditingPhoto] = useState(false);
  const updateActivePhotoAdjustments = (next) => {
    if (!activeDoc) return;
    setDocImages((previous) => previous.map((doc) =>
      doc.id === activeDoc.id ? { ...doc, photoAdjustments: next } : doc
    ));
  };

  const [docAlignment, setDocAlignment] = useState('center');
  const [autoClearPhotos, setAutoClearPhotos] = useState(true);

  // Photo Placement Mode: 'full' (Full Frame) | 'custom' (Custom Photo Slot)
  const [photoSlotMode, setPhotoSlotMode] = useState('full');
  // Normalized slot coordinates (0.0 to 1.0)
  const [customSlot, setCustomSlot] = useState({
    xPct: 0.1,
    yPct: 0.1,
    wPct: 0.8,
    hPct: 0.8
  });
  const [showSlotGuides, setShowSlotGuides] = useState(true);
  const [zoomScale, setZoomScale] = useState(1.0);
  const [snapLines, setSnapLines] = useState({ showX: false, showY: false, xPos: 0, yPos: 0 });

  const stageContainerRef = useRef(null);
  const photoInteractionRef = useRef(null);

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

  // Active pixel bounding box calculated from canvas resolution
  const activeCropArea = useMemo(() => {
    if (photoSlotMode === 'custom') {
      return {
        x: Math.round(customSlot.xPct * canvasSize.width),
        y: Math.round(customSlot.yPct * canvasSize.height),
        width: Math.max(1, Math.round(customSlot.wPct * canvasSize.width)),
        height: Math.max(1, Math.round(customSlot.hPct * canvasSize.height))
      };
    }
    return {
      x: 0,
      y: 0,
      width: canvasSize.width,
      height: canvasSize.height
    };
  }, [photoSlotMode, customSlot, canvasSize]);

  // The preview is displayed at panel size; full frame pixels are only needed for export.
  const previewScale = Math.min(1, 1024 / Math.max(canvasSize.width, canvasSize.height));
  const previewWidth = Math.max(1, Math.round(canvasSize.width * previewScale));
  const previewHeight = Math.max(1, Math.round(canvasSize.height * previewScale));

  const updateActivePhotoTransform = (next) => {
    if (!activeDoc || !activeDocImgObj || activeDocImgObj.src !== activeDoc.src) return;
    const placement = calculatePhotoPlacement(
      activeDocImgObj.naturalWidth, activeDocImgObj.naturalHeight,
      activeCropArea.width, activeCropArea.height, docAlignment, next
    );
    const constrained = { scale: placement.scale, x: placement.x, y: placement.y };
    setDocImages((previous) => previous.map((doc) =>
      doc.id === activeDoc.id ? { ...doc, photoTransform: constrained } : doc
    ));
  };

  const handlePhotoPointerDown = (event, resize = false) => {
    if (!activeDoc || !activeDocImgObj || event.button > 0) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = photoInteractionRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect?.height) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const startTransform = { ...photoTransform };
    const pointerId = event.pointerId;
    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const dx = (moveEvent.clientX - startX) / rect.width;
      const dy = (moveEvent.clientY - startY) / rect.height;
      if (resize) {
        updateActivePhotoTransform({ ...startTransform, scale: Math.max(1, Math.min(3, startTransform.scale + dx + dy)) });
      } else {
        updateActivePhotoTransform({ ...startTransform, x: startTransform.x + dx, y: startTransform.y + dy });
      }
    };
    const onEnd = (endEvent) => {
      if (endEvent.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
  };

  // Magnetic Snapping helper for custom photo slot
  const applySnapping = (xPct, yPct, wPct, hPct, displayW, displayH) => {
    const snapThreshold = 0.015; // 1.5% magnetic snap zone
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
      xPos: (finalX + wPct / 2) * displayW,
      yPos: (finalY + hPct / 2) * displayH
    });

    return { x: finalX, y: finalY };
  };

  // Draggable Bounding Box Move (Mouse + Touch)
  const handleSlotMoveStart = (e) => {
    e.stopPropagation();
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    if (clientX === undefined || clientY === undefined) return;

    const stageRect = stageContainerRef.current?.getBoundingClientRect();
    if (!stageRect || stageRect.width === 0 || stageRect.height === 0) return;

    const startX = clientX;
    const startY = clientY;
    const origXPct = customSlot.xPct;
    const origYPct = customSlot.yPct;
    const wPct = customSlot.wPct;
    const hPct = customSlot.hPct;

    let hasMoved = false;

    const onMove = (moveEvent) => {
      const curX = moveEvent.clientX ?? moveEvent.touches?.[0]?.clientX;
      const curY = moveEvent.clientY ?? moveEvent.touches?.[0]?.clientY;
      if (curX === undefined || curY === undefined) return;

      const dist = Math.hypot(curX - startX, curY - startY);
      if (!hasMoved && dist < 3) return;
      hasMoved = true;
      if (moveEvent.cancelable) moveEvent.preventDefault();

      const dx = (curX - startX) / stageRect.width;
      const dy = (curY - startY) / stageRect.height;

      const rawX = Math.max(0, Math.min(1 - wPct, origXPct + dx));
      const rawY = Math.max(0, Math.min(1 - hPct, origYPct + dy));

      const snapped = applySnapping(rawX, rawY, wPct, hPct, stageRect.width, stageRect.height);
      setCustomSlot((prev) => ({
        ...prev,
        xPct: snapped.x,
        yPct: snapped.y
      }));
    };

    const onEnd = () => {
      setSnapLines({ showX: false, showY: false, xPos: 0, yPos: 0 });
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
  };

  // 8-Direction Handle Resizing (Mouse + Touch)
  const handleSlotResizeStart = (e, direction) => {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();

    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    if (clientX === undefined || clientY === undefined) return;

    const stageRect = stageContainerRef.current?.getBoundingClientRect();
    if (!stageRect || stageRect.width === 0 || stageRect.height === 0) return;

    const startX = clientX;
    const startY = clientY;
    const startSlot = { ...customSlot };
    const minW = 0.05; // 5% minimum
    const minH = 0.05;

    const onMove = (moveEvent) => {
      const curX = moveEvent.clientX ?? moveEvent.touches?.[0]?.clientX;
      const curY = moveEvent.clientY ?? moveEvent.touches?.[0]?.clientY;
      if (curX === undefined || curY === undefined) return;
      if (moveEvent.cancelable) moveEvent.preventDefault();

      const dx = (curX - startX) / stageRect.width;
      const dy = (curY - startY) / stageRect.height;

      let { xPct, yPct, wPct, hPct } = startSlot;

      // East (Right)
      if (direction.includes('e')) {
        wPct = Math.max(minW, Math.min(1 - startSlot.xPct, startSlot.wPct + dx));
      }
      // West (Left)
      if (direction.includes('w')) {
        const maxDx = startSlot.wPct - minW;
        const appliedDx = Math.max(-startSlot.xPct, Math.min(maxDx, dx));
        xPct = startSlot.xPct + appliedDx;
        wPct = startSlot.wPct - appliedDx;
      }
      // South (Bottom)
      if (direction.includes('s')) {
        hPct = Math.max(minH, Math.min(1 - startSlot.yPct, startSlot.hPct + dy));
      }
      // North (Top)
      if (direction.includes('n')) {
        const maxDy = startSlot.hPct - minH;
        const appliedDy = Math.max(-startSlot.yPct, Math.min(maxDy, dy));
        yPct = startSlot.yPct + appliedDy;
        hPct = startSlot.hPct - appliedDy;
      }

      setCustomSlot({
        xPct: Math.max(0, Math.min(1 - minW, xPct)),
        yPct: Math.max(0, Math.min(1 - minH, yPct)),
        wPct: Math.max(minW, Math.min(1, wPct)),
        hPct: Math.max(minH, Math.min(1, hPct))
      });
    };

    const onEnd = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
  };

  const snapCenterX = () => {
    setCustomSlot((prev) => ({
      ...prev,
      xPct: Math.max(0, Math.min(1 - prev.wPct, 0.5 - prev.wPct / 2))
    }));
  };

  const snapCenterY = () => {
    setCustomSlot((prev) => ({
      ...prev,
      yPct: Math.max(0, Math.min(1 - prev.hPct, 0.5 - prev.hPct / 2))
    }));
  };

  const snapCenterBoth = () => {
    setCustomSlot((prev) => ({
      ...prev,
      xPct: Math.max(0, Math.min(1 - prev.wPct, 0.5 - prev.wPct / 2)),
      yPct: Math.max(0, Math.min(1 - prev.hPct, 0.5 - prev.hPct / 2))
    }));
  };

  const applySlotPreset = (preset) => {
    const W = canvasSize.width || 1000;
    const H = canvasSize.height || 1000;

    if (preset === 'center80') {
      setCustomSlot({ xPct: 0.1, yPct: 0.1, wPct: 0.8, hPct: 0.8 });
    } else if (preset === 'center70') {
      setCustomSlot({ xPct: 0.15, yPct: 0.15, wPct: 0.7, hPct: 0.7 });
    } else if (preset === 'square') {
      const minDim = Math.min(W, H) * 0.75;
      const wPct = minDim / W;
      const hPct = minDim / H;
      setCustomSlot({
        xPct: 0.5 - wPct / 2,
        yPct: 0.5 - hPct / 2,
        wPct,
        hPct
      });
    } else if (preset === 'photo43') {
      let targetW = W * 0.8;
      let targetH = targetW * (3 / 4);
      if (targetH > H * 0.8) {
        targetH = H * 0.8;
        targetW = targetH * (4 / 3);
      }
      const wPct = targetW / W;
      const hPct = targetH / H;
      setCustomSlot({
        xPct: 0.5 - wPct / 2,
        yPct: 0.5 - hPct / 2,
        wPct,
        hPct
      });
    } else if (preset === 'photo32') {
      let targetW = W * 0.8;
      let targetH = targetW * (2 / 3);
      if (targetH > H * 0.8) {
        targetH = H * 0.8;
        targetW = targetH * (3 / 2);
      }
      const wPct = targetW / W;
      const hPct = targetH / H;
      setCustomSlot({
        xPct: 0.5 - wPct / 2,
        yPct: 0.5 - hPct / 2,
        wPct,
        hPct
      });
    } else if (preset === 'wide169') {
      let targetW = W * 0.85;
      let targetH = targetW * (9 / 16);
      if (targetH > H * 0.85) {
        targetH = H * 0.85;
        targetW = targetH * (16 / 9);
      }
      const wPct = targetW / W;
      const hPct = targetH / H;
      setCustomSlot({
        xPct: 0.5 - wPct / 2,
        yPct: 0.5 - hPct / 2,
        wPct,
        hPct
      });
    } else if (preset === 'full') {
      setCustomSlot({ xPct: 0, yPct: 0, wPct: 1, hPct: 1 });
    }
  };

  const updateSlotPixel = (key, pixelValue) => {
    const W = canvasSize.width || 1000;
    const H = canvasSize.height || 1000;
    const num = Math.max(0, Number(pixelValue) || 0);

    setCustomSlot((prev) => {
      let next = { ...prev };
      if (key === 'width') {
        const wPct = Math.max(0.05, Math.min(1 - prev.xPct, num / W));
        next.wPct = wPct;
      } else if (key === 'height') {
        const hPct = Math.max(0.05, Math.min(1 - prev.yPct, num / H));
        next.hPct = hPct;
      } else if (key === 'x') {
        const xPct = Math.max(0, Math.min(1 - prev.wPct, num / W));
        next.xPct = xPct;
      } else if (key === 'y') {
        const yPct = Math.max(0, Math.min(1 - prev.hPct, num / H));
        next.yPct = yPct;
      }
      return next;
    });
  };

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
    let cancelled = false;
    if (activeDoc?.src) {
      loadImage(activeDoc.src).then((img) => {
        if (!cancelled) setActiveDocImgObj(img);
      });
    } else {
      setActiveDocImgObj(null);
    }
    return () => { cancelled = true; };
  }, [activeDoc?.src]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const frame = requestAnimationFrame(() => {
      const ctx = canvas.getContext('2d');
      ctx.setTransform(canvas.width / canvasSize.width, 0, 0, canvas.height / canvasSize.height, 0, 0);
      renderCanvasElement(ctx, canvasSize.width, canvasSize.height, {
        frameOverlayImage: frameImgObj,
        frameOpacity,
        docImage: activeDocImgObj?.src === activeDoc?.src ? activeDocImgObj : null,
        docCropArea: activeCropArea,
        docAlignment,
        docTransform: photoTransform,
        photoAdjustments
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [frameImgObj, frameOpacity, activeDocImgObj, activeDoc?.src, canvasSize, previewWidth, previewHeight, docAlignment, activeCropArea, photoTransform, photoAdjustments]);

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

  const [uploadDocProgress, setUploadDocProgress] = useState({ current: 0, total: 0 });

  const handleBatchDocUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploadingDocs(true);
    setUploadDocProgress({ current: 0, total: files.length });

    const newItems = [];
    const chunkSize = 4; // Process in micro-batches of 4 photos per tick to keep UI 60fps responsive

    for (let i = 0; i < files.length; i += chunkSize) {
      const chunk = files.slice(i, i + chunkSize);

      await Promise.all(
        chunk.map(async (file, chunkIdx) => {
          const globalIdx = i + chunkIdx;
          // URL.createObjectURL is 0ms instant & avoids V8 Heap Base64 memory overhead
          const rawSrc = URL.createObjectURL(file);
          const thumbSrc = await createCompressedThumbnail(rawSrc, 120, 0.6);
          const id = `doc-${Date.now()}-${globalIdx}-${Math.random().toString(36).substring(2, 6)}`;
          newItems.push({
            id,
            name: file.name,
            src: rawSrc,
            thumbSrc,
            ratio: 'Custom'
          });
        })
      );

      setUploadDocProgress({ current: Math.min(i + chunkSize, files.length), total: files.length });
      // Micro-pause yields thread to browser UI repaint loop (eliminates all UI hanging/freezing!)
      await new Promise((resolve) => setTimeout(resolve, 12));
    }

    setDocImages((prev) => [...prev, ...newItems]);
    setSelectedPhotoIds((prev) => new Set([...prev, ...newItems.map((item) => item.id)]));
    setIsUploadingDocs(false);

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
      _photoAdjustments: doc.photoAdjustments || DEFAULT_PHOTO_ADJUSTMENTS,
      _docTransform: doc.photoTransform || DEFAULT_PHOTO_TRANSFORM,
      id: doc.id
    }));

    await exportBatchToZip({
      records,
      layerConfig: {
        frameOverlayImage: frameImgObj,
        frameOpacity,
        docAlignment,
        docCropArea: activeCropArea
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
        const packedCount = volInfo?.volEnd || selectedDocs.length;
        const packingStatus = {
          isExporting: true,
          isFinished: false,
          progress: packedCount,
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

      // Custom Photo Slot Arrow Key Nudging
      if (photoSlotMode === 'custom' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const delta = e.shiftKey ? 0.05 : 0.01;
        setCustomSlot((prev) => {
          let newX = prev.xPct;
          let newY = prev.yPct;
          if (e.key === 'ArrowLeft') newX = Math.max(0, prev.xPct - delta);
          if (e.key === 'ArrowRight') newX = Math.min(1 - prev.wPct, prev.xPct + delta);
          if (e.key === 'ArrowUp') newY = Math.max(0, prev.yPct - delta);
          if (e.key === 'ArrowDown') newY = Math.min(1 - prev.hPct, prev.yPct + delta);
          return { ...prev, xPct: newX, yPct: newY };
        });
        return;
      }

      // Cycle Photo Preview (Up / Down if full frame, or [ / ] in any mode)
      const isNavCycleKey = (photoSlotMode !== 'custom' && ['ArrowUp', 'ArrowDown'].includes(e.key)) || ['[', ']'].includes(e.key);
      if (isNavCycleKey && docImages.length > 0) {
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
  }, [docImages, selectedPhotoIds, frameImgObj, canvasSize, docAlignment, autoClearPhotos, photoSlotMode, customSlot]);

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

          {/* Step 2: Photo Framing & Placement Slot */}
          <div className="glass-panel p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BoxSelect className="w-4 h-4 text-purple-400" />
                <h3 className="font-bold text-sm text-main">Step 2: Photo Framing & Placement Slot</h3>
              </div>
              {photoSlotMode === 'custom' && (
                <span className="badge badge-purple text-[10px]">Active Slot</span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">This slot is shared by all photos. Move or resize a selected photo in the preview.</p>

            {/* Mode Selection Cards */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPhotoSlotMode('full')}
                className={`p-3 rounded-xl text-left border transition-all flex flex-col gap-1.5 ${
                  photoSlotMode === 'full'
                    ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-500/20'
                    : 'glass-panel text-slate-400 hover:text-white hover:border-purple-500/40'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Square className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="text-xs font-bold">Full Frame</span>
                </div>
                <span className={`text-[10px] leading-tight ${photoSlotMode === 'full' ? 'text-purple-100' : 'text-slate-400'}`}>
                  Edge-to-edge bleed across entire canvas.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPhotoSlotMode('custom')}
                className={`p-3 rounded-xl text-left border transition-all flex flex-col gap-1.5 ${
                  photoSlotMode === 'custom'
                    ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-500/20'
                    : 'glass-panel text-slate-400 hover:text-white hover:border-purple-500/40'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Crop className="w-3.5 h-3.5 flex-shrink-0 text-amber-300" />
                  <span className="text-xs font-bold">Custom Photo Slot</span>
                </div>
                <span className={`text-[10px] leading-tight ${photoSlotMode === 'custom' ? 'text-purple-100' : 'text-slate-400'}`}>
                  Draggable box for thick borders / cutouts.
                </span>
              </button>
            </div>

            {/* Custom Photo Slot Detailed Controls */}
            {photoSlotMode === 'custom' && (
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-purple-500/30 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span className="flex items-center gap-1.5 text-purple-300">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    Custom Slot Settings
                  </span>
                  <button
                    type="button"
                    onClick={snapCenterBoth}
                    className="text-[10px] text-amber-400 hover:underline flex items-center gap-1"
                  >
                    <Crosshair className="w-3 h-3" /> Center In Frame
                  </button>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Drag the square on the preview stage to position it. Photos will fit into this box without warping or distortion, and excess is clipped.
                </p>

                {/* Quick Alignment Actions */}
                <div className="space-y-1">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">
                    Quick Snapping:
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={snapCenterX}
                      className="btn-secondary text-[10.5px] py-1 px-2 justify-center hover:border-purple-500"
                    >
                      Center X
                    </button>
                    <button
                      type="button"
                      onClick={snapCenterY}
                      className="btn-secondary text-[10.5px] py-1 px-2 justify-center hover:border-purple-500"
                    >
                      Center Y
                    </button>
                    <button
                      type="button"
                      onClick={snapCenterBoth}
                      className="btn-secondary text-[10.5px] py-1 px-2 justify-center text-purple-300 border-purple-500/40 hover:border-purple-400 font-bold"
                    >
                      Center Both
                    </button>
                  </div>
                </div>

                {/* Aspect Ratio Presets */}
                <div className="space-y-1">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">
                    Slot Size Presets:
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => applySlotPreset('center80')}
                      className="btn-secondary text-[10px] py-1 px-1.5 justify-center hover:border-purple-500"
                      title="80% Frame Opening"
                    >
                      Center 80%
                    </button>
                    <button
                      type="button"
                      onClick={() => applySlotPreset('center70')}
                      className="btn-secondary text-[10px] py-1 px-1.5 justify-center hover:border-purple-500"
                      title="70% Frame Opening"
                    >
                      Center 70%
                    </button>
                    <button
                      type="button"
                      onClick={() => applySlotPreset('square')}
                      className="btn-secondary text-[10px] py-1 px-1.5 justify-center text-amber-300 hover:border-amber-400"
                      title="1:1 Square"
                    >
                      Square 1:1
                    </button>
                    <button
                      type="button"
                      onClick={() => applySlotPreset('photo43')}
                      className="btn-secondary text-[10px] py-1 px-1.5 justify-center hover:border-purple-500"
                      title="4:3 Standard Photo"
                    >
                      Photo 4:3
                    </button>
                    <button
                      type="button"
                      onClick={() => applySlotPreset('photo32')}
                      className="btn-secondary text-[10px] py-1 px-1.5 justify-center hover:border-purple-500"
                      title="3:2 Classic Photo"
                    >
                      Photo 3:2
                    </button>
                    <button
                      type="button"
                      onClick={() => applySlotPreset('wide169')}
                      className="btn-secondary text-[10px] py-1 px-1.5 justify-center hover:border-purple-500"
                      title="16:9 Widescreen"
                    >
                      Wide 16:9
                    </button>
                  </div>
                </div>

                {/* Direct Pixel Dimensions Inputs */}
                <div className="space-y-1.5 pt-1 border-t border-slate-800">
                  <div className="flex items-center justify-between text-[10.5px] text-slate-400 font-bold uppercase tracking-wider">
                    <span>Slot Dimensions & Position:</span>
                    <span className="text-purple-400 font-mono lowercase">{canvasSize.width}×{canvasSize.height}px canvas</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 flex justify-between">
                        <span>Width (W):</span>
                        <span className="font-mono text-purple-300">{Math.round(customSlot.wPct * 100)}%</span>
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          min="10"
                          max={canvasSize.width}
                          value={activeCropArea.width}
                          onChange={(e) => updateSlotPixel('width', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs focus:border-purple-500 focus:outline-none"
                        />
                        <span className="absolute right-2 text-[10px] text-slate-500 pointer-events-none">px</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 flex justify-between">
                        <span>Height (H):</span>
                        <span className="font-mono text-purple-300">{Math.round(customSlot.hPct * 100)}%</span>
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          min="10"
                          max={canvasSize.height}
                          value={activeCropArea.height}
                          onChange={(e) => updateSlotPixel('height', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs focus:border-purple-500 focus:outline-none"
                        />
                        <span className="absolute right-2 text-[10px] text-slate-500 pointer-events-none">px</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 flex justify-between">
                        <span>Left (X):</span>
                        <span className="font-mono text-purple-300">{Math.round(customSlot.xPct * 100)}%</span>
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          min="0"
                          max={canvasSize.width}
                          value={activeCropArea.x}
                          onChange={(e) => updateSlotPixel('x', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs focus:border-purple-500 focus:outline-none"
                        />
                        <span className="absolute right-2 text-[10px] text-slate-500 pointer-events-none">px</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 flex justify-between">
                        <span>Top (Y):</span>
                        <span className="font-mono text-purple-300">{Math.round(customSlot.yPct * 100)}%</span>
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          min="0"
                          max={canvasSize.height}
                          value={activeCropArea.y}
                          onChange={(e) => updateSlotPixel('y', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs focus:border-purple-500 focus:outline-none"
                        />
                        <span className="absolute right-2 text-[10px] text-slate-500 pointer-events-none">px</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Toggle Show Guides */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px] text-slate-400">
                  <span>Overlay boundary lines:</span>
                  <button
                    type="button"
                    onClick={() => setShowSlotGuides((v) => !v)}
                    className="text-purple-300 hover:text-white flex items-center gap-1 font-bold"
                  >
                    {showSlotGuides ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    <span>{showSlotGuides ? 'Guides Visible' : 'Guides Hidden'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Smart Crop Alignment Inside Slot */}
            <div className="space-y-2 pt-1 border-t border-slate-700/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Crop className="w-3.5 h-3.5 text-emerald-400" />
                  Crop Alignment Inside {photoSlotMode === 'custom' ? 'Slot' : 'Frame'}:
                </span>
                <span className="text-[10px] text-slate-400">Preserves Aspect Ratio</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {['center', 'top', 'bottom'].map((align) => (
                  <button
                    key={align}
                    type="button"
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
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" />
                    <span>Uploading {uploadDocProgress.current}/{uploadDocProgress.total}...</span>
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
            {/* Header & Stage Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-base text-main">Framed Output Preview</h3>
                <span className="text-xs text-slate-400 font-mono">
                  {photoSlotMode === 'custom'
                    ? 'Frame Overlay (Top) → Custom Photo Slot (Bottom)'
                    : 'Frame Overlay (Top) → Full Bleed Photo (Bottom)'}
                </span>
              </div>

              {/* Viewport Zoom & Quick Snap Toolbar */}
              <div className="flex items-center gap-1.5 bg-slate-950/80 px-2 py-1 rounded-xl border border-slate-800 text-xs shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">Zoom:</span>
                <button
                  type="button"
                  onClick={() => setZoomScale((z) => Math.max(0.6, Number((z - 0.15).toFixed(2))))}
                  className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-[11px] font-bold text-purple-400 w-10 text-center">
                  {Math.round(zoomScale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomScale((z) => Math.min(1.6, Number((z + 0.15).toFixed(2))))}
                  className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>

                {photoSlotMode === 'custom' && (
                  <>
                    <div className="w-[1px] h-3.5 bg-slate-800 mx-1" />
                    <button
                      type="button"
                      onClick={snapCenterBoth}
                      className="px-2 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-[10.5px] font-semibold flex items-center gap-1 border border-purple-500/30"
                      title="Snap Custom Slot to Center"
                    >
                      <Crosshair className="w-3 h-3" /> Center
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSlotGuides((v) => !v)}
                      className={`p-1 rounded transition ${showSlotGuides ? 'text-purple-400 bg-purple-500/20' : 'text-slate-400 hover:text-white'}`}
                      title={showSlotGuides ? "Hide Slot Guides" : "Show Slot Guides"}
                    >
                      {showSlotGuides ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                  </>
                )}
              </div>
            </div>

            <PhotoAdjustmentsPanel
              photoName={activeDoc?.name}
              photoIndex={activeDocIdx}
              photoCount={docImages.length}
              onSelectPhoto={setActiveDocIdx}
              adjustments={photoAdjustments}
              onChange={updateActivePhotoAdjustments}
            />

            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-950/80 p-1.5 text-xs">
              <button type="button" onClick={() => setIsEditingPhoto((value) => !value)} disabled={!activeDoc || !activeDocImgObj}
                aria-pressed={isEditingPhoto} className={`h-8 px-2.5 rounded-lg flex items-center gap-1.5 font-bold disabled:opacity-40 ${
                  isEditingPhoto ? 'bg-cyan-600 text-white' : 'text-slate-200 hover:bg-slate-800'
                }`} title="Drag the photo inside the frame; drag its corner to resize">
                <Move className="w-3.5 h-3.5" /> Move / resize photo
              </button>
              <label className="flex items-center gap-2 min-w-[150px] flex-1 px-1 text-slate-300">
                <Maximize2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="whitespace-nowrap">Size {Math.round(photoTransform.scale * 100)}%</span>
                <input type="range" min="1" max="3" step="0.01" value={photoTransform.scale}
                  onChange={(event) => updateActivePhotoTransform({ ...photoTransform, scale: Number(event.target.value) })}
                  disabled={!activeDoc || !activeDocImgObj} aria-label="Photo size"
                  className="w-full min-w-12 accent-cyan-500 cursor-pointer disabled:opacity-40" />
              </label>
              <button type="button" onClick={() => updateActivePhotoTransform(DEFAULT_PHOTO_TRANSFORM)}
                disabled={!activeDoc || !activeDocImgObj} title="Reset photo position and size"
                className="h-8 px-2 rounded-lg flex items-center gap-1 text-slate-300 hover:bg-slate-800 disabled:opacity-40">
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            </div>

            {/* Stage Canvas Area */}
            <div className="w-full overflow-auto glass-panel p-4 rounded-2xl flex justify-center shadow-inner min-h-[340px]">
              <div
                ref={stageContainerRef}
                className="relative select-none touch-none inline-block max-w-full transition-transform duration-75"
                style={{
                  width: `${Math.round(zoomScale * 100)}%`,
                  maxWidth: zoomScale > 1 ? `${Math.round(zoomScale * 100)}%` : '100%'
                }}
              >
                {/* HTML5 Canvas */}
                <canvas
                  ref={canvasRef}
                  width={previewWidth}
                  height={previewHeight}
                  className="w-full h-auto rounded-lg shadow-2xl border border-slate-700/40 block"
                />

                {isEditingPhoto && activeDocImgObj?.src === activeDoc?.src && (
                  <div ref={photoInteractionRef} onPointerDown={(event) => handlePhotoPointerDown(event)}
                    className="absolute z-40 border-2 border-dashed border-cyan-400/80 bg-cyan-500/5 cursor-move touch-none select-none"
                    style={{
                      left: `${activeCropArea.x / canvasSize.width * 100}%`,
                      top: `${activeCropArea.y / canvasSize.height * 100}%`,
                      width: `${activeCropArea.width / canvasSize.width * 100}%`,
                      height: `${activeCropArea.height / canvasSize.height * 100}%`
                    }}
                    aria-label="Drag photo to reposition it"
                    title="Drag to move the photo"
                  >
                    <span className="absolute top-1 left-1 rounded bg-slate-950/85 px-2 py-1 text-[10px] font-bold text-cyan-200 pointer-events-none">
                      Drag photo · resize from corner
                    </span>
                    <button type="button" onPointerDown={(event) => handlePhotoPointerDown(event, true)}
                      className="absolute -right-2 -bottom-2 w-5 h-5 rounded-full border-2 border-white bg-cyan-500 shadow-lg cursor-nwse-resize touch-none"
                      aria-label="Drag to resize photo" title="Drag to resize photo" />
                  </div>
                )}

                {/* Magnetic Snap Guidelines */}
                {photoSlotMode === 'custom' && snapLines.showX && (
                  <div
                    className="absolute top-0 bottom-0 border-r-2 border-dashed border-cyan-400 z-30 pointer-events-none shadow-lg"
                    style={{ left: `${snapLines.xPos}px` }}
                  />
                )}
                {photoSlotMode === 'custom' && snapLines.showY && (
                  <div
                    className="absolute left-0 right-0 border-b-2 border-dashed border-cyan-400 z-30 pointer-events-none shadow-lg"
                    style={{ top: `${snapLines.yPos}px` }}
                  />
                )}

                {/* Interactive Custom Photo Slot Bounding Box Overlay */}
                {photoSlotMode === 'custom' && showSlotGuides && !isEditingPhoto && (
                  <div
                    onMouseDown={handleSlotMoveStart}
                    onTouchStart={handleSlotMoveStart}
                    className="absolute cursor-move border-2 border-purple-400 bg-purple-500/10 shadow-[0_0_20px_rgba(168,85,247,0.35)] ring-2 ring-purple-500/30 z-20 select-none group"
                    style={{
                      left: `${customSlot.xPct * 100}%`,
                      top: `${customSlot.yPct * 100}%`,
                      width: `${customSlot.wPct * 100}%`,
                      height: `${customSlot.hPct * 100}%`
                    }}
                  >
                    {/* Canva-Style Tag Chip at Top */}
                    <div className="absolute -top-6 left-0 bg-purple-600 text-white font-mono font-bold text-[9.5px] px-2 py-0.5 rounded-t shadow-md pointer-events-none whitespace-nowrap flex items-center gap-1.5 z-30">
                      <span>📷 Photo Slot:</span>
                      <span className="text-amber-300 font-extrabold">{activeCropArea.width} × {activeCropArea.height} px</span>
                      <span className="opacity-75 hidden sm:inline">({Math.round(customSlot.wPct * 100)}% × {Math.round(customSlot.hPct * 100)}%)</span>
                    </div>

                    {/* Subtle Crosshair in Center */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40 group-hover:opacity-70 transition-opacity">
                      <div className="w-4 h-0.5 bg-purple-300/60" />
                      <div className="h-4 w-0.5 bg-purple-300/60 -ml-2" />
                    </div>

                    {/* 4 Corner Resize Handles */}
                    {/* Top-Left */}
                    <div
                      onMouseDown={(e) => handleSlotResizeStart(e, 'nw')}
                      onTouchStart={(e) => handleSlotResizeStart(e, 'nw')}
                      className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-purple-600 rounded-full cursor-nwse-resize shadow-md hover:scale-125 z-30 ring-2 ring-purple-500/40"
                      title="Resize Top-Left"
                    />
                    {/* Top-Right */}
                    <div
                      onMouseDown={(e) => handleSlotResizeStart(e, 'ne')}
                      onTouchStart={(e) => handleSlotResizeStart(e, 'ne')}
                      className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-purple-600 rounded-full cursor-nesw-resize shadow-md hover:scale-125 z-30 ring-2 ring-purple-500/40"
                      title="Resize Top-Right"
                    />
                    {/* Bottom-Left */}
                    <div
                      onMouseDown={(e) => handleSlotResizeStart(e, 'sw')}
                      onTouchStart={(e) => handleSlotResizeStart(e, 'sw')}
                      className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-purple-600 rounded-full cursor-nesw-resize shadow-md hover:scale-125 z-30 ring-2 ring-purple-500/40"
                      title="Resize Bottom-Left"
                    />
                    {/* Bottom-Right */}
                    <div
                      onMouseDown={(e) => handleSlotResizeStart(e, 'se')}
                      onTouchStart={(e) => handleSlotResizeStart(e, 'se')}
                      className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-purple-600 rounded-full cursor-nwse-resize shadow-md hover:scale-125 z-30 ring-2 ring-purple-500/40"
                      title="Resize Bottom-Right"
                    />

                    {/* 4 Edge Resize Handles */}
                    {/* Top */}
                    <div
                      onMouseDown={(e) => handleSlotResizeStart(e, 'n')}
                      onTouchStart={(e) => handleSlotResizeStart(e, 'n')}
                      className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-2 bg-purple-500 border border-white rounded-full cursor-ns-resize shadow-sm hover:scale-125 z-30"
                      title="Resize Height (Top)"
                    />
                    {/* Bottom */}
                    <div
                      onMouseDown={(e) => handleSlotResizeStart(e, 's')}
                      onTouchStart={(e) => handleSlotResizeStart(e, 's')}
                      className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-2 bg-purple-500 border border-white rounded-full cursor-ns-resize shadow-sm hover:scale-125 z-30"
                      title="Resize Height (Bottom)"
                    />
                    {/* Left */}
                    <div
                      onMouseDown={(e) => handleSlotResizeStart(e, 'w')}
                      onTouchStart={(e) => handleSlotResizeStart(e, 'w')}
                      className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-2 h-6 bg-purple-500 border border-white rounded-full cursor-ew-resize shadow-sm hover:scale-125 z-30"
                      title="Resize Width (Left)"
                    />
                    {/* Right */}
                    <div
                      onMouseDown={(e) => handleSlotResizeStart(e, 'e')}
                      onTouchStart={(e) => handleSlotResizeStart(e, 'e')}
                      className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-2 h-6 bg-purple-500 border border-white rounded-full cursor-ew-resize shadow-sm hover:scale-125 z-30"
                      title="Resize Width (Right)"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Status Bar */}
            <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 px-1 font-medium gap-2">
              <span>{docImages.length > 0 ? `Previewing #${activeDocIdx + 1}: ${docImages[activeDocIdx]?.name}` : 'No photos loaded'}</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {photoSlotMode === 'custom' 
                  ? `Custom Photo Slot Active (${activeCropArea.width}×${activeCropArea.height}px • Unwarped Cover)` 
                  : 'Full Bleed Edge-to-Edge Active'}
              </span>
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
    </div>
  );
}
