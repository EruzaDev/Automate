import QRCode from 'qrcode';

/**
 * Generates QR code canvas data URI or directly renders onto target canvas context
 */
export async function renderQRCodeToCanvas(ctx, text, x, y, size, options = {}) {
  if (!text) return;

  const {
    darkColor = '#000000',
    lightColor = '#ffffff',
    margin = 1
  } = options;

  try {
    const tempCanvas = document.createElement('canvas');
    await QRCode.toCanvas(tempCanvas, text, {
      width: size,
      margin: margin,
      color: {
        dark: darkColor,
        light: lightColor
      },
      errorCorrectionLevel: 'H'
    });

    ctx.drawImage(tempCanvas, x, y, size, size);
  } catch (err) {
    console.error('Failed to render QR Code:', err);
  }
}

/**
 * Returns QR Code Data URL string
 */
export async function generateQRDataUrl(text, size = 300, options = {}) {
  if (!text) return '';
  const { darkColor = '#000000', lightColor = '#ffffff', margin = 1 } = options;
  return await QRCode.toDataURL(text, {
    width: size,
    margin: margin,
    color: {
      dark: darkColor,
      light: lightColor
    },
    errorCorrectionLevel: 'H'
  });
}
