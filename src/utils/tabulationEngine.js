// Tabulation and Award Placement Calculation Engine

// Converts integer to ordinal string (1 -> '1st', 2 -> '2nd', 3 -> '3rd', 4 -> '4th', etc.)
export function toOrdinal(n) {
  const num = Math.abs(parseInt(n, 10));
  if (isNaN(num)) return String(n);
  const s = ['th', 'st', 'nd', 'rd'];
  const v = num % 100;
  return num + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Converts rank number to placement title based on title scheme & custom overrides
export function getPlacementTitle(rankNum, titleScheme = 'championship', customTitles = {}) {
  const num = parseInt(rankNum, 10) || 1;

  if (titleScheme === 'championship') {
    if (customTitles[num]) return customTitles[num];
    switch (num) {
      case 1: return 'Champion';
      case 2: return '1st Runner-Up';
      case 3: return '2nd Runner-Up';
      case 4: return '3rd Runner-Up';
      case 5: return '4th Runner-Up';
      default: return customTitles.default || 'Finalist';
    }
  }

  if (titleScheme === 'placement_words' || titleScheme === 'ordinal_words' || titleScheme === 'first_place') {
    if (customTitles[num]) return customTitles[num];
    switch (num) {
      case 1: return 'First Place';
      case 2: return 'Second Place';
      case 3: return 'Third Place';
      case 4: return 'Fourth Place';
      case 5: return 'Fifth Place';
      default: return customTitles.default || `${toOrdinal(num)} Place`;
    }
  }

  if (titleScheme === 'mixed') {
    if (customTitles[num]) return customTitles[num];
    switch (num) {
      case 1: return 'Champion';
      case 2: return 'Second Place';
      case 3: return 'Third Place';
      case 4: return 'Fourth Place';
      case 5: return 'Fifth Place';
      default: return customTitles.default || `${toOrdinal(num)} Place`;
    }
  }

  // Custom Scheme / Fallback
  if (customTitles[num]) return customTitles[num];
  return customTitles.default || `${toOrdinal(num)} Place`;
}

// Automatically detect columns in dataset that likely contain numeric scores/ratings
export function detectScoreColumns(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const keys = Object.keys(rows[0]);

  const keywords = ['score', 'points', 'total', 'rating', 'grade', 'rank', 'mark', 'percentage', 'result', 'final'];

  return keys.filter((key) => {
    const lower = key.toLowerCase().trim();
    if (keywords.some((kw) => lower.includes(kw))) return true;

    // Check if values in this column are predominantly numeric
    const sample = rows.slice(0, 10);
    const numericCount = sample.filter((r) => {
      const val = r[key];
      return val !== undefined && val !== null && val !== '' && !isNaN(Number(val));
    }).length;

    return numericCount >= Math.ceil(sample.length * 0.7);
  });
}

// Process dataset rows: sort by score column, compute ranks, attach dynamic tags
export function tabulateRows(rows = [], {
  scoreColumn = '',
  sortOrder = 'desc', // 'desc' (highest first) | 'asc' (lowest first)
  titleScheme = 'championship',
  customTitles = {}
} = {}) {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  let sortedRows = rows.filter((r) => r && typeof r === 'object');

  if (scoreColumn) {
    sortedRows.sort((a, b) => {
      const valA = (a && a[scoreColumn] !== undefined && a[scoreColumn] !== null) ? parseFloat(a[scoreColumn]) : NaN;
      const valB = (b && b[scoreColumn] !== undefined && b[scoreColumn] !== null) ? parseFloat(b[scoreColumn]) : NaN;

      const numA = isNaN(valA) ? (sortOrder === 'desc' ? -Infinity : Infinity) : valA;
      const numB = isNaN(valB) ? (sortOrder === 'desc' ? -Infinity : Infinity) : valB;

      if (sortOrder === 'desc') {
        return numB - numA;
      }
      return numA - numB;
    });
  }

  // Assign ranks & dynamic tags
  let currentRank = 1;
  return sortedRows.map((row, idx) => {
    if (!row) return {};
    // Handle ties if score values match
    if (scoreColumn && idx > 0 && sortedRows[idx - 1]) {
      const prevVal = parseFloat(sortedRows[idx - 1][scoreColumn]);
      const currVal = parseFloat(row[scoreColumn]);
      if (!isNaN(prevVal) && !isNaN(currVal) && prevVal === currVal) {
        // Same rank for tie
      } else {
        currentRank = idx + 1;
      }
    } else {
      currentRank = idx + 1;
    }

    const rankNum = currentRank;
    const rankOrdinal = toOrdinal(rankNum);
    const placementTitle = getPlacementTitle(rankNum, titleScheme, customTitles);
    const scoreVal = scoreColumn ? (row[scoreColumn] !== undefined ? String(row[scoreColumn]) : '') : '';

    return {
      ...row,
      _titleScheme: titleScheme,
      _rank_num: rankNum,
      _rank: rankOrdinal,
      _rank_title: placementTitle,
      _score: scoreVal,
      rank_title: placementTitle,
      rank: rankOrdinal,
      rank_num: rankNum,
      score: scoreVal,
      placement: placementTitle
    };
  });
}
