import { drawCoverImage } from './smartCrop';
import { renderQRCodeToCanvas } from './qrGenerator';

/**
 * Loads an image from URL or data URI asynchronously
 */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => {
      console.warn('Image failed to load:', src);
      resolve(null);
    };
    img.src = src;
  });
}

/**
 * Transforms casing for strings
 */
export function applyCasing(text, format) {
  if (!text) return '';
  switch (format) {
    case 'uppercase':
      return text.toUpperCase();
    case 'lowercase':
      return text.toLowerCase();
    case 'titlecase':
      return text.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    default:
      return text;
  }
}

/**
 * Joins multiple column values from a record based on specified column order & separator
 */
export function evaluateMultiColumnText(record, config) {
  if (!config || !record) return '';
  const { columns = [], order = [], separator = ' ', casing = 'none', fallbackRules = [] } = config;

  // Use order if provided, otherwise use columns array order
  const activeOrder = order.length > 0 ? order : columns;

  const parts = [];

  for (const colName of activeOrder) {
    let value = record[colName];

    // Check if there's a conditional fallback rule for this column
    const fallbackRule = fallbackRules.find(r => r.targetColumn === colName);
    if (fallbackRule && (!value || String(value).trim() === '')) {
      value = record[fallbackRule.fallbackColumn] || '';
    }

    if (value !== undefined && value !== null && String(value).trim() !== '') {
      parts.push(String(value).trim());
    }
  }

  const result = parts.join(separator);
  return applyCasing(result, casing);
}

/**
 * Renders a full Certificate / Badge on target HTML5 canvas context
 */
export async function renderCanvasElement(ctx, canvasWidth, canvasHeight, layerData) {
  const {
    backgroundImage,
    frameOverlayImage,
    docImage,
    docCropArea = { x: 0, y: 0, width: canvasWidth, height: canvasHeight },
    docAlignment = 'center',
    textLayers = [],
    qrLayers = [],
    recordData = {}
  } = layerData;

  // Clear canvas
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // 1. Draw Documentation / Content Image (if present, underneath background or frame)
  if (docImage) {
    drawCoverImage(
      ctx,
      docImage,
      docCropArea.x,
      docCropArea.y,
      docCropArea.width,
      docCropArea.height,
      docAlignment
    );
  }

  // 2. Draw Background Template Image (e.g. Certificate background or Badge base template)
  if (backgroundImage) {
    ctx.drawImage(backgroundImage, 0, 0, canvasWidth, canvasHeight);
  }

  // 3. Render Dynamic Text Layers
  for (const layer of textLayers) {
    const textContent = evaluateMultiColumnText(recordData, layer);
    if (!textContent) continue;

    ctx.save();
    ctx.font = `${layer.fontWeight || 'normal'} ${layer.fontSize || 32}px '${layer.fontFamily || 'Inter'}', sans-serif`;
    ctx.fillStyle = layer.color || '#ffffff';
    ctx.textAlign = layer.alignment || 'center';
    ctx.textBaseline = 'middle';

    // Text Shadow
    if (layer.shadow) {
      ctx.shadowColor = layer.shadowColor || 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = layer.shadowBlur || 4;
      ctx.shadowOffsetX = layer.shadowOffsetX || 2;
      ctx.shadowOffsetY = layer.shadowOffsetY || 2;
    }

    // Letter Spacing (if supported by canvas context)
    if (layer.letterSpacing && 'letterSpacing' in ctx) {
      ctx.letterSpacing = `${layer.letterSpacing}px`;
    }

    ctx.fillText(textContent, layer.x, layer.y);

    // Text Stroke (Optional border around text)
    if (layer.stroke) {
      ctx.strokeStyle = layer.strokeColor || '#000000';
      ctx.lineWidth = layer.strokeWidth || 2;
      ctx.strokeText(textContent, layer.x, layer.y);
    }

    ctx.restore();
  }

  // 4. Render QR Code Layers
  for (const qr of qrLayers) {
    let payload = '';
    if (qr.sourceType === 'column') {
      payload = recordData[qr.columnName] || '';
    } else {
      payload = qr.staticText || '';
    }

    if (payload) {
      await renderQRCodeToCanvas(
        ctx,
        payload,
        qr.x,
        qr.y,
        qr.size || 150,
        {
          darkColor: qr.darkColor || '#000000',
          lightColor: qr.lightColor || '#ffffff',
          margin: qr.margin || 1
        }
      );
    }
  }

  // 5. Draw Frame Overlay on TOP (Company Frame overlay)
  if (frameOverlayImage) {
    ctx.save();
    if (layerData.frameOpacity !== undefined) {
      ctx.globalAlpha = layerData.frameOpacity;
    }
    ctx.drawImage(frameOverlayImage, 0, 0, canvasWidth, canvasHeight);
    ctx.restore();
  }
}
