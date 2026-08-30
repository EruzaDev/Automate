// Rich Text Formatting Parser for Markdown-like inline styling
// Supported syntax:
// ***bold & italic***
// **bold**
// *italic*
// ~~strikethrough~~
// <u>underline</u>

export function parseRichTextTokens(rawText) {
  if (!rawText) return [];
  const text = String(rawText);

  // Regex pattern for matching styled spans
  // 1: ***bold italic***
  // 2: **bold**
  // 3: *italic*
  // 4: ~~strikethrough~~
  // 5: <u>underline</u>
  const regex = /(\*\*\*(.*?)\*\*\*)|(\*\*(.*?)\*\*)|(\*(.*?)\*)|(~~(.*?)~~)|(<u>(.*?)<\/u>)/g;

  const tokens = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Push preceding unstyled text
    if (match.index > lastIndex) {
      tokens.push({
        text: text.slice(lastIndex, match.index),
        bold: false,
        italic: false,
        strike: false,
        underline: false
      });
    }

    if (match[1]) {
      // ***bold italic***
      tokens.push({ text: match[2], bold: true, italic: true, strike: false, underline: false });
    } else if (match[3]) {
      // **bold**
      tokens.push({ text: match[4], bold: true, italic: false, strike: false, underline: false });
    } else if (match[5]) {
      // *italic*
      tokens.push({ text: match[6], bold: false, italic: true, strike: false, underline: false });
    } else if (match[7]) {
      // ~~strikethrough~~
      tokens.push({ text: match[8], bold: false, italic: false, strike: true, underline: false });
    } else if (match[9]) {
      // <u>underline</u>
      tokens.push({ text: match[10], bold: false, italic: false, strike: false, underline: true });
    }

    lastIndex = regex.lastIndex;
  }

  // Push remaining unstyled text
  if (lastIndex < text.length) {
    tokens.push({
      text: text.slice(lastIndex),
      bold: false,
      italic: false,
      strike: false,
      underline: false
    });
  }

  return tokens;
}

// Strip markdown tags to measure raw string length/width
export function stripRichTextFormatting(text) {
  if (!text) return '';
  return String(text)
    .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/<u>(.*?)<\/u>/g, '$1');
}
