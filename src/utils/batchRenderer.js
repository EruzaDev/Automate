import QRCode from 'qrcode';
import JSZip from 'jszip';
import { fitFontSize, formatCanvasFont } from './fitText';
import { evaluateFieldText } from './multiColumnEvaluator';
import { parseRichTextTokens, parseStyledTextTokens, stripRichTextFormatting, getDOMLineBreaks } from './richTextParser';

// Render a single record row on a high-resolution export canvas with exact proportional scale matching stage viewport
export async function renderRecordToCanvas(dataRow, layout, canvas, stageWidth = 880, maxDimension = 2560) {
  if (!layout || !layout.image) return canvas;

  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch (e) {}
  }

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

  // Proportional resolution scale ratio relative to interactive stage canvas (baseStageWidth = 880px)
  const scaleRatio = rawWidth / (stageWidth || 880);

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
        field.allowWrap || field.isFixedFontSize || false
      );
      ctx.letterSpacing = `${letterSpacing}px`;
      ctx.wordSpacing = `${wordSpacing}px`;
      ctx.fillStyle = field.color || '#ffffff';
      ctx.textBaseline = 'middle';

      // Resolve styledTags dictionary for evaluated tag tokens
      const resolvedStyledTags = {};
      if (field.styledTags) {
        Object.keys(field.styledTags).forEach((k) => {
          if (field.styledTags[k]) {
            resolvedStyledTags[k] = field.styledTags[k];
            if (k.startsWith('{') && k.endsWith('}')) {
              const evalK = evaluateFieldText({ isCustomMessage: true, customTemplate: k, casing: field.casing }, dataRow || {});
              if (evalK && String(evalK).trim() && !String(evalK).startsWith('{')) {
                resolvedStyledTags[String(evalK).trim()] = field.styledTags[k];
              }
            }
          }
        });
      }

      const tokens = parseStyledTextTokens(text, resolvedStyledTags, {
        bold: baseFontWeight === '700' || baseFontWeight === 'bold',
        italic: field.fontStyle === 'italic',
        strike: Boolean(field.strikethrough),
        underline: Boolean(field.underline)
      });

      const maxLineWidth = boxW - (8 * scaleRatio);
      const lineHeight = fontSize * 1.2;
      const unscaledFittedFontSize = fontSize / scaleRatio;

      // Split into wrapped lines if allowWrap is true using real DOM layout measurement
      const lines = [];
      if (field.allowWrap) {
        const domLines = getDOMLineBreaks(
          text,
          resolvedStyledTags,
          { ...field, fontSize: unscaledFittedFontSize },
          (boxW / scaleRatio) - 8
        );

        if (domLines && domLines.length > 0) {
          domLines.forEach((dLine) => {
            lines.push(
              dLine.map((t) => {
                let weight = baseFontWeight;
                if (t.bold) weight = '700';
                let style = t.italic ? 'italic' : '';
                ctx.font = formatCanvasFont(style, weight, fontSize, baseFontFamily);
                return { ...t, width: ctx.measureText(t.text).width };
              })
            );
          });
        } else {
          lines.push(
            tokens.map((t) => {
              let weight = baseFontWeight;
              if (t.bold) weight = '700';
              let style = t.italic ? 'italic' : '';
              ctx.font = formatCanvasFont(style, weight, fontSize, baseFontFamily);
              return { ...t, width: ctx.measureText(t.text).width };
            })
          );
        }
      } else {
        lines.push(
          tokens.map((t) => {
            let weight = baseFontWeight;
            if (t.bold) weight = '700';
            let style = t.italic ? 'italic' : '';
            ctx.font = formatCanvasFont(style, weight, fontSize, baseFontFamily);
            return { ...t, width: ctx.measureText(t.text).width };
          })
        );
      }

      const totalBlockHeight = lines.length * lineHeight;
      let startY = boxY + (boxH - totalBlockHeight) / 2 + lineHeight / 2;

      for (const lineTokens of lines) {
        const lineTotalWidth = lineTokens.reduce((sum, t) => sum + (t.width || 0), 0);

        let currentX = boxX + (boxW - lineTotalWidth) / 2;
        if (field.align === 'left') { currentX = boxX + (4 * scaleRatio); }
        if (field.align === 'right') { currentX = boxX + boxW - lineTotalWidth - (4 * scaleRatio); }

        for (const token of lineTokens) {
          let weight = baseFontWeight;
          if (token.bold) weight = '700';
          let style = token.italic ? 'italic' : '';

          ctx.font = formatCanvasFont(style, weight, fontSize, baseFontFamily);
          ctx.fillStyle = token.color || field.color || '#ffffff';
          ctx.textAlign = 'left';
          ctx.fillText(token.text, currentX, startY);

          const tokenWidth = token.width !== undefined ? token.width : ctx.measureText(token.text).width;

          // Render Strikethrough
          if (token.strike) {
            ctx.beginPath();
            ctx.lineWidth = Math.max(1 * scaleRatio, fontSize / 16);
            ctx.strokeStyle = field.color || '#ffffff';
            ctx.moveTo(currentX, startY);
            ctx.lineTo(currentX + tokenWidth, startY);
            ctx.stroke();
          }

          // Render Underline
          if (token.underline) {
            ctx.beginPath();
            ctx.lineWidth = Math.max(1 * scaleRatio, fontSize / 16);
            ctx.strokeStyle = field.color || '#ffffff';
            const underlineY = startY + fontSize * 0.4;
            ctx.moveTo(currentX, underlineY);
            ctx.lineTo(currentX + tokenWidth, underlineY);
            ctx.stroke();
          }

          currentX += tokenWidth;
        }

        startY += lineHeight;
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
  batchChunkSize = 100, // Default 100 items per ZIP volume for smooth memory management
  exportFormat = 'png', // 'png' | 'jpeg'
  exportQuality = 0.92,
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

  const getCanvasBlob = (canvas, format = 'png', quality = 0.92) => {
    return new Promise((resolve) => {
      const mime = (format === 'jpeg' || format === 'jpg') ? 'image/jpeg' : 'image/png';
      canvas.toBlob((blob) => resolve(blob), mime, quality);
    });
  };

  const total = rows.length;
  const chunkSize = (batchChunkSize && batchChunkSize > 0) ? batchChunkSize : 100;
  const totalVolumes = Math.ceil(total / chunkSize);

  const fileExt = (exportFormat === 'jpeg' || exportFormat === 'jpg') ? 'jpg' : 'png';

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
        await renderRecordToCanvas(row, layout, exportCanvas, 880, maxDimension);
        
        const blob = await getCanvasBlob(exportCanvas, exportFormat, exportQuality);

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
        let zipFilePath = `${safeName}_${i + 1}.${fileExt}`;
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
              zipFilePath = `${folderSegments.join('/')}/${safeName}_${i + 1}.${fileExt}`;
            } else {
              // Combined Folder Mode: e.g. "BSCS 3 A" ({program} {year} {section})
              const combinedFolderName = folderSegments.join(' ');
              zipFilePath = `${combinedFolderName}/${safeName}_${i + 1}.${fileExt}`;
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
