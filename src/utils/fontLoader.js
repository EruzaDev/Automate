// Custom font loader utility using FontFace Web API

const loadedCustomFonts = [];

export async function loadCustomFontFile(file) {
  try {
    const fontName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const arrayBuffer = await file.arrayBuffer();

    const fontFace = new FontFace(fontName, arrayBuffer);
    await fontFace.load();

    document.fonts.add(fontFace);

    const fontEntry = {
      name: fontName,
      displayName: `${fontName} (Uploaded)`,
      family: `"${fontName}", sans-serif`
    };

    if (!loadedCustomFonts.some((f) => f.name === fontName)) {
      loadedCustomFonts.push(fontEntry);
    }

    return fontEntry;
  } catch (err) {
    console.error('Failed to load font file:', err);
    throw new Error(`Could not load font file "${file.name}": ${err.message}`);
  }
}

export function getLoadedCustomFonts() {
  return loadedCustomFonts;
}
