import { stripRichTextFormatting } from './richTextParser';

// Utility for measuring and auto-fitting text size within bounding box constraints with letter & word spacing support
const measureCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
const measureCtx = measureCanvas ? measureCanvas.getContext('2d') : null;

export function fitFontSize(
  text,
  maxW,
  maxH,
  fontFamily = 'sans-serif',
  fontWeight = '600',
  letterSpacing = 0,
  wordSpacing = 0,
  maxSize = null,
  minSize = 6,
  isFixed = false
) {
  if (!text) return Math.max(minSize, 14);

  // If fixed font size mode is enabled by user, use explicit target size
  if (isFixed && maxSize) {
    return Math.max(minSize, Number(maxSize));
  }

  if (!measureCtx) return Math.max(minSize, 14);

  const cleanText = stripRichTextFormatting(String(text));
  const calculatedMax = maxSize ? Number(maxSize) : Math.max(8, Math.min(maxH * 1.5, 240));
  let size = calculatedMax;

  measureCtx.letterSpacing = `${letterSpacing || 0}px`;
  measureCtx.wordSpacing = `${wordSpacing || 0}px`;

  while (size > minSize) {
    measureCtx.font = `${fontWeight} ${size}px ${fontFamily}`;
    const width = measureCtx.measureText(cleanText).width;
    const lineHeight = size * 1.15;
    if (width <= maxW && lineHeight <= maxH) break;
    size -= 1;
  }

  return Math.max(size, minSize);
}
