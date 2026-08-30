import React, { useState, useEffect, useRef } from 'react';
import { Contact, QrCode, Sliders, Download, Plus, Trash2, GitBranch, Layers, CheckCircle2, Eye, Sparkles } from 'lucide-react';
import CsvUploader from '../Shared/CsvUploader';
import ManualDataEntryModal from '../Shared/ManualDataEntryModal';
import { createSampleTeamBadgeBackground, SAMPLE_CSV_DATA } from '../Shared/SampleDataPresets';
import { renderCanvasElement, loadImage } from '../../utils/canvasRenderer';
import { exportBatchToZip } from '../../utils/zipExporter';

export default function BadgeEditor({ onStartExport, setExportStatus }) {
  const [records, setRecords] = useState(SAMPLE_CSV_DATA);
  const [columns, setColumns] = useState(['first_name', 'middle_name', 'last_name', 'nickname', 'section', 'year', 'department', 'role', 'student_id', 'layout_name', 'qr_data']);
  const [currentRecordIdx, setCurrentRecordIdx] = useState(0);

  const [bgImageSrc, setBgImageSrc] = useState(createSampleTeamBadgeBackground());
  const [bgImageObj, setBgImageObj] = useState(null);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 600, height: 900 });

  const [dynamicLayoutColumn, setDynamicLayoutColumn] = useState('layout_name');

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
    if (records.length === 0) {
      alert('Please load team records first!');
      return;
    }

    cancelExportRef.current = false;

    onStartExport();
    setExportStatus({ isExporting: true, isFinished: false, progress: 0, total: records.length });

    await exportBatchToZip({
      records,
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
      <div className="glass-panel p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-emerald-500/20 bg-gradient-to-r from-emerald-950/20 via-slate-900 to-indigo-950/20">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Contact className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-extrabold text-white tracking-tight">Team Badges & QR Generator Studio</h2>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Generate team cards with <strong className="text-emerald-300">Conditional Fallback Rules</strong> (e.g. IF nickname is empty → USE first_name), <strong className="text-indigo-300 font-semibold">Data-Driven QR Codes</strong>, and CSV layout switching.
          </p>
        </div>

        <button onClick={handleBatchExport} className="btn-primary shadow-lg shadow-emerald-500/20">
          <Download className="w-4 h-4" />
          Batch Export Badges ({records.length} Records)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side Controls */}
        <div className="lg:col-span-5 md:col-span-12 space-y-5">
          {/* Step 1: Source */}
          <CsvUploader
            onDataLoaded={(parsedRecords, parsedHeaders) => {
              setRecords(parsedRecords);
              setColumns(parsedHeaders);
              setCurrentRecordIdx(0);
            }}
            onOpenManualEditor={() => setIsManualModalOpen(true)}
            currentRecordCount={records.length}
          />

          {/* Record Selector & IF/ELSE Rule Live Evaluator */}
          {records.length > 0 && (
            <div className="glass-panel p-4 space-y-3 bg-slate-900/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <span>Preview Record:</span>
                </div>
                <select
                  value={currentRecordIdx}
                  onChange={(e) => setCurrentRecordIdx(Number(e.target.value))}
                  className="select-dark text-xs font-medium"
                >
                  {records.map((r, i) => (
                    <option key={i} value={i}>
                      #{i + 1}: {r.first_name || ''} {r.last_name || ''} ({r.nickname ? `Nickname: "${r.nickname}"` : 'No Nickname → Triggers Fallback'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Conditional Indicator Card */}
              <div className="p-3 rounded-xl bg-indigo-950/60 border border-indigo-500/30 text-xs text-indigo-200 flex items-center justify-between">
                <span>
                  Rule Status: {currentRecord.nickname ? (
                    <strong className="text-emerald-300">Using Nickname ("{currentRecord.nickname}")</strong>
                  ) : (
                    <strong className="text-amber-300">No Nickname → Fallback to First Name ("{currentRecord.first_name}")</strong>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Step 2: Conditional Text & Fallback Rules */}
          <div className="glass-panel p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-sm text-white">Step 2: Conditional Fallback Rule Builder</h3>
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
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-slate-950 shadow-md'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {layer.name}
                </button>
              ))}
            </div>

            {selectedLayer && (
              <div className="space-y-4 pt-3 border-t border-slate-800">
                {/* Fallback Condition Toggle Card */}
                <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-amber-300 block">
                    ⚡ Fallback Rule Configurator:
                  </span>

                  <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(selectedLayer.fallbackRules || []).some(
                        (r) => r.targetColumn === 'nickname' && r.fallbackColumn === 'first_name'
                      )}
                      onChange={() => toggleLayerFallbackRule('nickname', 'first_name')}
                      className="accent-emerald-500 w-4 h-4 rounded"
                    />
                    <span>IF <code className="text-indigo-300 font-mono">nickname</code> is empty → Fall back to <code className="text-emerald-300 font-mono">first_name</code></span>
                  </label>
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
                      className="h-9 w-full rounded-lg bg-slate-900 border border-slate-800 cursor-pointer p-0.5"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Step 3: Data-Driven QR Code Engine */}
          <div className="glass-panel p-5 space-y-4">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-purple-400" />
              <h3 className="font-bold text-sm text-white">Step 3: Data-Driven QR Code Engine</h3>
            </div>

            {selectedQr && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
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
              <Layers className="w-4 h-4 text-pink-400" />
              <h3 className="font-bold text-sm text-white">Step 4: CSV Layout Switcher Column</h3>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
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
              <h3 className="font-bold text-base text-white">Live Team Badge Preview</h3>

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

            <div className="w-full overflow-auto bg-slate-950/90 p-4 rounded-2xl border border-slate-800 flex justify-center shadow-inner">
              <canvas
                ref={canvasRef}
                width={canvasDimensions.width}
                height={canvasDimensions.height}
                className="max-w-full h-auto rounded-xl shadow-2xl border border-slate-800/80"
              />
            </div>

            <div className="flex justify-between text-xs text-slate-400 px-1 font-medium">
              <span>Badge Canvas: {canvasDimensions.width} x {canvasDimensions.height} px</span>
              <span className="text-emerald-400">Dynamic Fallback & QR Engine Active</span>
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
          setColumns(updatedCols);
          setCurrentRecordIdx(0);
        }}
      />
    </div>
  );
}
