import React, { useState } from 'react';
import { Search, Plus, Trash2, X, Download, Save, Table, CheckSquare, Square } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function CSVDataEditorModal({
  isOpen,
  onClose,
  rows,
  onSaveRows,
  selectedRowIndices = new Set(),
  onToggleSelectRow,
  onSelectAll,
  onDeselectAll
}) {
  if (!isOpen) return null;

  const [tableData, setTableData] = useState(() => JSON.parse(JSON.stringify(rows || [])));
  const [searchQuery, setSearchQuery] = useState('');

  const headers = tableData.length > 0
    ? Object.keys(tableData[0])
    : ['first_name', 'middle_name', 'last_name', 'Course', 'Year', 'Section', 'Code'];

  // Search Filter
  const filteredRows = tableData.filter((row) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return Object.values(row).some((val) => String(val).toLowerCase().includes(q));
  });

  const allFilteredSelected = filteredRows.length > 0 && filteredRows.every((r) => {
    const idx = tableData.indexOf(r);
    return selectedRowIndices.has(idx);
  });

  const handleCellChange = (rowIndex, colKey, value) => {
    setTableData((prev) => {
      const updated = [...prev];
      updated[rowIndex] = { ...updated[rowIndex], [colKey]: value };
      return updated;
    });
  };

  const handleAddRow = () => {
    const newRow = {};
    headers.forEach((h) => { newRow[h] = ''; });
    newRow[headers[0]] = `New Record ${tableData.length + 1}`;
    setTableData((prev) => [...prev, newRow]);
  };

  const handleDeleteRow = (actualIndex) => {
    setTableData((prev) => prev.filter((_, i) => i !== actualIndex));
  };

  const handleSaveAndClose = () => {
    onSaveRows(tableData);
    onClose();
  };

  const handleExportCSV = () => {
    const worksheet = XLSX.utils.json_to_sheet(tableData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    XLSX.writeFile(workbook, 'edited_dataset.xlsx');
  };

  const handleHeaderCheckboxChange = () => {
    if (allFilteredSelected) {
      if (onDeselectAll) onDeselectAll();
    } else {
      if (onSelectAll) onSelectAll();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="glass-panel-accent w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-700/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Table className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-bold text-main">CSV / Data Table Editor</h3>
            <span className="text-xs text-slate-400 font-mono">({tableData.length} records)</span>
            {selectedRowIndices && (
              <span className="badge badge-indigo text-[10px] ml-2">
                {selectedRowIndices.size} of {tableData.length} Selected
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportCSV}
              className="btn-secondary text-xs py-1.5 px-3 border-indigo-500/40 text-indigo-500"
            >
              <Download className="w-3.5 h-3.5" /> Download XLSX
            </button>
            <button
              onClick={handleSaveAndClose}
              className="btn-gold text-xs py-1.5 px-4 font-bold flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" /> Save Changes
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-main p-1 rounded-lg hover:bg-slate-500/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Select All Actions Bar */}
        <div className="p-3 border-b border-slate-700/30 bg-slate-900/40 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex items-center flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none z-10" />
            <input
              type="text"
              placeholder="Search by name, course, ID code, or any keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-dark text-xs w-full"
              style={{ paddingLeft: '2.4rem' }}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onSelectAll}
              className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1"
            >
              <CheckSquare className="w-3.5 h-3.5 text-amber-500" /> Select All
            </button>
            <button
              onClick={onDeselectAll}
              className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1"
            >
              <Square className="w-3.5 h-3.5 text-slate-400" /> Deselect All
            </button>

            <button
              onClick={handleAddRow}
              className="btn-secondary text-xs py-1.5 px-3 border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-500" /> Add Row
            </button>
          </div>
        </div>

        {/* Scrollable Data Table View */}
        <div className="flex-1 overflow-auto p-4">
          <table className="spreadsheet-table">
            <thead>
              <tr>
                <th className="p-2 text-center w-10">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={handleHeaderCheckboxChange}
                    className="accent-amber-500 cursor-pointer w-4 h-4"
                    title="Toggle Select All Filtered"
                  />
                </th>
                <th className="p-2 font-mono text-center w-12">#</th>
                {headers.map((h) => (
                  <th key={h} className="p-2 font-bold font-mono text-amber-500 min-w-[120px]">
                    {h}
                  </th>
                ))}
                <th className="p-2 text-center w-12">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const actualIdx = tableData.indexOf(row);
                const isSelected = selectedRowIndices.has(actualIdx);

                return (
                  <tr key={actualIdx} className={`transition-colors ${isSelected ? 'bg-amber-500/10' : ''}`}>
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelectRow && onToggleSelectRow(actualIdx)}
                        className="accent-amber-500 cursor-pointer w-4 h-4"
                      />
                    </td>
                    <td className="p-2 text-center font-mono text-slate-400">{actualIdx + 1}</td>
                    {headers.map((colKey) => (
                      <td key={colKey} className="p-1 min-w-[120px]">
                        <input
                          type="text"
                          value={row[colKey] !== undefined ? row[colKey] : ''}
                          onChange={(e) => handleCellChange(actualIdx, colKey, e.target.value)}
                          className="bg-transparent hover:bg-slate-500/10 focus:bg-slate-500/15 border border-transparent focus:border-amber-500/50 rounded px-2 py-1 text-xs w-full font-mono text-main outline-none transition-all"
                        />
                      </td>
                    ))}
                    <td className="p-2 text-center">
                      <button
                        onClick={() => handleDeleteRow(actualIdx)}
                        className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded"
                        title="Delete Row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredRows.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-xs">
              No matching records found for "{searchQuery}".
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-slate-700/30 bg-slate-900/40 flex items-center justify-between text-xs text-slate-400">
          <span>Showing {filteredRows.length} of {tableData.length} records • ({selectedRowIndices.size} selected for download)</span>
          <button
            onClick={handleSaveAndClose}
            className="btn-gold text-xs py-1.5 px-4 font-bold"
          >
            Save & Update Studio
          </button>
        </div>
      </div>
    </div>
  );
}
