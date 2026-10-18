// PulseCISC-32 Assembly Code Editor
import React, { useRef } from 'react';
import { PlayCircle, AlertCircle, HelpCircle } from 'lucide-react';
import type { AssemblyError } from '../core/types';

interface CodeEditorProps {
  code: string;
  onChange: (newCode: string) => void;
  onAssemble: () => void;
  activeLineIndex: number | null; // 0-indexed line currently pointed by EIP
  errors: AssemblyError[];
  onShowCheatsheet: () => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  code,
  onChange,
  onAssemble,
  activeLineIndex,
  errors,
  onShowCheatsheet,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lines = code.split('\n');

  // Error map for quick lookup (1-indexed to error)
  const errorMap = new Map<number, string>();
  for (const err of errors) {
    errorMap.set(err.line, err.message);
  }

  // Synchronize scroll between line numbers and textarea
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0b0f19] border-r border-slate-800 text-slate-100">
      {/* Editor Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/80 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-300 font-mono tracking-wide">
            x86 Assembly Source
          </span>
          {errors.length > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-rose-400 bg-rose-950/60 border border-rose-800/80 px-2 py-0.5 rounded-full font-mono">
              <AlertCircle className="w-3 h-3" />
              {errors.length} error{errors.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onShowCheatsheet}
            title="View x86 Instruction Cheatsheet"
            className="p-1 rounded text-slate-400 hover:text-sky-400 hover:bg-slate-800 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onAssemble}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-colors shadow-sm"
          >
            <PlayCircle className="w-3.5 h-3.5" />
            <span>Assemble & Load</span>
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="relative flex-1 flex overflow-hidden font-mono text-xs">
        {/* Line Numbers with active pointer */}
        <div
          ref={lineNumbersRef}
          className="w-12 py-3 bg-[#080c14] border-r border-slate-800/80 text-right select-none overflow-hidden"
        >
          {lines.map((_, idx) => {
            const lineNum = idx + 1;
            const isActive = activeLineIndex === idx;
            const hasError = errorMap.has(lineNum);

            return (
              <div
                key={idx}
                className={`relative px-2 h-5 flex items-center justify-end text-[11px] ${
                  isActive
                    ? 'text-sky-300 font-bold bg-sky-950/40'
                    : hasError
                    ? 'text-rose-400 bg-rose-950/40 font-bold'
                    : 'text-slate-600'
                }`}
              >
                {isActive && (
                  <span className="absolute left-1 text-sky-400 font-bold animate-pulse">
                    ▶
                  </span>
                )}
                <span>{lineNum}</span>
              </div>
            );
          })}
        </div>

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          spellCheck={false}
          className="flex-1 p-3 bg-transparent text-slate-200 resize-none focus:outline-none font-mono text-xs leading-5 whitespace-pre overflow-auto"
          style={{ lineHeight: '20px' }}
        />
      </div>

      {/* Errors Drawer (if any) */}
      {errors.length > 0 && (
        <div className="max-h-28 overflow-y-auto bg-rose-950/80 border-t border-rose-800/80 p-2 text-xs font-mono text-rose-300 select-text">
          <div className="font-semibold text-rose-200 mb-1 flex items-center gap-1 select-none">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>Assembler Diagnostics:</span>
          </div>
          {errors.map((err, i) => (
            <div key={i} className="pl-4 text-[11px] text-rose-300 cursor-text">
              • Line {err.line}: {err.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
