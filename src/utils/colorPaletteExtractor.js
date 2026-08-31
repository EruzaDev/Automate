// Color Palette Extraction & Color Theory Helper
// Converts RGB, HSL, Hex, and calculates Color Theories & Image Palettes

export function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToHex(h, s, l) {
  h = (h % 360 + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;

  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

export function hexToHsl(hex) {
  if (!hex) return { h: 0, s: 100, l: 50 };
  let clean = String(hex).replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  if (clean.length !== 6) return { h: 0, s: 100, l: 50 };

  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;

  return rgbToHsl(r, g, b);
}

// Extract dominant colors from an Image DOM element or HTMLCanvasElement
export function extractImagePalette(imgElement, count = 8) {
  if (typeof document === 'undefined' || !imgElement) return [];
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const w = 120;
    const h = Math.round(((imgElement.naturalHeight || imgElement.height || 100) / (imgElement.naturalWidth || imgElement.width || 100)) * 120) || 80;
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(imgElement, 0, 0, w, h);

    const imgData = ctx.getImageData(0, 0, w, h).data;
    const colorCounts = {};

    // Sample pixels every 8th pixel
    for (let i = 0; i < imgData.length; i += 32) {
      const r = Math.round(imgData[i] / 32) * 32;
      const g = Math.round(imgData[i + 1] / 32) * 32;
      const b = Math.round(imgData[i + 2] / 32) * 32;
      const alpha = imgData[i + 3];

      if (alpha < 128) continue;

      const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`.toUpperCase();
      colorCounts[hex] = (colorCounts[hex] || 0) + 1;
    }

    const sorted = Object.keys(colorCounts).sort((a, b) => colorCounts[b] - colorCounts[a]);
    return sorted.slice(0, count);
  } catch (e) {
    console.warn('Could not extract image palette:', e);
    return ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#FFFFFF', '#0F172A'];
  }
}

// Generate Color Theory suggestions based on a primary HEX color
export function generateColorTheories(primaryHex) {
  const { h, s, l } = hexToHsl(primaryHex || '#F59E0B');

  // 1. Complementary (180 deg offset)
  const compHue = (h + 180) % 360;
  const complementary = [
    hslToHex(h, s, l),
    hslToHex(compHue, Math.min(100, s + 10), Math.min(85, Math.max(35, l))),
    hslToHex(compHue, Math.max(20, s - 10), Math.min(95, l + 20))
  ];

  // 2. Analogous (-30 deg, +30 deg)
  const ana1 = (h + 330) % 360;
  const ana2 = (h + 30) % 360;
  const analogous = [
    hslToHex(ana1, s, l),
    hslToHex(h, s, l),
    hslToHex(ana2, s, l)
  ];

  // 3. Triadic (+120 deg, +240 deg)
  const tri1 = (h + 120) % 360;
  const tri2 = (h + 240) % 360;
  const triadic = [
    hslToHex(h, s, l),
    hslToHex(tri1, s, l),
    hslToHex(tri2, s, l)
  ];

  // 4. High-Contrast Text Suggestions
  const contrast = [
    '#FFFFFF',
    '#F59E0B',
    '#38BDF8',
    '#4ADE80',
    '#F472B6',
    '#A78BFA',
    '#F87171',
    '#0F172A'
  ];

  return {
    complementary,
    analogous,
    triadic,
    contrast
  };
}
