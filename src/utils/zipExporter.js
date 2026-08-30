import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { renderCanvasElement, loadImage } from './canvasRenderer';

/**
 * Format string with record variables (e.g. "{last_name}_{first_name}" -> "Doe_John")
 */
export function formatFileName(templateStr, record, index, fallbackPrefix = 'output') {
  if (!templateStr || templateStr.trim() === '') {
    const name = record.name || record.first_name || record.last_name || record.id || `record_${index + 1}`;
    return `${name}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  let formatted = templateStr.replace(/\{([^}]+)\}/g, (_, key) => {
    const val = record[key.trim()];
    return val !== undefined && val !== null ? String(val).trim() : '';
  });

  formatted = formatted.replace(/[^a-zA-Z0-9_\-\/]/g, '_');
  formatted = formatted.replace(/_+/g, '_').replace(/^_+|_+$/g, '');

  return formatted || `${fallbackPrefix}_${index + 1}`;
}

/**
 * Batch render records onto canvas and generate downloadable ZIP package
 */
export async function exportBatchToZip({
  records,
  layerConfig,
  width,
  height,
  fileNamePattern = '{last_name}_{first_name}',
  groupByColumns = [], // e.g. ['section', 'year']
  zipName = 'Batch_Generated_Assets.zip',
  maxDimension = 2560, // Cap resolution at 2.5K (2560px) to prevent 8K memory bloat & CPU encoding freeze
  onProgress,
  shouldCancel
}) {
  const zip = new JSZip();

  // Resolution scaling optimization
  let targetWidth = width;
  let targetHeight = height;
  let scaleRatio = 1.0;

  if (maxDimension && (width > maxDimension || height > maxDimension)) {
    scaleRatio = maxDimension / Math.max(width, height);
    targetWidth = Math.round(width * scaleRatio);
    targetHeight = Math.round(height * scaleRatio);
  }

  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = targetWidth;
  offscreenCanvas.height = targetHeight;
  const ctx = offscreenCanvas.getContext('2d');

  // Preload background & frame overlay images once if static
  const bgImg = typeof layerConfig.backgroundImage === 'string' 
    ? await loadImage(layerConfig.backgroundImage) 
    : layerConfig.backgroundImage;

  const frameImg = typeof layerConfig.frameOverlayImage === 'string'
    ? await loadImage(layerConfig.frameOverlayImage)
    : layerConfig.frameOverlayImage;

  const getCanvasBlob = (canvas) => {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  };

  const total = records.length;

  for (let i = 0; i < total; i++) {
    if (shouldCancel && shouldCancel()) {
      break;
    }

    const record = records[i];

    // Load record-specific doc image if any
    let docImg = null;
    if (record._docImageSrc) {
      docImg = await loadImage(record._docImageSrc);
    } else if (layerConfig.docImage) {
      docImg = layerConfig.docImage;
    }

    // Determine layout dynamically if specified in team badge config
    let currentTextLayers = layerConfig.textLayers || [];
    let currentQrLayers = layerConfig.qrLayers || [];

    if (layerConfig.dynamicLayoutColumn && record[layerConfig.dynamicLayoutColumn]) {
      const layoutKey = record[layerConfig.dynamicLayoutColumn];
      if (layerConfig.layoutPresets && layerConfig.layoutPresets[layoutKey]) {
        currentTextLayers = layerConfig.layoutPresets[layoutKey].textLayers || currentTextLayers;
        currentQrLayers = layerConfig.layoutPresets[layoutKey].qrLayers || currentQrLayers;
      }
    }

    // Clear Canvas context to free backing store memory
    ctx.clearRect(0, 0, targetWidth, targetHeight);

    // Apply resolution scale transform if downscaled
    ctx.save();
    if (scaleRatio !== 1.0) {
      ctx.scale(scaleRatio, scaleRatio);
    }

    // Render Canvas
    await renderCanvasElement(ctx, width, height, {
      ...layerConfig,
      backgroundImage: bgImg,
      frameOverlayImage: frameImg,
      docImage: docImg,
      textLayers: currentTextLayers,
      qrLayers: currentQrLayers,
      recordData: record
    });

    ctx.restore();

    // Direct Blob Conversion (avoiding heavy base64 string allocations)
    const blob = await getCanvasBlob(offscreenCanvas);

    // Determine File Path & Folder Structure
    let subFolderPath = '';
    if (groupByColumns.length > 0) {
      const folderParts = groupByColumns
        .map(col => record[col] ? String(record[col]).trim() : 'Unassigned')
        .filter(Boolean);
      if (folderParts.length > 0) {
        subFolderPath = folderParts.join('/') + '/';
      }
    }

    const filename = formatFileName(fileNamePattern, record, i) + '.png';
    const fullZipPath = subFolderPath + filename;

    if (blob) {
      zip.file(fullZipPath, blob);
    }

    if (onProgress) {
      onProgress(i + 1, total);
    }

    // Yield main thread with periodic micro-pauses to allow UI rendering & GC sweeps
    await new Promise((resolve) => setTimeout(resolve, 4));
  }

  if (shouldCancel && shouldCancel()) {
    offscreenCanvas.width = 0;
    offscreenCanvas.height = 0;
    return;
  }

  // Generate & Download ZIP with STREAM mode for high performance
  const content = await zip.generateAsync({
    type: 'blob',
    compression: 'STORE',
    streamFiles: true
  });

  // Free GPU memory allocated to offscreen canvas
  offscreenCanvas.width = 0;
  offscreenCanvas.height = 0;

  // Trigger download & immediately revoke object URL to prevent space buildup
  const blobUrl = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = zipName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Instantly clean up memory allocated for generated photos & zip blob
  setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 1000);
}
