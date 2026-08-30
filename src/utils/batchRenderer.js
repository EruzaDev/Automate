import QRCode from 'qrcode';
import JSZip from 'jszip';
import { fitFontSize } from './fitText';
import { evaluateFieldText } from './multiColumnEvaluator';
import { parseRichTextTokens, stripRichTextFormatting } from './richTextParser';

// Render a single record row on a high-resolution export canvas with exact proportional scale matching stage viewport
export async function renderRecordToCanvas(dataRow, layout, canvas, stageWidth = 620, maxDimension = 2560) {
  if (!layout || !layout.image) return canvas;

  const rawWidth = layout.image.naturalWidth || layout.image.width || 1200;
  const rawHeight = layout.image.naturalHeight || layout.image.height || 800;

  let width = rawWidth;
  let height = rawHeight;
  let resScale = 1.0;

  if (maxDimension && maxDimension > 0 && (rawWidth > maxDimension || rawHeight > maxDimension)) {
    resScale = maxDimension / Math.max(rawWidth, rawHeight);
    width = Math.round(rawWidth * resScale);
    height = Math.round(rawHeight * resScale);
  }

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);

  ctx.save();
  if (resScale !== 1.0) {
    ctx.scale(resScale, resScale);
  }

  // Draw layout background image
  ctx.drawImage(layout.image, 0, 0, rawWidth, rawHeight);

  // Proportional resolution scale ratio relative to interactive stage canvas (stageWidth = 620px)
  const scaleRatio = rawWidth / (stageWidth || 620);

  // Draw each field bounding box onto canvas
  for (const field of layout.fields || []) {
    const boxX = field.xPct * rawWidth;
    const boxY = field.yPct * rawHeight;
    const boxW = field.wPct * rawWidth;
    const boxH = field.hPct * rawHeight;

    if (field.type === 'text') {
      const text = evaluateFieldText(field, dataRow);
      const letterSpacing = (field.letterSpacing || 0) * scaleRatio;
      const wordSpacing = (field.wordSpacing || 0) * scaleRatio;
      const baseFontFamily = field.fontFamily || 'Georgia, serif';
      const baseFontWeight = field.fontWeight || '600';

      const unscaledMaxFont = field.fontSize || 36;
      const scaledMaxFont = unscaledMaxFont * scaleRatio;
      const minFont = 6 * scaleRatio;

      const fontSize = fitFontSize(
        text,
        boxW - (8 * scaleRatio),
        boxH - (6 * scaleRatio),
        baseFontFamily,
        baseFontWeight,
        letterSpacing,
        wordSpacing,
        scaledMaxFont,
        minFont,
        field.isFixedFontSize || false
      );

      ctx.letterSpacing = `${letterSpacing}px`;
      ctx.wordSpacing = `${wordSpacing}px`;
      ctx.fillStyle = field.color || '#ffffff';
      ctx.textBaseline = 'middle';

      const tokens = parseRichTextTokens(text);
      const cleanTotalText = stripRichTextFormatting(text);

      // Calculate starting position based on alignment
      ctx.font = `${baseFontWeight} ${fontSize}px ${baseFontFamily}`;
      const totalWidth = ctx.measureText(cleanTotalText).width;

      let currentX = boxX + (boxW - totalWidth) / 2; // Center default
      if (field.align === 'left') { currentX = boxX + (4 * scaleRatio); }
      if (field.align === 'right') { currentX = boxX + boxW - totalWidth - (4 * scaleRatio); }

      const textY = boxY + boxH / 2;

      // Draw each token styled segment
      for (const token of tokens) {
        let weight = baseFontWeight;
        if (token.bold) weight = '700';
        let style = '';
        if (token.italic) style = 'italic ';

        ctx.font = `${style}${weight} ${fontSize}px ${baseFontFamily}`;
        ctx.textAlign = 'left';
        ctx.fillText(token.text, currentX, textY);

        const tokenWidth = ctx.measureText(token.text).width;

        // Render Strikethrough
        if (token.strike) {
          ctx.beginPath();
          ctx.lineWidth = Math.max(1 * scaleRatio, fontSize / 16);
          ctx.strokeStyle = field.color || '#ffffff';
          ctx.moveTo(currentX, textY);
          ctx.lineTo(currentX + tokenWidth, textY);
          ctx.stroke();
        }

        // Render Underline
        if (token.underline) {
          ctx.beginPath();
          ctx.lineWidth = Math.max(1 * scaleRatio, fontSize / 16);
          ctx.strokeStyle = field.color || '#ffffff';
          ctx.moveTo(currentX, textY + fontSize * 0.45);
          ctx.lineTo(currentX + tokenWidth, textY + fontSize * 0.45);
          ctx.stroke();
        }

        currentX += tokenWidth;
      }
    } else if (field.type === 'qr') {
      const rawVal = dataRow && dataRow[field.key] !== undefined && dataRow[field.key] !== ''
        ? dataRow[field.key]
        : field.key;
      const qrText = String(rawVal || 'https://example.com');
      const qrSize = Math.max(120, Math.round(boxW));

      try {
        const qrDataUrl = await QRCode.toDataURL(qrText, {
          width: qrSize,
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' }
        });

        const qrImg = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = qrDataUrl;
        });

        if (qrImg) {
          ctx.drawImage(qrImg, boxX, boxY, boxW, boxH);
        }
      } catch (err) {
        console.error('QR rendering error:', err);
      }
    }
  }

  ctx.restore();
  return canvas;
}

// Batch ZIP generation helper
export async function exportLayoutsToZip({
  rows,
  layouts,
  layoutColumnKey = '',
  folderSortColumns = [],
  folderStructureMode = 'combined',
  maxDimension = 2560,
  safeMemoryMode = false,
  batchChunkSize = 500, // Maximum items per ZIP file volume to keep RAM low
  onProgress,
  onZipProgress,
  shouldCancel
}) {
  const exportCanvas = document.createElement('canvas');

  const resolveLayoutForRow = (row) => {
    if (layouts.length <= 1) return layouts[0] || null;
    if (!layoutColumnKey) return layouts[0];
    const val = String(row[layoutColumnKey] || '').trim().toLowerCase();
    const match = layouts.find((l) => String(l.selectorValue || '').trim().toLowerCase() === val);
    return match || layouts[0];
  };

  const getCanvasBlob = (canvas) => {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  };

  const total = rows.length;
  const chunkSize = (batchChunkSize && batchChunkSize > 0) ? batchChunkSize : 500;
  const totalVolumes = Math.ceil(total / chunkSize);

  for (let vol = 0; vol < totalVolumes; vol++) {
    if (shouldCancel && shouldCancel()) {
      break;
    }

    const volStart = vol * chunkSize;
    const volEnd = Math.min((vol + 1) * chunkSize, total);
    const volumeZip = new JSZip();

    for (let i = volStart; i < volEnd; i++) {
      if (shouldCancel && shouldCancel()) {
        break;
      }

      const row = rows[i];
      const layout = resolveLayoutForRow(row);

      if (layout) {
        await renderRecordToCanvas(row, layout, exportCanvas, 620, maxDimension);
        
        const blob = await getCanvasBlob(exportCanvas);

        // Reset export canvas backing store to free GPU texture RAM immediately
        exportCanvas.width = 0;
        exportCanvas.height = 0;

        // Formulate filename
        const nameHint = row.last_name && row.first_name
          ? `${row.last_name}_${row.first_name}`
          : row.name || row.first_name || row[Object.keys(row)[0]] || `record_${i + 1}`;

        const safeName = String(nameHint)
          .replace(/[^a-z0-9\-_ ]/gi, '')
          .trim()
          .replace(/\s+/g, '_') || `record_${i + 1}`;

        // Build folder hierarchy path if folderSortColumns is provided
        let zipFilePath = `${safeName}_${i + 1}.png`;
        if (Array.isArray(folderSortColumns) && folderSortColumns.length > 0) {
          const folderSegments = folderSortColumns
            .map((colKey) => {
              const rawVal = row[colKey];
              const cleanVal = String(rawVal !== undefined && rawVal !== null ? rawVal : '')
                .trim()
                .replace(/[\/\\?%*:|"<>]/g, '');
              return cleanVal || 'Uncategorized';
            })
            .filter(Boolean);

          if (folderSegments.length > 0) {
            if (folderStructureMode === 'nested') {
              zipFilePath = `${folderSegments.join('/')}/${safeName}_${i + 1}.png`;
            } else {
              // Combined Folder Mode: e.g. "BSCS 1 B"
              const combinedFolderName = folderSegments.join(' ');
              zipFilePath = `${combinedFolderName}/${safeName}_${i + 1}.png`;
            }
          }
        }

        if (blob) {
          volumeZip.file(zipFilePath, blob);
        }
      }

      if (onProgress) {
        onProgress(i + 1, total, { currentVolume: vol + 1, totalVolumes, volProgress: i + 1, volEnd });
      }

      // Adaptive yielding: Longer pauses every 5 records in safe memory mode or large batch
      const isChunkBoundary = (i + 1) % 5 === 0;
      const pauseMs = safeMemoryMode || total > 50
        ? (isChunkBoundary ? 60 : 15)
        : 8;

      await new Promise((resolve) => setTimeout(resolve, pauseMs));
    }

    if (shouldCancel && shouldCancel()) {
      exportCanvas.width = 0;
      exportCanvas.height = 0;
      return false;
    }

    // Generate Volume ZIP
    try {
      const zipContent = await volumeZip.generateAsync(
        {
          type: 'blob',
          compression: 'STORE',
          streamFiles: true
        },
        (metadata) => {
          if (shouldCancel && shouldCancel()) {
            throw new Error('EXPORT_CANCELLED');
          }
          if (onZipProgress) {
            onZipProgress(Math.round(metadata.percent), metadata.currentFile || '', {
              currentVolume: vol + 1,
              totalVolumes,
              volEnd
            });
          }
        }
      );

      if (shouldCancel && shouldCancel()) {
        exportCanvas.width = 0;
        exportCanvas.height = 0;
        return false;
      }

      // Auto Download Volume ZIP File
      const zipFileName = totalVolumes > 1
        ? `Certificates_Part_${vol + 1}_of_${totalVolumes}_(${volStart + 1}-${volEnd}).zip`
        : 'Certificates_Batch_Export.zip';

      const blobUrl = URL.createObjectURL(zipContent);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = zipFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Revoke URL object & pause 150ms for Garbage Collection sweep before next volume
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 1000);

      await new Promise((resolve) => setTimeout(resolve, 150));
    } catch (err) {
      exportCanvas.width = 0;
      exportCanvas.height = 0;
      if (err.message === 'EXPORT_CANCELLED') {
        return false;
      }
      throw err;
    }
  }

  exportCanvas.width = 0;
  exportCanvas.height = 0;

  return true;
}
