import React, { useState, useRef, useEffect } from 'react';
import { Layout, Plus, Trash2, FileSpreadsheet, Download, Type, QrCode, Sliders, ArrowUp, ArrowDown, FolderPlus, FolderTree, Bold, Italic, Strikethrough, Underline, MessageSquare, Search, Table, Eye, CheckCircle, Loader2, CheckSquare, Square, HelpCircle, ShieldAlert, ShieldCheck, Trophy, Award, Edit3, Check, Settings, Layers, Sparkles, Filter, Medal, Tag, ChevronDown, ChevronUp, Palette, AlignLeft, AlignCenter, AlignRight, RotateCcw, RotateCw, WholeWord, Sparkle, WrapText } from 'lucide-react';
import * as XLSX from 'xlsx';
import InteractiveStage from './InteractiveStage';
import CSVDataEditorModal from '../Shared/CSVDataEditorModal';
import RankingConfigModal from './RankingConfigModal';
import DynamicTagModal from './DynamicTagModal';
import ColorPickerModal from './ColorPickerModal';
import { renderRecordToCanvas, exportLayoutsToZip } from '../../utils/batchRenderer';
import { loadCustomFontFile, getLoadedCustomFonts } from '../../utils/fontLoader';
import { tabulateRows, detectScoreColumns, getPlacementTitle } from '../../utils/tabulationEngine';
import { stripRichTextFormatting } from '../../utils/richTextParser';

export default function LayoutStudio({ onStartExport, setExportStatus, onProgressChange, onRegisterCancel }) {
  // Layout Templates State
  const [layouts, setLayouts] = useState([]);
  const [currentLayoutId, setCurrentLayoutId] = useState(null);
  const [layoutColumnKey, setLayoutColumnKey] = useState('template');
  const [recordSearchTerm, setRecordSearchTerm] = useState('');

  // History Undo/Redo Stack State (Ctrl+Z / Ctrl+Y)
  const [historyStack, setHistoryStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Modal Dialogs State
  const [isRankingModalOpen, setIsRankingModalOpen] = useState(false);
  const [isDynamicTagsModalOpen, setIsDynamicTagsModalOpen] = useState(false);
  const [isExportSettingsModalOpen, setIsExportSettingsModalOpen] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

  // Folder Hierarchy & Export Modal Settings State
  const [exportBatchChunkSize, setExportBatchChunkSize] = useState(100);
  const [exportFormat, setExportFormat] = useState('png'); // 'png' | 'jpeg'
  const [exportQuality, setExportQuality] = useState(0.92);
  const [exportResolution, setExportResolution] = useState(2560);
  const [exportHierarchyColumns, setExportHierarchyColumns] = useState([]);
  const [exportFolderMode, setExportFolderMode] = useState('combined'); // 'combined' | 'nested'
  const [exportSafeMemoryMode, setExportSafeMemoryMode] = useState(false);
  const [exportSortByHierarchy, setExportSortByHierarchy] = useState(true);
  const [isLargeBatchModalOpen, setIsLargeBatchModalOpen] = useState(false);

  // Tabulation State
  const [scoreColumn, setScoreColumn] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [titleScheme, setTitleScheme] = useState('championship');
  const [customRankTitles, setCustomRankTitles] = useState({
    1: 'Champion',
    2: '1st Runner-Up',
    3: '2nd Runner-Up',
    4: '3rd Runner-Up',
    5: '4th Runner-Up',
    default: 'Participant'
  });

  // Layout & Field Inline Renaming State
  const [editingLayoutId, setEditingLayoutId] = useState(null);
  const [editingFieldId, setEditingFieldId] = useState(null);

  // Local Batch Progress State
  const [localExportStatus, setLocalExportStatus] = useState({
    isExporting: false,
    isFinished: false,
    progress: 0,
    total: 0
  });

  // Selected Field State
  const [selectedFieldId, setSelectedFieldId] = useState(null);

  // Custom Font State (Returned to Top!)
  const [customFonts, setCustomFonts] = useState([]);
  const fontFileInputRef = useRef(null);
  const templateTextareaRef = useRef(null);

  // Batch Data Rows & Selection State
  const [rows, setRows] = useState([]);
  const [selectedRowIndices, setSelectedRowIndices] = useState(new Set());
  const [dataFileName, setDataFileName] = useState('');

  // Tabulate dataset dynamically
  const tabulatedRows = React.useMemo(() => {
    return tabulateRows(rows, {
      scoreColumn,
      sortOrder,
      titleScheme,
      customTitles: customRankTitles
    });
  }, [rows, scoreColumn, sortOrder, titleScheme, customRankTitles]);

  const handleSelectAllRows = () => {
    setSelectedRowIndices(new Set(tabulatedRows.map((_, i) => i)));
  };

  const handleDeselectAllRows = () => {
    setSelectedRowIndices(new Set());
  };

  const handleToggleRowSelection = (index) => {
    setSelectedRowIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  // Quick Top Winner Selection Filter Buttons
  const handleSelectTopN = (count) => {
    if (!tabulatedRows.length) return;
    const n = Math.min(count, tabulatedRows.length);
    const newIndices = new Set();
    for (let i = 0; i < n; i++) {
      newIndices.add(i);
    }
    setSelectedRowIndices(newIndices);
  };

  // Layout & Field Inline Renaming
  const handleRenameLayout = (layoutId, newName) => {
    setLayouts((prev) =>
      prev.map((l) => (l.id === layoutId ? { ...l, name: newName || 'Layout' } : l))
    );
  };

  const handleRenameField = (fieldId, newName) => {
    if (!currentLayoutId) return;
    setLayouts((prev) =>
      prev.map((l) => {
        if (l.id !== currentLayoutId) return l;
        return {
          ...l,
          fields: l.fields.map((f) => (f.id === fieldId ? { ...f, name: newName || f.type } : f))
        };
      })
    );
  };

  // CSV Data Editor Modal & Live Search / Preview Row State
  const [isDataEditorOpen, setIsDataEditorOpen] = useState(false);
  const [previewRowIndex, setPreviewRowIndex] = useState(0);
  const [rowSearchQuery, setRowSearchQuery] = useState('');
  const [stageViewMode, setStageViewMode] = useState('record'); // 'record' | 'tags'
  const [isFullscreen, setIsFullscreen] = useState(false);

  const layoutFileInputRef = useRef(null);
  const dataFileInputRef = useRef(null);
  const studioWorkspaceRef = useRef(null);

  const handleToggleFullscreen = () => {
    if (!studioWorkspaceRef.current) return;
    if (!document.fullscreenElement) {
      studioWorkspaceRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch((err) => console.error(err));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch((err) => console.error(err));
    }
  };

  useEffect(() => {
    const handleFSChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  // Auto-generate random scores (1-100) ensuring top 5 places have unique scores
  const handleGenerateRandomScores = () => {
    if (!rows || rows.length === 0) return;

    const topScores = [];
    while (topScores.length < 5) {
      const val = Math.floor(Math.random() * 16) + 85; // 85 to 100
      if (!topScores.includes(val)) {
        topScores.push(val);
      }
    }
    topScores.sort((a, b) => b - a);
    const maxOthers = topScores[4] - 1;

    const updated = rows.map((row, idx) => {
      let scoreVal = 0;
      if (idx < 5 && idx < topScores.length) {
        scoreVal = topScores[idx];
      } else {
        scoreVal = Math.floor(Math.random() * maxOthers) + 1;
      }
      return {
        ...row,
        Score: scoreVal
      };
    });

    setRows(updated);
    setScoreColumn('Score');
  };

  // Filtered rows for stage selector
  const filteredPreviewRows = tabulatedRows.filter((r) => {
    if (!rowSearchQuery.trim()) return true;
    const q = rowSearchQuery.toLowerCase().trim();
    return Object.values(r).some((val) => String(val).toLowerCase().includes(q));
  });

  React.useEffect(() => {
    if (rowSearchQuery.trim() && filteredPreviewRows.length > 0) {
      const firstMatchIdx = tabulatedRows.indexOf(filteredPreviewRows[0]);
      if (firstMatchIdx !== -1 && firstMatchIdx !== previewRowIndex) {
        setPreviewRowIndex(firstMatchIdx);
      }
    }
  }, [rowSearchQuery, filteredPreviewRows, tabulatedRows, previewRowIndex]);

  React.useEffect(() => {
    if (onProgressChange) {
      onProgressChange(layouts.length > 0);
    }
  }, [layouts, onProgressChange]);

  const currentLayout = layouts.find((l) => l.id === currentLayoutId) || null;
  const selectedField = currentLayout?.fields.find((f) => f.id === selectedFieldId) || null;
  const headers = rows.length > 0 ? Object.keys(rows[0]) : ['first_name', 'middle_name', 'last_name', 'Section', 'Course', 'qr_data'];
  const activePreviewRow = React.useMemo(() => {
    const base = tabulatedRows[previewRowIndex] || tabulatedRows[0] || {};
    return {
      _titleScheme: titleScheme,
      _rank_num: previewRowIndex + 1,
      ...base
    };
  }, [tabulatedRows, previewRowIndex, titleScheme]);

  const [isUploading, setIsUploading] = useState(false);

  // Font Upload Handler (Returned to Top of Sidebar)
  const handleCustomFontUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setIsUploading(true);
    try {
      for (const file of files) {
        await loadCustomFontFile(file);
      }
      setCustomFonts(getLoadedCustomFonts());
    } catch (err) {
      alert(err.message);
    } finally {
      setIsUploading(false);
      fontFileInputRef.current.value = '';
    }
  };

  // Multi-Layout Background Files Upload
  const handleLayoutFilesUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    const newLayouts = [];
    const chunkSize = 2;

    for (let i = 0; i < files.length; i += chunkSize) {
      const chunk = files.slice(i, i + chunkSize);

      await Promise.all(
        chunk.map((file, chunkIdx) => {
          return new Promise((resolve) => {
            const globalIdx = i + chunkIdx;
            const dataURL = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
              const baseName = file.name.replace(/\.[^.]+$/, '');
              newLayouts.push({
                id: `L-${Date.now()}-${globalIdx}`,
                name: baseName,
                dataURL,
                image: img,
                selectorValue: baseName,
                fields: [
                  {
                    id: `f-${Date.now()}-${globalIdx}-1`,
                    name: 'Recipient Citation',
                    type: 'text',
                    isCustomMessage: true,
                    customTemplate: '',
                    isMultiColumn: false,
                    columns: ['first_name', 'last_name'],
                    separator: ' ',
                    casing: 'capitalize',
                    fontSize: 42,
                    isFixedFontSize: false,
                    letterSpacing: 0,
                    wordSpacing: 0,
                    xPct: 0.15,
                    yPct: 0.40,
                    wPct: 0.70,
                    hPct: 0.18,
                    fontFamily: customFonts[0]?.family || 'Georgia, serif',
                    fontWeight: '700',
                    color: '#ffffff',
                    align: 'center'
                  }
                ]
              });
              resolve();
            };
            img.onerror = () => resolve();
            img.src = dataURL;
          });
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 16));
    }

    setLayouts((prev) => {
      const updated = [...prev, ...newLayouts];
      if (!currentLayoutId && newLayouts.length > 0) setCurrentLayoutId(newLayouts[0].id);
      return updated;
    });

    setIsUploading(false);
    if (layoutFileInputRef.current) layoutFileInputRef.current.value = '';
  };

  const handleAddField = () => {
    if (!currentLayout) return;
    const existingFields = currentLayout.fields || [];
    const count = existingFields.length;
    const defaultKey = 'first_name';

    // Calculate smart non-overlapping Y position near center/upper stage
    let newY = 0.35;
    let newX = 0.25;

    if (existingFields.length > 0) {
      const maxYField = existingFields.reduce((max, f) => (f.yPct + f.hPct > max.yPct + max.hPct ? f : max), existingFields[0]);
      const nextYCandidate = maxYField.yPct + (maxYField.hPct || 0.08) + 0.03;

      if (nextYCandidate + 0.08 <= 0.85) {
        newY = Math.round(nextYCandidate * 100) / 100;
        newX = maxYField.xPct;
      } else {
        const offsetIndex = existingFields.length % 5;
        newX = Math.round((0.20 + offsetIndex * 0.04) * 100) / 100;
        newY = Math.round((0.20 + offsetIndex * 0.06) * 100) / 100;
      }
    }

    const newField = {
      id: `f-${Date.now()}`,
      name: `Text Field ${count + 1}`,
      type: 'text',
      key: 'custom_text',
      isCustomMessage: true,
      customTemplate: 'Input text here...',
      isMultiColumn: false,
      columns: [],
      separator: ' ',
      casing: 'as-is',
      fontSize: 36,
      isFixedFontSize: false,
      letterSpacing: 0,
      wordSpacing: 0,
      xPct: newX,
      yPct: newY,
      wPct: 0.50,
      hPct: 0.08,
      fontFamily: customFonts[0]?.family || 'Georgia, serif',
      fontWeight: '600',
      color: '#ffffff',
      align: 'center'
    };

    const updatedLayouts = layouts.map((l) => {
      if (l.id === currentLayoutId) {
        return { ...l, fields: [...l.fields, newField] };
      }
      return l;
    });

    setLayouts(updatedLayouts);
    setSelectedFieldId(newField.id);
  };

  const saveSnapshot = () => {
    setHistoryStack((prev) => [...prev.slice(-30), JSON.parse(JSON.stringify(layouts))]);
    setRedoStack([]);
  };

  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const previous = historyStack[historyStack.length - 1];
    setRedoStack((prev) => [...prev, JSON.parse(JSON.stringify(layouts))]);
    setHistoryStack((prev) => prev.slice(0, -1));
    setLayouts(previous);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setHistoryStack((prev) => [...prev, JSON.parse(JSON.stringify(layouts))]);
    setRedoStack((prev) => prev.slice(0, -1));
    setLayouts(next);
  };

  // Keyboard shortcut listener for Ctrl+Z and Ctrl+Y
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
      if (isInput) return; // Allow default textarea undo/redo while typing inside textarea

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyStack, redoStack, layouts]);

  const handleUpdateField = (fieldId, updates) => {
    saveSnapshot();
    setLayouts((prev) =>
      prev.map((l) => {
        if (l.id === currentLayoutId) {
          const updatedFields = l.fields.map((f) => (f.id === fieldId ? { ...f, ...updates } : f));
          return { ...l, fields: updatedFields };
        }
        return l;
      })
    );
  };

  const handleDeleteField = (fieldId) => {
    saveSnapshot();
    setLayouts((prev) =>
      prev.map((l) => {
        if (l.id === currentLayoutId) {
          return { ...l, fields: l.fields.filter((f) => f.id !== fieldId) };
        }
        return l;
      })
    );
    if (selectedFieldId === fieldId) setSelectedFieldId(null);
  };

  // Toggle middle_name tag specifically to middle_name_initial
  const handleToggleTagInitial = () => {
    if (!selectedField || selectedField.type !== 'text') return;
    saveSnapshot();
    const tpl = selectedField.customTemplate || '';

    let updatedTpl = tpl;
    if (tpl.toLowerCase().includes('{middle_name_initial}')) {
      updatedTpl = tpl.replace(/\{middle_name_initial\}/gi, '{middle_name}');
    } else if (tpl.toLowerCase().includes('{middle_name}')) {
      updatedTpl = tpl.replace(/\{middle_name\}/gi, '{middle_name_initial}');
    } else {
      const middleMatch = tpl.match(/\{([^}]*middle[^}]*)\}/i);
      if (middleMatch) {
        const fullTag = middleMatch[0];
        const inner = middleMatch[1];
        if (inner.toLowerCase().endsWith('_initial')) {
          updatedTpl = tpl.replace(fullTag, `{${inner.slice(0, -8)}}`);
        } else {
          updatedTpl = tpl.replace(fullTag, `{${inner}_initial}`);
        }
      } else {
        const needsSpace = tpl.length > 0 && !/\s$/.test(tpl);
        updatedTpl = tpl + (needsSpace ? ' ' : '') + '{middle_name_initial}';
      }
    }

    handleUpdateField(selectedField.id, { customTemplate: updatedTpl });
  };

  const lastSelectionRef = useRef(null);

  const handleCaptureSelection = (e) => {
    const el = e.target;
    if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      if (start !== undefined && end !== undefined && start !== end) {
        const text = el.value.slice(start, end).trim();
        if (text) {
          lastSelectionRef.current = { text, fieldId: selectedField?.id };
        }
      }
    }
  };

  // Toggle style (Bold, Italic, Strikethrough, Underline) on field properties, highlighted text range, or customTemplate tags
  const handleApplyInlineStyle = (styleType) => {
    if (!selectedField || selectedField.type !== 'text') return;
    saveSnapshot();

    const activeEl = document.activeElement;
    let targetKey = selectedField.selectedTag;

    if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT') && activeEl.selectionStart !== activeEl.selectionEnd) {
      const start = activeEl.selectionStart;
      const end = activeEl.selectionEnd;
      targetKey = activeEl.value.slice(start, end).trim();
    } else if (lastSelectionRef.current && lastSelectionRef.current.fieldId === selectedField.id && lastSelectionRef.current.text) {
      targetKey = lastSelectionRef.current.text;
    }

    const currentStyledTags = selectedField.styledTags || {};
    const fieldIsBold = selectedField.fontWeight === '700' || selectedField.fontWeight === 'bold';
    const fieldIsItalic = selectedField.fontStyle === 'italic';
    const fieldIsStrike = Boolean(selectedField.strikethrough);
    const fieldIsUnderline = Boolean(selectedField.underline);

    if (targetKey) {
      // Toggle style on the specific selected tag or highlighted phrase ONLY
      const existingTagStyle = currentStyledTags[targetKey] || {};

      let fieldIsActive = false;
      if (styleType === 'bold') fieldIsActive = fieldIsBold;
      else if (styleType === 'italic') fieldIsActive = fieldIsItalic;
      else if (styleType === 'strikethrough') fieldIsActive = fieldIsStrike;
      else if (styleType === 'underline') fieldIsActive = fieldIsUnderline;

      const currentVal = existingTagStyle[styleType] !== undefined ? existingTagStyle[styleType] : fieldIsActive;

      const newTagStyle = {
        ...existingTagStyle,
        [styleType]: !currentVal
      };

      handleUpdateField(selectedField.id, {
        selectedTag: targetKey,
        styledTags: {
          ...currentStyledTags,
          [targetKey]: newTagStyle
        }
      });
      lastSelectionRef.current = null;
    } else {
      // Toggle style on the WHOLE field & clear tag-specific overrides for this styleType
      const updatedStyledTags = { ...currentStyledTags };
      Object.keys(updatedStyledTags).forEach((tagKey) => {
        if (updatedStyledTags[tagKey]) {
          const { [styleType]: _removed, ...rest } = updatedStyledTags[tagKey];
          updatedStyledTags[tagKey] = rest;
        }
      });

      const updates = { styledTags: updatedStyledTags };
      if (styleType === 'bold') updates.fontWeight = fieldIsBold ? '400' : '700';
      else if (styleType === 'italic') updates.fontStyle = fieldIsItalic ? 'normal' : 'italic';
      else if (styleType === 'strikethrough') updates.strikethrough = !fieldIsStrike;
      else if (styleType === 'underline') updates.underline = !fieldIsUnderline;

      handleUpdateField(selectedField.id, updates);
    }
  };

  const handleColorChange = (newColor) => {
    if (!selectedField) return;

    const activeTagKey = selectedField.selectedTag;
    const currentStyledTags = selectedField.styledTags || {};

    if (activeTagKey) {
      // A specific tag or word range is selected: update color ONLY for this tag/word
      const tagStyle = currentStyledTags[activeTagKey] || {};
      handleUpdateField(selectedField.id, {
        styledTags: {
          ...currentStyledTags,
          [activeTagKey]: { ...tagStyle, color: newColor }
        }
      });
    } else {
      // NO specific text selected: change color for EVERYTHING in the text box!
      // Also clear tag-specific color overrides so all tags inherit the new base color
      const updatedStyledTags = { ...currentStyledTags };
      Object.keys(updatedStyledTags).forEach((tagKey) => {
        if (updatedStyledTags[tagKey]) {
          const { color: _removed, ...rest } = updatedStyledTags[tagKey];
          updatedStyledTags[tagKey] = rest;
        }
      });

      handleUpdateField(selectedField.id, {
        color: newColor,
        styledTags: updatedStyledTags
      });
    }
  };

  const insertVariableAtCursor = (varTag, separator = ' ') => {
    if (!selectedField) return;
    const currentTpl = selectedField.customTemplate || '';
    const needsSepBefore = currentTpl.length > 0 && !/\s$/.test(currentTpl);
    const formattedTag = (needsSepBefore ? separator : '') + varTag + separator;
    handleUpdateField(selectedField.id, { customTemplate: currentTpl + formattedTag });
  };

  const applyFormatting = (prefix, suffix) => {
    if (!selectedField) return;
    const currentTpl = selectedField.customTemplate || '';
    handleUpdateField(selectedField.id, { customTemplate: prefix + currentTpl + suffix });
  };

  // CSV Data Upload
  const handleDataFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const isCSV = /\.csv$/i.test(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        let parsed = [];
        if (isCSV) {
          parsed = parseCSVText(evt.target?.result);
        } else {
          const data = new Uint8Array(evt.target?.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
          parsed = json.map((obj) => {
            const clean = {};
            Object.keys(obj).forEach((k) => { clean[String(k).trim()] = String(obj[k]).trim(); });
            return clean;
          });
        }
        setRows(parsed);
        setSelectedRowIndices(new Set(parsed.map((_, i) => i)));
        setPreviewRowIndex(0);
        setDataFileName(`${file.name} (${parsed.length} rows)`);

        const scoresFound = detectScoreColumns(parsed);
        if (scoresFound.length > 0 && !scoreColumn) {
          setScoreColumn(scoresFound[0]);
        }
      } catch (err) {
        alert('File error: ' + err.message);
      } finally {
        setIsUploading(false);
      }
    };

    if (isCSV) reader.readAsText(file);
    else reader.readAsArrayBuffer(file);

    dataFileInputRef.current.value = '';
  };

  const parseCSVText = (text) => {
    const lines = text.trim().split('\n').filter((l) => l.trim().length);
    if (lines.length === 0) return [];
    const headers = lines[0].split(',').map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const cells = line.split(',').map((c) => c.trim());
      const obj = {};
      headers.forEach((h, i) => { obj[h] = cells[i] !== undefined ? cells[i] : ''; });
      return obj;
    });
  };

  const handleDownloadSinglePreview = async () => {
    if (!currentLayout) return;
    const tempCanvas = document.createElement('canvas');
    await renderRecordToCanvas(activePreviewRow, currentLayout, tempCanvas, 880, exportResolution);

    const link = document.createElement('a');
    link.download = `certificate-${currentLayout.name || 'preview'}.png`;
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
    tempCanvas.width = 0;
    tempCanvas.height = 0;
  };

  // Auto-detect hierarchy columns (Program, Year, Section, Course, etc.) when rows load
  useEffect(() => {
    if (rows && rows.length > 0) {
      const sampleKeys = Object.keys(rows[0]).filter((k) => !k.startsWith('_'));
      const matched = sampleKeys.filter((k) => {
        const lower = k.toLowerCase().trim();
        return (
          lower.includes('program') ||
          lower.includes('course') ||
          lower.includes('year') ||
          lower.includes('section') ||
          lower.includes('grade') ||
          lower.includes('class') ||
          lower.includes('dept')
        );
      });
      if (matched.length > 0 && exportHierarchyColumns.length === 0) {
        setExportHierarchyColumns(matched);
      }
    }
  }, [rows]);

  const handleInitiateBatchZip = () => {
    if (layouts.length === 0 || tabulatedRows.length === 0 || selectedRowIndices.size === 0) {
      alert('Please select records to export.');
      return;
    }
    setIsExportSettingsModalOpen(true);
  };

  const executeBatchZipExport = async () => {
    if (layouts.length === 0 || tabulatedRows.length === 0 || selectedRowIndices.size === 0) return;

    let selectedRowsToExport = tabulatedRows.filter((_, idx) => selectedRowIndices.has(idx));

    // Sort by hierarchy columns if enabled
    if (exportSortByHierarchy && exportHierarchyColumns.length > 0) {
      selectedRowsToExport = [...selectedRowsToExport].sort((a, b) => {
        for (const col of exportHierarchyColumns) {
          const valA = String(a[col] || '').trim().toLowerCase();
          const valB = String(b[col] || '').trim().toLowerCase();
          if (valA !== valB) return valA.localeCompare(valB, undefined, { numeric: true });
        }
        return 0;
      });
    }

    let shouldCancel = false;
    const cancelTrigger = () => { shouldCancel = true; };
    if (onRegisterCancel) onRegisterCancel(cancelTrigger);

    const totalVolumesCount = Math.ceil(selectedRowsToExport.length / exportBatchChunkSize);

    const initialStatus = {
      isExporting: true,
      isFinished: false,
      progress: 0,
      total: selectedRowsToExport.length,
      currentVolume: 1,
      totalVolumes: totalVolumesCount,
      zipPercent: 0,
      phase: 'rendering',
      currentFile: ''
    };
    setLocalExportStatus(initialStatus);
    if (setExportStatus) setExportStatus(initialStatus);
    if (onStartExport) onStartExport();

    try {
      await exportLayoutsToZip({
        layouts,
        rows: selectedRowsToExport,
        layoutColumnKey: 'name',
        folderSortColumns: exportHierarchyColumns,
        folderStructureMode: exportFolderMode,
        safeMemoryMode: exportSafeMemoryMode,
        batchChunkSize: exportBatchChunkSize,
        exportFormat,
        exportQuality,
        maxDimension: exportResolution,
        shouldCancel: () => shouldCancel,
        onProgress: (current, total, meta) => {
          const updatedStatus = {
            isExporting: true,
            isFinished: false,
            progress: current || 0,
            total: total || selectedRowsToExport.length,
            currentVolume: meta?.currentVolume || 1,
            totalVolumes: meta?.totalVolumes || totalVolumesCount,
            zipPercent: 0,
            phase: 'rendering',
            currentFile: ''
          };
          setLocalExportStatus(updatedStatus);
          if (setExportStatus) setExportStatus(updatedStatus);
        },
        onZipProgress: (zipPercent, currentFile, meta) => {
          const updatedStatus = {
            isExporting: true,
            isFinished: false,
            progress: selectedRowsToExport.length,
            total: selectedRowsToExport.length,
            currentVolume: meta?.currentVolume || 1,
            totalVolumes: meta?.totalVolumes || totalVolumesCount,
            zipPercent: zipPercent || 0,
            phase: 'zipping',
            currentFile: currentFile || ''
          };
          setLocalExportStatus(updatedStatus);
          if (setExportStatus) setExportStatus(updatedStatus);
        }
      });
    } catch (err) {
      if (err.message !== 'EXPORT_CANCELLED') {
        alert('ZIP Export Failed: ' + err.message);
      }
    } finally {
      const resetStatus = {
        isExporting: false,
        isFinished: false,
        progress: 0,
        total: 0,
        currentVolume: 1,
        totalVolumes: 1,
        zipPercent: 0,
        phase: 'idle',
        currentFile: ''
      };
      setLocalExportStatus(resetStatus);
      if (setExportStatus) setExportStatus(resetStatus);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in relative">
      {/* CSV Data Table Editor Modal */}
      <CSVDataEditorModal
        isOpen={isDataEditorOpen}
        onClose={() => setIsDataEditorOpen(false)}
        rows={rows}
        onSaveRows={(updatedRows) => {
          setRows(updatedRows);
          setSelectedRowIndices(new Set(updatedRows.map((_, i) => i)));
          if (previewRowIndex >= updatedRows.length) setPreviewRowIndex(0);
        }}
        selectedRowIndices={selectedRowIndices}
        onToggleSelectRow={handleToggleRowSelection}
        onSelectAll={handleSelectAllRows}
        onDeselectAll={handleDeselectAllRows}
      />

      {/* EXPORT SETTINGS & HIERARCHY MODAL */}
      {isExportSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-amber-500/40 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Batch Export Settings</h3>
                  <p className="text-xs text-slate-400">Configure resolution, batch chunking, and folder hierarchy before downloading.</p>
                </div>
              </div>
              <button
                onClick={() => setIsExportSettingsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors font-bold text-base"
              >
                ✕
              </button>
            </div>

            {/* Modal Content / Form Options */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              
              {/* SECTION 1: QUALITY & RESOLUTION */}
              <div className="glass-panel p-4 space-y-3 border-slate-800">
                <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" /> Quality & Canvas Resolution Settings
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">Export File Format:</label>
                    <select
                      value={exportFormat}
                      onChange={(e) => setExportFormat(e.target.value)}
                      className="select-dark text-xs w-full py-1.5 font-mono"
                    >
                      <option value="png">PNG (High Definition / Lossless)</option>
                      <option value="jpeg">JPEG (Compressed / Smaller Zip)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">Canvas Resolution Scale:</label>
                    <select
                      value={exportResolution}
                      onChange={(e) => setExportResolution(Number(e.target.value))}
                      className="select-dark text-xs w-full py-1.5 font-mono"
                    >
                      <option value={2560}>🌟 2560px Max (Ultra HD / Print Quality)</option>
                      <option value={1920}>⚡ 1920px Max (Standard HD / Fast)</option>
                      <option value={1280}>🛡️ 1280px Max (Compact / Mobile Safe)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 2: BATCH CHUNKING (PER 100 RECORDS) */}
              <div className="glass-panel p-4 space-y-3 border-indigo-500/30">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-400" /> Batch Chunking (ZIP Volumes)
                  </h4>
                  <span className="text-[11px] font-mono text-amber-300 font-bold bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20">
                    {Math.ceil(selectedRowIndices.size / exportBatchChunkSize)} ZIP Volume(s)
                  </span>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Items Per ZIP Volume:</label>
                  <select
                    value={exportBatchChunkSize}
                    onChange={(e) => setExportBatchChunkSize(Number(e.target.value))}
                    className="select-dark text-xs w-full py-1.5 font-mono"
                  >
                    <option value={100}>100 Items Per ZIP (Default / Balanced RAM)</option>
                    <option value={50}>50 Items Per ZIP (High Reliability for Low RAM)</option>
                    <option value={200}>200 Items Per ZIP (Faster Single Download)</option>
                    <option value={500}>500 Items Per ZIP (Large Single ZIP Volume)</option>
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Splitting generation into chunks of {exportBatchChunkSize} records prevents browser tab memory freezes and allows continuous background downloads.
                  </p>
                </div>
              </div>

              {/* SECTION 3: HIERARCHICAL FOLDER SORTING ({program} {year} {section}) */}
              <div className="glass-panel p-4 space-y-3.5 border-emerald-500/30">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                    <FolderTree className="w-4 h-4 text-emerald-400" /> Hierarchical Folder Organization
                  </h4>
                </div>

                <p className="text-xs text-slate-300">
                  Select CSV columns to organize exported certificates into sub-folders based on hierarchy (e.g., <span className="text-amber-300 font-mono font-bold">Program</span>, <span className="text-amber-300 font-mono font-bold">Year</span>, and <span className="text-amber-300 font-mono font-bold">Section</span>):
                </p>

                {/* Column Header Selection Pills */}
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-slate-950/80 rounded-xl border border-slate-800">
                  {headers.filter(h => !h.startsWith('_')).map((col) => {
                    const isSelected = exportHierarchyColumns.includes(col);
                    return (
                      <button
                        key={col}
                        onClick={() => {
                          if (isSelected) {
                            setExportHierarchyColumns(exportHierarchyColumns.filter(c => c !== col));
                          } else {
                            setExportHierarchyColumns([...exportHierarchyColumns, col]);
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1 border ${
                          isSelected
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '} {col}
                      </button>
                    );
                  })}
                </div>

                {/* Hierarchy Folder Path Preview */}
                {exportHierarchyColumns.length > 0 && (
                  <div className="p-3 bg-slate-950 rounded-xl border border-emerald-500/30 text-xs space-y-1.5">
                    <span className="text-slate-400 font-mono text-[10px] uppercase font-bold block">Target Folder Path:</span>
                    <div className="flex items-center gap-2 font-mono text-emerald-300 font-bold">
                      <FolderPlus className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>
                        {exportFolderMode === 'combined'
                          ? `{ ${exportHierarchyColumns.join(' ')} } / Certificate.png`
                          : `${exportHierarchyColumns.join(' / ')} / Certificate.png`}
                      </span>
                    </div>
                  </div>
                )}

                {/* Hierarchy Sort & Mode Toggles */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1 border-t border-slate-800">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportSortByHierarchy}
                      onChange={(e) => setExportSortByHierarchy(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0"
                    />
                    <span>Sort records by Hierarchy before export</span>
                  </label>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">Folder Style:</span>
                    <select
                      value={exportFolderMode}
                      onChange={(e) => setExportFolderMode(e.target.value)}
                      className="select-dark text-xs py-0.5 px-2 font-mono"
                    >
                      <option value="combined">Combined Folder Name ({exportHierarchyColumns.join(' ') || 'Program Year Sec'})</option>
                      <option value="nested">Nested Subfolders (Program / Year / Section)</option>
                    </select>
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsExportSettingsModalOpen(false)}
                className="btn-secondary text-xs py-2 px-4 font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setIsExportSettingsModalOpen(false);
                  executeBatchZipExport();
                }}
                className="btn-gold text-xs py-2 px-5 font-bold shadow-lg shadow-amber-500/20 flex items-center gap-2"
              >
                <Download className="w-4 h-4 text-slate-950" />
                <span>Start Batch Export ({selectedRowIndices.size} Records)</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Clean Top Header Bar */}
      <div className="glass-panel p-3.5 flex items-center justify-between border-amber-500/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center border border-amber-500/40">
            <Layout className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
              <span>Certificate Studio</span>
              {scoreColumn && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <Trophy className="w-3 h-3 text-amber-400" /> Sorted by {scoreColumn}
                </span>
              )}
            </h2>
          </div>
        </div>

        {/* Top Header Actions */}
        <div className="flex items-center gap-2">
          {rows.length > 0 && (
            <button
              onClick={() => setIsDataEditorOpen(true)}
              className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              <Table className="w-4 h-4 text-indigo-400" /> Data Table ({rows.length})
            </button>
          )}
          <button
            onClick={handleInitiateBatchZip}
            disabled={layouts.length === 0 || tabulatedRows.length === 0 || selectedRowIndices.size === 0 || localExportStatus.isExporting}
            className="btn-gold text-xs py-1.5 px-4 font-bold shadow-md shadow-amber-500/20 flex items-center gap-1.5 disabled:opacity-40"
          >
            {localExportStatus.isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                <span>Generating ({localExportStatus.progress}/{localExportStatus.total})...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-slate-950" />
                <span>Export ZIP ({selectedRowIndices.size})</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* LEFT SIDEBAR PANEL: Custom Fonts (Top), Layout Cards & Layers */}
        <div className="lg:col-span-3 space-y-3.5">
          
          {/* 1. CUSTOM FONTS SECTION (PROMINENTLY AT THE TOP) */}
          <div className="glass-panel p-3.5 space-y-2.5 border-indigo-500/30">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <FolderPlus className="w-3.5 h-3.5 text-indigo-400" /> Custom Fonts
              </h3>
              <span className="text-[10px] text-amber-400 font-mono font-bold">{customFonts.length} Loaded</span>
            </div>

            <input
              type="file"
              ref={fontFileInputRef}
              onChange={handleCustomFontUpload}
              accept=".ttf,.otf,.woff,.woff2"
              multiple
              className="hidden"
            />

            <button
              onClick={() => fontFileInputRef.current?.click()}
              className="btn-secondary text-xs w-full justify-center py-2 border-indigo-500/40 text-indigo-300 font-bold hover:bg-indigo-500/10 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-400" /> Upload Font File (.ttf / .otf)
            </button>

            {customFonts.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1 max-h-24 overflow-auto">
                {customFonts.map((cf) => (
                  <span key={cf.name} className="px-2 py-0.5 rounded-md bg-slate-900 text-indigo-300 border border-slate-800 text-[10px] font-mono">
                    {cf.displayName}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 2. LAYOUT TEMPLATE IMAGES WITH INLINE RENAMING */}
          <div className="glass-panel p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs text-slate-200 uppercase tracking-wider">Layout Images ({layouts.length})</h3>
              <input
                type="file"
                ref={layoutFileInputRef}
                onChange={handleLayoutFilesUpload}
                accept="image/*,.png,.jpg,.jpeg,.webp,.gif,.svg,.bmp"
                multiple
                className="hidden"
              />
              <button
                onClick={() => layoutFileInputRef.current?.click()}
                className="btn-primary text-[11px] py-1 px-2.5"
              >
                <Plus className="w-3.5 h-3.5" /> Upload Image
              </button>
            </div>

            <div className="space-y-1.5 max-h-44 overflow-auto pr-1">
              {layouts.map((l) => (
                <div
                  key={l.id}
                  onClick={() => {
                    setCurrentLayoutId(l.id);
                    setSelectedFieldId(l.fields[0]?.id || null);
                  }}
                  className={`p-2 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                    currentLayoutId === l.id
                      ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-bold shadow-md'
                      : 'glass-panel text-slate-400 hover:border-amber-500/40'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                    <img src={l.dataURL} alt="thumb" className="w-7 h-7 rounded object-cover border border-slate-700 flex-shrink-0" />
                    {editingLayoutId === l.id ? (
                      <input
                        type="text"
                        defaultValue={l.name}
                        autoFocus
                        onBlur={(e) => {
                          handleRenameLayout(l.id, e.target.value);
                          setEditingLayoutId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleRenameLayout(l.id, e.target.value);
                            setEditingLayoutId(null);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="input-dark text-[11px] py-0.5 px-1 font-mono w-full"
                      />
                    ) : (
                      <div className="min-w-0 flex-1 flex items-center justify-between pr-1">
                        <span className="text-[11px] font-bold block truncate">{l.name}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingLayoutId(l.id);
                          }}
                          className="text-slate-400 hover:text-amber-300 p-0.5 opacity-60 hover:opacity-100"
                          title="Rename Layout"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const updated = layouts.filter((item) => item.id !== l.id);
                      setLayouts(updated);
                      if (currentLayoutId === l.id) setCurrentLayoutId(updated[0]?.id || null);
                    }}
                    className="text-red-400 hover:text-red-300 text-xs p-1 flex-shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 3. LAYOUT FIELDS / LAYERS LIST */}
          <div className="glass-panel p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" /> Text Fields ({currentLayout?.fields.length || 0})
              </h3>
              <button
                onClick={() => handleAddField()}
                disabled={!currentLayout}
                className="btn-secondary text-[10px] py-1 px-2.5 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 font-bold"
              >
                + Add Text Box
              </button>
            </div>

            <div className="space-y-1.5 max-h-44 overflow-auto">
              {currentLayout?.fields.map((f) => (
                <div
                  key={f.id}
                  onClick={() => setSelectedFieldId(f.id)}
                  className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer text-xs transition-all ${
                    selectedFieldId === f.id
                      ? 'bg-amber-500/20 border-amber-400 font-bold'
                      : 'glass-panel opacity-80 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden flex-1">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${
                      f.type === 'text' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {f.type === 'text' ? 'TXT' : 'QR'}
                    </span>

                    {editingFieldId === f.id ? (
                      <input
                        type="text"
                        defaultValue={f.name || f.key || 'Field'}
                        autoFocus
                        onBlur={(e) => {
                          handleRenameField(f.id, e.target.value);
                          setEditingFieldId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleRenameField(f.id, e.target.value);
                            setEditingFieldId(null);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="input-dark text-[11px] py-0.5 px-1 font-mono w-full"
                      />
                    ) : (
                      <div className="flex items-center justify-between flex-1 min-w-0 pr-1">
                        <span className="font-mono text-[11px] truncate">
                          {f.name || (f.isCustomMessage ? 'Custom Citation' : f.isMultiColumn ? f.columns?.join(' + ') : f.key)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingFieldId(f.id);
                          }}
                          className="text-slate-400 hover:text-amber-300 p-0.5 opacity-60 hover:opacity-100 ml-1"
                          title="Rename Field"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteField(f.id);
                    }}
                    className="text-red-400 hover:text-red-300 text-xs px-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 4. BATCH DATASET LOADER */}
          <div className="glass-panel p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-200">
                Batch Data ({tabulatedRows.length} rows)
              </h3>
              <input
                type="file"
                ref={dataFileInputRef}
                onChange={handleDataFileUpload}
                accept=".csv,.xlsx,.xls"
                className="hidden"
              />
              <button
                onClick={() => dataFileInputRef.current?.click()}
                className="btn-secondary text-[11px] py-1 px-2.5 font-bold"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-400" /> Upload File
              </button>
            </div>

            {rows.length > 0 && (
              <div className="text-[10.5px] font-mono text-slate-400 flex items-center justify-between">
                <span>Total Imported:</span>
                <span className="text-amber-300 font-bold">{selectedRowIndices.size} / {rows.length} Selected</span>
              </div>
            )}
          </div>


        </div>

        {/* CENTER / MAIN WORKSPACE (9 COLS): CANVA-STYLE TOP TOOLBAR & BIG STAGE */}
        <div
          ref={studioWorkspaceRef}
          className={`lg:col-span-9 space-y-3 transition-all ${
            isFullscreen ? 'fixed inset-0 z-50 bg-slate-950 p-4 overflow-y-auto shadow-2xl' : ''
          }`}
        >
          
          {/* CANVA-STYLE TOP FLOATING TOOLBAR */}
          <div className="glass-panel p-2.5 space-y-2 border-amber-500/30 sticky top-16 z-30 shadow-xl">
            <div className="flex items-center justify-between flex-wrap gap-2">
              
              {/* Selected Field Label / Type */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  {selectedField ? (selectedField.name || selectedField.type.toUpperCase()) : 'Select Box on Stage'}
                </span>
              </div>

              {selectedField && selectedField.type === 'text' && (
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Font Family Dropdown (Custom Fonts Listed at Top!) */}
                  <select
                    value={selectedField.fontFamily || 'Georgia, serif'}
                    onChange={(e) => handleUpdateField(selectedField.id, { fontFamily: e.target.value })}
                    className="select-dark text-xs py-1 px-2.5 font-medium max-w-[180px]"
                  >
                    {customFonts.length > 0 && (
                      <optgroup label="🌟 Custom Uploaded Fonts">
                        {customFonts.map((cf) => (
                          <option key={cf.name} value={cf.family}>{cf.displayName}</option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="System Standard Fonts">
                      <option value="Georgia, serif">Georgia (Serif)</option>
                      <option value="Playfair Display, serif">Playfair Display</option>
                      <option value="Cinzel, serif">Cinzel (Luxury Serif)</option>
                      <option value="Plus Jakarta Sans, sans-serif">Plus Jakarta Sans</option>
                      <option value="Inter, sans-serif">Inter (Sans)</option>
                    </optgroup>
                  </select>

                  {/* Font Size Input */}
                  <div className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded-xl border border-slate-800" title="Font Size (px)">
                    <span className="text-[10px] text-slate-400 font-bold">Size:</span>
                    <input
                      type="number"
                      min="8"
                      max="240"
                      value={selectedField.fontSize || 36}
                      onChange={(e) => handleUpdateField(selectedField.id, { fontSize: Number(e.target.value) })}
                      className="w-12 bg-transparent text-xs font-mono text-center text-amber-300 focus:outline-none"
                    />
                  </div>

                  {/* Letter Spacing Input */}
                  <div className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded-xl border border-slate-800" title="Letter Spacing (px)">
                    <span className="text-[10px] text-slate-400 font-bold font-mono">Letter:</span>
                    <input
                      type="number"
                      step="0.5"
                      min="-10"
                      max="50"
                      value={selectedField.letterSpacing || 0}
                      onChange={(e) => handleUpdateField(selectedField.id, { letterSpacing: Number(e.target.value) })}
                      className="w-10 bg-transparent text-xs font-mono text-center text-amber-300 focus:outline-none"
                    />
                    <span className="text-[9px] text-slate-500 font-mono">px</span>
                  </div>

                  {/* Word Spacing Input */}
                  <div className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded-xl border border-slate-800" title="Word Spacing (px)">
                    <span className="text-[10px] text-slate-400 font-bold font-mono">Word:</span>
                    <input
                      type="number"
                      step="0.5"
                      min="-10"
                      max="100"
                      value={selectedField.wordSpacing || 0}
                      onChange={(e) => handleUpdateField(selectedField.id, { wordSpacing: Number(e.target.value) })}
                      className="w-10 bg-transparent text-xs font-mono text-center text-amber-300 focus:outline-none"
                    />
                    <span className="text-[9px] text-slate-500 font-mono">px</span>
                  </div>

                  {/* Formatting Buttons (Inline & Font Property B, I, S, U) */}
                  {(() => {
                    const activeTagKey = selectedField?.selectedTag;
                    const activeTagStyle = activeTagKey ? selectedField?.styledTags?.[activeTagKey] : null;

                    const fieldIsBold = selectedField?.fontWeight === '700' || selectedField?.fontWeight === 'bold';
                    const fieldIsItalic = selectedField?.fontStyle === 'italic';
                    const fieldIsStrike = Boolean(selectedField?.strikethrough);
                    const fieldIsUnderline = Boolean(selectedField?.underline);

                    const isBoldActive = activeTagStyle?.bold !== undefined ? Boolean(activeTagStyle.bold) : fieldIsBold;
                    const isItalicActive = activeTagStyle?.italic !== undefined ? Boolean(activeTagStyle.italic) : fieldIsItalic;
                    const isStrikeActive = activeTagStyle?.strikethrough !== undefined ? Boolean(activeTagStyle.strikethrough) : fieldIsStrike;
                    const isUnderlineActive = activeTagStyle?.underline !== undefined ? Boolean(activeTagStyle.underline) : fieldIsUnderline;

                    return (
                      <div className="flex items-center gap-0.5 bg-slate-950 p-0.5 rounded-xl border border-slate-800">
                        <button
                          onMouseDown={(e) => { e.preventDefault(); handleCaptureSelection(e); }}
                          onClick={() => handleApplyInlineStyle('bold')}
                          className={`p-1.5 rounded text-xs ${
                            isBoldActive ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                          }`}
                          title="Toggle Bold"
                        >
                          <Bold className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onMouseDown={(e) => { e.preventDefault(); handleCaptureSelection(e); }}
                          onClick={() => handleApplyInlineStyle('italic')}
                          className={`p-1.5 rounded text-xs ${
                            isItalicActive ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                          }`}
                          title="Toggle Italic"
                        >
                          <Italic className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onMouseDown={(e) => { e.preventDefault(); handleCaptureSelection(e); }}
                          onClick={() => handleApplyInlineStyle('strikethrough')}
                          className={`p-1.5 rounded text-xs ${
                            isStrikeActive ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                          }`}
                          title="Toggle Strikethrough"
                        >
                          <Strikethrough className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onMouseDown={(e) => { e.preventDefault(); handleCaptureSelection(e); }}
                          onClick={() => handleApplyInlineStyle('underline')}
                          className={`p-1.5 rounded text-xs ${
                            isUnderlineActive ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                          }`}
                          title="Toggle Underline"
                        >
                          <Underline className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })()}

                  {/* Alignment Switcher */}
                  <div className="flex items-center gap-0.5 bg-slate-950 p-0.5 rounded-xl border border-slate-800">
                    <button
                      onClick={() => handleUpdateField(selectedField.id, { align: 'left' })}
                      className={`p-1.5 rounded ${selectedField.align === 'left' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                      title="Align Left"
                    >
                      <AlignLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleUpdateField(selectedField.id, { align: 'center' })}
                      className={`p-1.5 rounded ${selectedField.align === 'center' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                      title="Align Center"
                    >
                      <AlignCenter className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleUpdateField(selectedField.id, { align: 'right' })}
                      className={`p-1.5 rounded ${selectedField.align === 'right' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                      title="Align Right"
                    >
                      <AlignRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Multi-line / Next Line Toggle */}
                  <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800">
                    <button
                      onClick={() => handleUpdateField(selectedField.id, { allowWrap: !selectedField.allowWrap })}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold transition-all ${
                        selectedField.allowWrap
                          ? 'bg-amber-500 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title={
                        selectedField.allowWrap
                          ? 'Next Line Allowed: Text wraps onto multiple lines instead of shrinking font size'
                          : 'Single Line Only: Font size automatically shrinks to fit inside 1 line'
                      }
                    >
                      <WrapText className="w-3.5 h-3.5" />
                      <span className="text-[10px] uppercase font-mono tracking-wider">
                        {selectedField.allowWrap ? 'Next Line: ON' : 'Next Line: OFF'}
                      </span>
                    </button>
                  </div>

                  {/* Text Casing Switcher */}
                  <select
                    value={selectedField.casing || 'as-is'}
                    onChange={(e) => handleUpdateField(selectedField.id, { casing: e.target.value })}
                    className="select-dark text-xs py-1 px-2 font-mono"
                    title="Text Casing Transformation"
                  >
                    <option value="as-is">As-Is Casing</option>
                    <option value="uppercase">UPPERCASE</option>
                    <option value="lowercase">lowercase</option>
                    <option value="capitalize">Title Case</option>
                  </select>

                  {/* Undo & Redo Shortcuts Buttons */}
                  <div className="flex items-center gap-0.5 bg-slate-950 p-0.5 rounded-xl border border-slate-800">
                    <button
                      onClick={handleUndo}
                      disabled={historyStack.length === 0}
                      className={`p-1.5 rounded ${historyStack.length > 0 ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-600 opacity-50 cursor-not-allowed'}`}
                      title="Undo (Ctrl+Z)"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleRedo}
                      disabled={redoStack.length === 0}
                      className={`p-1.5 rounded ${redoStack.length > 0 ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-600 opacity-50 cursor-not-allowed'}`}
                      title="Redo (Ctrl+Y)"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Rich Drag-Type Color Picker Button */}
                  {(() => {
                    const activeTagKey = selectedField?.selectedTag;
                    const activeTagStyle = activeTagKey ? selectedField?.styledTags?.[activeTagKey] : null;
                    const currentColor = activeTagStyle?.color || selectedField?.color || '#FFFFFF';

                    return (
                      <button
                        onClick={() => setIsColorPickerOpen(true)}
                        className="flex items-center gap-1.5 px-2 py-1 bg-slate-950 rounded-xl border border-slate-800 hover:border-amber-400/60 transition group"
                        title={activeTagKey ? `Change color for selected tag "${activeTagKey}"` : "Change text color for entire box & view Color Theories"}
                      >
                        <div
                          className="w-4 h-4 rounded-md border border-slate-700 shadow-sm group-hover:scale-110 transition"
                          style={{ backgroundColor: currentColor }}
                        />
                        <span className="text-[10px] font-mono font-bold text-slate-300 group-hover:text-amber-300">
                          {currentColor}
                        </span>
                        <Palette className="w-3.5 h-3.5 text-amber-400" />
                      </button>
                    );
                  })()}

                </div>
              )}
            </div>

            {/* Dynamic Action Buttons Row: Dynamic Tags + Ranking Awards side-by-side */}
            {selectedField && selectedField.type === 'text' && (
              <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-800/80 flex-wrap">
                {/* Left group: Dynamic Tags & Configure Ranking side-by-side! */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsDynamicTagsModalOpen(true)}
                    className="px-3 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-xs font-mono font-bold text-amber-300 border border-amber-500/30 flex items-center gap-1.5 shadow-sm transition"
                    title="Insert column tags and format template"
                  >
                    <Tag className="w-3.5 h-3.5 text-amber-400" /> 🏷️ Insert Dynamic Tag...
                  </button>

                  <button
                    onClick={() => setIsRankingModalOpen(true)}
                    className="px-3 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 text-xs font-mono font-bold text-amber-300 border border-amber-500/40 flex items-center gap-1.5 shadow-sm transition"
                    title="Configure score column and placement award schemes (1st, 2nd, Champion, etc.)"
                  >
                    <Trophy className="w-3.5 h-3.5 text-amber-400" /> 🏆 Configure Ranking & Awards
                  </button>
                </div>

                {/* Right group: View Mode & Middle Initial toggle */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setStageViewMode((prev) => (prev === 'record' ? 'tags' : 'record'))}
                    className={`px-3 py-1 rounded-xl text-xs font-mono font-bold border transition flex items-center gap-1.5 shadow-sm ${
                      stageViewMode === 'tags'
                        ? 'bg-indigo-500 text-slate-950 border-indigo-400 font-bold ring-2 ring-indigo-400/40'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:text-white'
                    }`}
                    title="Toggle between displaying raw dynamic tags vs evaluated record values on canvas"
                  >
                    {stageViewMode === 'tags' ? (
                      <>
                        <Tag className="w-3.5 h-3.5 text-slate-950" /> 🏷️ Tag Layout Mode
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5 text-indigo-400" /> 👤 Live Record Mode
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleToggleTagInitial}
                    className="px-2.5 py-1 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-xs font-mono font-bold text-indigo-300 border border-indigo-500/30 flex items-center gap-1 transition"
                    title="Make selected tag Middle Initial ({middle_name} -> {middle_name_initial} -> M.)"
                  >
                    🔤 Make Initial (M.I.)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Record Selector Header & Search */}
          <div className="flex items-center justify-between flex-wrap gap-2 px-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-400 font-medium">Live Preview Record:</span>
              <select
                value={previewRowIndex}
                onChange={(e) => setPreviewRowIndex(Number(e.target.value))}
                className="select-dark text-xs py-1 font-semibold text-amber-300 max-w-[260px]"
              >
                {filteredPreviewRows.map((r) => {
                  const actualIdx = tabulatedRows.indexOf(r);
                  const name = r.last_name && r.first_name
                    ? `${r.last_name}, ${r.first_name}`
                    : r.name || r.first_name || `Record #${actualIdx + 1}`;
                  return (
                    <option key={actualIdx} value={actualIdx}>
                      #{actualIdx + 1}: {name}
                    </option>
                  );
                })}
              </select>

              {/* Record Search Input */}
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none z-10" />
                <input
                  type="text"
                  placeholder="Search record..."
                  value={rowSearchQuery}
                  onChange={(e) => setRowSearchQuery(e.target.value)}
                  className="input-dark py-1 text-xs w-44 font-mono text-slate-200"
                  style={{ paddingLeft: '2.1rem' }}
                />
              </div>
            </div>
          </div>

          {/* MASSIVE CANVA-STYLE INTERACTIVE STAGE VIEWPORT */}
          <div className="w-full glass-panel p-3 rounded-2xl overflow-hidden shadow-inner min-h-[520px] flex flex-col items-center justify-center">
            <InteractiveStage
              currentLayout={currentLayout}
              selectedFieldId={selectedFieldId}
              onSelectField={setSelectedFieldId}
              onUpdateField={handleUpdateField}
              previewRow={activePreviewRow}
              stageViewMode={stageViewMode}
              onToggleFullscreen={handleToggleFullscreen}
              isFullscreen={isFullscreen}
            />
          </div>
        </div>
      </div>

      {/* Large Batch Advisory Modal */}
      {isLargeBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-amber-500/40 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/30">
                <ShieldAlert className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Large Batch Advisory</h3>
                <p className="text-xs text-amber-300 font-medium">
                  {selectedRowIndices.size} Certificates Selected
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Enabling <strong>Safe Memory Mode</strong> is recommended for large exports to prevent memory exhaustion.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => {
                  setSafeMemoryMode(true);
                  setIsLargeBatchModalOpen(false);
                  setTimeout(() => handleGenerateBatchZip(), 50);
                }}
                className="btn-gold text-xs py-2.5 justify-center font-bold flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4 text-slate-950" /> Enable Safe & Start
              </button>
              <button
                onClick={() => {
                  setIsLargeBatchModalOpen(false);
                  setTimeout(() => handleGenerateBatchZip(), 50);
                }}
                className="btn-secondary text-xs py-2.5 justify-center"
              >
                Proceed Fast
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ranking & Awards Config Modal */}
      <RankingConfigModal
        isOpen={isRankingModalOpen}
        onClose={() => setIsRankingModalOpen(false)}
        headers={headers}
        scoreColumn={scoreColumn}
        setScoreColumn={setScoreColumn}
        titleScheme={titleScheme}
        setTitleScheme={setTitleScheme}
        onApplyRanking={({ scoreColumn: sCol, titleScheme: tScheme, teamCount }) => {
          if (sCol !== undefined) setScoreColumn(sCol);
          if (tScheme !== undefined) setTitleScheme(tScheme);
          handleSelectTopN(teamCount || 3);

          if (currentLayoutId) {
            saveSnapshot();
            setLayouts((prevLayouts) =>
              prevLayouts.map((l) => {
                if (l.id !== currentLayoutId) return l;
                return {
                  ...l,
                  fields: l.fields.map((f) => {
                    const rawContent = (f.customTemplate || f.key || '').toLowerCase();
                    const isRankField = f.id === selectedFieldId || f.enableTabulationTags || rawContent.includes('champion') || rawContent.includes('runner') || rawContent.includes('place');
                    if (isRankField) {
                      if (!rawContent.includes('{rank_title}') && !rawContent.includes('{_rank_title}') && !rawContent.includes('{placement}')) {
                        return {
                          ...f,
                          isCustomMessage: true,
                          customTemplate: '{rank_title}',
                          key: 'rank_title',
                          enableTabulationTags: true
                        };
                      }
                    }
                    return f;
                  })
                };
              })
            );
          }
        }}
      />

      {/* Dynamic Tag & Live Text Layout Modal */}
      <DynamicTagModal
        isOpen={isDynamicTagsModalOpen}
        onClose={() => setIsDynamicTagsModalOpen(false)}
        headers={headers}
        initialTemplate={selectedField?.customTemplate || ''}
        previewRow={activePreviewRow}
        enableTabulationTags={Boolean(selectedField?.enableTabulationTags || scoreColumn)}
        onApplyTemplate={(newTpl) => {
          saveSnapshot();
          handleUpdateField(selectedField.id, { customTemplate: newTpl });
        }}
      />

      {/* Interactive Color Studio & Theories Modal */}
      <ColorPickerModal
        isOpen={isColorPickerOpen}
        onClose={() => setIsColorPickerOpen(false)}
        color={
          (selectedField?.selectedTag && selectedField?.styledTags?.[selectedField.selectedTag]?.color) ||
          selectedField?.color ||
          '#FFFFFF'
        }
        onChange={handleColorChange}
        bgImage={currentLayout?.image}
      />
    </div>
  );
}
