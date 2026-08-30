import React, { useState } from 'react';
import { X, Plus, Trash2, Check, FileSpreadsheet } from 'lucide-react';

export default function ManualDataEntryModal({ isOpen, onClose, initialRecords, initialColumns, onSave }) {
  const [columns, setColumns] = useState(
    initialColumns.length > 0 
      ? initialColumns 
      : ['first_name', 'middle_name', 'last_name', 'section', 'year', 'department', 'nickname', 'student_id']
  );

  const [records, setRecords] = useState(
    initialRecords.length > 0
      ? initialRecords
      : [
          { first_name: 'John', middle_name: 'A.', last_name: 'Doe', section: '3A', year: '2026', department: 'IT', nickname: 'Johnny', student_id: '1001' },
          { first_name: 'Jane', middle_name: 'B.', last_name: 'Smith', section: '3B', year: '2026', department: 'CS', nickname: '', student_id: '1002' }
        ]
  );

  const [newColumnName, setNewColumnName] = useState('');

  if (!isOpen) return null;

  const handleCellChange = (rowIndex, colName, value) => {
    const updated = [...records];
    updated[rowIndex] = { ...updated[rowIndex], [colName]: value };
    setRecords(updated);
  };

  const handleAddRow = () => {
    const newRow = {};
    columns.forEach(c => newRow[c] = '');
    setRecords([...records, newRow]);
  };

  const handleRemoveRow = (index) => {
    setRecords(records.filter((_, i) => i !== index));
  };

  const handleAddColumn = () => {
    const trimmed = newColumnName.trim().toLowerCase().replace(/\s+/g, '_');
    if (!trimmed || columns.includes(trimmed)) return;
    setColumns([...columns, trimmed]);
    setNewColumnName('');
  };

  const handleRemoveColumn = (colName) => {
    if (columns.length <= 1) return;
    setColumns(columns.filter(c => c !== colName));
  };

  const handleSave = () => {
    onSave(records, columns);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
      <div className="glass-panel-accent max-w-5xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold">Manual Data Grid & Column Editor</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="New column name..."
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              className="input-dark text-xs w-44"
              onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()}
            />
            <button onClick={handleAddColumn} className="btn-secondary text-xs py-1.5 px-3">
              <Plus className="w-3.5 h-3.5" />
              Add Column
            </button>
          </div>

          <button onClick={handleAddRow} className="btn-secondary text-xs py-1.5 px-3">
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            Add Row
          </button>
        </div>

        {/* Editable Spreadsheet Table */}
        <div className="flex-1 overflow-auto p-4">
          <table className="spreadsheet-table">
            <thead>
              <tr>
                <th className="w-12 text-center">#</th>
                {columns.map((col) => (
                  <th key={col}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-indigo-300">{col}</span>
                      {columns.length > 1 && (
                        <button
                          onClick={() => handleRemoveColumn(col)}
                          className="text-gray-500 hover:text-red-400"
                          title="Remove Column"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                <th className="w-12 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {records.map((row, rIdx) => (
                <tr key={rIdx}>
                  <td className="text-center font-semibold text-slate-500 text-xs">{rIdx + 1}</td>
                  {columns.map((col) => (
                    <td key={col}>
                      <input
                        type="text"
                        value={row[col] || ''}
                        onChange={(e) => handleCellChange(rIdx, col, e.target.value)}
                        className="bg-transparent text-xs text-white border border-transparent hover:border-slate-700 focus:border-indigo-500 rounded px-2 py-1 w-full outline-none"
                      />
                    </td>
                  ))}
                  <td className="text-center">
                    <button
                      onClick={() => handleRemoveRow(rIdx)}
                      className="text-gray-500 hover:text-red-400 p-1"
                      title="Delete Row"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[var(--border-color)] bg-slate-950/80 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary text-xs">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary text-xs">
            <Check className="w-4 h-4" />
            Apply & Save Data ({records.length} Rows)
          </button>
        </div>
      </div>
    </div>
  );
}
