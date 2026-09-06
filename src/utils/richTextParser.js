// Rich Text Formatting Parser for Markdown & Inline styling (Canva & Word style)
// Supported syntax:
// ***bold & italic***
// **bold** or <b>bold</b> or <strong>bold</strong>
// *italic* or <i>italic</i> or <em>italic</em>
// ~~strikethrough~~ or <s>strikethrough</s> or <del>strikethrough</del>
// <u>underline</u>

export function parseRichTextTokens(rawText, baseStyles = {}) {
  if (!rawText) return [];
  const text = String(rawText);

  const baseBold = Boolean(baseStyles.bold);
  const baseItalic = Boolean(baseStyles.italic);
  const baseStrike = Boolean(baseStyles.strike);
  const baseUnderline = Boolean(baseStyles.underline);
  const baseColor = baseStyles.color;

  // Regex pattern matching styled spans (markdown & html)
  // 1,2: ***bold italic***
  // 3,4: **bold**
  // 5,6: *italic*
  // 7,8: ~~strike~~
  // 9,10: <u>underline</u>
  // 11,12: <b> or <strong>
  // 13,14: <i> or <em>
  // 15,16: <s> or <strike> or <del>
  const regex = /(\*\*\*(.*?)\*\*\*)|(\*\*(.*?)\*\*)|(\*(.*?)\*)|(~~(.*?)~~)|(<u>(.*?)<\/u>)|(<(?:b|strong)>(.*?)<\/(?:b|strong)>)|(<(?:i|em)>(.*?)<\/(?:i|em)>)|(<(?:s|strike|del)>(.*?)<\/(?:s|strike|del)>)/gi;

  const tokens = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Preceding unstyled text
    if (match.index > lastIndex) {
      tokens.push({
        text: text.slice(lastIndex, match.index),
        bold: baseBold,
        italic: baseItalic,
        strike: baseStrike,
        underline: baseUnderline,
        color: baseColor
      });
    }

    let innerText = '';
    const newStyles = {
      bold: baseBold,
      italic: baseItalic,
      strike: baseStrike,
      underline: baseUnderline,
      color: baseColor
    };

    if (match[1]) {
      // ***bold italic***
      innerText = match[2];
      newStyles.bold = true;
      newStyles.italic = true;
    } else if (match[3]) {
      // **bold**
      innerText = match[4];
      newStyles.bold = true;
    } else if (match[5]) {
      // *italic*
      innerText = match[6];
      newStyles.italic = true;
    } else if (match[7]) {
      // ~~strike~~
      innerText = match[8];
      newStyles.strike = true;
    } else if (match[9]) {
      // <u>underline</u>
      innerText = match[10];
      newStyles.underline = true;
    } else if (match[11]) {
      // <b> or <strong>
      innerText = match[12];
      newStyles.bold = true;
    } else if (match[13]) {
      // <i> or <em>
      innerText = match[14];
      newStyles.italic = true;
    } else if (match[15]) {
      // <s> or <strike> or <del>
      innerText = match[16];
      newStyles.strike = true;
    }

    // Recursively parse inner text in case of nested formatting (e.g. **<u>word</u>**)
    const innerTokens = parseRichTextTokens(innerText, newStyles);
    if (innerTokens.length > 0) {
      tokens.push(...innerTokens);
    } else {
      tokens.push({
        text: innerText,
        ...newStyles
      });
    }

    lastIndex = regex.lastIndex;
  }

  // Trailing unstyled text
  if (lastIndex < text.length) {
    tokens.push({
      text: text.slice(lastIndex),
      bold: baseBold,
      italic: baseItalic,
      strike: baseStrike,
      underline: baseUnderline,
      color: baseColor
    });
  }

  return tokens;
}

// Strip markdown & HTML tags to measure raw string length/width
export function stripRichTextFormatting(text) {
  if (!text) return '';
  return String(text)
    .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/<\/?(?:u|b|strong|i|em|s|strike|del)(?:\s+[^>]*)?>/gi, '');
}

// Parse text into styled tokens based on styledTags dictionary + inline markdown/HTML formatting
export function parseStyledTextTokens(rawText, styledTags = {}, fieldDefaults = {}) {
  if (!rawText) return [];
  const text = String(rawText);
  const baseBold = fieldDefaults.bold !== undefined ? Boolean(fieldDefaults.bold) : false;
  const baseItalic = fieldDefaults.italic !== undefined ? Boolean(fieldDefaults.italic) : false;
  const baseStrike = fieldDefaults.strike !== undefined ? Boolean(fieldDefaults.strike) : false;
  const baseUnderline = fieldDefaults.underline !== undefined ? Boolean(fieldDefaults.underline) : false;

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
    // Parse inline markdown/HTML formatting for entire text
    return parseRichTextTokens(text, {
      bold: baseBold,
      italic: baseItalic,
      strike: baseStrike,
      underline: baseUnderline,
      color: fieldDefaults.color
    });
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
      const sliceText = text.slice(lastIdx, match.index);
      const subTokens = parseRichTextTokens(sliceText, {
        bold: baseBold,
        italic: baseItalic,
        strike: baseStrike,
        underline: baseUnderline,
        color: fieldDefaults.color
      });
      tokens.push(...subTokens);
    }

    const matchedKey = match[0];
    const tagStyle = styledTags[matchedKey] || {};

    const effectiveBold = tagStyle.bold !== undefined ? Boolean(tagStyle.bold) : baseBold;
    const effectiveItalic = tagStyle.italic !== undefined ? Boolean(tagStyle.italic) : baseItalic;
    const effectiveStrike = tagStyle.strikethrough !== undefined ? Boolean(tagStyle.strikethrough) : baseStrike;
    const effectiveUnderline = tagStyle.underline !== undefined ? Boolean(tagStyle.underline) : baseUnderline;
    const effectiveColor = tagStyle.color || fieldDefaults.color;

    // Check if matched key contains inline markdown formatting
    const tagSubTokens = parseRichTextTokens(matchedKey, {
      bold: effectiveBold,
      italic: effectiveItalic,
      strike: effectiveStrike,
      underline: effectiveUnderline,
      color: effectiveColor
    });

    if (tagSubTokens.length > 1) {
      tagSubTokens.forEach((t) => {
        tokens.push({
          ...t,
          keyName: matchedKey,
          isTag: matchedKey.startsWith('{') && matchedKey.endsWith('}')
        });
      });
    } else {
      tokens.push({
        text: matchedKey,
        keyName: matchedKey,
        isTag: matchedKey.startsWith('{') && matchedKey.endsWith('}'),
        bold: effectiveBold,
        italic: effectiveItalic,
        strike: effectiveStrike,
        underline: effectiveUnderline,
        color: effectiveColor
      });
    }

    lastIdx = regex.lastIndex;
  }

  if (lastIdx < text.length) {
    const sliceText = text.slice(lastIdx);
    const subTokens = parseRichTextTokens(sliceText, {
      bold: baseBold,
      italic: baseItalic,
      strike: baseStrike,
      underline: baseUnderline,
      color: fieldDefaults.color
    });
    tokens.push(...subTokens);
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
    underline: Boolean(field.underline),
    color: field.color
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
