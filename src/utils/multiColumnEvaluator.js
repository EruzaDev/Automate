import { stripRichTextFormatting } from './richTextParser';

// Evaluate text content for a field: custom message template OR multi-column combination OR single key
export function evaluateFieldText(field, dataRow = {}) {
  if (!field) return '';
  const row = dataRow || {};

  let rawString = '';

  // Mode 1: Custom Message Template (e.g., "Awarded to ***{first_name} {last_name}*** for {Course}")
  if (field.isCustomMessage && field.customTemplate) {
    rawString = field.customTemplate.replace(/\{([^}]+)\}/g, (_, key) => {
      const trimmedKey = key.trim();

      // Case-insensitive lookup in dataRow
      let val = row[trimmedKey];
      if (val === undefined) {
        const lowerKey = trimmedKey.toLowerCase();
        const foundKey = Object.keys(row).find((k) => String(k).trim().toLowerCase() === lowerKey);
        if (foundKey) val = row[foundKey];
      }

      const finalStr = val !== undefined && val !== null ? String(val) : '';
      return applyCasing(finalStr, field.casing);
    });
  }
  // Mode 2: Multi-Column Concatenation
  else if (field.isMultiColumn && Array.isArray(field.columns) && field.columns.length > 0) {
    const values = field.columns
      .map((colKey) => {
        let val = row[colKey];
        if (val === undefined) {
          const lowerKey = String(colKey).trim().toLowerCase();
          const foundKey = Object.keys(row).find((k) => String(k).trim().toLowerCase() === lowerKey);
          if (foundKey) val = row[foundKey];
        }
        return val;
      })
      .filter((val) => val !== undefined && val !== null && String(val).trim().length > 0)
      .map((val) => applyCasing(String(val).trim(), field.casing));

    const separator = field.separator !== undefined ? field.separator : ' ';
    const position = field.separatorPosition || 'between_all';

    if (values.length === 0) {
      rawString = '';
    } else if (values.length === 1) {
      rawString = values[0];
    } else if (position === 'after_first') {
      const first = values[0];
      const rest = values.slice(1).join(' ');
      rawString = `${first}${separator}${rest}`;
    } else if (position === 'before_last') {
      const front = values.slice(0, -1).join(' ');
      const last = values[values.length - 1];
      rawString = `${front}${separator}${last}`;
    } else if (position === 'custom_index' && field.separatorIndex !== undefined) {
      const idx = Math.max(1, Math.min(values.length - 1, Number(field.separatorIndex) || 1));
      const front = values.slice(0, idx).join(' ');
      const back = values.slice(idx).join(' ');
      rawString = `${front}${separator}${back}`;
    } else {
      rawString = values.join(separator);
    }
  }
  // Mode 3: Single Column Key
  else if (field.key) {
    let val = row[field.key];
    if (val === undefined) {
      const lowerKey = String(field.key).trim().toLowerCase();
      const foundKey = Object.keys(row).find((k) => String(k).trim().toLowerCase() === lowerKey);
      if (foundKey) val = row[foundKey];
    }
    rawString = applyCasing(String(val !== undefined ? val : field.key), field.casing);
  }

  return rawString;
}

// Casing transformation helper
export function applyCasing(str, casingRule = 'as-is') {
  if (!str) return '';
  switch (casingRule) {
    case 'uppercase':
      return str.toUpperCase();
    case 'lowercase':
      return str.toLowerCase();
    case 'capitalize':
    case 'titlecase':
    case 'title':
      // Converts string to lowercase first, then capitalizes first letter of every word (Title Case)
      return str.toLowerCase().replace(/\b[a-z]/g, (char) => char.toUpperCase());
    case 'as-is':
    default:
      return str;
  }
}
