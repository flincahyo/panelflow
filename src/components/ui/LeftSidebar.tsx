"use client";

import {
  BookmarkPlus,
  Box,
  Check,
  ChevronDown,
  Clock,
  Cpu,
  FileUp,
  Image as ImageIcon,
  Layers,
  MapPin,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState, type ChangeEvent } from "react";
import { CadPreviewThumbnail } from "@/components/ui/CadPreviewThumbnail";
import { ImageToCadModal } from "@/components/modals/ImageToCadModal";
import {
  COMPONENT_CATALOG,
  COMPONENT_CATEGORIES,
  COMPONENT_LIST,
} from "@/lib/components-catalog";
import { parseDxfToMmSegments } from "@/lib/dxf-parser";
import {
  listCustomCadLibrary,
  removeCustomCadFromLibrary,
  renameCustomCadInLibrary,
  saveCustomCadToLibrary,
  updateCustomCadCloudId,
  type CustomLibraryCadItem,
} from "@/lib/indexed-db";
import { getBackplateDimensions } from "@/lib/template-export";
import { formatDim, fromMm, inputStepForUnit, toMm } from "@/lib/units";
import { usePanelStore } from "@/store/usePanelStore";
import type {
  CadFormat,
  CadImportUnit,
  ComponentCategory,
  ComponentTemplateId,
  CustomCadAsset,
} from "@/types/panel";

type TabId = "components" | "rails" | "enclosure" | "cad";

function PartVectorIcon({
  templateId,
  accentColor,
}: {
  templateId: ComponentTemplateId;
  accentColor: string;
}) {
  switch (templateId) {
    case "mcb-1p":
    case "fuse-1p":
      return (
        <svg viewBox="0 0 36 44" className="h-9 w-9">
          <rect x="10" y="4" width="16" height="36" rx="2" fill="#1e222d" stroke="#475569" strokeWidth="1.3" />
          <circle cx="18" cy="8" r="1.8" fill="#94a3b8" />
          <circle cx="18" cy="36" r="1.8" fill="#94a3b8" />
          <rect x="13" y="17" width="10" height="9" rx="1.2" fill={accentColor} />
          <line x1="18" y1="12" x2="18" y2="17" stroke="#64748b" strokeWidth="1" />
        </svg>
      );
    case "mcb-2p":
      return (
        <svg viewBox="0 0 42 44" className="h-9 w-9">
          <rect x="7" y="4" width="28" height="36" rx="2" fill="#1e222d" stroke="#475569" strokeWidth="1.3" />
          <line x1="21" y1="4" x2="21" y2="40" stroke="#334155" strokeWidth="0.9" />
          <circle cx="14" cy="8" r="1.6" fill="#94a3b8" />
          <circle cx="28" cy="8" r="1.6" fill="#94a3b8" />
          <circle cx="14" cy="36" r="1.6" fill="#94a3b8" />
          <circle cx="28" cy="36" r="1.6" fill="#94a3b8" />
          <rect x="10" y="18" width="22" height="7" rx="1.2" fill={accentColor} />
        </svg>
      );
    case "mcb-3p":
    case "mcb-4p":
    case "spd-3pn":
      return (
        <svg viewBox="0 0 48 44" className="h-9 w-9">
          <rect x="4" y="4" width="40" height="36" rx="2" fill="#1e222d" stroke="#475569" strokeWidth="1.3" />
          <line x1="17" y1="4" x2="17" y2="40" stroke="#334155" strokeWidth="0.9" />
          <line x1="31" y1="4" x2="31" y2="40" stroke="#334155" strokeWidth="0.9" />
          <circle cx="10.5" cy="8" r="1.6" fill="#94a3b8" />
          <circle cx="24" cy="8" r="1.6" fill="#94a3b8" />
          <circle cx="37.5" cy="8" r="1.6" fill="#94a3b8" />
          <circle cx="10.5" cy="36" r="1.6" fill="#94a3b8" />
          <circle cx="24" cy="36" r="1.6" fill="#94a3b8" />
          <circle cx="37.5" cy="36" r="1.6" fill="#94a3b8" />
          <rect x="8" y="18" width="32" height="7" rx="1.2" fill={accentColor} />
        </svg>
      );
    case "mccb-100a":
      return (
        <svg viewBox="0 0 48 48" className="h-9 w-9">
          <rect x="8" y="3" width="32" height="42" rx="3" fill="#1e293b" stroke="#475569" strokeWidth="1.4" />
          <rect x="18" y="15" width="12" height="16" rx="2" fill="#0f172a" stroke={accentColor} strokeWidth="1.2" />
          <rect x="20" y="20" width="8" height="6" rx="1" fill={accentColor} />
          <circle cx="14" cy="7" r="1.6" fill="#94a3b8" />
          <circle cx="24" cy="7" r="1.6" fill="#94a3b8" />
          <circle cx="34" cy="7" r="1.6" fill="#94a3b8" />
          <circle cx="14" cy="41" r="1.6" fill="#94a3b8" />
          <circle cx="24" cy="41" r="1.6" fill="#94a3b8" />
          <circle cx="34" cy="41" r="1.6" fill="#94a3b8" />
        </svg>
      );
    case "contactor":
    case "tor":
      return (
        <svg viewBox="0 0 46 44" className="h-9 w-9">
          <rect x="5" y="4" width="36" height="36" rx="2.5" fill="#1e222d" stroke="#475569" strokeWidth="1.3" />
          <rect x="9" y="13" width="28" height="18" rx="1.5" fill="#0f172a" stroke={accentColor} strokeWidth="1.1" />
          <rect x="17" y="18" width="12" height="8" rx="1" fill={accentColor} fillOpacity="0.8" />
          <circle cx="11" cy="8" r="1.5" fill="#94a3b8" />
          <circle cx="19" cy="8" r="1.5" fill="#94a3b8" />
          <circle cx="27" cy="8" r="1.5" fill="#94a3b8" />
          <circle cx="35" cy="8" r="1.5" fill="#94a3b8" />
          <circle cx="11" cy="36" r="1.5" fill="#94a3b8" />
          <circle cx="19" cy="36" r="1.5" fill="#94a3b8" />
          <circle cx="27" cy="36" r="1.5" fill="#94a3b8" />
          <circle cx="35" cy="36" r="1.5" fill="#94a3b8" />
        </svg>
      );
    case "relay":
    case "timer-relay":
      return (
        <svg viewBox="0 0 36 44" className="h-9 w-9">
          <rect x="8" y="5" width="20" height="34" rx="2" fill="#1e222d" stroke="#475569" strokeWidth="1.3" />
          <rect x="11" y="12" width="14" height="20" rx="1.5" fill="#0f172a" stroke={accentColor} strokeWidth="1" />
          <circle cx="18" cy="18" r="2.6" fill={accentColor} />
          <line x1="14" y1="25" x2="22" y2="25" stroke="#64748b" strokeWidth="1.2" />
        </svg>
      );
    case "plc-compact":
      return (
        <svg viewBox="0 0 48 44" className="h-9 w-9">
          <rect x="4" y="6" width="40" height="32" rx="2.5" fill="#1e293b" stroke="#475569" strokeWidth="1.3" />
          <rect x="7" y="9" width="34" height="4" rx="1" fill="#0f172a" />
          <rect x="7" y="31" width="34" height="4" rx="1" fill="#0f172a" />
          <circle cx="11" cy="20" r="1.8" fill="#22c55e" />
          <circle cx="16" cy="20" r="1.8" fill={accentColor} />
          <text x="22" y="22.5" fontSize="6" fontFamily="monospace" fill="#cbd5e1" fontWeight="bold">PLC</text>
        </svg>
      );
    case "vfd-15kw":
      return (
        <svg viewBox="0 0 42 48" className="h-9 w-9">
          <rect x="8" y="3" width="26" height="42" rx="2.5" fill="#1e293b" stroke="#475569" strokeWidth="1.3" />
          <rect x="12" y="8" width="18" height="10" rx="1.2" fill="#0f172a" stroke={accentColor} strokeWidth="1" />
          <circle cx="21" cy="27" r="4" fill="#334155" stroke={accentColor} strokeWidth="1" />
          <text x="14" y="15" fontSize="5" fontFamily="monospace" fill="#38bdf8" fontWeight="bold">50.0</text>
        </svg>
      );
    case "terminal-block":
    case "terminal-n":
    case "terminal-pe":
    case "end-clamp":
      return (
        <svg viewBox="0 0 36 44" className="h-9 w-9">
          <rect x="12" y="5" width="12" height="34" rx="1.5" fill="#1e222d" stroke={accentColor} strokeWidth="1.3" />
          <circle cx="18" cy="11" r="2" fill="#94a3b8" />
          <circle cx="18" cy="33" r="2" fill="#94a3b8" />
          <line x1="18" y1="13" x2="18" y2="31" stroke={accentColor} strokeWidth="1.5" />
        </svg>
      );
    case "psu-24v":
    case "psu-24v-10a":
    case "dist-block-4p":
      return (
        <svg viewBox="0 0 48 44" className="h-9 w-9">
          <rect x="5" y="4" width="38" height="36" rx="2.5" fill="#1e222d" stroke="#475569" strokeWidth="1.3" />
          <line x1="10" y1="12" x2="38" y2="12" stroke="#334155" strokeWidth="1" />
          <line x1="10" y1="16" x2="38" y2="16" stroke="#334155" strokeWidth="1" />
          <line x1="10" y1="20" x2="38" y2="20" stroke="#334155" strokeWidth="1" />
          <circle cx="34" cy="29" r="2.5" fill={accentColor} />
          <text x="10" y="31" fontSize="6.5" fontFamily="monospace" fill="#cbd5e1" fontWeight="bold">
            {templateId === "dist-block-4p" ? "DIST" : "24V"}
          </text>
        </svg>
      );
    case "pilot-lamp-red":
    case "pilot-lamp-green":
    case "pilot-lamp-yellow":
    case "push-button":
    case "e-stop":
    case "selector-3pos":
    case "cam-lock":
      return (
        <svg viewBox="0 0 40 40" className="h-9 w-9">
          <circle cx="20" cy="20" r="14" fill={templateId === "e-stop" ? "#facc15" : "#1e293b"} stroke="#475569" strokeWidth="1.5" />
          <circle cx="20" cy="20" r="9" fill={accentColor} stroke="#0f172a" strokeWidth="1.2" />
          {templateId === "selector-3pos" && (
            <line x1="14" y1="14" x2="26" y2="26" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
          )}
          {templateId === "cam-lock" && (
            <rect x="18" y="13" width="4" height="14" rx="1" fill="#ffffff" />
          )}
        </svg>
      );
    case "panel-meter-96":
      return (
        <svg viewBox="0 0 44 44" className="h-9 w-9">
          <rect x="5" y="5" width="34" height="34" rx="2.5" fill="#0f172a" stroke="#475569" strokeWidth="1.4" />
          <rect x="9" y="10" width="26" height="16" rx="1" fill="#0284c7" fillOpacity="0.25" stroke={accentColor} strokeWidth="1" />
          <text x="12" y="21" fontSize="6.5" fontFamily="monospace" fill="#38bdf8" fontWeight="bold">400V</text>
        </svg>
      );
    case "cooling-fan-120":
      return (
        <svg viewBox="0 0 44 44" className="h-9 w-9">
          <rect x="5" y="5" width="34" height="34" rx="2.5" fill="#1e293b" stroke="#475569" strokeWidth="1.4" />
          <circle cx="22" cy="22" r="12" fill="#0f172a" stroke="#64748b" strokeWidth="1" />
          <circle cx="22" cy="22" r="3.5" fill={accentColor} />
          <line x1="22" y1="11" x2="22" y2="33" stroke="#94a3b8" strokeWidth="1.5" />
          <line x1="11" y1="22" x2="33" y2="22" stroke="#94a3b8" strokeWidth="1.5" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 36 44" className="h-9 w-9">
          <rect x="8" y="6" width="20" height="32" rx="2" fill="#1e222d" stroke={accentColor} strokeWidth="1.3" />
        </svg>
      );
  }
}

export function LeftSidebar() {
  const [activeTab, setActiveTab] = useState<TabId>("components");
  const [searchQuery, setSearchQuery] = useState("");
  const [cadImportUnit, setCadImportUnit] = useState<CadImportUnit>("mm");
  const [railsOpen, setRailsOpen] = useState(true);
  const [ductsOpen, setDuctsOpen] = useState(true);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    Favorites: true,
    "Recent Symbols": true,
    "Protection & Switchgear": true,
    "Control & Automation": true,
    "Power & Distribution": true,
    "Terminals & DIN Accessories": true,
    "Door & Panel Controls": true,
    "My CAD Library": true,
  });
  const [customLibrary, setCustomLibrary] = useState<CustomLibraryCadItem[]>([]);
  const [savedToastId, setSavedToastId] = useState<string | null>(null);
  const [editingLibraryId, setEditingLibraryId] = useState<string | null>(null);
  const [editingLibraryName, setEditingLibraryName] = useState("");
  const [editingCadId, setEditingCadId] = useState<string | null>(null);
  const [editingCadName, setEditingCadName] = useState("");
  const [showImageToCadModal, setShowImageToCadModal] = useState(false);

  const hydratePartPreferences = usePanelStore((s) => s.hydratePartPreferences);

  useEffect(() => {
    hydratePartPreferences();
    const reloadLibrary = () => {
      listCustomCadLibrary()
        .then((items) => setCustomLibrary(items))
        .catch(() => {
          // IndexedDB unavailable
        });
    };
    reloadLibrary();

    if (typeof window !== "undefined") {
      window.addEventListener("panelflow:custom-library-updated", reloadLibrary);
      return () => {
        window.removeEventListener("panelflow:custom-library-updated", reloadLibrary);
      };
    }
  }, [hydratePartPreferences]);

  const displayUnit = usePanelStore((s) => s.displayUnit);
  const enclosure = usePanelStore((s) => s.enclosure);
  const plateConfig = usePanelStore((s) => s.plateConfig);
  const rails = usePanelStore((s) => s.rails);
  const ducts = usePanelStore((s) => s.ducts);
  const cadAssets = usePanelStore((s) => s.cadAssets);
  const selected = usePanelStore((s) => s.selected);
  const isPinMarkingMode = usePanelStore((s) => s.isPinMarkingMode);
  const activeMarkingAssetId = usePanelStore((s) => s.activeMarkingAssetId);

  const updateEnclosure = usePanelStore((s) => s.updateEnclosure);
  const updatePlateConfig = usePanelStore((s) => s.updatePlateConfig);
  const setSelected = usePanelStore((s) => s.setSelected);
  const addRail = usePanelStore((s) => s.addRail);
  const removeRail = usePanelStore((s) => s.removeRail);
  const addDuct = usePanelStore((s) => s.addDuct);
  const removeDuct = usePanelStore((s) => s.removeDuct);
  const addComponent = usePanelStore((s) => s.addComponent);
  const leftSidebarOpen = usePanelStore((s) => s.leftSidebarOpen);
  const setLeftSidebarOpen = usePanelStore((s) => s.setLeftSidebarOpen);
  const recentPartIds = usePanelStore((s) => s.recentPartIds);
  const favoritePartIds = usePanelStore((s) => s.favoritePartIds);
  const toggleFavoritePart = usePanelStore((s) => s.toggleFavoritePart);
  const addCadAsset = usePanelStore((s) => s.addCadAsset);
  const updateCadAsset = usePanelStore((s) => s.updateCadAsset);
  const removeCadAsset = usePanelStore((s) => s.removeCadAsset);
  const setPinMarkingMode = usePanelStore((s) => s.setPinMarkingMode);

  const { widthMm: plateW, heightMm: plateH } = getBackplateDimensions(
    enclosure,
    plateConfig
  );
  const step = inputStepForUnit(displayUnit);

  const q = searchQuery.trim().toLowerCase();
  const filteredComponents = COMPONENT_LIST.filter(
    (c) =>
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.shortName.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
  );
  const favoriteItems = favoritePartIds
    .map((id) => COMPONENT_CATALOG[id])
    .filter(
      (c): c is NonNullable<typeof c> =>
        Boolean(c) &&
        (!q ||
          c.name.toLowerCase().includes(q) ||
          c.shortName.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q))
    );
  const recentItems = recentPartIds
    .map((id) => COMPONENT_CATALOG[id])
    .filter(
      (c): c is NonNullable<typeof c> =>
        Boolean(c) &&
        (!q ||
          c.name.toLowerCase().includes(q) ||
          c.shortName.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q))
    );
  const filteredRails = rails.filter(
    (r) => !q || r.name.toLowerCase().includes(q)
  );
  const filteredDucts = ducts.filter(
    (d) => !q || d.name.toLowerCase().includes(q)
  );
  const filteredCad = cadAssets.filter(
    (a) =>
      !q ||
      a.name.toLowerCase().includes(q) ||
      a.fileName.toLowerCase().includes(q)
  );
  const filteredLibrary = customLibrary.filter(
    (item) =>
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.fileName.toLowerCase().includes(q) ||
      item.format.toLowerCase().includes(q)
  );

  const toggleCategory = (cat: string) => {
    setOpenCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handleSaveToLibrary = async (asset: CustomCadAsset) => {
    try {
      const saved = await saveCustomCadToLibrary(asset);
      setCustomLibrary((prev) => {
        const idx = prev.findIndex((i) => i.id === saved.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [saved, ...prev];
      });

      // If user is logged in, also sync custom part to PostgreSQL cloud
      fetch("/api/custom-parts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: asset.name,
          format: asset.format,
          bounding_box: asset.cropMm
            ? { ...asset.boundingBoxMm, cropMm: asset.cropMm }
            : asset.boundingBoxMm,
          pins: asset.pins,
          cad_data: asset.rawText || asset.dataUrl || null,
        }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          const cloudId = data?.part?.id;
          if (typeof cloudId === "string" && cloudId) {
            updateCustomCadCloudId(saved.id, cloudId).catch(() => {});
            setCustomLibrary((prev) =>
              prev.map((i) => (i.id === saved.id ? { ...i, cloudId } : i))
            );
          }
        })
        .catch(() => {});

      setSavedToastId(asset.id);
      setTimeout(() => {
        setSavedToastId((curr) => (curr === asset.id ? null : curr));
      }, 1800);
    } catch {
      // ignore
    }
  };

  const handleDeleteFromLibrary = async (item: CustomLibraryCadItem) => {
    try {
      await removeCustomCadFromLibrary(item.id);
      setCustomLibrary((prev) => prev.filter((i) => i.id !== item.id));
      const remoteId = item.cloudId ?? item.id;
      fetch(`/api/custom-parts?id=${encodeURIComponent(remoteId)}`, {
        method: "DELETE",
      }).catch(() => {});
    } catch {
      // ignore
    }
  };

  const handleRenameLibraryItem = async (item: CustomLibraryCadItem) => {
    const trimmed = editingLibraryName.trim();
    setEditingLibraryId(null);
    if (!trimmed || trimmed === item.name) return;

    try {
      const updated = await renameCustomCadInLibrary(item.id, trimmed);
      setCustomLibrary((prev) =>
        prev.map((i) =>
          i.id === item.id ? updated ?? { ...i, name: trimmed } : i
        )
      );
      const remoteId = item.cloudId ?? item.id;
      fetch("/api/custom-parts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: remoteId, name: trimmed }),
      }).catch(() => {});
    } catch {
      // ignore
    }
  };

  const handleRenameCadAsset = (asset: CustomCadAsset) => {
    const trimmed = editingCadName.trim();
    setEditingCadId(null);
    if (!trimmed || trimmed === asset.name) return;
    updateCadAsset(asset.id, { name: trimmed });
  };

  const handleInstantiateFromLibrary = (item: CustomLibraryCadItem) => {
    const uid = `cad-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newAsset: CustomCadAsset = {
      id: uid,
      name: item.name,
      fileName: item.fileName,
      format: item.format,
      sourceUnit: item.sourceUnit,
      xMm: 0,
      yMm: 0,
      zMm: Math.max(10, item.boundingBoxMm.d / 2),
      boundingBoxMm: { ...item.boundingBoxMm },
      cropMm: item.cropMm ? { ...item.cropMm } : undefined,
      pins: item.pins.map((p, idx) => ({
        ...p,
        id: `${uid}-pin-${idx + 1}`,
      })),
      rawText: item.rawText,
      dataUrl: item.dataUrl,
      objectUrl: item.dataUrl,
      imageOverlayUrl: item.imageOverlayUrl,
      showImageOverlay: item.showImageOverlay,
      imageOpacity: item.imageOpacity,
      lockAspectRatio: item.lockAspectRatio,
      entityCount: item.entityCount,
      parseWarning: item.parseWarning,
    };
    addCadAsset(newAsset);
  };

  const handleCadUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["glb", "gltf", "obj", "dxf"].includes(ext)) return;

    const format = ext as CadFormat;
    const id = `cad-${Date.now()}`;
    const baseAsset: CustomCadAsset = {
      id,
      name: file.name.replace(/\.[^.]+$/, ""),
      fileName: file.name,
      format,
      sourceUnit: cadImportUnit,
      xMm: 0,
      yMm: 0,
      zMm: 30,
      boundingBoxMm: { w: 50, h: 50, d: 20 },
      pins: [],
    };

    if (format === "glb" || format === "gltf") {
      baseAsset.objectUrl = URL.createObjectURL(file);
      baseAsset.dataUrl = await new Promise<string | undefined>((resolve) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve(typeof reader.result === "string" ? reader.result : undefined);
        reader.onerror = () => resolve(undefined);
        reader.readAsDataURL(file);
      });
    } else {
      baseAsset.rawText = await file.text();
      if (format === "dxf") {
        const parsed = parseDxfToMmSegments(baseAsset.rawText, cadImportUnit);
        baseAsset.boundingBoxMm = parsed.boundingBoxMm;
        baseAsset.entityCount = parsed.entityCount;
        baseAsset.parseWarning = parsed.warning;
      }
    }

    addCadAsset(baseAsset);
    e.target.value = "";
  };

  const tabs: { id: TabId; label: string; icon: typeof Box }[] = [
    { id: "components", label: "Parts", icon: Cpu },
    { id: "rails", label: "Rails", icon: Layers },
    { id: "enclosure", label: "Plate", icon: Box },
    { id: "cad", label: "CAD", icon: FileUp },
  ];

  const handleAddComponent = (templateId: ComponentTemplateId) => {
    addComponent(templateId);
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setLeftSidebarOpen(false);
    }
  };

  if (!leftSidebarOpen) {
    return null;
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] md:hidden"
        onClick={() => setLeftSidebarOpen(false)}
        aria-hidden="true"
      />
      <aside className="fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-[320px] flex-col border-r border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#0c0e14]/95 text-[#0f172a] dark:text-slate-200 shadow-2xl backdrop-blur-xl md:relative md:inset-y-auto md:left-auto md:z-auto md:w-[300px] md:max-w-none md:shrink-0 md:translate-x-0 md:shadow-none md:bg-[#f8fafc] md:dark:bg-[#0c0e14]/90">
        {/* Mobile Drawer Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] dark:border-white/10 px-3 py-2 md:hidden">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            <span className="text-xs font-semibold tracking-tight text-[#0f172a] dark:text-white">
              Parts &amp; Library
            </span>
          </div>
          <button
            type="button"
            onClick={() => setLeftSidebarOpen(false)}
            aria-label="Close Parts Drawer"
            className="rounded-lg p-1.5 text-[#64748b] dark:text-slate-400 hover:bg-[#e2e8f0] dark:hover:bg-white/10 hover:text-[#0f172a] dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* Search Bar Pill */}
      <div className="p-2.5 pb-2">
        <div className="flex items-center gap-2 rounded-full border border-[#e2e8f0] dark:border-white/10 bg-white dark:bg-[#171a21] px-3 py-2 focus-within:border-[#cbd5e1] dark:focus-within:border-white/25 transition-colors shadow-xs">
          <Search className="h-4 w-4 shrink-0 text-[#64748b] dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search parts, rails, symbols..."
            className="w-full bg-transparent text-[13px] text-[#0f172a] dark:text-slate-100 placeholder:text-[#94a3b8] dark:placeholder:text-slate-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-[#64748b] dark:text-slate-500 hover:text-[#0f172a] dark:hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Category Pill Switcher */}
      <div className="px-2.5 pb-2">
        <div className="grid grid-cols-4 gap-1 rounded-xl border border-[#e2e8f0] dark:border-white/10 bg-[#f1f5f9] dark:bg-[#131620]/70 p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                  active
                    ? "bg-[#0f172a] text-white dark:bg-white dark:text-black shadow-xs"
                    : "text-[#64748b] dark:text-slate-400 hover:bg-[#e2e8f0] dark:hover:bg-white/5 hover:text-[#0f172a] dark:hover:text-slate-200"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto px-2.5 pb-3 space-y-3 text-xs">
        {activeTab === "components" && (
          <div className="space-y-2.5">
            {/* ★ FAVORITES Section */}
            {favoriteItems.length > 0 && (
              <div className="rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/20 p-2.5 space-y-2 shadow-xs">
                <button
                  type="button"
                  onClick={() => toggleCategory("Favorites")}
                  className="flex w-full items-center justify-between font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300"
                >
                  <span className="flex items-center gap-1.5">
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${
                        openCategories["Favorites"] ? "" : "-rotate-90"
                      }`}
                    />
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                    FAVORITES
                  </span>
                  <span className="rounded-full bg-amber-200/60 dark:bg-amber-900/50 px-2 py-0.5 text-[10px] text-amber-800 dark:text-amber-200 font-mono">
                    {favoriteItems.length}
                  </span>
                </button>

                {openCategories["Favorites"] && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {favoriteItems.map((tpl) => (
                      <div
                        key={`fav-${tpl.id}`}
                        className="group relative flex flex-col items-center justify-between rounded-xl border border-amber-200 dark:border-amber-500/20 bg-white dark:bg-[#171a21] p-2 text-center transition-all hover:border-amber-400 dark:hover:border-amber-400 hover:bg-amber-50/30 dark:hover:bg-[#1d212b]"
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavoritePart(tpl.id);
                          }}
                          title="Remove from Favorites"
                          className="absolute top-1 right-1 z-10 rounded-full p-1 text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-950/60 transition-colors"
                        >
                          <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddComponent(tpl.id)}
                          title={`Add ${tpl.name} (${tpl.widthMm}×${tpl.heightMm}mm)`}
                          className="w-full flex flex-col items-center"
                        >
                          <div className="flex h-10 w-full items-center justify-center">
                            <PartVectorIcon
                              templateId={tpl.id}
                              accentColor={tpl.accentColor}
                            />
                          </div>
                          <div className="mt-1.5 w-full">
                            <div className="truncate text-[12px] font-medium text-[#0f172a] dark:text-slate-100 group-hover:text-amber-700 dark:group-hover:text-amber-300">
                              {tpl.shortName}
                            </div>
                            <div className="mt-0.5 font-mono text-[10px] tabular-nums text-[#64748b] dark:text-slate-500">
                              {formatDim(tpl.widthMm, displayUnit, 0)} ×{" "}
                              {formatDim(tpl.heightMm, displayUnit, 0)}
                            </div>
                          </div>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 🕒 RECENT SYMBOLS Section */}
            {recentItems.length > 0 && (
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/30 dark:bg-indigo-950/20 p-2.5 space-y-2 shadow-xs">
                <button
                  type="button"
                  onClick={() => toggleCategory("Recent Symbols")}
                  className="flex w-full items-center justify-between font-mono text-[11px] font-semibold uppercase tracking-wider text-indigo-800 dark:text-indigo-300"
                >
                  <span className="flex items-center gap-1.5">
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${
                        openCategories["Recent Symbols"] ? "" : "-rotate-90"
                      }`}
                    />
                    <Clock className="h-3.5 w-3.5 text-indigo-500" />
                    RECENT SYMBOLS
                  </span>
                  <span className="rounded-full bg-indigo-200/60 dark:bg-indigo-900/50 px-2 py-0.5 text-[10px] text-indigo-800 dark:text-indigo-200 font-mono">
                    {recentItems.length}
                  </span>
                </button>

                {openCategories["Recent Symbols"] && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {recentItems.map((tpl) => {
                      const isFav = favoritePartIds.includes(tpl.id);
                      return (
                        <div
                          key={`rec-${tpl.id}`}
                          className="group relative flex flex-col items-center justify-between rounded-xl border border-indigo-200/60 dark:border-indigo-500/20 bg-white dark:bg-[#171a21] p-2 text-center transition-all hover:border-indigo-400 dark:hover:border-indigo-400 hover:bg-indigo-50/20 dark:hover:bg-[#1d212b]"
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavoritePart(tpl.id);
                            }}
                            title={isFav ? "Starred favorite" : "Add to Favorites"}
                            className={`absolute top-1 right-1 z-10 rounded-full p-1 transition-colors ${
                              isFav
                                ? "text-amber-500"
                                : "text-[#94a3b8] opacity-0 group-hover:opacity-100 hover:text-amber-500"
                            }`}
                          >
                            <Star
                              className={`h-3 w-3 ${
                                isFav ? "fill-amber-400 text-amber-500" : ""
                              }`}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddComponent(tpl.id)}
                            title={`Add ${tpl.name} (${tpl.widthMm}×${tpl.heightMm}mm)`}
                            className="w-full flex flex-col items-center"
                          >
                            <div className="flex h-10 w-full items-center justify-center">
                              <PartVectorIcon
                                templateId={tpl.id}
                                accentColor={tpl.accentColor}
                              />
                            </div>
                            <div className="mt-1.5 w-full">
                              <div className="truncate text-[12px] font-medium text-[#0f172a] dark:text-slate-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
                                {tpl.shortName}
                              </div>
                              <div className="mt-0.5 font-mono text-[10px] tabular-nums text-[#64748b] dark:text-slate-500">
                                {formatDim(tpl.widthMm, displayUnit, 0)} ×{" "}
                                {formatDim(tpl.heightMm, displayUnit, 0)}
                              </div>
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* My CAD Library Accordion */}
            {filteredLibrary.length > 0 && (
              <div className="rounded-xl border border-sky-200 dark:border-sky-500/20 bg-sky-50/50 dark:bg-sky-950/20 p-2.5 space-y-2 shadow-xs">
                <button
                  type="button"
                  onClick={() => toggleCategory("My CAD Library")}
                  className="flex w-full items-center justify-between font-mono text-[11px] font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300"
                >
                  <span className="flex items-center gap-1.5">
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${
                        openCategories["My CAD Library"] ? "" : "-rotate-90"
                      }`}
                    />
                    My CAD Library
                  </span>
                  <span className="rounded-full bg-sky-100 dark:bg-sky-900/50 px-2 py-0.5 text-[10px]">
                    {filteredLibrary.length}
                  </span>
                </button>

                {openCategories["My CAD Library"] && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {filteredLibrary.map((item) => (
                      <div
                        key={item.id}
                        className="group relative flex flex-col justify-between rounded-xl border border-sky-200 dark:border-sky-500/30 bg-white dark:bg-[#171a21] p-2 transition-all hover:border-sky-400 dark:hover:border-sky-400"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="rounded bg-sky-100 dark:bg-sky-950 px-1 py-0.2 font-mono text-[9px] font-bold text-sky-700 dark:text-sky-400">
                              {item.format.toUpperCase()}
                            </span>
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingLibraryId(item.id);
                                  setEditingLibraryName(item.name);
                                }}
                                title="Rename in Library"
                                className="p-1 text-[#94a3b8] hover:text-sky-500"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteFromLibrary(item)}
                                title="Delete from Library"
                                className="p-1 text-[#94a3b8] hover:text-rose-500"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>

                          <div className="mt-1.5 flex h-14 w-full items-center justify-center rounded-lg border border-sky-100 dark:border-white/5 bg-sky-50/40 dark:bg-[#0c0e14]/60 p-1.5">
                            <CadPreviewThumbnail
                              format={item.format}
                              rawText={item.rawText}
                              sourceUnit={item.sourceUnit}
                              boundingBoxMm={item.boundingBoxMm}
                              pins={item.pins}
                              className="h-full w-full"
                            />
                          </div>

                          {editingLibraryId === item.id ? (
                            <input
                              type="text"
                              autoFocus
                              value={editingLibraryName}
                              onChange={(e) => setEditingLibraryName(e.target.value)}
                              onBlur={() => handleRenameLibraryItem(item)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleRenameLibraryItem(item);
                                } else if (e.key === "Escape") {
                                  e.preventDefault();
                                  setEditingLibraryId(null);
                                }
                              }}
                              className="mt-1.5 w-full rounded border border-sky-400 bg-white dark:bg-[#0c0e14] px-1.5 py-0.5 text-[12px] font-medium text-[#0f172a] dark:text-slate-100 focus:outline-none"
                            />
                          ) : (
                            <div className="mt-1.5 truncate text-[12px] font-medium text-[#0f172a] dark:text-slate-100">
                              {item.name}
                            </div>
                          )}
                          <div className="font-mono text-[10px] text-[#64748b] dark:text-slate-400">
                            {formatDim(item.boundingBoxMm.w, displayUnit, 0)}×
                            {formatDim(item.boundingBoxMm.h, displayUnit, 0)} ·{" "}
                            {item.pins.length}P
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleInstantiateFromLibrary(item)}
                          className="mt-2 flex w-full items-center justify-center gap-1 rounded-md bg-sky-600 hover:bg-sky-500 py-1 font-mono text-[10px] font-semibold text-white transition-colors"
                        >
                          <Plus className="h-3 w-3" /> Place
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Standard Component Categories */}
            {COMPONENT_CATEGORIES.map((cat) => {
              const catItems = filteredComponents.filter(
                (c) => c.category === cat
              );
              if (catItems.length === 0) return null;
              const isOpen = openCategories[cat] ?? true;

              return (
                <div
                  key={cat}
                  className="rounded-xl border border-[#e2e8f0] dark:border-white/10 bg-white dark:bg-[#131620]/70 p-2.5 space-y-2 shadow-xs"
                >
                  <button
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className="flex w-full items-center justify-between font-mono text-[11px] font-semibold uppercase tracking-wider text-[#334155] dark:text-slate-300"
                  >
                    <span className="flex items-center gap-1.5">
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${
                          isOpen ? "" : "-rotate-90"
                        }`}
                      />
                      {cat}
                    </span>
                    <span className="rounded-full bg-[#f1f5f9] dark:bg-white/5 px-2 py-0.5 text-[10px] text-[#64748b] dark:text-slate-400">
                      {catItems.length}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {catItems.map((tpl) => {
                        const isFav = favoritePartIds.includes(tpl.id);
                        return (
                          <div
                            key={tpl.id}
                            className="group relative flex flex-col items-center justify-between rounded-xl border border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#171a21] p-2 text-center transition-all hover:border-[#cbd5e1] dark:hover:border-white/25 hover:bg-[#f1f5f9] dark:hover:bg-[#1d212b]"
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavoritePart(tpl.id);
                              }}
                              title={isFav ? "Remove from Favorites" : "Add to Favorites"}
                              aria-label={isFav ? `Unfavorite ${tpl.shortName}` : `Favorite ${tpl.shortName}`}
                              className={`absolute top-1 right-1 z-10 rounded-full p-1 transition-colors ${
                                isFav
                                  ? "text-amber-500"
                                  : "text-[#94a3b8] opacity-0 group-hover:opacity-100 hover:text-amber-500"
                              }`}
                            >
                              <Star
                                className={`h-3 w-3 ${
                                  isFav ? "fill-amber-400 text-amber-500" : ""
                                }`}
                              />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddComponent(tpl.id)}
                              title={`Add ${tpl.name} (${tpl.widthMm}×${tpl.heightMm}mm)`}
                              className="w-full flex flex-col items-center active:scale-[0.98]"
                            >
                              <div className="flex h-10 w-full items-center justify-center">
                                <PartVectorIcon
                                  templateId={tpl.id}
                                  accentColor={tpl.accentColor}
                                />
                              </div>
                              <div className="mt-1.5 w-full">
                                <div className="truncate text-[12px] font-medium text-[#0f172a] dark:text-slate-100 group-hover:text-[#0f172a] dark:group-hover:text-white">
                                  {tpl.shortName}
                                </div>
                                <div className="mt-0.5 font-mono text-[10px] tabular-nums text-[#64748b] dark:text-slate-500">
                                  {formatDim(tpl.widthMm, displayUnit, 0)} ×{" "}
                                  {formatDim(tpl.heightMm, displayUnit, 0)}
                                </div>
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredComponents.length === 0 && filteredLibrary.length === 0 && (
              <div className="rounded-xl border border-[#e2e8f0] dark:border-white/10 bg-white dark:bg-[#131620]/70 p-6 text-center text-xs text-[#94a3b8] dark:text-slate-500">
                No matching parts in library
              </div>
            )}
          </div>
        )}

        {activeTab === "rails" && (
          <div className="space-y-2.5">
            {/* DIN Rails Accordion Card */}
            <div className="rounded-xl border border-[#e2e8f0] dark:border-white/10 bg-white dark:bg-[#131620]/70 p-2.5 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setRailsOpen((v) => !v)}
                  className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-[#334155] dark:text-slate-300"
                >
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${
                      railsOpen ? "" : "-rotate-90"
                    }`}
                  />
                  DIN Rails (35mm)
                </button>
                <button
                  type="button"
                  onClick={() => addRail()}
                  className="flex items-center gap-1 rounded-full bg-[#0f172a] dark:bg-white px-2.5 py-0.5 text-[11px] font-semibold text-white dark:text-black hover:bg-[#334155] dark:hover:bg-slate-200 transition-colors"
                >
                  <Plus className="h-3 w-3" /> Add
                </button>
              </div>

              {railsOpen && (
                <div className="space-y-1.5 pt-1">
                  {filteredRails.map((rail) => (
                    <div
                      key={rail.id}
                      onClick={() => setSelected({ kind: "rail", id: rail.id })}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border px-2.5 py-1.5 transition-colors ${
                        selected?.kind === "rail" && selected.id === rail.id
                          ? "border-[#0284c7] bg-[#e0f2fe] text-[#0369a1] dark:border-white/35 dark:bg-[#343842]/70 dark:text-slate-200"
                          : "border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#171a21] hover:border-[#cbd5e1] dark:hover:border-white/20"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-[#0f172a] dark:text-slate-200">
                          {rail.name}
                        </div>
                        <div className="font-mono text-[11px] tabular-nums text-[#64748b] dark:text-slate-400">
                          L={formatDim(rail.lengthMm, displayUnit)} · Y=
                          {formatDim(rail.yMm, displayUnit)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeRail(rail.id);
                        }}
                        className="p-1 text-[#94a3b8] dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Wire Ducts Accordion Card */}
            <div className="rounded-xl border border-[#e2e8f0] dark:border-white/10 bg-white dark:bg-[#131620]/70 p-2.5 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setDuctsOpen((v) => !v)}
                  className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-[#334155] dark:text-slate-300"
                >
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${
                      ductsOpen ? "" : "-rotate-90"
                    }`}
                  />
                  Wire Ducts
                </button>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => addDuct("horizontal")}
                    className="rounded-full border border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#171a21] px-2.5 py-0.5 text-[11px] font-medium text-[#0f172a] dark:text-slate-200 hover:border-[#cbd5e1] dark:hover:border-white/25 hover:bg-[#f1f5f9] dark:hover:bg-white/10"
                  >
                    + H
                  </button>
                  <button
                    type="button"
                    onClick={() => addDuct("vertical")}
                    className="rounded-full border border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#171a21] px-2.5 py-0.5 text-[11px] font-medium text-[#0f172a] dark:text-slate-200 hover:border-[#cbd5e1] dark:hover:border-white/25 hover:bg-[#f1f5f9] dark:hover:bg-white/10"
                  >
                    + V
                  </button>
                </div>
              </div>

              {ductsOpen && (
                <div className="space-y-1.5 pt-1">
                  {filteredDucts.map((duct) => (
                    <div
                      key={duct.id}
                      onClick={() => setSelected({ kind: "duct", id: duct.id })}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border px-2.5 py-1.5 transition-colors ${
                        selected?.kind === "duct" && selected.id === duct.id
                          ? "border-[#0284c7] bg-[#e0f2fe] text-[#0369a1] dark:border-white/35 dark:bg-[#343842]/70 dark:text-slate-200"
                          : "border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#171a21] hover:border-[#cbd5e1] dark:hover:border-white/20"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-[#0f172a] dark:text-slate-200">
                          {duct.name}
                        </div>
                        <div className="font-mono text-[11px] tabular-nums text-[#64748b] dark:text-slate-400">
                          {formatDim(duct.widthMm, displayUnit)} ×{" "}
                          {formatDim(duct.heightMm, displayUnit)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeDuct(duct.id);
                        }}
                        className="p-1 text-[#94a3b8] dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "enclosure" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-[#e2e8f0] dark:border-white/10 bg-white dark:bg-[#131620]/70 p-3 space-y-2.5 shadow-xs">
              <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#64748b] dark:text-slate-400">
                Enclosure Dimensions ({displayUnit})
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["Width (W)", "widthMm"],
                    ["Height (H)", "heightMm"],
                    ["Depth (D)", "depthMm"],
                    ["Inset", "backplateInsetMm"],
                  ] as const
                ).map(([label, key]) => (
                  <label key={key} className="block space-y-1">
                    <span className="text-xs text-[#64748b] dark:text-slate-400">{label}</span>
                    <input
                      type="number"
                      step={step}
                      value={Number(
                        fromMm(enclosure[key], displayUnit).toFixed(3)
                      )}
                      onChange={(e) => {
                        const mm = toMm(
                          Number.parseFloat(e.target.value) || 0,
                          displayUnit
                        );
                        updateEnclosure({ [key]: Math.max(20, mm) });
                      }}
                      className="w-full rounded-lg border border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#171a21] px-2.5 py-1.5 font-mono text-[13px] tabular-nums text-[#0f172a] dark:text-slate-100 focus:border-[#0284c7] dark:focus:border-white/30 focus:outline-none"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[#e2e8f0] dark:border-white/10 bg-white dark:bg-[#131620]/70 p-3 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#64748b] dark:text-slate-400">
                  Mounting Plate
                </span>
                <div className="flex rounded-full border border-[#e2e8f0] dark:border-white/10 bg-[#f1f5f9] dark:bg-[#171a21] p-0.5 text-[11px] font-mono">
                  <button
                    type="button"
                    onClick={() => updatePlateConfig({ mode: "auto" })}
                    className={`rounded-full px-2.5 py-0.5 transition-colors ${
                      plateConfig.mode === "auto"
                        ? "bg-[#0f172a] text-white dark:bg-white dark:text-black font-semibold shadow-xs"
                        : "text-[#64748b] dark:text-slate-400 hover:text-[#0f172a] dark:hover:text-slate-200"
                    }`}
                  >
                    Auto
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updatePlateConfig({
                        mode: "manual",
                        manualWidthMm:
                          plateConfig.mode === "auto"
                            ? Math.max(
                                100,
                                enclosure.widthMm -
                                  enclosure.backplateInsetMm * 2
                              )
                            : plateConfig.manualWidthMm,
                        manualHeightMm:
                          plateConfig.mode === "auto"
                            ? Math.max(
                                100,
                                enclosure.heightMm -
                                  enclosure.backplateInsetMm * 2
                              )
                            : plateConfig.manualHeightMm,
                      })
                    }
                    className={`rounded-full px-2.5 py-0.5 transition-colors ${
                      plateConfig.mode === "manual"
                        ? "bg-[#0f172a] text-white dark:bg-white dark:text-black font-semibold shadow-xs"
                        : "text-[#64748b] dark:text-slate-400 hover:text-[#0f172a] dark:hover:text-slate-200"
                    }`}
                  >
                    Manual
                  </button>
                </div>
              </div>

              {plateConfig.mode === "manual" ? (
                <div className="grid grid-cols-2 gap-2">
                  <label className="block space-y-1">
                    <span className="text-xs text-[#64748b] dark:text-slate-400">
                      Plate W ({displayUnit})
                    </span>
                    <input
                      type="number"
                      step={step}
                      value={Number(
                        fromMm(plateConfig.manualWidthMm, displayUnit).toFixed(
                          3
                        )
                      )}
                      onChange={(e) => {
                        const mm = toMm(
                          Number.parseFloat(e.target.value) || 0,
                          displayUnit
                        );
                        updatePlateConfig({ manualWidthMm: Math.max(100, mm) });
                      }}
                      className="w-full rounded-lg border border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#171a21] px-2.5 py-1.5 font-mono text-[13px] tabular-nums text-[#0f172a] dark:text-slate-100 focus:border-[#0284c7] dark:focus:border-white/30 focus:outline-none"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-[#64748b] dark:text-slate-400">
                      Plate H ({displayUnit})
                    </span>
                    <input
                      type="number"
                      step={step}
                      value={Number(
                        fromMm(plateConfig.manualHeightMm, displayUnit).toFixed(
                          3
                        )
                      )}
                      onChange={(e) => {
                        const mm = toMm(
                          Number.parseFloat(e.target.value) || 0,
                          displayUnit
                        );
                        updatePlateConfig({
                          manualHeightMm: Math.max(100, mm),
                        });
                      }}
                      className="w-full rounded-lg border border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#171a21] px-2.5 py-1.5 font-mono text-[13px] tabular-nums text-[#0f172a] dark:text-slate-100 focus:border-[#0284c7] dark:focus:border-white/30 focus:outline-none"
                    />
                  </label>
                </div>
              ) : (
                <div className="rounded-lg border border-[#e2e8f0] dark:border-white/5 bg-[#f8fafc] dark:bg-[#171a21] px-2.5 py-1.5 font-mono text-xs tabular-nums text-[#334155] dark:text-slate-300">
                  {formatDim(plateW, displayUnit)} ×{" "}
                  {formatDim(plateH, displayUnit)}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "cad" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-[#e2e8f0] dark:border-white/10 bg-white dark:bg-[#131620]/70 p-3 space-y-2.5 shadow-xs">
              <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#64748b] dark:text-slate-400">
                Custom CAD Importer
              </div>

              <label className="block space-y-1">
                <span className="text-xs text-[#64748b] dark:text-slate-400">
                  Source File Native Unit
                </span>
                <select
                  value={cadImportUnit}
                  onChange={(e) =>
                    setCadImportUnit(e.target.value as CadImportUnit)
                  }
                  className="w-full rounded-lg border border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#171a21] px-2.5 py-1.5 font-mono text-[13px] text-[#0f172a] dark:text-slate-100 focus:border-[#0284c7] dark:focus:border-white/30 focus:outline-none"
                >
                  <option value="mm">Millimeters (mm)</option>
                  <option value="cm">Centimeters (cm)</option>
                  <option value="m">Meters (m)</option>
                  <option value="inch">Inches (inch)</option>
                </select>
              </label>

              <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#cbd5e1] dark:border-white/15 bg-[#f8fafc] dark:bg-[#171a21] p-4 text-center transition-colors hover:border-[#0284c7] dark:hover:border-white/35">
                <FileUp className="h-5 w-5 text-[#64748b] dark:text-slate-300" />
                <span className="text-[13px] font-medium text-[#0f172a] dark:text-slate-200">
                  Upload .GLB / .GLTF / .OBJ / .DXF
                </span>
                <span className="font-mono text-[11px] text-[#94a3b8] dark:text-slate-500">
                  Auto-normalized to canonical mm
                </span>
                <input
                  type="file"
                  accept=".glb,.gltf,.obj,.dxf"
                  onChange={handleCadUpload}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() => setShowImageToCadModal(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 p-2.5 text-center transition-colors font-medium text-[13px]"
              >
                <ImageIcon className="h-4 w-4" />
                <span>Image Component Creator</span>
              </button>
            </div>

            <div className="space-y-1.5">
              {filteredCad.map((asset) => {
                const markingThis =
                  isPinMarkingMode && activeMarkingAssetId === asset.id;
                return (
                  <div
                    key={asset.id}
                    onClick={() => setSelected({ kind: "cad", id: asset.id })}
                    className={`rounded-lg border p-2 transition-colors cursor-pointer ${
                      selected?.kind === "cad" && selected.id === asset.id
                        ? "border-[#0284c7] bg-[#e0f2fe] text-[#0369a1] dark:border-white/35 dark:bg-[#343842]/50 dark:text-slate-200"
                        : "border-[#e2e8f0] dark:border-white/10 bg-white dark:bg-[#171a21] hover:border-[#cbd5e1] dark:hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#e2e8f0] dark:border-white/10 bg-[#f8fafc] dark:bg-[#0c0e14] p-1">
                          <CadPreviewThumbnail
                            format={asset.format}
                            rawText={asset.rawText}
                            sourceUnit={asset.sourceUnit}
                            boundingBoxMm={asset.boundingBoxMm}
                            pins={asset.pins}
                            className="h-full w-full"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          {editingCadId === asset.id ? (
                            <input
                              type="text"
                              autoFocus
                              value={editingCadName}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setEditingCadName(e.target.value)}
                              onBlur={() => handleRenameCadAsset(asset)}
                              onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleRenameCadAsset(asset);
                                } else if (e.key === "Escape") {
                                  e.preventDefault();
                                  setEditingCadId(null);
                                }
                              }}
                              className="w-full rounded border border-sky-400 bg-white dark:bg-[#0c0e14] px-1.5 py-0.5 text-[13px] font-medium text-[#0f172a] dark:text-slate-100 focus:outline-none"
                            />
                          ) : (
                            <div className="truncate text-[13px] font-medium text-[#0f172a] dark:text-slate-200">
                              {asset.name}
                            </div>
                          )}
                          <div className="font-mono text-[11px] text-[#64748b] dark:text-slate-400">
                            [{asset.format.toUpperCase()}] · {asset.pins.length}{" "}
                            pins
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCadId(asset.id);
                            setEditingCadName(asset.name);
                          }}
                          title="Rename CAD asset"
                          className="p-1 text-[#94a3b8] dark:text-slate-500 hover:text-sky-500 dark:hover:text-sky-400"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeCadAsset(asset.id);
                          }}
                          title="Remove CAD asset"
                          className="p-1 text-[#94a3b8] dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 flex gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected({ kind: "cad", id: asset.id });
                          setPinMarkingMode(!markingThis, asset.id);
                        }}
                        className={`flex-1 rounded-md py-1.5 font-mono text-[11px] font-semibold transition-colors ${
                          markingThis
                            ? "bg-amber-500 text-black font-bold"
                            : "border border-[#e2e8f0] dark:border-white/10 bg-[#f1f5f9] dark:bg-[#0c0e14] text-[#334155] dark:text-slate-300 hover:border-[#cbd5e1] dark:hover:border-white/25"
                        }`}
                      >
                        <MapPin className="mr-1 inline h-3.5 w-3.5" />
                        {markingThis ? "Done Marking" : "Mark Pins"}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveToLibrary(asset);
                        }}
                        title="Save CAD asset + marked pins to My Library (IndexedDB)"
                        className={`flex-1 rounded-md py-1.5 font-mono text-[11px] font-semibold transition-colors ${
                          savedToastId === asset.id
                            ? "bg-emerald-600 text-white"
                            : "border border-sky-300 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/60"
                        }`}
                      >
                        {savedToastId === asset.id ? (
                          <>
                            <Check className="mr-1 inline h-3.5 w-3.5" />
                            Saved!
                          </>
                        ) : (
                          <>
                            <BookmarkPlus className="mr-1 inline h-3.5 w-3.5" />
                            Save to My Library
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
    {showImageToCadModal && (
      <ImageToCadModal onClose={() => setShowImageToCadModal(false)} />
    )}
    </>
  );
}
