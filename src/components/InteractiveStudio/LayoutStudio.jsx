import React, { useState, useRef } from 'react';
import { Layout, Plus, Trash2, FileSpreadsheet, Download, Type, QrCode, Sliders, ArrowUp, ArrowDown, FolderPlus, FolderTree, Bold, Italic, Strikethrough, Underline, MessageSquare, Search, Table, Eye, CheckCircle, Loader2, CheckSquare, Square } from 'lucide-react';
import * as XLSX from 'xlsx';
import InteractiveStage from './InteractiveStage';
import CSVDataEditorModal from '../Shared/CSVDataEditorModal';
import { renderRecordToCanvas, exportLayoutsToZip } from '../../utils/batchRenderer';
import { loadCustomFontFile, getLoadedCustomFonts } from '../../utils/fontLoader';

export default function LayoutStudio({ onStartExport, setExportStatus, onProgressChange, onRegisterCancel }) {
  // Layout Templates State (Clean start with no sample photos)
  const [layouts, setLayouts] = useState([]);
  const [currentLayoutId, setCurrentLayoutId] = useState(null);
  const [layoutColumnKey, setLayoutColumnKey] = useState('template');

  // Folder Hierarchy Sort State
  const [folderSortColumns, setFolderSortColumns] = useState([]);

  const handleAddFolderSortColumn = (colKey) => {
    if (!colKey || folderSortColumns.includes(colKey)) return;
    setFolderSortColumns((prev) => [...prev, colKey]);
  };

  const handleRemoveFolderSortColumn = (colKey) => {
    setFolderSortColumns((prev) => prev.filter((c) => c !== colKey));
  };

  const handleMoveFolderSortColumn = (index, direction) => {
    const next = [...folderSortColumns];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= next.length) return;
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;
    setFolderSortColumns(next);
  };

  // Local Batch Export Progress & Loading State
  const [localExportStatus, setLocalExportStatus] = useState({
    isExporting: false,
    isFinished: false,
    progress: 0,
    total: 0
  });

  // Selected Field State
  const [selectedFieldId, setSelectedFieldId] = useState(null);

  // Custom Font State
  const [customFonts, setCustomFonts] = useState([]);
  const fontFileInputRef = useRef(null);
  const templateTextareaRef = useRef(null);

  // Batch CSV Data Rows & Selection State
  const [rows, setRows] = useState([]);
  const [selectedRowIndices, setSelectedRowIndices] = useState(new Set());
  const [dataFileName, setDataFileName] = useState('');

  const handleSelectAllRows = () => {
    setSelectedRowIndices(new Set(rows.map((_, i) => i)));
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

  // CSV Data Editor Modal & Live Search / Preview Row State
  const [isDataEditorOpen, setIsDataEditorOpen] = useState(false);
  const [previewRowIndex, setPreviewRowIndex] = useState(0);
  const [rowSearchQuery, setRowSearchQuery] = useState('');

  const layoutFileInputRef = useRef(null);
  const dataFileInputRef = useRef(null);

  // Filtered rows for live preview selector search
  const filteredPreviewRows = rows.filter((r) => {
    if (!rowSearchQuery.trim()) return true;
    const q = rowSearchQuery.toLowerCase().trim();
    return Object.values(r).some((val) => String(val).toLowerCase().includes(q));
  });

  // Auto-select first matching record on stage when searching
  React.useEffect(() => {
    if (rowSearchQuery.trim() && filteredPreviewRows.length > 0) {
      const firstMatchIdx = rows.indexOf(filteredPreviewRows[0]);
      if (firstMatchIdx !== -1 && firstMatchIdx !== previewRowIndex) {
        setPreviewRowIndex(firstMatchIdx);
      }
    }
  }, [rowSearchQuery, filteredPreviewRows, rows, previewRowIndex]);

  // Notify parent of progress status
  React.useEffect(() => {
    if (onProgressChange) {
      onProgressChange(layouts.length > 0);
    }
  }, [layouts, onProgressChange]);

  const currentLayout = layouts.find((l) => l.id === currentLayoutId) || null;
  const selectedField = currentLayout?.fields.find((f) => f.id === selectedFieldId) || null;
  const headers = rows.length > 0 ? Object.keys(rows[0]) : ['first_name', 'middle_name', 'last_name', 'Section', 'Course', 'qr_data'];

  const activePreviewRow = rows[previewRowIndex] || rows[0] || {};

  // Uploading Loading State
  const [isUploading, setIsUploading] = useState(false);

  // Font Upload Handler
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
  const handleLayoutFilesUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    let loadedCount = 0;

    files.forEach((file, i) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const dataURL = evt.target?.result;
        const img = new Image();
        img.onload = () => {
          const baseName = file.name.replace(/\.[^.]+$/, '');
          const newLayout = {
            id: `L-${Date.now()}-${i}`,
            name: file.name,
            dataURL,
            image: img,
            selectorValue: baseName,
            fields: [
              {
                id: `f-${Date.now()}-1`,
                type: 'text',
                isCustomMessage: false,
                customTemplate: 'Awarded to ***{first_name} {middle_name} {last_name}*** for completing {Course}',
                isMultiColumn: true,
                columns: ['first_name', 'middle_name', 'last_name'],
                separator: ' ',
                casing: 'capitalize',
                fontSize: 36,
                isFixedFontSize: false,
                letterSpacing: 0,
                wordSpacing: 0,
                xPct: 0.15,
                yPct: 0.40,
                wPct: 0.70,
                hPct: 0.15,
                fontFamily: 'Georgia, serif',
                fontWeight: '700',
                color: '#ffffff',
                align: 'center'
              }
            ]
          };

          setLayouts((prev) => {
            const updated = [...prev, newLayout];
            if (!currentLayoutId) setCurrentLayoutId(newLayout.id);
            return updated;
          });

          loadedCount++;
          if (loadedCount === files.length) {
            setIsUploading(false);
          }
        };
        img.src = dataURL;
      };
      reader.readAsDataURL(file);
    });

    layoutFileInputRef.current.value = '';
  };

  const handleAddField = (type) => {
    if (!currentLayout) return;
    const count = currentLayout.fields.filter((f) => f.type === type).length;
    const defaultKey = type === 'text' ? 'first_name' : (count === 0 ? 'qr_data' : `qr_${count + 1}`);

    const newField = {
      id: `f-${Date.now()}`,
      type,
      key: defaultKey,
      isCustomMessage: false,
      customTemplate: 'Certificate of Excellence presented to ***{first_name} {last_name}***',
      isMultiColumn: type === 'text',
      columns: type === 'text' ? ['first_name', 'last_name'] : [],
      separator: ' ',
      casing: 'as-is',
      fontSize: 32,
      isFixedFontSize: false,
      letterSpacing: 0,
      wordSpacing: 0,
      xPct: type === 'text' ? 0.20 : 0.70,
      yPct: type === 'text' ? 0.45 : 0.65,
      wPct: type === 'text' ? 0.60 : 0.18,
      hPct: type === 'text' ? 0.14 : 0.24,
      fontFamily: 'Georgia, serif',
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

  const handleUpdateField = (fieldId, updates) => {
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

  // Toggle Column Selection in Multi-Column Mode
  const handleToggleColumn = (colKey) => {
    if (!selectedField) return;
    const currentCols = selectedField.columns || [];
    let updated;
    if (currentCols.includes(colKey)) {
      updated = currentCols.filter((c) => c !== colKey);
    } else {
      updated = [...currentCols, colKey];
    }
    handleUpdateField(selectedField.id, { columns: updated });
  };

  // Move Column Up/Down in Multi-Column Mode
  const handleMoveColumn = (index, direction) => {
    if (!selectedField || !selectedField.columns) return;
    const cols = [...selectedField.columns];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= cols.length) return;

    const temp = cols[index];
    cols[index] = cols[targetIdx];
    cols[targetIdx] = temp;

    handleUpdateField(selectedField.id, { columns: cols });
  };

  // Remove a Column from Multi-Column Render Order
  const handleRemoveColumn = (colToRemove) => {
    if (!selectedField || !selectedField.columns) return;
    const updated = selectedField.columns.filter((c) => c !== colToRemove);
    handleUpdateField(selectedField.id, { columns: updated });
  };

  // Smart Formatting Wrapper: Wraps highlighted text in textarea with formatting tags (e.g. **selected**)
  const applyFormattingToSelection = (prefix, suffix) => {
    if (!selectedField) return;
    const textarea = templateTextareaRef.current;
    const currentTpl = selectedField.customTemplate || '';

    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      if (start !== undefined && end !== undefined && start !== end) {
        // Text is highlighted -> Wrap selected text with prefix & suffix!
        const selectedText = currentTpl.substring(start, end);
        const newTpl = currentTpl.substring(0, start) + prefix + selectedText + suffix + currentTpl.substring(end);
        handleUpdateField(selectedField.id, { customTemplate: newTpl });

        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + prefix.length, end + prefix.length);
        }, 0);
        return;
      } else if (start !== undefined) {
        // No text highlighted -> Insert formatting block at cursor
        const newTpl = currentTpl.substring(0, start) + prefix + 'text' + suffix + currentTpl.substring(start);
        handleUpdateField(selectedField.id, { customTemplate: newTpl });

        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + prefix.length, start + prefix.length + 4);
        }, 0);
        return;
      }
    }

    // Fallback
    handleUpdateField(selectedField.id, { customTemplate: currentTpl + prefix + 'text' + suffix });
  };

  // Insert Variable Placeholder at Current Cursor / Replace Selection
  const insertVariableAtCursor = (varTag) => {
    if (!selectedField) return;
    const textarea = templateTextareaRef.current;
    const currentTpl = selectedField.customTemplate || '';

    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      if (start !== undefined && end !== undefined) {
        const newTpl = currentTpl.substring(0, start) + varTag + currentTpl.substring(end);
        handleUpdateField(selectedField.id, { customTemplate: newTpl });

        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + varTag.length, start + varTag.length);
        }, 0);
        return;
      }
    }

    handleUpdateField(selectedField.id, { customTemplate: currentTpl + varTag });
  };

  // Batch CSV / Excel Upload Handler
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

        // Automatically reset/validate layout field column picks to match new CSV headers
        if (parsed.length > 0) {
          const newHeaders = Object.keys(parsed[0]);
          setLayouts((prevLayouts) =>
            prevLayouts.map((l) => ({
              ...l,
              fields: l.fields.map((f) => {
                if (f.type === 'text') {
                  const validCols = (f.columns || []).filter((c) => newHeaders.includes(c));
                  const newCols = validCols.length > 0 ? validCols : newHeaders.slice(0, Math.min(3, newHeaders.length));
                  const newKey = newHeaders.includes(f.key) ? f.key : newHeaders[0];
                  return { ...f, columns: newCols, key: newKey };
                } else if (f.type === 'qr') {
                  const qrMatch = newHeaders.find((h) => /qr|code|url|id/i.test(h)) || newHeaders[0];
                  const newKey = newHeaders.includes(f.key) ? f.key : qrMatch;
                  return { ...f, key: newKey };
                }
                return f;
              })
            }))
          );
        }
      } catch (err) {
        alert('File parsing error: ' + err.message);
      } finally {
        setIsUploading(false);
      }
    };

    if (isCSV) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }

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

  // Export Single Preview PNG
  const handleDownloadSinglePreview = async () => {
    if (!currentLayout) return;
    const tempCanvas = document.createElement('canvas');
    await renderRecordToCanvas(activePreviewRow, currentLayout, tempCanvas);

    const link = document.createElement('a');
    link.download = `preview_${currentLayout.name}.png`;
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
  };

  const cancelExportRef = useRef(false);

  // Export Batch ZIP for Selected Rows
  const handleGenerateBatchZip = async () => {
    if (layouts.length === 0 || rows.length === 0) return;

    const selectedRowsToExport = rows.filter((_, idx) => selectedRowIndices.has(idx));
    if (selectedRowsToExport.length === 0) {
      alert('Please select at least 1 record to generate!');
      return;
    }

    cancelExportRef.current = false;
    if (onRegisterCancel) {
      onRegisterCancel(() => {
        cancelExportRef.current = true;
        const resetStatus = { isExporting: false, isFinished: false, progress: 0, total: 0 };
        setLocalExportStatus(resetStatus);
        if (setExportStatus) setExportStatus(resetStatus);
      });
    }

    if (onStartExport) onStartExport();
    const initialStatus = { isExporting: true, isFinished: false, progress: 0, total: selectedRowsToExport.length };
    setLocalExportStatus(initialStatus);
    if (setExportStatus) setExportStatus(initialStatus);

    const zipBlob = await exportLayoutsToZip({
      rows: selectedRowsToExport,
      layouts,
      layoutColumnKey,
      folderSortColumns,
      onProgress: (current, total) => {
        const curStatus = { isExporting: true, isFinished: false, progress: current, total };
        setLocalExportStatus(curStatus);
        if (setExportStatus) setExportStatus(curStatus);
      },
      shouldCancel: () => cancelExportRef.current
    });

    if (cancelExportRef.current) {
      const cancelledStatus = { isExporting: false, isFinished: false, progress: 0, total: 0 };
      setLocalExportStatus(cancelledStatus);
      if (setExportStatus) setExportStatus(cancelledStatus);
      return;
    }

    const blobUrl = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = 'Certificates_Batch_Export.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Instantly clean up memory allocated for generated photos & zip blob
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 1000);

    const finalStatus = { isExporting: false, isFinished: true, progress: selectedRowsToExport.length, total: selectedRowsToExport.length };
    setLocalExportStatus(finalStatus);
    if (setExportStatus) setExportStatus(finalStatus);
  };

  // Keyboard Shortcuts for LayoutStudio
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      const target = e.target;
      const isInputFocused =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) ||
        target?.isContentEditable;

      if (isInputFocused) return;

      // Duplicate Selected Box (Ctrl + D / Cmd + D)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (selectedFieldId && currentLayout) {
          const fieldToDup = currentLayout.fields.find((f) => f.id === selectedFieldId);
          if (fieldToDup) {
            const newField = {
              ...fieldToDup,
              id: `f-${Date.now()}`,
              xPct: Math.min(0.8, fieldToDup.xPct + 0.04),
              yPct: Math.min(0.8, fieldToDup.yPct + 0.04)
            };
            setLayouts((prev) =>
              prev.map((l) => (l.id === currentLayoutId ? { ...l, fields: [...l.fields, newField] } : l))
            );
            setSelectedFieldId(newField.id);
          }
        }
        return;
      }

      // Delete Selected Box (Delete / Backspace)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedFieldId) {
          e.preventDefault();
          handleDeleteField(selectedFieldId);
        }
        return;
      }

      // Deselect Field (Enter / Escape)
      if ((e.key === 'Enter' && !e.ctrlKey && !e.metaKey) || e.key === 'Escape') {
        if (selectedFieldId) {
          e.preventDefault();
          setSelectedFieldId(null);
        }
        return;
      }

      // Trigger Batch ZIP Export (Ctrl + Enter / Cmd + Enter)
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleGenerateBatchZip();
        return;
      }

      // Arrow Key Nudging for Selected Box
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (selectedFieldId && selectedField) {
          e.preventDefault();
          const step = e.shiftKey ? 0.05 : 0.01;
          let dx = 0;
          let dy = 0;
          if (e.key === 'ArrowLeft') dx = -step;
          if (e.key === 'ArrowRight') dx = step;
          if (e.key === 'ArrowUp') dy = -step;
          if (e.key === 'ArrowDown') dy = step;

          const newX = Math.max(0, Math.min(1 - selectedField.wPct, selectedField.xPct + dx));
          const newY = Math.max(0, Math.min(1 - selectedField.hPct, selectedField.yPct + dy));
          handleUpdateField(selectedField.id, { xPct: newX, yPct: newY });
          return;
        }

        // Record switcher when no field selected
        if (!selectedFieldId && rows.length > 0) {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            setPreviewRowIndex((prev) => (prev > 0 ? prev - 1 : rows.length - 1));
          } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            setPreviewRowIndex((prev) => (prev < rows.length - 1 ? prev + 1 : 0));
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFieldId, currentLayout, selectedField, rows, currentLayoutId]);

  // Drag and drop target for LayoutStudio
  const [isDragOverStudio, setIsDragOverStudio] = useState(false);

  const handleStudioDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragOverStudio) setIsDragOverStudio(true);
  };

  const handleStudioDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragOverStudio(false);
  };

  const handleStudioDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverStudio(false);

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;

    const csvOrExcel = files.find((f) => /\.(csv|xlsx|xls)$/i.test(f.name));
    const fontFiles = files.filter((f) => /\.(ttf|otf|woff|woff2)$/i.test(f.name));
    const imageFiles = files.filter((f) => /\.(png|jpg|jpeg|webp|gif|svg|bmp)$/i.test(f.name));

    if (csvOrExcel) {
      handleDataFileUpload({ target: { files: [csvOrExcel] } });
    }
    if (fontFiles.length > 0) {
      handleCustomFontUpload({ target: { files: fontFiles } });
    }
    if (imageFiles.length > 0) {
      handleLayoutFilesUpload({ target: { files: imageFiles } });
    }
  };

  return (
    <div
      onDragOver={handleStudioDragOver}
      onDragLeave={handleStudioDragLeave}
      onDrop={handleStudioDrop}
      className={`space-y-6 animate-fade-in relative transition-all duration-200 rounded-3xl ${
        isDragOverStudio ? 'ring-4 ring-amber-400/60 bg-amber-500/5' : ''
      }`}
    >
      {/* Drag & Drop Visual Overlay */}
      {isDragOverStudio && (
        <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm rounded-3xl border-2 border-dashed border-amber-400 flex flex-col items-center justify-center gap-3 p-8 animate-fade-in pointer-events-none">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40 animate-bounce">
            <Layout className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-amber-300">Drop Files to Load into Certificate Studio</h3>
          <p className="text-xs text-slate-300 text-center max-w-md">
            Drop <strong className="text-white">Images</strong> for Layout Backgrounds, <strong className="text-white">CSV/Excel</strong> for recipient data, or <strong className="text-white">Fonts (.ttf/.otf)</strong>.
          </p>
        </div>
      )}
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

      {/* Clean Header */}
      <div className="glass-panel p-4 flex items-center justify-between border-amber-500/30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center border border-amber-500/40">
            <Layout className="w-5 h-5" />
          </div>
          <h2 className="text-2xl font-black tracking-tight">Certificate</h2>
        </div>

        {/* Edit CSV Button in Header - Only available when dataset is uploaded */}
        {rows.length > 0 && (
          <button
            onClick={() => setIsDataEditorOpen(true)}
            className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            <Table className="w-4 h-4 text-indigo-500" /> View & Edit CSV Data ({rows.length})
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT PANEL: Layout Templates & Field Manager */}
        <div className="lg:col-span-3 md:col-span-4 space-y-4">
          {/* Custom Font Upload */}
          <div className="glass-panel p-4 space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider flex items-center justify-between opacity-80">
              <span>Custom Fonts</span>
              <span className="text-[10px] text-amber-500 font-mono">{customFonts.length} uploaded</span>
            </h3>

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
              className="btn-secondary text-xs w-full justify-center"
            >
              <FolderPlus className="w-4 h-4 text-indigo-500" /> Upload Font (.ttf, .otf, .woff)
            </button>
          </div>

          {/* Layout Backgrounds Section */}
          <div className="glass-panel p-4 space-y-3">
            <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider">Layout Templates ({layouts.length})</h3>

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
              className="btn-primary text-xs w-full justify-center"
            >
              <Plus className="w-4 h-4" /> Add Layout Image(s)
            </button>

            {/* Layout Cards */}
            <div className="space-y-2 max-h-48 overflow-auto pr-1">
              {layouts.map((l) => (
                <div
                  key={l.id}
                  onClick={() => {
                    setCurrentLayoutId(l.id);
                    setSelectedFieldId(l.fields[0]?.id || null);
                  }}
                  className={`p-2.5 rounded-xl border flex flex-col gap-2 cursor-pointer transition-all ${
                    currentLayoutId === l.id
                      ? 'bg-amber-500/15 border-amber-500 text-amber-500 font-bold shadow-md'
                      : 'glass-panel text-slate-500 hover:border-amber-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <img src={l.dataURL} alt="thumb" className="w-8 h-8 rounded object-cover border border-slate-500/30" />
                      <div className="min-w-0">
                        <span className="text-xs font-bold block truncate">{l.name}</span>
                        <span className="text-[10px] opacity-70">{l.fields.length} field(s)</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const updated = layouts.filter((item) => item.id !== l.id);
                        setLayouts(updated);
                        if (currentLayoutId === l.id) setCurrentLayoutId(updated[0]?.id || null);
                      }}
                      className="text-red-400 hover:text-red-300 text-xs p-1"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add Text Button */}
          <div className="glass-panel p-4 space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider opacity-80">Add Text</h3>
            <button
              onClick={() => handleAddField('text')}
              disabled={!currentLayout}
              className="btn-secondary text-xs w-full justify-center disabled:opacity-40 font-bold text-emerald-600 dark:text-emerald-400"
            >
              <Type className="w-4 h-4 text-emerald-500" /> + Add Text
            </button>
          </div>

          {/* Current Layout Fields List */}
          <div className="glass-panel p-4 space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider opacity-80">
              Layout Fields ({currentLayout?.fields.length || 0})
            </h3>

            <div className="space-y-1.5 max-h-48 overflow-auto">
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
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
                      TXT
                    </span>
                    <span className="font-mono truncate">
                      {f.isCustomMessage ? 'Custom Message' : f.isMultiColumn ? f.columns?.join(' + ') : f.key}
                    </span>
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
        </div>

        {/* CENTER PANEL: Interactive Canvas Viewport */}
        <div className="lg:col-span-6 md:col-span-8 space-y-4">
          <div className="glass-panel p-4 space-y-3 sticky top-20">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <span>Interactive Layout Stage</span>
              </h3>

              {/* Record Live Preview Switcher & Search Bar */}
              <div className="flex items-center gap-2">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400 pointer-events-none z-10" />
                  <input
                    type="text"
                    placeholder="Search record..."
                    value={rowSearchQuery}
                    onChange={(e) => setRowSearchQuery(e.target.value)}
                    className="input-dark text-[11px] py-1 w-36"
                    style={{ paddingLeft: '1.85rem' }}
                  />
                </div>

                <select
                  value={previewRowIndex}
                  onChange={(e) => setPreviewRowIndex(Number(e.target.value))}
                  className="select-dark text-[11px] py-1 max-w-[200px]"
                >
                  {filteredPreviewRows.map((r) => {
                    const actualIndex = rows.indexOf(r);
                    const name = r.last_name && r.first_name
                      ? `${r.last_name}, ${r.first_name}`
                      : r.name || r.first_name || `Record #${actualIndex + 1}`;
                    return (
                      <option key={actualIndex} value={actualIndex}>
                        #{actualIndex + 1}: {name}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Interactive Canvas Viewport */}
            <div className="w-full glass-panel p-2 rounded-2xl overflow-hidden shadow-inner min-h-[400px] flex items-center justify-center">
              <InteractiveStage
                currentLayout={currentLayout}
                selectedFieldId={selectedFieldId}
                onSelectField={setSelectedFieldId}
                onUpdateField={handleUpdateField}
                previewRow={activePreviewRow}
              />
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Canva-Style Field Inspector & Custom Formatting */}
        <div className="lg:col-span-3 md:col-span-12 space-y-4">
          <div className="glass-panel p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-bold text-xs text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-amber-400" /> Selected Box Inspector
              </h3>
              {selectedField && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-amber-400 border border-slate-800">
                  {selectedField.type === 'text' ? 'Text Box' : 'QR Box'}
                </span>
              )}
            </div>

            {selectedField ? (
              <div className="space-y-3 text-xs">
                {selectedField.type === 'text' && (
                  <>
                    {/* Text Field Content Type Switcher */}
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold text-slate-400 block">Content Mode:</label>
                      <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                        <button
                          onClick={() => handleUpdateField(selectedField.id, { isCustomMessage: false, isMultiColumn: true })}
                          className={`py-1.5 px-2 rounded-lg font-bold text-[11px] transition-all ${
                            !selectedField.isCustomMessage
                              ? 'bg-amber-500 text-slate-950 shadow'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Column Pick
                        </button>
                        <button
                          onClick={() => handleUpdateField(selectedField.id, { isCustomMessage: true, isMultiColumn: false })}
                          className={`py-1.5 px-2 rounded-lg font-bold text-[11px] transition-all ${
                            selectedField.isCustomMessage
                              ? 'bg-amber-500 text-slate-950 shadow'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Custom Message
                        </button>
                      </div>
                    </div>

                    {/* Mode A: Custom Message Template with Markdown Syntax support */}
                    {selectedField.isCustomMessage ? (
                      <div className="space-y-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                            <MessageSquare className="w-3 h-3 text-amber-400" /> Message Template:
                          </label>
                        </div>

                        <textarea
                          ref={templateTextareaRef}
                          rows={3}
                          value={selectedField.customTemplate || ''}
                          onChange={(e) => handleUpdateField(selectedField.id, { customTemplate: e.target.value })}
                          placeholder="Awarded to ***{first_name} {last_name}*** for completing {Course}"
                          className="input-dark text-xs font-mono w-full leading-relaxed"
                        />

                        {/* Formatting Helper Buttons */}
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] font-bold text-slate-400 block">Format Highlighted Text / Selection:</span>
                          <div className="flex flex-wrap gap-1">
                            <button
                              onClick={() => applyFormattingToSelection('***', '***')}
                              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] font-bold text-amber-300 flex items-center gap-0.5"
                              title="Bold & Italic Syntax"
                            >
                              <Bold className="w-3 h-3" /><Italic className="w-3 h-3" /> ***text***
                            </button>

                            <button
                              onClick={() => applyFormattingToSelection('**', '**')}
                              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] font-bold text-amber-300 flex items-center gap-0.5"
                              title="Bold Syntax"
                            >
                              <Bold className="w-3 h-3" /> **bold**
                            </button>

                            <button
                              onClick={() => applyFormattingToSelection('*', '*')}
                              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-indigo-300 flex items-center gap-0.5"
                              title="Italic Syntax"
                            >
                              <Italic className="w-3 h-3" /> *italic*
                            </button>

                            <button
                              onClick={() => applyFormattingToSelection('~~', '~~')}
                              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-pink-300 flex items-center gap-0.5"
                              title="Strikethrough Syntax"
                            >
                              <Strikethrough className="w-3 h-3" /> ~~strike~~
                            </button>

                            <button
                              onClick={() => applyFormattingToSelection('<u>', '</u>')}
                              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-emerald-300 flex items-center gap-0.5"
                              title="Underline Syntax"
                            >
                              <Underline className="w-3 h-3" /> &lt;u&gt;underline&lt;/u&gt;
                            </button>
                          </div>
                        </div>

                        {/* Quick Column Variable Insert Pills */}
                        <div className="space-y-1 pt-1.5 border-t border-slate-900">
                          <span className="text-[10px] font-semibold text-slate-400 block">Insert Variable at Cursor:</span>
                          <div className="flex flex-wrap gap-1 max-h-24 overflow-auto">
                            {headers.map((h) => (
                              <button
                                key={h}
                                onClick={() => insertVariableAtCursor(`{${h}}`)}
                                className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-amber-500/20 text-[10px] font-mono text-slate-300 hover:text-amber-300 border border-slate-800"
                              >
                                +{h}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Mode B: Column Pick Mode */
                      <div className="space-y-2">
                        <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                          <span className="font-semibold text-slate-300">Multi-Column Mode</span>
                          <input
                            type="checkbox"
                            checked={selectedField.isMultiColumn || false}
                            onChange={(e) => handleUpdateField(selectedField.id, { isMultiColumn: e.target.checked })}
                            className="w-4 h-4 accent-amber-500 cursor-pointer"
                          />
                        </div>

                        {selectedField.isMultiColumn ? (
                          <div className="space-y-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                            <label className="text-[11px] font-bold text-amber-300 block">Pick CSV Columns to Combine:</label>
                            <div className="space-y-1 max-h-36 overflow-auto">
                              {headers.map((h) => {
                                const isChecked = selectedField.columns?.includes(h);
                                return (
                                  <label key={h} className="flex items-center justify-between p-1 rounded hover:bg-slate-900 cursor-pointer">
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handleToggleColumn(h)}
                                        className="accent-amber-500"
                                      />
                                      <span className="font-mono text-slate-200">{h}</span>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>

                            {selectedField.columns && selectedField.columns.length > 0 && (
                              <div className="pt-2 border-t border-slate-800 space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 block">Column Render Order:</label>
                                {selectedField.columns.map((col, idx) => (
                                  <div key={col} className="flex items-center justify-between bg-slate-900 px-2 py-1 rounded text-[11px]">
                                    <span className="font-mono text-amber-300">{idx + 1}. {col}</span>
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => handleMoveColumn(idx, 'up')}
                                        disabled={idx === 0}
                                        className="text-slate-400 hover:text-white disabled:opacity-30 p-0.5"
                                        title="Move Up"
                                      >
                                        <ArrowUp className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => handleMoveColumn(idx, 'down')}
                                        disabled={idx === selectedField.columns.length - 1}
                                        className="text-slate-400 hover:text-white disabled:opacity-30 p-0.5"
                                        title="Move Down"
                                      >
                                        <ArrowDown className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => handleRemoveColumn(col)}
                                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded p-0.5"
                                        title="Remove Column"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">Separator String:</label>
                                <input
                                  type="text"
                                  value={selectedField.separator !== undefined ? selectedField.separator : ' '}
                                  onChange={(e) => handleUpdateField(selectedField.id, { separator: e.target.value })}
                                  placeholder="e.g. , or -"
                                  className="input-dark text-xs font-mono"
                                />
                              </div>

                              <div>
                                <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">Separator Position:</label>
                                <select
                                  value={selectedField.separatorPosition || 'between_all'}
                                  onChange={(e) => handleUpdateField(selectedField.id, { separatorPosition: e.target.value })}
                                  className="select-dark text-xs w-full"
                                >
                                  <option value="between_all">Between All (Doe, John, Alex)</option>
                                  <option value="after_first">After 1st Only (Doe, John Alex)</option>
                                  <option value="before_last">Before Last Only (John Alex, Doe)</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <label className="text-[11px] font-semibold text-slate-400 block mb-1">CSV Data Column Key:</label>
                            <select
                              value={selectedField.key || ''}
                              onChange={(e) => handleUpdateField(selectedField.id, { key: e.target.value })}
                              className="select-dark text-xs w-full"
                            >
                              {headers.map((h) => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Font Size & Sizing Mode Controls */}
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-amber-300">Font Size (px):</label>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-400">Fixed Size:</span>
                          <input
                            type="checkbox"
                            checked={selectedField.isFixedFontSize || false}
                            onChange={(e) => handleUpdateField(selectedField.id, { isFixedFontSize: e.target.checked })}
                            className="w-3.5 h-3.5 accent-amber-500 cursor-pointer"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="10"
                          max="160"
                          step="1"
                          value={selectedField.fontSize || 36}
                          onChange={(e) => handleUpdateField(selectedField.id, { fontSize: Number(e.target.value) })}
                          className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                        />
                        <input
                          type="number"
                          min="8"
                          max="240"
                          value={selectedField.fontSize || 36}
                          onChange={(e) => handleUpdateField(selectedField.id, { fontSize: Number(e.target.value) })}
                          className="w-14 input-dark text-xs font-mono text-center px-1 py-0.5"
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 block">
                        {selectedField.isFixedFontSize
                          ? 'Strict Fixed Size (Will not auto-shrink)'
                          : 'Max Font Size Cap (Auto-shrinks if text overflows bounding box)'}
                      </span>
                    </div>

                    {/* Letter Spacing & Word Spacing Controls */}
                    <div className="grid grid-cols-2 gap-2 p-2 rounded-xl bg-slate-950/80 border border-slate-800">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold text-amber-300">Letter Spacing:</label>
                          <span className="text-[10px] font-mono text-slate-300">{selectedField.letterSpacing || 0}px</span>
                        </div>
                        <input
                          type="range"
                          min="-2"
                          max="25"
                          step="0.5"
                          value={selectedField.letterSpacing || 0}
                          onChange={(e) => handleUpdateField(selectedField.id, { letterSpacing: parseFloat(e.target.value) })}
                          className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold text-amber-300">Word Spacing:</label>
                          <span className="text-[10px] font-mono text-slate-300">{selectedField.wordSpacing || 0}px</span>
                        </div>
                        <input
                          type="range"
                          min="-2"
                          max="35"
                          step="0.5"
                          value={selectedField.wordSpacing || 0}
                          onChange={(e) => handleUpdateField(selectedField.id, { wordSpacing: parseFloat(e.target.value) })}
                          className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                        />
                      </div>
                    </div>

                    {/* Casing Rules */}
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 block mb-1">Text Casing Rule:</label>
                      <select
                        value={selectedField.casing || 'as-is'}
                        onChange={(e) => handleUpdateField(selectedField.id, { casing: e.target.value })}
                        className="select-dark text-xs w-full"
                      >
                        <option value="as-is">As-Is (Preserve CSV Case)</option>
                        <option value="title">Title Case / Titled (e.g. John Doe)</option>
                        <option value="uppercase">UPPERCASE (ALL CAPS)</option>
                        <option value="lowercase">lowercase</option>
                        <option value="capitalize">Capitalize Each Word</option>
                      </select>
                    </div>

                    {/* Font Selector including Custom Uploaded Fonts */}
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 block mb-1">Font Family:</label>
                      <select
                        value={selectedField.fontFamily || 'Georgia, serif'}
                        onChange={(e) => handleUpdateField(selectedField.id, { fontFamily: e.target.value })}
                        className="select-dark text-xs w-full"
                      >
                        <option value="Georgia, serif">Georgia (Classic Serif)</option>
                        <option value="Playfair Display, serif">Playfair Display</option>
                        <option value="Cinzel, serif">Cinzel (Luxury Serif)</option>
                        <option value="Plus Jakarta Sans, sans-serif">Plus Jakarta Sans</option>
                        <option value="Inter, sans-serif">Inter</option>

                        {/* Custom uploaded font list */}
                        {customFonts.map((cf) => (
                          <option key={cf.name} value={cf.family}>{cf.displayName}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">Weight:</label>
                        <select
                          value={selectedField.fontWeight || '600'}
                          onChange={(e) => handleUpdateField(selectedField.id, { fontWeight: e.target.value })}
                          className="select-dark text-xs w-full"
                        >
                          <option value="400">Normal (400)</option>
                          <option value="600">SemiBold (600)</option>
                          <option value="700">Bold (700)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">Align:</label>
                        <select
                          value={selectedField.align || 'center'}
                          onChange={(e) => handleUpdateField(selectedField.id, { align: e.target.value })}
                          className="select-dark text-xs w-full"
                        >
                          <option value="center">Center</option>
                          <option value="left">Left</option>
                          <option value="right">Right</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 block mb-1">Text Color (Color / Hex):</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={selectedField.color && selectedField.color.startsWith('#') ? selectedField.color : '#ffffff'}
                          onChange={(e) => handleUpdateField(selectedField.id, { color: e.target.value })}
                          className="h-8 w-10 rounded bg-slate-900 border border-slate-800 cursor-pointer p-0.5 flex-shrink-0"
                          title="Choose Color"
                        />
                        <input
                          type="text"
                          value={selectedField.color || '#ffffff'}
                          onChange={(e) => handleUpdateField(selectedField.id, { color: e.target.value })}
                          placeholder="#ffffff"
                          className="input-dark text-xs font-mono w-full"
                        />
                      </div>
                    </div>
                  </>
                )}

                {selectedField.type === 'qr' && (
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">QR Data Column:</label>
                    <select
                      value={selectedField.key || ''}
                      onChange={(e) => handleUpdateField(selectedField.id, { key: e.target.value })}
                      className="select-dark text-xs w-full"
                    >
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <span className="text-xs text-slate-500 block py-4 text-center">Click any box on stage to edit configuration.</span>
            )}
          </div>

          {/* Batch Data Loader */}
          <div className="glass-panel p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wider text-main">
                Batch Data ({rows.length} rows)
              </h3>
              {rows.length > 0 && (
                <span className="badge badge-indigo text-[10px]">
                  {selectedRowIndices.size} of {rows.length} Selected
                </span>
              )}
            </div>

            {rows.length > 0 && (
              <div className="flex items-center justify-between gap-1 py-1 border-y border-slate-700/20 text-xs">
                <button
                  onClick={handleSelectAllRows}
                  className="text-[11px] font-bold text-amber-500 hover:underline flex items-center gap-1"
                >
                  <CheckSquare className="w-3.5 h-3.5" /> Select All
                </button>
                <button
                  onClick={handleDeselectAllRows}
                  className="text-[11px] font-bold text-slate-400 hover:underline flex items-center gap-1"
                >
                  <Square className="w-3.5 h-3.5" /> Deselect All
                </button>
              </div>
            )}

            <input
              type="file"
              ref={dataFileInputRef}
              onChange={handleDataFileUpload}
              accept=".csv,.xlsx,.xls"
              className="hidden"
            />

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => dataFileInputRef.current?.click()}
                className="btn-secondary text-[11px] justify-center"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-500" /> Upload CSV/XLSX
              </button>

              <button
                onClick={() => setIsDataEditorOpen(true)}
                disabled={rows.length === 0}
                className="btn-secondary text-[11px] justify-center border-indigo-500/40 text-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
                title={rows.length === 0 ? 'Upload CSV/XLSX file to edit data table' : 'Edit Data Table'}
              >
                <Table className="w-3.5 h-3.5 text-indigo-500" /> Edit Data Table
              </button>
            </div>

            {dataFileName && (
              <span className="text-[10px] text-slate-400 block truncate">{dataFileName}</span>
            )}
          </div>

          {/* ZIP Folder Hierarchy & Sorting Options */}
          <div className="glass-panel p-4 space-y-3 border-amber-500/30">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <FolderTree className="w-3.5 h-3.5 text-amber-400" /> Zip Folder Hierarchy
              </h3>
              {folderSortColumns.length > 0 && (
                <button
                  onClick={() => setFolderSortColumns([])}
                  className="text-[10px] text-red-400 hover:underline"
                >
                  Clear Folders
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400 leading-normal">
              Organize exported certificates into nested folders in the ZIP file based on column values.
            </p>

            {/* Active Folder Priority List */}
            {folderSortColumns.length > 0 && (
              <div className="space-y-1.5">
                {folderSortColumns.map((col, idx) => (
                  <div
                    key={col}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex-shrink-0">
                        Level {idx + 1}
                      </span>
                      <span className="font-semibold truncate text-slate-200">{col}</span>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {idx > 0 && (
                        <button
                          onClick={() => handleMoveFolderSortColumn(idx, 'up')}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                          title="Move Priority Up"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                      )}
                      {idx < folderSortColumns.length - 1 && (
                        <button
                          onClick={() => handleMoveFolderSortColumn(idx, 'down')}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                          title="Move Priority Down"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveFolderSortColumn(col)}
                        className="p-1 rounded hover:bg-slate-800 text-red-400 hover:text-red-300 ml-1"
                        title="Remove Folder Level"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Column Picker Dropdown */}
            {headers.filter((h) => !folderSortColumns.includes(h)).length > 0 ? (
              <select
                value=""
                onChange={(e) => {
                  handleAddFolderSortColumn(e.target.value);
                  e.target.value = '';
                }}
                className="select-dark text-xs w-full py-1.5"
                disabled={rows.length === 0}
              >
                <option value="" disabled>
                  {rows.length === 0 ? 'Upload dataset to add folder levels...' : '+ Add Folder Hierarchy Level...'}
                </option>
                {headers
                  .filter((h) => !folderSortColumns.includes(h))
                  .map((h) => (
                    <option key={h} value={h}>
                      Subfolder by: {h}
                    </option>
                  ))}
              </select>
            ) : (
              <span className="text-[10px] text-slate-500 block italic text-center">
                All columns added to folder structure
              </span>
            )}

            {/* Folder Structure Preview Path */}
            {folderSortColumns.length > 0 && (
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono text-amber-300 truncate">
                ZIP / {folderSortColumns.map((c) => `{${c}}`).join(' / ')} / Certificate.png
              </div>
            )}
          </div>

          {/* Actions at the bottom */}
          <div className="space-y-2 pt-2">
            <button onClick={handleDownloadSinglePreview} disabled={!currentLayout} className="btn-secondary text-xs w-full justify-center disabled:opacity-40">
              Download Preview PNG
            </button>
            <button
              onClick={handleGenerateBatchZip}
              disabled={layouts.length === 0 || rows.length === 0 || selectedRowIndices.size === 0 || localExportStatus.isExporting}
              className="btn-gold text-sm w-full py-3 justify-center shadow-lg shadow-amber-500/20 disabled:opacity-40 font-bold flex items-center gap-2"
            >
              {localExportStatus.isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Generating ({localExportStatus.progress}/{localExportStatus.total})...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>
                    {selectedRowIndices.size === 0
                      ? 'No Rows Selected'
                      : `Generate Selected (${selectedRowIndices.size} ZIP)`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Batch Generation Progress & Loading Modal */}
      {(localExportStatus.isExporting || localExportStatus.isFinished) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6 text-center space-y-5">
            {localExportStatus.isExporting ? (
              <>
                <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-amber-500/20 animate-ping"></div>
                  <div className="w-16 h-16 rounded-full border-4 border-amber-400 border-t-transparent animate-spin"></div>
                  <Download className="w-6 h-6 text-amber-400 absolute" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white">Generating Batch Certificates</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Rendering certificate {localExportStatus.progress} of {localExportStatus.total}...
                  </p>
                </div>

                {/* Progress Bar & Percentage */}
                <div className="space-y-1.5">
                  <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800 p-0.5">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full rounded-full transition-all duration-200 shadow-lg shadow-amber-500/50"
                      style={{
                        width: `${localExportStatus.total > 0 ? Math.round((localExportStatus.progress / localExportStatus.total) * 100) : 0}%`
                      }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[11px] font-mono text-slate-400">
                    <span>{Math.round((localExportStatus.progress / (localExportStatus.total || 1)) * 100)}% Completed</span>
                    <span>{localExportStatus.progress} / {localExportStatus.total}</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    cancelExportRef.current = true;
                  }}
                  className="btn-secondary text-xs py-1.5 px-4 text-red-400 hover:text-red-300 border-red-500/30 font-bold"
                >
                  Cancel Export
                </button>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                  <CheckCircle className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white">Batch Export Complete!</h3>
                  <p className="text-xs text-slate-400">
                    Successfully generated {localExportStatus.total} certificate PNG files in your ZIP download.
                  </p>
                </div>

                <button
                  onClick={() => setLocalExportStatus({ isExporting: false, isFinished: false, progress: 0, total: 0 })}
                  className="btn-gold text-xs py-2 px-6 font-bold w-full justify-center"
                >
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
