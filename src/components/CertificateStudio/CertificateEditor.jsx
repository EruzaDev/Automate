import React, { useState, useEffect, useRef } from 'react';
import { Award, Plus, Trash2, Move, Type, Download, Sliders, Layers, FolderTree, FileSpreadsheet, Sparkles, ZoomIn, ZoomOut, Maximize2, ArrowUp, ArrowDown, Eye, Check, CheckSquare, Square } from 'lucide-react';
import CsvUploader from '../Shared/CsvUploader';
import ManualDataEntryModal from '../Shared/ManualDataEntryModal';
import { createSampleCertificateBackground, SAMPLE_CSV_DATA } from '../Shared/SampleDataPresets';
import { renderCanvasElement, loadImage, evaluateMultiColumnText } from '../../utils/canvasRenderer';
import { exportBatchToZip } from '../../utils/zipExporter';

export default function CertificateEditor({ onStartExport, setExportStatus }) {
  // Data State & Selection
  const [records, setRecords] = useState(SAMPLE_CSV_DATA);
  const [selectedRecordIndices, setSelectedRecordIndices] = useState(new Set(SAMPLE_CSV_DATA.map((_, i) => i)));
  const [columns, setColumns] = useState(['first_name', 'middle_name', 'last_name', 'section', 'year', 'department', 'role']);
  const [currentRecordIdx, setCurrentRecordIdx] = useState(0);

  // Template State
  const [bgImageSrc, setBgImageSrc] = useState(createSampleCertificateBackground());
  const [bgImageObj, setBgImageObj] = useState(null);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 1200, height: 850 });
  const [zoomScale, setZoomScale] = useState(1.0);

  const handleSelectAllRecords = () => {
    setSelectedRecordIndices(new Set(records.map((_, i) => i)));
  };

  const handleDeselectAllRecords = () => {
    setSelectedRecordIndices(new Set());
  };

  const handleToggleRecordSelection = (idx) => {
    setSelectedRecordIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // Text Layers Configuration
  const [textLayers, setTextLayers] = useState([
    {
      id: 'layer-recipient',
      name: 'Recipient Full Name',
      columns: ['first_name', 'middle_name', 'last_name'],
      order: ['first_name', 'middle_name', 'last_name'],
      separator: ' ',
      casing: 'uppercase',
      x: 600,
      y: 360,
      fontFamily: 'Playfair Display',
      fontSize: 48,
      fontWeight: 'bold',
      color: '#f59e0b',
      alignment: 'center',
      shadow: true,
      shadowColor: 'rgba(0, 0, 0, 0.6)',
      shadowBlur: 6
    },
    {
      id: 'layer-section',
      name: 'Section & Year Badge',
      columns: ['section', 'year'],
      order: ['section', 'year'],
      separator: ' | Class of ',
      casing: 'none',
      x: 600,
      y: 430,
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 22,
      fontWeight: '600',
      color: '#cbd5e1',
      alignment: 'center'
    }
  ]);

  const [selectedLayerId, setSelectedLayerId] = useState('layer-recipient');
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  // Grouping & Export Settings
  const [fileNamePattern, setFileNamePattern] = useState('{last_name}_{first_name}_{section}');
  const [groupByColumns, setGroupByColumns] = useState(['section', 'year']);

  const canvasRef = useRef(null);
  const bgFileInputRef = useRef(null);

  // Preload Background Image Object
  useEffect(() => {
    if (bgImageSrc) {
      loadImage(bgImageSrc).then((img) => {
        if (img) {
          setBgImageObj(img);
          setCanvasDimensions({ width: img.naturalWidth || 1200, height: img.naturalHeight || 850 });
        }
      });
    }
  }, [bgImageSrc]);

  // Render Preview Canvas
  useEffect(() => {
    if (!canvasRef.current || !bgImageObj) return;

    const ctx = canvasRef.current.getContext('2d');
    const recordData = records[currentRecordIdx] || {};

    renderCanvasElement(ctx, canvasDimensions.width, canvasDimensions.height, {
      backgroundImage: bgImageObj,
      textLayers,
      recordData
    });
  }, [bgImageObj, textLayers, currentRecordIdx, records, canvasDimensions]);

  // Handle Custom Background Upload
  const handleTemplateUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setBgImageSrc(evt.target?.result);
    };
    reader.readAsDataURL(file);
  };

  const selectedLayer = textLayers.find((l) => l.id === selectedLayerId) || textLayers[0];

  const updateSelectedLayer = (updates) => {
    setTextLayers(textLayers.map((l) => (l.id === selectedLayerId ? { ...l, ...updates } : l)));
  };

  const handleAddTextLayer = () => {
    const newId = `layer-${Date.now()}`;
    const newLayer = {
      id: newId,
      name: `Text Layer ${textLayers.length + 1}`,
      columns: columns.slice(0, 2),
      order: columns.slice(0, 2),
      separator: ' ',
      casing: 'none',
      x: Math.round(canvasDimensions.width / 2),
      y: Math.round(canvasDimensions.height / 2),
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 28,
      fontWeight: '600',
      color: '#ffffff',
      alignment: 'center'
    };
    setTextLayers([...textLayers, newLayer]);
    setSelectedLayerId(newId);
  };

  const handleRemoveLayer = (id) => {
    if (textLayers.length <= 1) return;
    const filtered = textLayers.filter((l) => l.id !== id);
    setTextLayers(filtered);
    setSelectedLayerId(filtered[0].id);
  };

  const moveColumnInOrder = (colName, direction) => {
    if (!selectedLayer) return;
    const currentOrder = [...(selectedLayer.order || selectedLayer.columns)];
    const idx = currentOrder.indexOf(colName);
    if (idx < 0) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= currentOrder.length) return;

    const temp = currentOrder[idx];
    currentOrder[idx] = currentOrder[targetIdx];
    currentOrder[targetIdx] = temp;

    updateSelectedLayer({ order: currentOrder });
  };

  // Center Selected Layer
  const centerLayerHorizontally = () => {
    if (!selectedLayer) return;
    updateSelectedLayer({ x: Math.round(canvasDimensions.width / 2) });
  };

  const cancelExportRef = useRef(false);

  // Batch Export Trigger for Selected Records
  const handleBatchExport = async () => {
    const selectedRecords = records.filter((_, idx) => selectedRecordIndices.has(idx));

    if (selectedRecords.length === 0) {
      alert('Please select at least 1 record to export!');
      return;
    }

    cancelExportRef.current = false;

    onStartExport();
    setExportStatus({ isExporting: true, isFinished: false, progress: 0, total: selectedRecords.length });

    await exportBatchToZip({
      records: selectedRecords,
      layerConfig: {
        backgroundImage: bgImageObj,
        textLayers
      },
      width: canvasDimensions.width,
      height: canvasDimensions.height,
      fileNamePattern,
      groupByColumns,
      zipName: 'Certificates_Batch.zip',
      onProgress: (current, total) => {
        setExportStatus((prev) => ({ ...prev, progress: current }));
      },
      shouldCancel: () => cancelExportRef.current
    });

    if (cancelExportRef.current) {
      setExportStatus({ isExporting: false, isFinished: false, progress: 0, total: 0 });
      return;
    }

    setExportStatus((prev) => ({ ...prev, isExporting: false, isFinished: true }));
  };

  const currentRecord = records[currentRecordIdx] || {};
  const liveEvaluatedText = selectedLayer ? evaluateMultiColumnText(currentRecord, selectedLayer) : '';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner */}
      <div className="glass-panel p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-amber-500/20">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center border border-amber-500/30">
              <Award className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-extrabold text-main tracking-tight">Automated Certificate Generator</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Build multi-column text boxes (e.g. combine <code className="text-amber-500 font-semibold">first_name + middle_name + last_name + section + year</code>), reorder sequence, and group exports into subfolders.
          </p>
        </div>

        <button
          onClick={handleBatchExport}
          disabled={selectedRecordIndices.size === 0}
          className="btn-gold shadow-lg shadow-amber-500/20 disabled:opacity-40"
        >
          <Download className="w-4 h-4" />
          {selectedRecordIndices.size === 0
            ? 'No Records Selected'
            : `Batch Export Selected (${selectedRecordIndices.size} ZIP)`}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Control Sidebar */}
        <div className="lg:col-span-5 space-y-5">
          {/* Step 1: Data Input */}
          <CsvUploader
            onDataLoaded={(parsedRecords, parsedHeaders) => {
              setRecords(parsedRecords);
              setSelectedRecordIndices(new Set(parsedRecords.map((_, i) => i)));
              setColumns(parsedHeaders);
              setCurrentRecordIdx(0);
            }}
            onOpenManualEditor={() => setIsManualModalOpen(true)}
            currentRecordCount={records.length}
          />

          {/* Record Selector & Select All Toolbar */}
          {records.length > 0 && (
            <div className="glass-panel p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-main">
                  <Eye className="w-4 h-4 text-indigo-500" />
                  <span>Preview Record:</span>
                </div>
                <select
                  value={currentRecordIdx}
                  onChange={(e) => setCurrentRecordIdx(Number(e.target.value))}
                  className="select-dark text-xs font-medium max-w-[200px]"
                >
                  {records.map((r, i) => (
                    <option key={i} value={i}>
                      #{i + 1}: {r.first_name || ''} {r.last_name || 'Record'} ({r.section || 'No Sec'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between gap-1 pt-2 border-t border-slate-700/20 text-xs">
                <button
                  onClick={handleSelectAllRecords}
                  className="text-[11px] font-bold text-amber-500 hover:underline flex items-center gap-1"
                >
                  <CheckSquare className="w-3.5 h-3.5" /> Select All ({records.length})
                </button>
                <button
                  onClick={handleDeselectAllRecords}
                  className="text-[11px] font-bold text-slate-400 hover:underline flex items-center gap-1"
                >
                  <Square className="w-3.5 h-3.5" /> Deselect All
                </button>
                <span className="badge badge-indigo text-[10px] ml-auto">
                  {selectedRecordIndices.size} Selected
                </span>
              </div>
            </div>
          )}

          {/* Step 2: Multi-Column Builder & Layer Controls */}
          <div className="glass-panel p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-500" />
                <h3 className="font-bold text-sm text-main">Step 2: Multi-Column Text Layers</h3>
              </div>
              <button onClick={handleAddTextLayer} className="btn-secondary text-xs py-1 px-2.5">
                <Plus className="w-3.5 h-3.5" /> Add Layer
              </button>
            </div>

            {/* Layer Selection Chips */}
            <div className="flex flex-wrap gap-2">
              {textLayers.map((layer) => (
                <button
                  key={layer.id}
                  onClick={() => setSelectedLayerId(layer.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    selectedLayerId === layer.id
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'btn-secondary text-slate-400 hover:text-main'
                  }`}
                >
                  <Type className="w-3.5 h-3.5" />
                  {layer.name}
                </button>
              ))}
            </div>

            {selectedLayer && (
              <div className="space-y-4 pt-3 border-t border-slate-700/30">
                {/* Live Formatted Output Preview Pill */}
                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 space-y-1">
                  <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">
                    Live Formatted String Preview:
                  </span>
                  <div className="text-sm font-semibold text-amber-500 truncate font-mono">
                    "{liveEvaluatedText || 'No columns selected'}"
                  </div>
                </div>

                {/* Columns Selection Checkboxes */}
                <div>
                  <label className="text-xs font-bold text-indigo-500 block mb-1.5">
                    Select CSV Columns for this Text Box:
                  </label>
                  <div className="flex flex-wrap gap-1.5 p-2 glass-panel rounded-xl max-h-32 overflow-auto">
                    {columns.map((col) => {
                      const isSelected = (selectedLayer.columns || []).includes(col);
                      return (
                        <button
                          key={col}
                          type="button"
                          onClick={() => {
                            const newCols = isSelected
                              ? selectedLayer.columns.filter((c) => c !== col)
                              : [...selectedLayer.columns, col];
                            const newOrder = isSelected
                              ? (selectedLayer.order || []).filter((c) => c !== col)
                              : [...(selectedLayer.order || []), col];
                            updateSelectedLayer({ columns: newCols, order: newOrder });
                          }}
                          className={`text-xs px-2.5 py-1 rounded-lg font-semibold border transition-all ${
                            isSelected
                              ? 'bg-indigo-600/30 border-indigo-500 text-indigo-500 shadow-sm'
                              : 'btn-secondary text-slate-400 hover:text-main'
                          }`}
                        >
                          {isSelected ? `✓ ${col}` : `+ ${col}`}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Column Reordering Controls */}
                <div>
                  <label className="text-xs font-bold text-amber-500 block mb-1.5">
                    Column Display Sequence & Order:
                  </label>
                  <div className="space-y-1.5 glass-panel p-2.5 rounded-xl">
                    {(selectedLayer.order || selectedLayer.columns).map((colName, idx) => (
                      <div
                        key={colName}
                        className="flex items-center justify-between glass-panel px-3 py-1.5 rounded-lg text-xs font-medium"
                      >
                        <span className="text-main">
                          <strong className="text-indigo-500">{idx + 1}.</strong> {colName}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => moveColumnInOrder(colName, 'up')}
                            disabled={idx === 0}
                            className="p-1 rounded bg-slate-500/20 text-main hover:bg-indigo-600 hover:text-white disabled:opacity-30 text-[10px]"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => moveColumnInOrder(colName, 'down')}
                            disabled={idx === (selectedLayer.order || selectedLayer.columns).length - 1}
                            className="p-1 rounded bg-slate-500/20 text-main hover:bg-indigo-600 hover:text-white disabled:opacity-30 text-[10px]"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Text Formatting Controls */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Separator</label>
                    <input
                      type="text"
                      value={selectedLayer.separator !== undefined ? selectedLayer.separator : ' '}
                      onChange={(e) => updateSelectedLayer({ separator: e.target.value })}
                      placeholder="e.g. , or -"
                      className="input-dark text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Position</label>
                    <select
                      value={selectedLayer.separatorPosition || 'between_all'}
                      onChange={(e) => updateSelectedLayer({ separatorPosition: e.target.value })}
                      className="select-dark text-xs w-full"
                    >
                      <option value="between_all">Between All (Doe, John, Alex)</option>
                      <option value="after_first">After 1st Only (Doe, John Alex)</option>
                      <option value="before_last">Before Last Only (John Alex, Doe)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Casing</label>
                    <select
                      value={selectedLayer.casing || 'none'}
                      onChange={(e) => updateSelectedLayer({ casing: e.target.value })}
                      className="select-dark text-xs w-full"
                    >
                      <option value="none">As Is</option>
                      <option value="uppercase">UPPERCASE</option>
                      <option value="lowercase">lowercase</option>
                      <option value="titlecase">Title Case</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Font Family</label>
                    <select
                      value={selectedLayer.fontFamily || 'Inter'}
                      onChange={(e) => updateSelectedLayer({ fontFamily: e.target.value })}
                      className="select-dark text-xs w-full"
                    >
                      <option value="Cinzel">Cinzel (Luxury Serif)</option>
                      <option value="Playfair Display">Playfair Display</option>
                      <option value="Montserrat">Montserrat</option>
                      <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                      <option value="Inter">Inter</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Font Size (px)</label>
                    <input
                      type="number"
                      value={selectedLayer.fontSize || 32}
                      onChange={(e) => updateSelectedLayer({ fontSize: Number(e.target.value) })}
                      className="input-dark text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Text Color</label>
                    <input
                      type="color"
                      value={selectedLayer.color || '#ffffff'}
                      onChange={(e) => updateSelectedLayer({ color: e.target.value })}
                      className="h-9 w-full rounded-lg border border-slate-700 cursor-pointer p-0.5"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Alignment</label>
                    <select
                      value={selectedLayer.alignment || 'center'}
                      onChange={(e) => updateSelectedLayer({ alignment: e.target.value })}
                      className="select-dark text-xs w-full"
                    >
                      <option value="center">Center</option>
                      <option value="left">Left</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                </div>

                {/* Position Sliders with Snap Button */}
                <div className="space-y-3 pt-2 border-t border-slate-700/30">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-400">Vertical Position (Y): {selectedLayer.y}px</span>
                    <button
                      onClick={centerLayerHorizontally}
                      className="text-[10px] text-indigo-500 hover:underline"
                    >
                      Snap Center (X)
                    </button>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max={canvasDimensions.height - 50}
                    value={selectedLayer.y}
                    onChange={(e) => updateSelectedLayer({ y: Number(e.target.value) })}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>

                {textLayers.length > 1 && (
                  <button
                    onClick={() => handleRemoveLayer(selectedLayer.id)}
                    className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 pt-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Text Layer
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Step 3: Subfolder Grouping Settings (Section & Year) */}
          <div className="glass-panel p-5 space-y-3">
            <div className="flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-amber-500" />
              <h3 className="font-bold text-sm text-main">Step 3: Subfolder Grouping & File Naming</h3>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                File Naming Format:
              </label>
              <input
                type="text"
                value={fileNamePattern}
                onChange={(e) => setFileNamePattern(e.target.value)}
                className="input-dark text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Subfolder Grouping Columns:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {columns.map((col) => {
                  const isGrouped = groupByColumns.includes(col);
                  return (
                    <button
                      key={col}
                      onClick={() => {
                        setGroupByColumns(
                          isGrouped ? groupByColumns.filter((c) => c !== col) : [...groupByColumns, col]
                        );
                      }}
                      className={`text-xs px-2.5 py-1 rounded-lg font-semibold border transition-all ${
                        isGrouped
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-500 shadow-sm'
                          : 'btn-secondary text-slate-400'
                      }`}
                    >
                      {isGrouped ? `✓ Subfolder: ${col}` : `+ ${col}`}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Preview Canvas */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-panel p-5 space-y-4 sticky top-20">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-bold text-base text-main">Live Certificate Preview</h3>

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={bgFileInputRef}
                  onChange={handleTemplateUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  onClick={() => bgFileInputRef.current?.click()}
                  className="btn-secondary text-xs"
                >
                  Upload Custom Background Template
                </button>
              </div>
            </div>

            {/* Viewport */}
            <div className="w-full overflow-auto glass-panel p-4 rounded-2xl flex justify-center shadow-inner">
              <canvas
                ref={canvasRef}
                width={canvasDimensions.width}
                height={canvasDimensions.height}
                className="max-w-full h-auto rounded-lg shadow-2xl border border-slate-700/40"
              />
            </div>

            <div className="flex justify-between text-xs text-slate-400 px-1 font-medium">
              <span>Canvas dimensions: {canvasDimensions.width} x {canvasDimensions.height} px</span>
              <span className="text-indigo-500">High-DPI Export Ready</span>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Grid Data Entry Modal */}
      <ManualDataEntryModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        initialRecords={records}
        initialColumns={columns}
        onSave={(updatedRecords, updatedCols) => {
          setRecords(updatedRecords);
          setSelectedRecordIndices(new Set(updatedRecords.map((_, i) => i)));
          setColumns(updatedCols);
          setCurrentRecordIdx(0);
        }}
      />
    </div>
  );
}
