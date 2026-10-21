// PulseCISC-32 Assembly Code Editor
import React, { useRef, useState } from 'react';
import {
  PlayCircle,
  AlertCircle,
  HelpCircle,
  Plus,
  BookmarkPlus,
  Pencil,
  Trash2,
  Check,
  X,
  RotateCcw,
  HardDriveDownload,
} from 'lucide-react';
import type { AssemblyError } from '../core/types';
import type { ProgramPreset } from '../samples/presets';

interface CodeEditorProps {
  code: string;
  onChange: (newCode: string) => void;
  onAssemble: () => void;
  activeLineIndex: number | null; // 0-indexed line currently pointed by EIP
  errors: AssemblyError[];
  onShowCheatsheet: () => void;
  currentProgram?: ProgramPreset;
  isDirtySample?: boolean;
  customProgramCount?: number;
  onCreateNewProgram?: (name: string, useCurrentCode: boolean) => void;
  onRenameCustomProgram?: (newName: string) => void;
  onDeleteCustomProgram?: () => void;
  onResetSampleCode?: () => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  code,
  onChange,
  onAssemble,
  activeLineIndex,
  errors,
  onShowCheatsheet,
  currentProgram,
  isDirtySample = false,
  customProgramCount = 0,
  onCreateNewProgram,
  onRenameCustomProgram,
  onDeleteCustomProgram,
  onResetSampleCode,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lines = code.split('\n');

  // Inline states for creating / renaming / deleting custom user programs
  const [barMode, setBarMode] = useState<'none' | 'create-blank' | 'save-copy' | 'rename' | 'confirm-delete'>('none');
  const [nameInput, setNameInput] = useState<string>('');

  const isCustom = Boolean(currentProgram?.isCustom);

  const openCreateBlank = () => {
    setNameInput(`My Program ${customProgramCount + 1}`);
    setBarMode('create-blank');
  };

  const openSaveCopy = () => {
    const baseName = currentProgram
      ? currentProgram.name.replace(/^\d+\.\s*/, '').split(' - ')[0].trim()
      : 'Custom Program';
    setNameInput(`${baseName} (Custom)`);
    setBarMode('save-copy');
  };

  const openRename = () => {
    if (!currentProgram) return;
    setNameInput(currentProgram.name);
    setBarMode('rename');
  };

  const handleConfirmBar = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim() || `My Program ${customProgramCount + 1}`;
    if (barMode === 'create-blank') {
      onCreateNewProgram?.(trimmed, false);
    } else if (barMode === 'save-copy') {
      onCreateNewProgram?.(trimmed, true);
    } else if (barMode === 'rename') {
      onRenameCustomProgram?.(trimmed);
    }
    setBarMode('none');
  };

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
      <div className="flex items-center justify-between gap-1.5 px-2.5 py-2 bg-slate-900/80 border-b border-slate-800">
        <div className="flex items-center gap-1.5 min-w-0">
          {isCustom ? (
            <span
              title="All changes to this custom program are automatically persisted in browser/app localStorage"
              className="flex items-center gap-1 text-[10px] text-emerald-300 bg-emerald-950/70 border border-emerald-700/60 px-2 py-0.5 rounded-full font-mono truncate"
            >
              <HardDriveDownload className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="truncate">{currentProgram?.name}</span>
              <span className="text-emerald-400/80 hidden sm:inline">• Saved</span>
            </span>
          ) : (
            <span className="text-xs font-semibold text-slate-300 font-mono tracking-wide truncate">
              x86 Source
            </span>
          )}

          {!isCustom && isDirtySample && (
            <span
              title="Your edits are persisted locally. Click 'Save Copy' to store as a permanent custom program."
              className="text-[10px] text-amber-300 bg-amber-950/60 border border-amber-700/60 px-1.5 py-0.5 rounded-full font-mono shrink-0"
            >
              Edited
            </span>
          )}

          {errors.length > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-rose-400 bg-rose-950/60 border border-rose-800/80 px-1.5 py-0.5 rounded-full font-mono shrink-0">
              <AlertCircle className="w-3 h-3" />
              {errors.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* + New Blank Custom Program */}
          {onCreateNewProgram && (
            <button
              type="button"
              onClick={openCreateBlank}
              title="Create a new custom assembly program (persisted locally)"
              className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700/80 text-[11px] font-medium transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>New</span>
            </button>
          )}

          {/* Save Current Code as Custom Program (when viewing a sample or wanting a copy) */}
          {onCreateNewProgram && !isCustom && (
            <button
              type="button"
              onClick={openSaveCopy}
              title="Save current editor code to My Saved Programs (persisted locally)"
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                isDirtySample
                  ? 'bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-500/50'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80'
              }`}
            >
              <BookmarkPlus className="w-3 h-3 text-emerald-400" />
              <span className="hidden sm:inline">Save Copy</span>
            </button>
          )}

          {/* Reset Sample to Default (when a built-in sample was edited) */}
          {!isCustom && isDirtySample && onResetSampleCode && (
            <button
              type="button"
              onClick={onResetSampleCode}
              title="Revert sample to original built-in code"
              className="p-1 rounded text-amber-400 hover:text-amber-200 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Rename & Delete actions for Custom Programs */}
          {isCustom && onRenameCustomProgram && (
            <button
              type="button"
              onClick={openRename}
              title="Rename this custom program"
              className="p-1 rounded text-slate-400 hover:text-sky-400 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}

          {isCustom && onDeleteCustomProgram && (
            <button
              type="button"
              onClick={() => setBarMode('confirm-delete')}
              title="Delete this custom program"
              className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={onShowCheatsheet}
            title="View x86 Instruction Cheatsheet"
            className="p-1 rounded text-slate-400 hover:text-sky-400 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onAssemble}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-colors shadow-sm cursor-pointer"
          >
            <PlayCircle className="w-3.5 h-3.5" />
            <span>Assemble</span>
          </button>
        </div>
      </div>

      {/* Inline Create / Save Copy / Rename / Delete Bar */}
      {barMode !== 'none' && (
        <div className="px-3 py-2 bg-slate-900 border-b border-sky-500/40 text-xs">
          {barMode === 'confirm-delete' ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-rose-300 font-medium truncate">
                Delete &ldquo;{currentProgram?.name}&rdquo;?
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    onDeleteCustomProgram?.();
                    setBarMode('none');
                  }}
                  className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold cursor-pointer"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setBarMode('none')}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleConfirmBar} className="flex items-center gap-1.5">
              <span className="text-[11px] text-sky-300 font-semibold shrink-0">
                {barMode === 'create-blank'
                  ? 'New Program:'
                  : barMode === 'save-copy'
                  ? 'Save Copy As:'
                  : 'Rename:'}
              </span>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Enter program name..."
                autoFocus
                className="flex-1 min-w-0 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500 font-mono"
              />
              <button
                type="submit"
                title="Save locally"
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer shrink-0"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
              <button
                type="button"
                onClick={() => setBarMode('none')}
                title="Cancel"
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
        </div>
      )}

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
