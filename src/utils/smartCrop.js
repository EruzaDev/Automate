/**
 * Smart Crop Engine: Calculates aspect cover & center alignment 
 * so the documentation image fills the exact frame dimensions 
 * without stretching or distortion.
 */

export function calculateCoverDimensions(srcWidth, srcHeight, destWidth, destHeight, alignment = 'center') {
  const srcRatio = srcWidth / srcHeight;
  const destRatio = destWidth / destHeight;

  let renderWidth, renderHeight, offsetX, offsetY;

  if (srcRatio > destRatio) {
    // Image is wider than frame - fit height, crop horizontal sides
    renderHeight = destHeight;
    renderWidth = destHeight * srcRatio;
    offsetY = 0;
    if (alignment === 'left') {
      offsetX = 0;
    } else if (alignment === 'right') {
      offsetX = destWidth - renderWidth;
    } else {
      // Center
      offsetX = (destWidth - renderWidth) / 2;
    }
  } else {
    // Image is taller than frame - fit width, crop vertical top/bottom
    renderWidth = destWidth;
    renderHeight = destWidth / srcRatio;
    offsetX = 0;
    if (alignment === 'top') {
      offsetY = 0;
    } else if (alignment === 'bottom') {
      offsetY = destHeight - renderHeight;
    } else {
      // Center
      offsetY = (destHeight - renderHeight) / 2;
    }
  }

  return {
    renderWidth,
    renderHeight,
    offsetX,
    offsetY
  };
}

export const DEFAULT_PHOTO_TRANSFORM = Object.freeze({ scale: 1, x: 0, y: 0 });

/** Position a photo inside its crop area while keeping the area completely covered. */
export function calculatePhotoPlacement(srcWidth, srcHeight, destWidth, destHeight, alignment = 'center', transform = DEFAULT_PHOTO_TRANSFORM) {
  const cover = calculateCoverDimensions(srcWidth, srcHeight, destWidth, destHeight, alignment);
  const scale = Math.max(1, Math.min(3, Number(transform?.scale) || 1));
  const renderWidth = cover.renderWidth * scale;
  const renderHeight = cover.renderHeight * scale;
  const baseX = cover.offsetX - (renderWidth - cover.renderWidth) / 2;
  const baseY = cover.offsetY - (renderHeight - cover.renderHeight) / 2;
  const offsetX = Math.max(destWidth - renderWidth, Math.min(0, baseX + (Number(transform?.x) || 0) * destWidth));
  const offsetY = Math.max(destHeight - renderHeight, Math.min(0, baseY + (Number(transform?.y) || 0) * destHeight));
  return {
    renderWidth, renderHeight, offsetX, offsetY,
    scale,
    x: (offsetX - baseX) / destWidth,
    y: (offsetY - baseY) / destHeight
  };
}

/**
 * Draws image onto canvas with cover fit & center crop
 */
export function drawCoverImage(ctx, img, targetX, targetY, targetWidth, targetHeight, alignment = 'center', transform = DEFAULT_PHOTO_TRANSFORM) {
  if (!img || !img.complete || img.naturalWidth === 0) return;
  if (!targetWidth || !targetHeight || targetWidth <= 0 || targetHeight <= 0) return;

  const { renderWidth, renderHeight, offsetX, offsetY } = calculatePhotoPlacement(
    img.naturalWidth,
    img.naturalHeight,
    targetWidth,
    targetHeight,
    alignment,
    transform
  );

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Clip to target bounding box
  ctx.beginPath();
  ctx.rect(targetX, targetY, targetWidth, targetHeight);
  ctx.clip();

  // Draw image extended to cover frame
  ctx.drawImage(
    img,
    targetX + offsetX,
    targetY + offsetY,
    renderWidth,
    renderHeight
  );

  ctx.restore();
}
