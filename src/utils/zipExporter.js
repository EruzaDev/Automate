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
  onProgress
}) {
  const zip = new JSZip();
  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = width;
  offscreenCanvas.height = height;
  const ctx = offscreenCanvas.getContext('2d');

  // Preload background & frame overlay images once if static
  const bgImg = typeof layerConfig.backgroundImage === 'string' 
    ? await loadImage(layerConfig.backgroundImage) 
    : layerConfig.backgroundImage;

  const frameImg = typeof layerConfig.frameOverlayImage === 'string'
    ? await loadImage(layerConfig.frameOverlayImage)
    : layerConfig.frameOverlayImage;

  const total = records.length;

  for (let i = 0; i < total; i++) {
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

    // Convert canvas to Data URL / Blob
    const dataUrl = offscreenCanvas.toDataURL('image/png');
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');

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

    zip.file(fullZipPath, base64Data, { base64: true });

    if (onProgress) {
      onProgress(i + 1, total);
    }
  }

  // Generate & Download ZIP
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, zipName);
}
