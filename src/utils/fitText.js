import { stripRichTextFormatting } from './richTextParser';

// Utility for measuring and auto-fitting text size within bounding box constraints with letter & word spacing support
const measureCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
const measureCtx = measureCanvas ? measureCanvas.getContext('2d') : null;

export function formatCanvasFont(style = '', weight = '400', size = 16, family = 'sans-serif') {
  const cleanStyle = style ? `${style.trim()} ` : '';
  const cleanWeight = weight || '400';
  let formattedFamily = family || 'Georgia, serif';
  if (!formattedFamily.includes('"') && !formattedFamily.includes("'")) {
    formattedFamily = formattedFamily
      .split(',')
      .map((part) => {
        const trimmed = part.trim();
        if (trimmed.includes(' ') && !trimmed.startsWith("'") && !trimmed.startsWith('"')) {
          return `'${trimmed}'`;
        }
        return trimmed;
      })
      .join(', ');
  }
  return `${cleanStyle}${cleanWeight} ${Math.max(1, Math.round(size))}px ${formattedFamily}`;
}

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
  const cleanText = stripRichTextFormatting(text);

  // If fixed font size mode is enabled by user, return explicit font size
  if (isFixed) {
    return Math.max(minSize, Number(maxSize || 14));
  }

  if (!measureCtx) return Math.max(minSize, 14);

  // Maximum starting size (user's configured fontSize or box constraint)
  const calculatedMax = maxSize ? Number(maxSize) : Math.max(8, Math.min(maxH * 1.2, 240));
  let size = calculatedMax;

  const lSpace = Number(letterSpacing || 0);
  const wSpace = Number(wordSpacing || 0);
  const charCount = cleanText.length;
  const wordCount = cleanText.split(/\s+/).filter(Boolean).length;

  const extraLetter = charCount > 1 ? (charCount - 1) * lSpace : 0;
  const extraWord = wordCount > 1 ? (wordCount - 1) * wSpace : 0;

  // Iteratively shrink font size down until text fits within maxW and maxH on a single line
  while (size > minSize) {
    measureCtx.font = formatCanvasFont('', fontWeight, size, fontFamily);
    const baseWidth = measureCtx.measureText(cleanText).width;
    const width = baseWidth + extraLetter + extraWord;
    const lineHeight = size * 1.05;
    if (width <= maxW && lineHeight <= maxH) break;
    size -= 1;
  }

  return Math.max(size, minSize);
}
