import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Upload, FileSpreadsheet, Edit3, CheckCircle2, Loader2 } from 'lucide-react';

export default function CsvUploader({ onDataLoaded, onOpenManualEditor, currentRecordCount = 0 }) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const processFile = (file) => {
    if (!file) return;
    setIsUploading(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      worker: true,
      complete: (results) => {
        setIsUploading(false);
        if (results.data && results.data.length > 0) {
          onDataLoaded(results.data, Object.keys(results.data[0]));
        }
      },
      error: (err) => {
        setIsUploading(false);
        alert('CSV Parsing Error: ' + err.message);
      }
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.includes('csv') || file.name.endsWith('.csv'))) {
      processFile(file);
    }
  };

  return (
    <div className="glass-panel p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-500 flex items-center justify-center border border-indigo-500/30">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-main">Step 1: Recipient Data Input</h3>
            <p className="text-[11px] text-slate-400">Import CSV or enter records manually in-browser</p>
          </div>
        </div>
        {currentRecordCount > 0 && (
          <span className="badge badge-emerald">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {currentRecordCount} Records Ready
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Upload CSV Dropzone */}
        <div
          onClick={() => !isUploading && fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`dropzone flex flex-col items-center justify-center gap-2 py-4 relative transition-all ${
            isDragOver ? 'border-amber-400 bg-amber-500/10 scale-[1.02]' : ''
          } ${
            isUploading ? 'opacity-75 cursor-wait' : 'cursor-pointer'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv"
            className="hidden"
            disabled={isUploading}
          />
          {isUploading ? (
            <>
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center border border-indigo-500/20">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
              <div className="text-center">
                <span className="text-xs font-bold text-indigo-500 block">Uploading & Parsing CSV...</span>
                <span className="text-[10px] text-slate-400">Reading records into memory</span>
              </div>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center border border-indigo-500/20">
                <Upload className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="text-center">
                <span className="text-xs font-bold text-indigo-500 block">
                  {isDragOver ? 'Drop CSV File Here' : 'Upload CSV File'}
                </span>
                <span className="text-[10px] text-slate-400">Click or drag & drop .csv file</span>
              </div>
            </>
          )}
        </div>

        {/* Manual Grid Entry Option */}
        <div
          onClick={onOpenManualEditor}
          className="dropzone flex flex-col items-center justify-center gap-2 py-4 border-purple-500/30 hover:border-purple-400 cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center border border-purple-500/20">
            <Edit3 className="w-5 h-5" />
          </div>
          <div className="text-center">
            <span className="text-xs font-bold text-purple-500 block">Manual Grid Data Editor</span>
            <span className="text-[10px] text-slate-400">Type or edit spreadsheet rows directly</span>
          </div>
        </div>
      </div>
    </div>
  );
}
