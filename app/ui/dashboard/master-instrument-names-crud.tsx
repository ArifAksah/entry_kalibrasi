"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePermissions } from "../../../hooks/usePermissions";
import { useAlert } from "../../../hooks/useAlert";
import Alert from "../../../components/ui/Alert";

interface InstrumentCode {
  id: number;
  code_alat: string | null;
  name?: string | null;
  created_at: string;
}

interface InstrumentNameItem {
  id: number;
  name: string;
  instrument_code_id: number | null;
  created_at: string;
}

const MasterInstrumentNamesCRUD: React.FC = () => {
  usePermissions();
  const { alert, showSuccess, showError, hideAlert } = useAlert();

  const [expandedCodeId, setExpandedCodeId] = useState<number | null>(null);

  // Instrument Code state
  const [codes, setCodes] = useState<InstrumentCode[]>([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [codeSearch, setCodeSearch] = useState("");
  const [codePage, setCodePage] = useState(1);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<InstrumentCode | null>(null);
  const [codeAlatInput, setCodeAlatInput] = useState("");
  const [codeNameInput, setCodeNameInput] = useState("");
  const [isCodeSubmitting, setIsCodeSubmitting] = useState(false);
  const [confirmDeleteCode, setConfirmDeleteCode] =
    useState<InstrumentCode | null>(null);

  // Instrument Names state
  const [names, setNames] = useState<InstrumentNameItem[]>([]);
  const [namesLoading, setNamesLoading] = useState(false);
  const [nameSearch, setNameSearch] = useState("");
  const [namePage, setNamePage] = useState(1);
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [editingName, setEditingName] = useState<InstrumentNameItem | null>(
    null,
  );
  const [nameInput, setNameInput] = useState("");
  const [selectedCodeId, setSelectedCodeId] = useState<number | "">("");
  const [isNameSubmitting, setIsNameSubmitting] = useState(false);
  const [confirmDeleteName, setConfirmDeleteName] =
    useState<InstrumentNameItem | null>(null);

  const pageSize = 10;

  // ── Fetch instrument codes ──────────────────────────────────────────────
  const fetchCodes = async () => {
    setCodesLoading(true);
    try {
      const res = await fetch("/api/instrument-code");
      if (!res.ok) throw new Error("Gagal mengambil kode instrumen");
      const json = await res.json();
      setCodes(Array.isArray(json) ? json : []);
    } catch (e: any) {
      showError(e.message || "Gagal memuat kode instrumen");
    } finally {
      setCodesLoading(false);
    }
  };

  // ── Fetch instrument names ──────────────────────────────────────────────
  const fetchNames = async () => {
    setNamesLoading(true);
    try {
      const res = await fetch("/api/instrument-names");
      if (!res.ok) throw new Error("Gagal mengambil nama instrumen");
      const json = await res.json();
      setNames(Array.isArray(json) ? json : []);
    } catch (e: any) {
      showError(e.message || "Gagal memuat nama instrumen");
    } finally {
      setNamesLoading(false);
    }
  };

  useEffect(() => {
    fetchCodes();
    fetchNames();
  }, []);

  // ── Code CRUD ───────────────────────────────────────────────────────────
  const openCodeModal = (item?: InstrumentCode) => {
    setEditingCode(item || null);
    setCodeAlatInput(item?.code_alat || "");
    setCodeNameInput(item?.name || "");
    setIsCodeModalOpen(true);
  };

  const closeCodeModal = () => {
    setIsCodeModalOpen(false);
    setEditingCode(null);
    setCodeAlatInput("");
    setCodeNameInput("");
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeAlatInput.trim()) return;
    setIsCodeSubmitting(true);
    try {
      const payload = {
        code_alat: codeAlatInput.trim(),
        name: codeNameInput.trim() || null,
      };
      if (editingCode) {
        const res = await fetch(`/api/instrument-code/${editingCode.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Gagal update");
        }
        showSuccess("Kode instrumen berhasil diupdate");
      } else {
        const res = await fetch("/api/instrument-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Gagal simpan");
        }
        showSuccess("Kode instrumen berhasil ditambahkan");
      }
      closeCodeModal();
      fetchCodes();
    } catch (e: any) {
      showError(e.message || "Terjadi kesalahan");
    } finally {
      setIsCodeSubmitting(false);
    }
  };

  const handleConfirmDeleteCode = async () => {
    if (!confirmDeleteCode) return;
    try {
      const res = await fetch(`/api/instrument-code/${confirmDeleteCode.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Gagal hapus");
      }
      showSuccess("Kode instrumen berhasil dihapus");
      setConfirmDeleteCode(null);
      fetchCodes();
    } catch (e: any) {
      showError(e.message || "Gagal menghapus");
    }
  };

  // ── Name CRUD ───────────────────────────────────────────────────────────
  const openNameModal = (item?: InstrumentNameItem, preSelectedCodeId?: number) => {
    setEditingName(item || null);
    setNameInput(item?.name || "");
    // If preSelectedCodeId is provided, use it; otherwise use item's code_id
    setSelectedCodeId(preSelectedCodeId ?? item?.instrument_code_id ?? "");
    setIsNameModalOpen(true);
  };

  const closeNameModal = () => {
    setIsNameModalOpen(false);
    setEditingName(null);
    setNameInput("");
    setSelectedCodeId("");
  };

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim() || !selectedCodeId) return;
    setIsNameSubmitting(true);
    try {
      const payload = {
        name: nameInput.trim(),
        instrument_code_id: Number(selectedCodeId),
      };
      if (editingName) {
        const res = await fetch(`/api/instrument-names/${editingName.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Gagal update");
        }
        showSuccess("Nama instrumen berhasil diupdate");
      } else {
        const res = await fetch("/api/instrument-names", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Gagal simpan");
        }
        showSuccess("Nama instrumen berhasil ditambahkan");
      }
      closeNameModal();
      fetchNames();
    } catch (e: any) {
      showError(e.message || "Terjadi kesalahan");
    } finally {
      setIsNameSubmitting(false);
    }
  };

  const handleConfirmDeleteName = async () => {
    if (!confirmDeleteName) return;
    try {
      const res = await fetch(`/api/instrument-names/${confirmDeleteName.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Gagal hapus");
      }
      showSuccess("Nama instrumen berhasil dihapus");
      setConfirmDeleteName(null);
      fetchNames();
    } catch (e: any) {
      showError(e.message || "Gagal menghapus");
    }
  };

  // ── Pagination helpers ──────────────────────────────────────────────────
  const filteredCodes = useMemo(
    () =>
      codes.filter(
        (c) =>
          (c.code_alat || "")
            .toLowerCase()
            .includes(codeSearch.toLowerCase()) ||
          (c.name || "").toLowerCase().includes(codeSearch.toLowerCase()),
      ),
    [codes, codeSearch],
  );
  const totalCodePages = useMemo(
    () => Math.max(1, Math.ceil(filteredCodes.length / pageSize)),
    [filteredCodes.length],
  );
  const pagedCodes = useMemo(() => {
    const start = (codePage - 1) * pageSize;
    return filteredCodes.slice(start, start + pageSize);
  }, [filteredCodes, codePage]);

  const filteredNames = useMemo(() => {
    const q = nameSearch.toLowerCase();
    return names.filter((n) => {
      const code = codes.find((c) => c.id === n.instrument_code_id);
      const codeStr = (code?.code_alat || "") + " " + (code?.name || "");
      return (
        n.name.toLowerCase().includes(q) || codeStr.toLowerCase().includes(q)
      );
    });
  }, [names, nameSearch, codes]);
  const totalNamePages = useMemo(
    () => Math.max(1, Math.ceil(filteredNames.length / pageSize)),
    [filteredNames.length],
  );
  const pagedNames = useMemo(() => {
    const start = (namePage - 1) * pageSize;
    return filteredNames.slice(start, start + pageSize);
  }, [filteredNames, namePage]);

  useEffect(() => {
    setCodePage(1);
  }, [codeSearch]);
  useEffect(() => {
    setNamePage(1);
  }, [nameSearch]);

  // ── Render helpers ──────────────────────────────────────────────────────
  const PaginationBar = ({
    currentPage,
    totalPages,
    onPageChange,
  }: {
    currentPage: number;
    totalPages: number;
    onPageChange: (p: number) => void;
  }) => (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t border-gray-200 bg-white">
      <div className="text-sm text-gray-600">
        Halaman <span className="font-medium">{currentPage}</span> dari{" "}
        <span className="font-medium">{totalPages}</span>
      </div>
      <div className="inline-flex items-center gap-2">
        {(["First", "Prev", "Next", "Last"] as const).map((label) => {
          const disabled =
            label === "First" || label === "Prev"
              ? currentPage === 1
              : currentPage === totalPages;
          const onClick = () => {
            if (label === "First") onPageChange(1);
            else if (label === "Prev")
              onPageChange(Math.max(1, currentPage - 1));
            else if (label === "Next")
              onPageChange(Math.min(totalPages, currentPage + 1));
            else onPageChange(totalPages);
          };
          return (
            <button
              key={label}
              onClick={onClick}
              disabled={disabled}
              className={`px-3 py-1 rounded border text-sm ${disabled ? "text-gray-400 border-gray-200 cursor-not-allowed" : "text-gray-700 border-gray-300 hover:bg-gray-50"}`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );

  const ConfirmDeleteModal = ({
    item,
    label,
    onConfirm,
    onCancel,
  }: {
    item: { name: string } | null;
    label: string;
    onConfirm: () => void;
    onCancel: () => void;
  }) => {
    if (!item) return null;
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-yellow-50 rounded-full">
              <svg
                className="w-6 h-6 text-yellow-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              Konfirmasi Hapus
            </h3>
          </div>
          <p className="text-sm text-gray-600 mb-6">
            Hapus {label} &quot;{item.name}&quot;? Data yang sudah dihapus tidak
            bisa dipulihkan.
          </p>
          <div className="flex justify-end space-x-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              Batal
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
            >
              Hapus
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {alert.show && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={hideAlert}
          autoHide={alert.autoHide}
          duration={alert.duration}
        />
      )}

      {/* Master Kode Instrumen & Nama */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 px-6 py-4 bg-gradient-to-r from-blue-50 to-cyan-50">
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            <h2 className="text-lg font-semibold text-gray-800">Kode Instrumen</h2>
            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full">
              {codes.length} kode
            </span>
            <span className="text-gray-400">•</span>
            <span className="bg-cyan-100 text-cyan-700 text-xs font-bold px-2.5 py-1 rounded-full">
              {names.length} nama
            </span>
          </div>
        </div>

        <div>
            <div className="flex justify-between items-center p-4">
              <div className="flex items-center gap-3">
                <input
                  value={codeSearch}
                  onChange={(e) => setCodeSearch(e.target.value)}
                  placeholder="Cari kode instrumen..."
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-56 text-sm"
                />
              </div>
              <button
                onClick={() => openCodeModal()}
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-4 py-2 rounded-lg transition-all duration-200 shadow hover:shadow-md font-medium text-sm flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Tambah Kode
              </button>
            </div>

            {codesLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-500">Memuat data...</span>
              </div>
            ) : filteredCodes.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <svg
                  className="w-12 h-12 mx-auto mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                  />
                </svg>
                <p className="font-medium">Belum ada kode instrumen</p>
                <p className="text-sm mt-1">
                  Klik &quot;Tambah Kode&quot; untuk menambahkan kode pertama.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                        No
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Kode
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Deskripsi
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nama Instrumen
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Dibuat
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pagedCodes.map((item, idx) => {
                      const childCount = names.filter(
                        (n) => n.instrument_code_id === item.id,
                      ).length;
                      return (
                        <React.Fragment key={item.id}>
                        <tr
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {(codePage - 1) * pageSize + idx + 1}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-100 text-blue-800 text-sm font-bold tracking-wide">
                              {item.code_alat}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                            {item.name || (
                              <span className="text-gray-300 italic">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                              {childCount} nama
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(item.created_at).toLocaleDateString(
                              "id-ID",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              },
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                            <button
                              onClick={() => setExpandedCodeId(expandedCodeId === item.id ? null : item.id)}
                              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-gray-600 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors text-xs font-medium"
                            >
                              <svg
                                className={`w-3.5 h-3.5 mr-1 transition-transform ${expandedCodeId === item.id ? 'rotate-90' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                              Detail
                            </button>
                            <button
                              onClick={() => openCodeModal(item)}
                              className="inline-flex items-center px-3 py-1.5 border border-blue-300 text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors text-xs font-medium"
                            >
                              <svg
                                className="w-3.5 h-3.5 mr-1"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                              Edit
                            </button>
                            <button
                              onClick={() => setConfirmDeleteCode(item)}
                              className="inline-flex items-center px-3 py-1.5 border border-red-300 text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors text-xs font-medium"
                            >
                              <svg
                                className="w-3.5 h-3.5 mr-1"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                              Hapus
                            </button>
                          </td>
                        </tr>
                        {expandedCodeId === item.id && (
                          <tr>
                            <td colSpan={6} className="px-6 py-4 bg-gray-50 border-b">
                              <div className="flex items-center justify-between mb-3">
                                <div className="text-sm font-semibold text-gray-700">
                                  Daftar Nama Instrumen dengan kode "{item.code_alat}"
                                </div>
                                <button
                                  onClick={() => openNameModal(undefined, item.id)}
                                  className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-xs font-medium shadow-sm"
                                  title="Tambah nama instrumen untuk kode ini"
                                >
                                  <svg
                                    className="w-3.5 h-3.5 mr-1"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M12 4v16m8-8H4"
                                    />
                                  </svg>
                                  Tambah Nama
                                </button>
                              </div>
                              {(() => {
                                const childNames = names.filter(n => n.instrument_code_id === item.id);
                                if (childNames.length === 0) {
                                  return (
                                    <div className="text-center py-8">
                                      <svg
                                        className="w-10 h-10 mx-auto mb-2 text-gray-300"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={1.5}
                                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                                        />
                                      </svg>
                                      <p className="text-sm text-gray-400 italic">
                                        Belum ada nama instrumen untuk kode ini.
                                      </p>
                                      <p className="text-xs text-gray-400 mt-1">
                                        Klik tombol "Tambah Nama" di atas untuk menambahkan.
                                      </p>
                                    </div>
                                  );
                                }
                                return (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {childNames.map(n => (
                                      <div key={n.id} className="group flex items-center justify-between gap-2 px-3 py-2 bg-white rounded-md border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                          <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0"></span>
                                          <span className="text-sm text-gray-800 truncate">{n.name}</span>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button
                                            onClick={() => openNameModal(n)}
                                            className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                            title="Edit nama instrumen"
                                          >
                                            <svg
                                              className="w-3.5 h-3.5"
                                              fill="none"
                                              stroke="currentColor"
                                              viewBox="0 0 24 24"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                              />
                                            </svg>
                                          </button>
                                          <button
                                            onClick={() => setConfirmDeleteName(n)}
                                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                            title="Hapus nama instrumen"
                                          >
                                            <svg
                                              className="w-3.5 h-3.5"
                                              fill="none"
                                              stroke="currentColor"
                                              viewBox="0 0 24 24"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M6 18L18 6M6 6l12 12"
                                              />
                                            </svg>
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {!codesLoading && filteredCodes.length > 0 && (
              <PaginationBar
                currentPage={codePage}
                totalPages={totalCodePages}
                onPageChange={setCodePage}
              />
            )}
          </div>
        </div>

      {/* ── Modal: Kode Instrumen ───────────────────────────────────────── */}
      {isCodeModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="bg-gradient-to-r from-slate-800 to-blue-900 px-6 py-4 rounded-t-xl flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                {editingCode ? "Edit Kode Instrumen" : "Tambah Kode Instrumen"}
              </h3>
              <button
                onClick={closeCodeModal}
                className="text-white hover:text-gray-300 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCodeSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kode Alat <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={codeAlatInput}
                  onChange={(e) =>
                    setCodeAlatInput(e.target.value.toUpperCase())
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono tracking-widest"
                  placeholder="Contoh: RR, AWS, TT..."
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nama{" "}
                  <span className="text-gray-400 font-normal text-xs">
                    (opsional)
                  </span>
                </label>
                <input
                  type="text"
                  value={codeNameInput}
                  onChange={(e) => setCodeNameInput(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nama lengkap kode instrumen..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeCodeModal}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isCodeSubmitting}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isCodeSubmitting && (
                    <svg
                      className="animate-spin h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  )}
                  {isCodeSubmitting ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Nama Instrumen ───────────────────────────────────────── */}
      {isNameModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="bg-gradient-to-r from-slate-800 to-blue-900 px-6 py-4 rounded-t-xl flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                {editingName ? "Edit Nama Instrumen" : "Tambah Nama Instrumen"}
              </h3>
              <button
                onClick={closeNameModal}
                className="text-white hover:text-gray-300 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <form onSubmit={handleNameSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kode Instrumen <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedCodeId}
                  onChange={(e) =>
                    setSelectedCodeId(
                      e.target.value ? Number(e.target.value) : "",
                    )
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  required
                  disabled={!editingName && selectedCodeId !== ""}
                >
                  <option value="">-- Pilih Kode Instrumen --</option>
                  {codes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code_alat}
                      {c.name ? ` — ${c.name}` : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-gray-400">
                  Pilih kode instrumen induk untuk nama ini.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nama Instrumen <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Masukkan nama instrumen..."
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeNameModal}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isNameSubmitting || !selectedCodeId}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isNameSubmitting && (
                    <svg
                      className="animate-spin h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  )}
                  {isNameSubmitting ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm Delete Modals ───────────────────────────────────────── */}
      <ConfirmDeleteModal
        item={confirmDeleteCode ? { name: confirmDeleteCode.code_alat || "" } : null}
        label="kode instrumen"
        onConfirm={handleConfirmDeleteCode}
        onCancel={() => setConfirmDeleteCode(null)}
      />
      <ConfirmDeleteModal
        item={confirmDeleteName}
        label="nama instrumen"
        onConfirm={handleConfirmDeleteName}
        onCancel={() => setConfirmDeleteName(null)}
      />
    </div>
  );
};

export default MasterInstrumentNamesCRUD;
