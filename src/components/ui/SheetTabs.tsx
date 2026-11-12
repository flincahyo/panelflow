"use client";

import React, { useState } from "react";
import {
  Copy,
  Edit2,
  FileCheck2,
  FileCode2,
  FileSpreadsheet,
  Plus,
  Trash2,
} from "lucide-react";
import { usePanelStore } from "@/store/usePanelStore";
import type { SheetType } from "@/types/panel";

export function SheetTabs() {
  const sheets = usePanelStore((s) => s.sheets);
  const activeSheetId = usePanelStore((s) => s.activeSheetId);
  const setActiveSheet = usePanelStore((s) => s.setActiveSheet);
  const addSheet = usePanelStore((s) => s.addSheet);
  const renameSheet = usePanelStore((s) => s.renameSheet);
  const duplicateSheet = usePanelStore((s) => s.duplicateSheet);
  const deleteSheet = usePanelStore((s) => s.deleteSheet);

  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [showTypeMenu, setShowTypeMenu] = useState(false);

  const startRename = (id: string, name: string) => {
    setEditingSheetId(id);
    setEditingName(name);
  };

  const finishRename = () => {
    if (editingSheetId && editingName.trim()) {
      renameSheet(editingSheetId, editingName.trim());
    }
    setEditingSheetId(null);
  };

  const getSheetIcon = (type: SheetType) => {
    switch (type) {
      case "door-cutout":
        return <FileSpreadsheet className="h-3.5 w-3.5 text-amber-400" />;
      case "schematic":
        return <FileCode2 className="h-3.5 w-3.5 text-emerald-400" />;
      default:
        return <FileCheck2 className="h-3.5 w-3.5 text-slate-300" />;
    }
  };

  return (
    <div className="relative flex h-9 w-full select-none items-center justify-between border-t border-white/10 bg-[#0c0e14] px-2.5 text-xs">
      <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar py-1">
        {sheets.map((sheet) => {
          const isActive = sheet.id === activeSheetId;
          const isEditing = sheet.id === editingSheetId;

          return (
            <div
              key={sheet.id}
              onClick={() => setActiveSheet(sheet.id)}
              className={`group flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-all cursor-pointer border ${
                isActive
                  ? "border-white/15 bg-[#171a21] text-white shadow-xs"
                  : "border-transparent bg-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              {getSheetIcon(sheet.sheetType)}

              {isEditing ? (
                <input
                  type="text"
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={finishRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") finishRename();
                    if (e.key === "Escape") setEditingSheetId(null);
                  }}
                  className="rounded bg-[#090b10] px-1.5 py-0.5 font-mono text-[11px] text-white outline-none ring-1 ring-white/30"
                />
              ) : (
                <span
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    startRename(sheet.id, sheet.name);
                  }}
                  className="font-medium text-[11px] whitespace-nowrap"
                  title="Double click to rename"
                >
                  {sheet.name}
                </span>
              )}

              <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  title="Rename Sheet"
                  onClick={(e) => {
                    e.stopPropagation();
                    startRename(sheet.id, sheet.name);
                  }}
                  className="rounded p-0.5 hover:bg-white/10 text-slate-400 hover:text-white"
                >
                  <Edit2 className="h-2.5 w-2.5" />
                </button>
                <button
                  type="button"
                  title="Duplicate Sheet"
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicateSheet(sheet.id);
                  }}
                  className="rounded p-0.5 hover:bg-white/10 text-slate-400 hover:text-white"
                >
                  <Copy className="h-2.5 w-2.5" />
                </button>
                {sheets.length > 1 && (
                  <button
                    type="button"
                    title="Delete Sheet"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSheet(sheet.id);
                    }}
                    className="rounded p-0.5 hover:bg-rose-950/60 text-slate-500 hover:text-rose-400"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowTypeMenu((v) => !v)}
            className="flex items-center gap-1 rounded-lg border border-dashed border-white/15 bg-[#171a21]/60 px-2 py-1 text-[11px] font-medium text-slate-300 hover:border-white/30 hover:bg-[#171a21] hover:text-white transition-colors"
          >
            <Plus className="h-3 w-3" /> New Sheet
          </button>

          {showTypeMenu && (
            <div
              className="absolute bottom-9 left-0 z-50 w-48 rounded-xl border border-white/10 bg-[#111318]/98 p-1 shadow-2xl backdrop-blur-xl text-xs"
              onMouseLeave={() => setShowTypeMenu(false)}
            >
              <button
                type="button"
                onClick={() => {
                  addSheet("mounting-plate");
                  setShowTypeMenu(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-slate-200 hover:bg-white/10 hover:text-white"
              >
                <FileCheck2 className="h-3.5 w-3.5 text-sky-400" />
                Mounting Plate (2D/3D)
              </button>
              <button
                type="button"
                onClick={() => {
                  addSheet("door-cutout");
                  setShowTypeMenu(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-slate-200 hover:bg-white/10 hover:text-white"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-amber-400" />
                Door Cutout Layout
              </button>
              <button
                type="button"
                onClick={() => {
                  addSheet("schematic");
                  setShowTypeMenu(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-slate-200 hover:bg-white/10 hover:text-white"
              >
                <FileCode2 className="h-3.5 w-3.5 text-emerald-400" />
                Schematic Diagram
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="hidden font-mono text-[10px] tabular-nums text-slate-500 sm:block">
        Sheet {sheets.findIndex((s) => s.id === activeSheetId) + 1} of{" "}
        {sheets.length}
      </div>
    </div>
  );
}
