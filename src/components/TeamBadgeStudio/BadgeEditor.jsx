import React, { useState, useEffect, useRef } from 'react';
import { Contact, QrCode, Sliders, Download, Plus, Trash2, GitBranch, Layers, CheckCircle2, Eye, Sparkles, CheckSquare, Square } from 'lucide-react';
import CsvUploader from '../Shared/CsvUploader';
import ManualDataEntryModal from '../Shared/ManualDataEntryModal';
import { createSampleTeamBadgeBackground, SAMPLE_CSV_DATA } from '../Shared/SampleDataPresets';
import { renderCanvasElement, loadImage } from '../../utils/canvasRenderer';
import { exportBatchToZip } from '../../utils/zipExporter';

export default function BadgeEditor({ onStartExport, setExportStatus }) {
  const [records, setRecords] = useState(SAMPLE_CSV_DATA);
  const [selectedRecordIndices, setSelectedRecordIndices] = useState(new Set(SAMPLE_CSV_DATA.map((_, i) => i)));
  const [columns, setColumns] = useState(['first_name', 'middle_name', 'last_name', 'nickname', 'section', 'year', 'department', 'role', 'student_id', 'layout_name', 'qr_data']);
  const [currentRecordIdx, setCurrentRecordIdx] = useState(0);

  const [bgImageSrc, setBgImageSrc] = useState(createSampleTeamBadgeBackground());
  const [bgImageObj, setBgImageObj] = useState(null);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 600, height: 900 });

  const [dynamicLayoutColumn, setDynamicLayoutColumn] = useState('layout_name');

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

  const [textLayers, setTextLayers] = useState([
    {
      id: 'layer-name',
      name: 'Display Name (Nickname / First Name)',
      columns: ['nickname'],
      order: ['nickname'],
      separator: ' ',
      casing: 'uppercase',
      fallbackRules: [{ targetColumn: 'nickname', fallbackColumn: 'first_name' }],
      x: 300,
      y: 480,
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 34,
      fontWeight: '800',
      color: '#ffffff',
      alignment: 'center'
    },
    {
      id: 'layer-role',
      name: 'Role & Department',
      columns: ['role', 'department'],
      order: ['role', 'department'],
      separator: ' • ',
      casing: 'none',
      x: 300,
      y: 535,
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 20,
      fontWeight: '600',
      color: '#a5b4fc',
      alignment: 'center'
    },
    {
      id: 'layer-class',
      name: 'Section & Year',
      columns: ['section', 'year'],
      order: ['section', 'year'],
      separator: ' | Class of ',
      casing: 'none',
      x: 300,
      y: 575,
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 16,
      fontWeight: '500',
      color: '#94a3b8',
      alignment: 'center'
    }
  ]);

  const [qrLayers, setQrLayers] = useState([
    {
      id: 'qr-1',
      name: 'Employee QR Code',
      sourceType: 'column',
      columnName: 'qr_data',
      staticText: 'https://company.org/verify',
      x: 215,
      y: 630,
      size: 170,
      darkColor: '#0f172a',
      lightColor: '#ffffff',
      margin: 2
    }
  ]);

  const [selectedLayerId, setSelectedLayerId] = useState('layer-name');
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  const [fileNamePattern, setFileNamePattern] = useState('{last_name}_{nickname}_{section}');
  const [groupByColumns, setGroupByColumns] = useState(['department', 'section']);

  const canvasRef = useRef(null);
  const bgFileInputRef = useRef(null);

  useEffect(() => {
    if (bgImageSrc) {
      loadImage(bgImageSrc).then((img) => {
        if (img) {
          setBgImageObj(img);
          setCanvasDimensions({ width: img.naturalWidth || 600, height: img.naturalHeight || 900 });
        }
      });
    }
  }, [bgImageSrc]);

  useEffect(() => {
    if (!canvasRef.current || !bgImageObj) return;

    const ctx = canvasRef.current.getContext('2d');
    const recordData = records[currentRecordIdx] || {};

    renderCanvasElement(ctx, canvasDimensions.width, canvasDimensions.height, {
      backgroundImage: bgImageObj,
      textLayers,
      qrLayers,
      recordData
    });
  }, [bgImageObj, textLayers, qrLayers, currentRecordIdx, records, canvasDimensions]);

  const handleTemplateUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setBgImageSrc(evt.target?.result);
    };
    reader.readAsDataURL(file);
  };

  const selectedLayer = textLayers.find((l) => l.id === selectedLayerId);
  const selectedQr = qrLayers[0];

  const updateSelectedLayer = (updates) => {
    setTextLayers(textLayers.map((l) => (l.id === selectedLayerId ? { ...l, ...updates } : l)));
  };

  const toggleLayerFallbackRule = (targetCol, fallbackCol) => {
    if (!selectedLayer) return;
    const currentRules = selectedLayer.fallbackRules || [];
    const exists = currentRules.some((r) => r.targetColumn === targetCol && r.fallbackColumn === fallbackCol);

    const updatedRules = exists
      ? currentRules.filter((r) => !(r.targetColumn === targetCol && r.fallbackColumn === fallbackCol))
      : [...currentRules, { targetColumn: targetCol, fallbackColumn: fallbackCol }];

    updateSelectedLayer({ fallbackRules: updatedRules });
  };

  const cancelExportRef = useRef(false);

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
        textLayers,
        qrLayers,
        dynamicLayoutColumn
      },
      width: canvasDimensions.width,
      height: canvasDimensions.height,
      fileNamePattern,
      groupByColumns,
      zipName: 'Team_Badges_QR_Batch.zip',
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner */}
      <div className="glass-panel p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-emerald-500/20">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center border border-emerald-500/30">
              <Contact className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-extrabold text-main tracking-tight">Team Badges & QR Generator Studio</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Generate team cards with <strong className="text-emerald-500">Conditional Fallback Rules</strong> (e.g. IF nickname is empty → USE first_name), <strong className="text-indigo-500 font-semibold">Data-Driven QR Codes</strong>, and CSV layout switching.
          </p>
        </div>

        <button
          onClick={handleBatchExport}
          disabled={selectedRecordIndices.size === 0}
          className="btn-primary shadow-lg shadow-emerald-500/20 disabled:opacity-40"
        >
          <Download className="w-4 h-4" />
          {selectedRecordIndices.size === 0
            ? 'No Records Selected'
            : `Batch Export Selected (${selectedRecordIndices.size} Badges ZIP)`}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side Controls */}
        <div className="lg:col-span-5 md:col-span-12 space-y-5">
          {/* Step 1: Source */}
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-main">
                  <Eye className="w-4 h-4 text-emerald-500" />
                  <span>Preview Record:</span>
                </div>
                <select
                  value={currentRecordIdx}
                  onChange={(e) => setCurrentRecordIdx(Number(e.target.value))}
                  className="select-dark text-xs font-medium max-w-[200px]"
                >
                  {records.map((r, i) => (
                    <option key={i} value={i}>
                      #{i + 1}: {r.first_name || ''} {r.last_name || ''} ({r.nickname ? `Nickname: "${r.nickname}"` : 'No Nickname → Triggers Fallback'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between gap-1 pt-2 border-t border-slate-700/20 text-xs">
                <button
                  onClick={handleSelectAllRecords}
                  className="text-[11px] font-bold text-emerald-500 hover:underline flex items-center gap-1"
                >
                  <CheckSquare className="w-3.5 h-3.5" /> Select All ({records.length})
                </button>
                <button
                  onClick={handleDeselectAllRecords}
                  className="text-[11px] font-bold text-slate-400 hover:underline flex items-center gap-1"
                >
                  <Square className="w-3.5 h-3.5" /> Deselect All
                </button>
                <span className="badge badge-emerald text-[10px] ml-auto">
                  {selectedRecordIndices.size} Selected
                </span>
              </div>

              {/* Conditional Indicator Card */}
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-xs text-main flex items-center justify-between">
                <span>
                  Rule Status: {currentRecord.nickname ? (
                    <strong className="text-emerald-500">Using Nickname ("{currentRecord.nickname}")</strong>
                  ) : (
                    <strong className="text-amber-500">No Nickname → Fallback to First Name ("{currentRecord.first_name}")</strong>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Step 2: Conditional Text & Fallback Rules */}
          <div className="glass-panel p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-indigo-500" />
                <h3 className="font-bold text-sm text-main">Step 2: Conditional Fallback Rule Builder</h3>
              </div>
            </div>

            {/* Layer Tabs */}
            <div className="flex flex-wrap gap-2">
              {textLayers.map((layer) => (
                <button
                  key={layer.id}
                  onClick={() => setSelectedLayerId(layer.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedLayerId === layer.id
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'btn-secondary text-slate-400 hover:text-main'
                  }`}
                >
                  {layer.name}
                </button>
              ))}
            </div>

            {selectedLayer && (
              <div className="space-y-4 pt-3 border-t border-slate-700/30">
                {/* Fallback Condition Toggle Card */}
                <div className="p-3.5 rounded-xl glass-panel space-y-2">
                  <span className="text-xs font-bold text-amber-500 block">
                    ⚡ Fallback Rule Configurator:
                  </span>

                  <label className="flex items-center gap-2.5 text-xs text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(selectedLayer.fallbackRules || []).some(
                        (r) => r.targetColumn === 'nickname' && r.fallbackColumn === 'first_name'
                      )}
                      onChange={() => toggleLayerFallbackRule('nickname', 'first_name')}
                      className="accent-emerald-500 w-4 h-4 rounded"
                    />
                    <span>IF <code className="text-indigo-500 font-mono">nickname</code> is empty → Fall back to <code className="text-emerald-500 font-mono">first_name</code></span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Separator String</label>
                    <input
                      type="text"
                      value={selectedLayer.separator !== undefined ? selectedLayer.separator : ' '}
                      onChange={(e) => updateSelectedLayer({ separator: e.target.value })}
                      placeholder="e.g. , or -"
                      className="input-dark text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Separator Position</label>
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
                </div>

                <div className="grid grid-cols-2 gap-3">
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
                </div>
              </div>
            )}
          </div>

          {/* Step 3: Data-Driven QR Code Engine */}
          <div className="glass-panel p-5 space-y-4">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-purple-500" />
              <h3 className="font-bold text-sm text-main">Step 3: Data-Driven QR Code Engine</h3>
            </div>

            {selectedQr && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">
                    Map QR Payload to CSV Column:
                  </label>
                  <select
                    value={selectedQr.columnName || 'qr_data'}
                    onChange={(e) => {
                      const updated = [...qrLayers];
                      updated[0].columnName = e.target.value;
                      setQrLayers(updated);
                    }}
                    className="select-dark text-xs w-full"
                  >
                    {columns.map((c) => (
                      <option key={c} value={c}>Column: {c}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">QR Size (px)</label>
                    <input
                      type="number"
                      value={selectedQr.size || 170}
                      onChange={(e) => {
                        const updated = [...qrLayers];
                        updated[0].size = Number(e.target.value);
                        setQrLayers(updated);
                      }}
                      className="input-dark text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Vertical Y Position</label>
                    <input
                      type="number"
                      value={selectedQr.y || 630}
                      onChange={(e) => {
                        const updated = [...qrLayers];
                        updated[0].y = Number(e.target.value);
                        setQrLayers(updated);
                      }}
                      className="input-dark text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Step 4: CSV Layout Selector Column */}
          <div className="glass-panel p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-pink-500" />
              <h3 className="font-bold text-sm text-main">Step 4: CSV Layout Switcher Column</h3>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                CSV Column Driving Design Layouts:
              </label>
              <select
                value={dynamicLayoutColumn}
                onChange={(e) => setDynamicLayoutColumn(e.target.value)}
                className="select-dark text-xs w-full"
              >
                {columns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Right Preview Viewport */}
        <div className="lg:col-span-7 md:col-span-12 space-y-4">
          <div className="glass-panel p-5 space-y-4 sticky top-20">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-bold text-base text-main">Live Team Badge Preview</h3>

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
                  Upload Custom Badge Template
                </button>
              </div>
            </div>

            <div className="w-full overflow-auto glass-panel p-4 rounded-2xl flex justify-center shadow-inner">
              <canvas
                ref={canvasRef}
                width={canvasDimensions.width}
                height={canvasDimensions.height}
                className="max-w-full h-auto rounded-xl shadow-2xl border border-slate-700/40"
              />
            </div>

            <div className="flex justify-between text-xs text-slate-400 px-1 font-medium">
              <span>Badge Canvas: {canvasDimensions.width} x {canvasDimensions.height} px</span>
              <span className="text-emerald-500">Dynamic Fallback & QR Engine Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Data Entry Modal */}
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
