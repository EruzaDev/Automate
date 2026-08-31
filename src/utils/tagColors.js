// Utility for assigning distinct, vibrant colors to dynamic tags
export function getTagColor(tagName) {
  if (!tagName) return '#38bdf8'; // Sky Blue default
  const clean = String(tagName).toLowerCase().replace(/[{}]/g, '').trim();

  if (clean.includes('first')) return '#fbbf24'; // Amber / Gold
  if (clean.includes('middle')) return '#818cf8'; // Soft Indigo
  if (clean.includes('last')) return '#06b6d4'; // Cyan
  if (clean.includes('name')) return '#3b82f6'; // Bright Blue
  if (clean.includes('rank') || clean.includes('award') || clean.includes('placement') || clean.includes('title')) return '#34d399'; // Emerald
  if (clean.includes('score') || clean.includes('point')) return '#facc15'; // Yellow
  if (clean.includes('course') || clean.includes('degree') || clean.includes('program')) return '#c084fc'; // Purple
  if (clean.includes('section') || clean.includes('class')) return '#f472b6'; // Pink
  if (clean.includes('date') || clean.includes('year')) return '#fb7185'; // Rose
  return '#e879f9'; // Fuchsia
}

// Function to segment a template into tokens (literals vs dynamic tags)
export function parseTemplateTokens(templateStr = '') {
  if (!templateStr) return [];
  const text = String(templateStr);
  const tagRegex = /\{([^}]+)\}/g;
  const tokens = [];
  let lastIdx = 0;
  let match;

  while ((match = tagRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      tokens.push({
        type: 'text',
        content: text.slice(lastIdx, match.index)
      });
    }

    const fullTag = match[0];
    const keyName = match[1];

    tokens.push({
      type: 'tag',
      fullTag,
      keyName,
      color: getTagColor(keyName)
    });

    lastIdx = tagRegex.lastIndex;
  }

  if (lastIdx < text.length) {
    tokens.push({
      type: 'text',
      content: text.slice(lastIdx)
    });
  }

  return tokens;
}
