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

/**
 * Draws image onto canvas with cover fit & center crop
 */
export function drawCoverImage(ctx, img, targetX, targetY, targetWidth, targetHeight, alignment = 'center') {
  if (!img || !img.complete || img.naturalWidth === 0) return;

  const { renderWidth, renderHeight, offsetX, offsetY } = calculateCoverDimensions(
    img.naturalWidth,
    img.naturalHeight,
    targetWidth,
    targetHeight,
    alignment
  );

  ctx.save();
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
