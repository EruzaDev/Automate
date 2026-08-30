import React, { useState } from 'react';
import { Search, Plus, Trash2, X, Download, Save, Table } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function CSVDataEditorModal({ isOpen, onClose, rows, onSaveRows }) {
  if (!isOpen) return null;

  const [tableData, setTableData] = useState(() => JSON.parse(JSON.stringify(rows || [])));
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCell, setEditingCell] = useState(null); // { rowIndex, colKey }

  const headers = tableData.length > 0
    ? Object.keys(tableData[0])
    : ['first_name', 'middle_name', 'last_name', 'Course', 'Year', 'Section', 'Code'];

  // Search Filter
  const filteredRows = tableData.filter((row, idx) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return Object.values(row).some((val) => String(val).toLowerCase().includes(q));
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-2">
            <Table className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold text-white">CSV / Data Table Editor</h3>
            <span className="text-xs text-slate-400 font-mono">({tableData.length} records)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="btn-secondary text-xs py-1.5 px-3 border-indigo-500/40 text-indigo-300"
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
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Actions Bar */}
        <div className="p-3 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between gap-4">
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

          <button
            onClick={handleAddRow}
            className="btn-secondary text-xs py-1.5 px-3 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" /> Add Row
          </button>
        </div>

        {/* Scrollable Data Table View */}
        <div className="flex-1 overflow-auto p-4">
          <table className="w-full text-xs text-left text-slate-300 border-collapse">
            <thead className="text-[11px] text-slate-400 uppercase bg-slate-950 sticky top-0 z-10 border-b border-slate-800">
              <tr>
                <th className="p-2 font-mono text-center w-12">#</th>
                {headers.map((h) => (
                  <th key={h} className="p-2 font-bold font-mono text-amber-300 min-w-[120px]">
                    {h}
                  </th>
                ))}
                <th className="p-2 text-center w-12">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredRows.map((row, filteredIdx) => {
                const actualIdx = tableData.indexOf(row);
                return (
                  <tr key={actualIdx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-2 text-center font-mono text-slate-500">{actualIdx + 1}</td>
                    {headers.map((colKey) => (
                      <td key={colKey} className="p-1 min-w-[120px]">
                        <input
                          type="text"
                          value={row[colKey] !== undefined ? row[colKey] : ''}
                          onChange={(e) => handleCellChange(actualIdx, colKey, e.target.value)}
                          className="bg-transparent hover:bg-slate-950 focus:bg-slate-950 border border-transparent focus:border-amber-400/50 rounded px-2 py-1 text-xs w-full font-mono text-slate-200 outline-none transition-all"
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
            <div className="p-8 text-center text-slate-500 text-xs">
              No matching records found for "{searchQuery}".
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
          <span>Showing {filteredRows.length} of {tableData.length} records</span>
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
