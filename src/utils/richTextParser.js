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

// Parse text into styled tokens based on styledTags dictionary
export function parseStyledTextTokens(rawText, styledTags = {}, fieldDefaults = {}) {
  if (!rawText) return [];
  const text = String(rawText);
  const baseBold = fieldDefaults.bold !== undefined ? fieldDefaults.bold : false;
  const baseItalic = fieldDefaults.italic !== undefined ? fieldDefaults.italic : false;
  const baseStrike = fieldDefaults.strike !== undefined ? fieldDefaults.strike : false;
  const baseUnderline = fieldDefaults.underline !== undefined ? fieldDefaults.underline : false;

  // Extract all dynamic tags in curly braces (e.g. {first_name})
  const tagMatches = [];
  const tagRegex = /\{([^}]+)\}/g;
  let m;
  while ((m = tagRegex.exec(text)) !== null) {
    tagMatches.push(m[0]);
  }

  // Combine dynamic tags and styledTags keys
  const allKeysSet = new Set([...tagMatches, ...Object.keys(styledTags)]);
  const keys = Array.from(allKeysSet).filter((k) => k && text.includes(k));

  if (keys.length === 0) {
    return [{ text, bold: baseBold, italic: baseItalic, strike: baseStrike, underline: baseUnderline }];
  }

  // Sort keys by length descending to match longest phrases/tags first
  keys.sort((a, b) => b.length - a.length);

  const escapedKeys = keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escapedKeys.join('|')})`, 'g');

  const tokens = [];
  let lastIdx = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      tokens.push({
        text: text.slice(lastIdx, match.index),
        bold: baseBold,
        italic: baseItalic,
        strike: baseStrike,
        underline: baseUnderline
      });
    }

    const matchedKey = match[0];
    const tagStyle = styledTags[matchedKey] || {};

    tokens.push({
      text: matchedKey,
      keyName: matchedKey,
      isTag: matchedKey.startsWith('{') && matchedKey.endsWith('}'),
      bold: tagStyle.bold !== undefined ? tagStyle.bold : baseBold,
      italic: tagStyle.italic !== undefined ? tagStyle.italic : baseItalic,
      strike: tagStyle.strikethrough !== undefined ? tagStyle.strikethrough : baseStrike,
      underline: tagStyle.underline !== undefined ? tagStyle.underline : baseUnderline,
      color: tagStyle.color
    });

    lastIdx = regex.lastIndex;
  }

  if (lastIdx < text.length) {
    tokens.push({
      text: text.slice(lastIdx),
      bold: baseBold,
      italic: baseItalic,
      strike: baseStrike,
      underline: baseUnderline
    });
  }

  return tokens;
}

// Calculate DOM line breaks for exact parity between browser DOM layout and Canvas export
export function getDOMLineBreaks(text, styledTags = {}, field = {}, maxW = 300) {
  if (typeof document === 'undefined' || !text) return [];

  const tokens = parseStyledTextTokens(text, styledTags, {
    bold: field.fontWeight === '700' || field.fontWeight === 'bold',
    italic: field.fontStyle === 'italic',
    strike: Boolean(field.strikethrough),
    underline: Boolean(field.underline)
  });

  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.visibility = 'hidden';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = `${Math.max(10, maxW)}px`;
  container.style.fontFamily = field.fontFamily || 'Georgia, serif';
  container.style.fontSize = `${field.fontSize || 36}px`;
  container.style.fontWeight = field.fontWeight || '400';
  container.style.fontStyle = field.fontStyle || 'normal';
  container.style.letterSpacing = `${field.letterSpacing || 0}px`;
  container.style.wordSpacing = `${field.wordSpacing || 0}px`;
  container.style.whiteSpace = 'pre-wrap';
  container.style.wordBreak = 'break-word';
  container.style.overflowWrap = 'anywhere';
  container.style.lineHeight = '1.2';
  container.style.padding = '0';
  container.style.margin = '0';
  container.style.border = 'none';

  const spanElements = [];
  tokens.forEach((tok) => {
    const parts = tok.text.split(/(\s+)/);
    parts.forEach((p) => {
      if (!p) return;
      const span = document.createElement('span');
      span.textContent = p;
      span.style.fontWeight = tok.bold ? '700' : (field.fontWeight || '400');
      span.style.fontStyle = tok.italic ? 'italic' : (field.fontStyle || 'normal');
      span._tokenRef = { ...tok, text: p };
      container.appendChild(span);
      spanElements.push(span);
    });
  });

  document.body.appendChild(container);

  const lines = [];
  let currentLine = [];
  let lastTop = null;

  spanElements.forEach((span) => {
    const rect = span.getBoundingClientRect();
    const top = Math.round(rect.top);

    if (lastTop !== null && Math.abs(top - lastTop) > 4) {
      if (currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = [];
      }
    }
    currentLine.push(span._tokenRef);
    lastTop = top;
  });

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  document.body.removeChild(container);
  return lines;
}
