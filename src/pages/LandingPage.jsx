import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import UploadForm from "../components/UploadForm";
import SummaryTable from "../components/SummaryTable";
import StepSection from "../components/StepSection";
import PrintLayout from "../components/PrintLayout";
import { SIZES, NUMERIC_SIZES, ADULT_SIZES } from "../lib/summary";

const generateId = (() => {
  let counter = 0;
  return () => {
    counter += 1;
    return `row-${Date.now()}-${counter}`;
  };
})();

const extractBaseName = (name, row) => {
  const trimmed = String(name || "").trim();
  const match = trimmed.match(/^(.*?)(?:\s|-)?(\d{2,3})$/);
  if (match) {
    const possibleSize = Number(match[2]);
    if (SIZES.includes(possibleSize)) {
      const hasOtherSizes = SIZES.some(
        (size) => size !== possibleSize && (Number(row[size]) || 0) > 0
      );
      const countAtSize = Number(row[possibleSize]) || 0;
      if (!hasOtherSizes && countAtSize > 0) {
        return { baseName: match[1].trim(), sizeFromName: possibleSize };
      }
    }
  }
  return { baseName: trimmed, sizeFromName: null };
};

const withHelpers = (row) => {
  const rawName = String(row.design || "").trim();
  const { baseName, sizeFromName } = extractBaseName(rawName, row);
  const normalized = {
    ...row,
    id: generateId(),
    baseName,
    color: String(row.color || "").trim(),
    printCode: String(row.printCode || "").trim(),
    sizeFromName,
  };
  return recalcRow(normalized);
};

const recalcRow = (row) => {
  const total = SIZES.reduce((acc, size) => acc + (Number(row[size]) || 0), 0);
  const rawPrintCode = String(row.printCode || "").trim();
  let baseName = String(row.baseName || "").trim();
  if (rawPrintCode) {
    const pattern = new RegExp(`^${rawPrintCode}(?:[\\s\\-_/]+)?`, "i");
    const stripped = baseName.replace(pattern, "").trim();
    if (stripped) baseName = stripped;
  }
  if (!baseName) baseName = "상품명 없음";

  const displayColor = String(row.color || "").trim();
  const displayName = rawPrintCode ? `${baseName} (${rawPrintCode})` : baseName;
  const hasPrintCode = Boolean(rawPrintCode);

  return {
    ...row,
    baseName,
    color: displayColor,
    displayName,
    hasPrintCode,
    printCode: rawPrintCode,
    total,
    design: displayName,
  };
};

const aggregateRowsByName = (rows) => {
  const map = new Map();
  rows.forEach((row) => {
    const key = `${row.baseName}||${row.color || ""}||${row.printCode || ""}`;
    if (!map.has(key)) {
      const base = {
        id: generateId(),
        baseName: row.baseName,
        color: row.color,
        printCode: row.printCode,
      };
      SIZES.forEach((size) => {
        base[size] = 0;
      });
      map.set(key, base);
    }
    const target = map.get(key);
    SIZES.forEach((size) => {
      target[size] += Number(row[size]) || 0;
    });
  });
  return Array.from(map.values()).map(recalcRow);
};

const mergeRows = (rows) => {
  if (!rows.length) return null;
  const baseName = rows[0].baseName;
  const printCode = rows[0].printCode || "";
  const colorList = Array.from(
    new Set(
      rows
        .map((row) => String(row.color || "").trim())
        .filter((value) => value.length > 0)
    )
  );
  const merged = {
    id: generateId(),
    baseName,
    color: colorList.join(", "),
    printCode,
  };
  SIZES.forEach((size) => {
    merged[size] = rows.reduce((sum, row) => sum + (Number(row[size]) || 0), 0);
  });
  return recalcRow(merged);
};

export default function LandingPage() {
  const [summary, setSummary] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showPrintLayout, setShowPrintLayout] = useState(false);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState("all");
  const [listFullscreen, setListFullscreen] = useState(false);

  const containerClass =
    "w-full max-w-6xl px-4 sm:px-6 lg:px-10 xl:px-14 mx-auto";

  const handleData = (rows) => {
    const prepared = rows.map(withHelpers);
    setSummary(aggregateRowsByName(prepared));
    setSelectedIds([]);
  };

  const handleToggleRow = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleAll = (ids, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) ids.forEach((id) => next.add(id));
      else ids.forEach((id) => next.delete(id));
      return Array.from(next);
    });
  };

  const handleMergeSelected = () => {
    if (selectedIds.length < 2) {
      window.alert("병합할 상품을 두 개 이상 선택해 주세요.");
      return;
    }
    const rowsToMerge = summary.filter((row) => selectedIds.includes(row.id));
    const uniqueNames = Array.from(new Set(rowsToMerge.map((row) => row.baseName)));
    if (uniqueNames.length > 1) {
      window.alert("상품명이 다르면 병합할 수 없습니다.");
      return;
    }
    const uniqueCodes = Array.from(new Set(rowsToMerge.map((row) => row.printCode || "")));
    if (uniqueCodes.length > 1) {
      window.alert("상품코드가 다르면 병합할 수 없습니다.");
      return;
    }
    const mergedRow = mergeRows(rowsToMerge);
    setSummary((prev) => {
      const remaining = prev.filter((row) => !selectedIds.includes(row.id));
      const next = mergedRow ? [...remaining, mergedRow] : remaining;
      return aggregateRowsByName(next);
    });
    setSelectedIds([]);
  };

  const handleUpdateCell = (id, field, value) => {
    setSummary((prev) => {
      const updatedRows = prev.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row };
        if (field === "name") {
          const extracted = extractBaseName(value, row);
          updated.baseName = extracted.baseName;
          updated.sizeFromName = extracted.sizeFromName;
        } else if (field === "color") {
          updated.color = value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
            .join(", ");
        } else if (SIZES.includes(field)) {
          const parsed = Number(value);
          updated[field] = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
        }
        return recalcRow(updated);
      });
      return aggregateRowsByName(updatedRows);
    });
  };

  const queryFiltered = useMemo(() => {
    if (!query.trim()) return summary;
    const lowered = query.toLowerCase();
    return summary.filter((row) =>
      [row.baseName, row.color, row.design].join(" ").toLowerCase().includes(lowered)
    );
  }, [query, summary]);

  const filteredSummary = useMemo(() => {
    if (viewMode === "print") return queryFiltered.filter((row) => row.hasPrintCode);
    if (viewMode === "general") return queryFiltered.filter((row) => !row.hasPrintCode);
    return queryFiltered;
  }, [queryFiltered, viewMode]);

  const filteredTotal = useMemo(
    () => filteredSummary.reduce((acc, row) => acc + (Number(row.total) || 0), 0),
    [filteredSummary]
  );

  const activeSizes = useMemo(() => {
    const rowsToCheck = filteredSummary.length ? filteredSummary : summary;
    const present = SIZES.filter((size) =>
      rowsToCheck.some((row) => Number(row[size]) > 0)
    );
    return present.length ? present : NUMERIC_SIZES;
  }, [filteredSummary, summary]);

  const handleDownload = () => {
    const header = ["번호", "상품명", ...activeSizes.map((size) => String(size)), "합계"];
    const sorted = [...filteredSummary].sort((a, b) =>
      a.baseName.localeCompare(b.baseName, "ko", { sensitivity: "base" })
    );
    const rows = sorted.map((row, index) => [
      index + 1,
      row.displayName,
      ...activeSizes.map((size) => row[size] ?? 0),
      row.total,
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Summary");
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `nykids-summary-${timestamp}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  const tabs = [
    { id: "all", label: "전체" },
    { id: "print", label: "나염" },
    { id: "general", label: "일반" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white py-8">
      <div className="print:hidden flex flex-col flex-1">
        <header className={`${containerClass} text-center mb-10`}>
          <img
            src="https://emhcrace.github.io/newyork-kids/logo_on.png"
            alt="뉴욕꼬맹이 로고"
            className="mx-auto mb-4 h-16 md:h-20"
          />
          <p className="text-gray-600">Excel 형식을 변환해보세요</p>
        </header>

        <div className={containerClass}>
          <UploadForm onData={handleData} />
        </div>

        {summary.length === 0 && (
          <div className={containerClass}>
            <StepSection />
          </div>
        )}

        {summary.length > 0 && !showPrintLayout && (
          <div className={`${containerClass} mt-12 space-y-4`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPrintLayout(true)}
                  className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
                >
                  인쇄 미리보기
                </button>
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  엑셀 파일 다운로드
                </button>
                <button
                  onClick={handleMergeSelected}
                  className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
                >
                  선택한 항목 병합
                </button>
              </div>
              <div className="relative flex-1 min-w-[220px]">
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="상품명 검색"
                  className="w-full px-3 pr-8 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="검색어 지우기"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    X
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-end text-sm text-gray-500">
              <span>
                표시 행: {filteredSummary.length.toLocaleString()}개 · 총 수량:{" "}
                {filteredTotal.toLocaleString()}개
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setViewMode(tab.id)}
                    className={`px-4 py-2 rounded border ${
                      viewMode === tab.id
                        ? "bg-indigo-500 text-white border-indigo-500"
                        : "bg-white text-gray-600 border-gray-300 hover:bg-gray-100"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setListFullscreen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded border bg-white text-gray-700 hover:bg-gray-100"
                >
                  <span aria-hidden="true">⛶</span>
                  <span>전체화면</span>
                </button>
            </div>

            <SummaryTable
              data={filteredSummary}
              selectedIds={selectedIds}
              onToggleRow={handleToggleRow}
              onToggleAll={handleToggleAll}
              onUpdateCell={handleUpdateCell}
              fixedHeight={query.length > 0}
              viewMode={viewMode}
              sizes={activeSizes}
            />
          </div>
        )}

        <footer className={`${containerClass} mt-auto py-8 text-sm text-gray-400`}>
          ⓒ 2025 뉴욕꼬맹이
        </footer>
      </div>

      {showPrintLayout && (
        <PrintLayout
          data={filteredSummary}
          viewMode={viewMode}
          sizes={activeSizes}
          onClose={() => setShowPrintLayout(false)}
        />
      )}

      {listFullscreen && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col px-4 py-6 overflow-hidden">
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <div>
              <h2 className="text-xl font-bold">엑셀 목록 전체화면</h2>
              <p className="text-sm text-gray-500">
                수정한 내용은 그대로 유지되며, 닫기 후에도 반영됩니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setListFullscreen(false)}
              className="px-4 py-2 rounded bg-red-500 text-white hover:bg-red-600"
            >
              닫기
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <SummaryTable
              data={filteredSummary}
              selectedIds={selectedIds}
              onToggleRow={handleToggleRow}
              onToggleAll={handleToggleAll}
              onUpdateCell={handleUpdateCell}
              fixedHeight={false}
              fullHeight
              viewMode={viewMode}
              sizes={activeSizes}
            />
          </div>
        </div>
      )}
    </div>
  );
}
