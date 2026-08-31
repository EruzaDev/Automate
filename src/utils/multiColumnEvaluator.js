import { getPlacementTitle, toOrdinal } from './tabulationEngine.js';

// Sample fallback values for visual preview when no CSV data is loaded yet
function getSampleValue(keyName, titleScheme = 'championship', rankNum = 1) {
  const k = String(keyName).toLowerCase();
  const rNum = parseInt(rankNum, 10) || 1;
  if (k.includes('first')) return 'John';
  if (k.includes('last')) return 'Doe';
  if (k.includes('middle')) return 'Milla';
  if (k.includes('rank_title') || k.includes('ranktitle') || k.includes('placement') || k.includes('award') || k === 'title') {
    return getPlacementTitle(rNum, titleScheme);
  }
  if (k.includes('rank') || k.includes('ordinal')) return `${toOrdinal(rNum)} Place`;
  if (k.includes('score') || k.includes('point')) return '98.5';
  if (k.includes('course') || k.includes('degree') || k.includes('program')) return 'Computer Science';
  if (k.includes('section') || k.includes('class')) return 'Section A';
  if (k.includes('date')) return 'August 31, 2026';
  if (k.includes('company') || k.includes('org')) return 'Global Technologies';
  return `{${keyName}}`;
}

// Evaluate text content for a field: custom message template OR multi-column combination OR single key
export function evaluateFieldText(field, dataRow = {}) {
  if (!field) return '';
  const row = dataRow || {};
  const hasRowData = Object.keys(row).length > 0;

  let rawString = '';

  // Mode 1: Custom Message Template (e.g., "Awarded to ***{first_name} {middle_name_initial} {last_name}*** for {Course}")
  if (field.isCustomMessage) {
    const tpl = field.customTemplate !== undefined && field.customTemplate !== null ? field.customTemplate : '';
    rawString = tpl.replace(/\{([^}]+)\}/g, (_, key) => {
      let trimmedKey = key.trim();
      let isInitial = false;

      // Detect initial modifiers (e.g., middle_name_initial, middle_name.initial, middle_name:initial)
      if (trimmedKey.toLowerCase().endsWith('_initial')) {
        isInitial = true;
        trimmedKey = trimmedKey.slice(0, -8).trim();
      } else if (trimmedKey.toLowerCase().endsWith('.initial') || trimmedKey.toLowerCase().endsWith(':initial')) {
        isInitial = true;
        trimmedKey = trimmedKey.slice(0, -8).trim();
      }

      // Case-insensitive lookup in dataRow with dynamic rank fallback
      const lowerKey = trimmedKey.toLowerCase().replace(/[\s_]+/g, '');
      let val;
      if (lowerKey.includes('ranktitle') || lowerKey.includes('placement') || lowerKey === 'title') {
        val = row._rank_title !== undefined ? row._rank_title : (row._rank_title || row.rank_title || row['Rank Title'] || row['rank_title'] || row.placement || row.Title || row.Award);
      } else {
        val = row[trimmedKey];
      }

      if (val === undefined) {
        // Check dynamic tabulation aliases
        if (lowerKey.includes('ranktitle') || lowerKey.includes('placement') || lowerKey.includes('award') || lowerKey === 'title') {
          val = row._rank_title || row.rank_title || row['Rank Title'] || row['rank_title'] || row.placement || row.Title || row.Award;
        } else if (lowerKey.includes('rank') || lowerKey.includes('ordinal')) {
          val = row._rank || row.rank || row['Rank'] || row['rank'];
        } else if (lowerKey.includes('ranknum') || lowerKey.includes('ranknumber')) {
          val = row._rank_num || row.rank_num || row['Rank Num'] || row['Rank Number'];
        } else if (lowerKey.includes('score') || lowerKey.includes('points')) {
          val = row._score || row.score || row['Score'] || row['Points'];
        }
        
        if (val === undefined) {
          const foundKey = Object.keys(row).find((k) => String(k).trim().toLowerCase().replace(/[\s_]+/g, '') === lowerKey);
          if (foundKey) val = row[foundKey];
        }
      }

      let finalStr = '';
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        finalStr = String(val).trim();
      } else {
        const activeScheme = row._titleScheme || field?.titleScheme || 'championship';
        const rNum = row._rank_num || row.rank_num || 1;
        finalStr = getSampleValue(trimmedKey, activeScheme, rNum);
      }

      // If initial requested, extract first letter and append period (e.g. "Alexander" -> "A.")
      if (isInitial && finalStr.length > 0) {
        const cleanChar = finalStr.startsWith('{') ? 'M' : finalStr.charAt(0);
        finalStr = cleanChar.toUpperCase() + '.';
      }

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
    const lowerKey = String(field.key).trim().toLowerCase().replace(/[\s_]+/g, '');
    let val;
    if (lowerKey.includes('ranktitle') || lowerKey.includes('placement') || lowerKey === 'title' || lowerKey === 'champion') {
      val = row._rank_title !== undefined ? row._rank_title : (row.rank_title || row['Rank Title'] || row.placement || row.Title);
    } else if (lowerKey.includes('rank') || lowerKey.includes('ordinal')) {
      val = row._rank !== undefined ? row._rank : (row.rank || row['Rank']);
    } else if (lowerKey.includes('score') || lowerKey.includes('points')) {
      val = row._score !== undefined ? row._score : (row.score || row['Score']);
    } else {
      val = row[field.key];
    }

    if (val === undefined) {
      const foundKey = Object.keys(row).find((k) => String(k).trim().toLowerCase().replace(/[\s_]+/g, '') === lowerKey);
      if (foundKey) val = row[foundKey];
    }

    if (val === undefined && (lowerKey.includes('ranktitle') || lowerKey.includes('placement') || lowerKey === 'champion')) {
      const activeScheme = row._titleScheme || field?.titleScheme || 'championship';
      const rNum = row._rank_num || row.rank_num || 1;
      val = getSampleValue('rank_title', activeScheme, rNum);
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
