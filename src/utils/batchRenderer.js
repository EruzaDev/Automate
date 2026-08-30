import QRCode from 'qrcode';
import JSZip from 'jszip';
import { fitFontSize } from './fitText';
import { evaluateFieldText } from './multiColumnEvaluator';
import { parseRichTextTokens, stripRichTextFormatting } from './richTextParser';

// Render a single record row on a high-resolution export canvas with exact proportional scale matching stage viewport
export async function renderRecordToCanvas(dataRow, layout, canvas, stageWidth = 620) {
  if (!layout || !layout.image) return canvas;

  const ctx = canvas.getContext('2d');
  const width = layout.image.naturalWidth || layout.image.width || 1200;
  const height = layout.image.naturalHeight || layout.image.height || 800;

  canvas.width = width;
  canvas.height = height;

  // Draw layout background image
  ctx.drawImage(layout.image, 0, 0, width, height);

  // Proportional resolution scale ratio relative to interactive stage canvas (stageWidth = 620px)
  const scaleRatio = width / (stageWidth || 620);

  // Draw each field bounding box onto canvas
  for (const field of layout.fields || []) {
    const boxX = field.xPct * width;
    const boxY = field.yPct * height;
    const boxW = field.wPct * width;
    const boxH = field.hPct * height;

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

  return canvas;
}

// Batch ZIP generation helper
export async function exportLayoutsToZip({
  rows,
  layouts,
  layoutColumnKey = '',
  onProgress,
  shouldCancel
}) {
  const zip = new JSZip();
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

  for (let i = 0; i < rows.length; i++) {
    if (shouldCancel && shouldCancel()) {
      break;
    }

    const row = rows[i];
    const layout = resolveLayoutForRow(row);

    if (layout) {
      await renderRecordToCanvas(row, layout, exportCanvas, 620);
      
      const blob = await getCanvasBlob(exportCanvas);

      // Formulate filename
      const nameHint = row.last_name && row.first_name
        ? `${row.last_name}_${row.first_name}`
        : row.name || row.first_name || row[Object.keys(row)[0]] || `record_${i + 1}`;

      const safeName = String(nameHint)
        .replace(/[^a-z0-9\-_ ]/gi, '')
        .trim()
        .replace(/\s+/g, '_') || `record_${i + 1}`;

      if (blob) {
        zip.file(`${safeName}_${i + 1}.png`, blob);
      }
    }

    if (onProgress) {
      onProgress(i + 1, rows.length);
    }

    // Yield main thread to allow React to paint DOM & prevent UI freeze
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const content = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  return content;
}
