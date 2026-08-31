import React, { useState, useEffect, useRef } from 'react';
import { Tag, X, Search, Trophy, Check, Eye, LayoutTemplate } from 'lucide-react';
import { evaluateFieldText } from '../../utils/multiColumnEvaluator';
import { stripRichTextFormatting } from '../../utils/richTextParser';

export default function DynamicTagModal({
  isOpen,
  onClose,
  headers = [],
  initialTemplate = '',
  onApplyTemplate,
  previewRow = {},
  enableTabulationTags = false
}) {
  const [templateText, setTemplateText] = useState(initialTemplate);
  const [searchTerm, setSearchTerm] = useState('');
  const [separator, setSeparator] = useState(' ');
  const [useInitial, setUseInitial] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTemplateText(stripRichTextFormatting(initialTemplate || ''));
    }
  }, [isOpen, initialTemplate]);

  if (!isOpen) return null;

  const separatorsList = [
    { label: 'Space', value: ' ', icon: '␣' },
    { label: 'Comma ( , )', value: ', ', icon: ',' },
    { label: 'Dash ( - )', value: ' - ', icon: '-' },
    { label: 'Slash ( / )', value: ' / ', icon: '/' },
    { label: 'Newline', value: '\n', icon: '↵' },
    { label: 'None', value: '', icon: '∅' }
  ];

  const filteredHeaders = headers.filter((h) =>
    h.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleInsertTagToEditor = (rawTag) => {
    let finalTag = rawTag;
    if (useInitial && rawTag.startsWith('{') && rawTag.endsWith('}') && !rawTag.includes('_initial')) {
      const inner = rawTag.slice(1, -1);
      finalTag = `{${inner}_initial}`;
    }

    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart || templateText.length;
      const end = textareaRef.current.selectionEnd || templateText.length;
      const before = templateText.substring(0, start);
      const after = templateText.substring(end);

      let textToInsert = finalTag;
      const effectiveSep = separator !== undefined ? separator : ' ';
      if (before.length > 0 && !/\s$/.test(before) && effectiveSep) {
        textToInsert = effectiveSep + textToInsert;
      }
      if (after.length > 0 && !/^\s/.test(after) && effectiveSep) {
        textToInsert = textToInsert + effectiveSep;
      }

      const newText = before + textToInsert + after;
      setTemplateText(newText);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const nextPos = start + textToInsert.length;
          textareaRef.current.setSelectionRange(nextPos, nextPos);
        }
      }, 0);
    } else {
      let textToInsert = finalTag;
      const effectiveSep = separator !== undefined ? separator : ' ';
      if (templateText.length > 0 && !/\s$/.test(templateText) && effectiveSep) {
        textToInsert = effectiveSep + textToInsert;
      }
      setTemplateText((prev) => prev + textToInsert);
    }
  };

  const evaluatedPreview = evaluateFieldText(
    { isCustomMessage: true, customTemplate: templateText },
    previewRow
  );

  const handleApply = () => {
    if (onApplyTemplate) {
      onApplyTemplate(stripRichTextFormatting(templateText));
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-100 flex items-center gap-2">
                Dynamic Text Layout & Tags
              </h2>
              <p className="text-xs text-slate-400">
                Build text templates with live evaluated record preview
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Template Editor & Record Preview Box */}
        <div className="p-4 bg-slate-950/90 border-b border-slate-800 space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <LayoutTemplate className="w-3.5 h-3.5 text-amber-400" /> Text Layout Template:
            </label>
            <textarea
              ref={textareaRef}
              value={templateText}
              onChange={(e) => setTemplateText(e.target.value)}
              placeholder="Click dynamic tags below or type text layout here..."
              rows={2}
              className="input-dark py-2 px-3 text-xs font-mono text-amber-300 w-full resize-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Live Record Evaluated Preview Card */}
          <div className="p-2.5 rounded-xl bg-slate-900 border border-emerald-500/30 space-y-1 shadow-inner">
            <div className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1">
              <Eye className="w-3.5 h-3.5 text-emerald-400" /> Live Record Evaluated Preview:
            </div>
            <div className="text-xs text-slate-100 font-medium break-words leading-relaxed min-h-[1.25rem]">
              {evaluatedPreview ? (
                <span className="font-semibold text-slate-100">{evaluatedPreview}</span>
              ) : (
                <span className="text-slate-500 italic text-[11px]">(No template text entered yet)</span>
              )}
            </div>
          </div>

          {/* Search Box & Tag Options */}
          <div className="relative flex items-center pt-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none z-10" />
            <input
              type="text"
              placeholder="Search tag name (e.g. first_name, grade)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-dark py-1.5 text-xs w-full font-mono text-amber-300"
              style={{ paddingLeft: '2.25rem' }}
            />
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
            {/* Separator Picker */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400">Separator:</span>
              <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                {separatorsList.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => setSeparator(s.value)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                      separator === s.value
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title={`Separator: ${s.label}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Initial Toggle */}
            <label className="flex items-center gap-1.5 cursor-pointer text-indigo-300 font-bold text-[11px] bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20 hover:bg-indigo-500/20 transition">
              <input
                type="checkbox"
                checked={useInitial}
                onChange={(e) => setUseInitial(e.target.checked)}
                className="rounded accent-indigo-500 cursor-pointer"
              />
              🔤 Make Initial (M.I.)
            </label>
          </div>
        </div>

        {/* Content Body: Tag Badges */}
        <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          {/* Award / Tabulation Tags */}
          {enableTabulationTags && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5" /> Award & Ranking Tags:
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleInsertTagToEditor('{rank_title}')}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 text-xs font-mono font-bold text-amber-300 border border-amber-500/40 flex items-center gap-1 transition"
                >
                  🏆 {'{rank_title}'}
                </button>
                <button
                  onClick={() => handleInsertTagToEditor('{rank}')}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 text-xs font-mono font-bold text-amber-300 border border-amber-500/40 flex items-center gap-1 transition"
                >
                  🏅 {'{rank}'}
                </button>
                <button
                  onClick={() => handleInsertTagToEditor('{score}')}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 text-xs font-mono font-bold text-amber-300 border border-amber-500/40 flex items-center gap-1 transition"
                >
                  ⭐ {'{score}'}
                </button>
              </div>
            </div>
          )}

          {/* Dataset Columns Tags */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>Spreadsheet Header Tags:</span>
              <span className="text-[10px] text-slate-500 font-mono">
                {filteredHeaders.length} columns available
              </span>
            </div>

            {filteredHeaders.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs italic">
                {headers.length === 0
                  ? 'No CSV/Excel file loaded yet. Upload a data file to see custom header tags.'
                  : `No tags match "${searchTerm}"`}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {filteredHeaders.map((h) => (
                  <button
                    key={h}
                    onClick={() => handleInsertTagToEditor(`{${h}}`)}
                    className="p-2.5 rounded-xl bg-slate-950 hover:bg-amber-500/15 border border-slate-800 hover:border-amber-500/40 text-left transition flex items-center justify-between group"
                  >
                    <span className="font-mono text-xs text-amber-300 font-semibold truncate">
                      {useInitial ? `{${h}_initial}` : `{${h}}`}
                    </span>
                    <span className="text-[10px] text-slate-500 group-hover:text-amber-400 transition">
                      +Add Tag
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer: Action Buttons */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition font-semibold"
          >
            Cancel
          </button>

          <button
            onClick={handleApply}
            className="px-5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-md flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" /> Apply to Canvas Field
          </button>
        </div>
      </div>
    </div>
  );
}
