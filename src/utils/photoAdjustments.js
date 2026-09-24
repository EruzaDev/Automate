export const DEFAULT_PHOTO_ADJUSTMENTS = Object.freeze({
  brightness: 0, contrast: 0, hue: 0, saturation: 0,
  exposure: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0,
  redCyan: 0, greenMagenta: 0, blueYellow: 0,
  levelBlack: 0, levelWhite: 255, gamma: 1,
  curveShadows: 0, curveMidtones: 0, curveHighlights: 0
});

const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const smoothstep = (start, end, value) => {
  const t = clamp((value - start) / (end - start));
  return t * t * (3 - 2 * t);
};

export function hasPhotoAdjustments(settings) {
  return !!settings && Object.entries(DEFAULT_PHOTO_ADJUSTMENTS).some(
    ([key, value]) => Number(settings[key] ?? value) !== value
  );
}

export function applyPhotoAdjustments(imageData, settings) {
  if (!hasPhotoAdjustments(settings)) return imageData;
  const s = { ...DEFAULT_PHOTO_ADJUSTMENTS, ...settings };
  const data = imageData.data;
  const black = clamp(Number(s.levelBlack), 0, 254) / 255;
  const white = Math.max(black + 1 / 255, clamp(Number(s.levelWhite), 1, 255) / 255);
  const gamma = Math.max(0.1, Number(s.gamma));
  const exposure = Math.pow(2, Number(s.exposure));
  const contrast = Math.max(0, 1 + Number(s.contrast) / 100);
  const saturation = Math.max(0, 1 + Number(s.saturation) / 100);
  const hue = Number(s.hue) * Math.PI / 180;
  const cosHue = Math.cos(hue);
  const sinHue = Math.sin(hue);
  const colorChanged = hue !== 0 || saturation !== 1;
  const redShift = Number(s.redCyan) / 300;
  const greenShift = Number(s.greenMagenta) / 300;
  const blueShift = Number(s.blueYellow) / 300;
  const shadowAmount = Number(s.shadows) / 180;
  const highlightAmount = Number(s.highlights) / 180;
  const whiteAmount = Number(s.whites) / 180;
  const blackAmount = Number(s.blacks) / 180;
  const curveShadows = Number(s.curveShadows) / 200;
  const curveMidtones = Number(s.curveMidtones) / 200;
  const curveHighlights = Number(s.curveHighlights) / 200;
  const toneTable = new Float32Array(256);
  const shiftTable = new Float32Array(4097);

  // Precalculate expensive powers, smooth curves and exponentials once per edit.
  for (let value = 0; value < 256; value++) {
    const leveled = Math.pow(clamp((value / 255 - black) / (white - black)), 1 / gamma);
    toneTable[value] = (leveled * exposure - 0.5) * contrast + 0.5 + Number(s.brightness) / 200;
  }
  for (let index = 0; index < shiftTable.length; index++) {
    const luminance = index / 4096;
    shiftTable[index] =
      shadowAmount * (1 - smoothstep(0.05, 0.55, luminance)) +
      highlightAmount * smoothstep(0.45, 0.95, luminance) +
      whiteAmount * smoothstep(0.65, 1, luminance) +
      blackAmount * (1 - smoothstep(0, 0.35, luminance)) +
      curveShadows * Math.exp(-(((luminance - 0.18) / 0.2) ** 2)) +
      curveMidtones * Math.exp(-(((luminance - 0.5) / 0.23) ** 2)) +
      curveHighlights * Math.exp(-(((luminance - 0.82) / 0.2) ** 2));
  }

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    let r = toneTable[data[i]];
    let g = toneTable[data[i + 1]];
    let b = toneTable[data[i + 2]];

    const luminance = clamp(0.2126 * r + 0.7152 * g + 0.0722 * b);
    const shift = shiftTable[Math.round(luminance * 4096)];
    r += shift + redShift;
    g += shift + greenShift;
    b += shift + blueShift;

    if (!colorChanged) {
      data[i] = Math.round(clamp(r) * 255);
      data[i + 1] = Math.round(clamp(g) * 255);
      data[i + 2] = Math.round(clamp(b) * 255);
      continue;
    }

    // Rotate chroma around the luminance axis, then change its distance from gray.
    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const u = b - gray;
    const v = r - gray;
    const rotatedU = (u * cosHue - v * sinHue) * saturation;
    const rotatedV = (u * sinHue + v * cosHue) * saturation;
    const nextR = gray + rotatedV;
    const nextB = gray + rotatedU;
    const nextG = (gray - 0.2126 * nextR - 0.0722 * nextB) / 0.7152;
    data[i] = Math.round(clamp(nextR) * 255);
    data[i + 1] = Math.round(clamp(nextG) * 255);
    data[i + 2] = Math.round(clamp(nextB) * 255);
  }
  return imageData;
}
