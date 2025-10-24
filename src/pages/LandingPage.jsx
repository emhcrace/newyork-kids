import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import UploadForm from "../components/UploadForm";
import SummaryTable from "../components/SummaryTable";
import StepSection from "../components/StepSection";
import PrintLayout from "../components/PrintLayout";
import { SIZES } from "../lib/summary";

const generateId = (() => {
  let counter = 0;
  return () => {
    counter += 1;
    return `row-${Date.now()}-${counter}`;
  };
})();

const parseDesign = (design) => {
  const match = String(design || "").match(/^(.*?)(?:\(([^)]+)\))?$/);
  return {
    name: match ? match[1].trim() : String(design || "").trim(),
    color: match && match[2] ? match[2].trim() : "",
  };
};

const withHelpers = (row) => {
  const { name, color } = parseDesign(row.design);
  const { baseName, sizeFromName } = extractBaseName(name, row);
  const normalized = {
    ...row,
    id: generateId(),
    baseName,
    color,
    sizeFromName,
  };
  return recalcRow(normalized);
};

const recalcRow = (row) => {
  const total = SIZES.reduce((acc, size) => acc + (Number(row[size]) || 0), 0);
  const baseName = String(row.baseName || "").trim() || "상품명 없음";
  const displayColor = String(row.color || "").trim();
  const design = displayColor ? `${baseName}(${displayColor})` : baseName;
  return { ...row, baseName, color: displayColor, total, design };
};

const mergeRows = (rows) => {
  if (!rows.length) return null;
  const baseName = rows[0].baseName;
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
  };
  SIZES.forEach((size) => {
    merged[size] = rows.reduce((sum, row) => sum + (Number(row[size]) || 0), 0);
  });
  return recalcRow(merged);
};

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

const aggregateRowsByName = (rows) => {
  const map = new Map();
  rows.forEach((row) => {
    const key = `${row.baseName}||${row.color || ""}`;
    if (!map.has(key)) {
      const base = {
        id: generateId(),
        baseName: row.baseName,
        color: row.color,
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

export default function LandingPage() {
  const [summary, setSummary] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showPrintLayout, setShowPrintLayout] = useState(false);
  const [query, setQuery] = useState("");

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
      if (checked) {
        ids.forEach((id) => next.add(id));
      } else {
        ids.forEach((id) => next.delete(id));
      }
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
      window.alert("상품명이 다른 항목은 병합할 수 없습니다.");
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
          updated.baseName = value.trim() || "상품명 없음";
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

  const filteredSummary = useMemo(() => {
    if (!query.trim()) return summary;
    const lowered = query.toLowerCase();
    return summary.filter((row) =>
      [row.baseName, row.color, row.design]
        .join(" ")
        .toLowerCase()
        .includes(lowered)
    );
  }, [query, summary]);

  const handleDownload = () => {
    const header = [
      "상품명",
      "90",
      "100",
      "110",
      "120",
      "130",
      "140",
      "150",
      "160",
      "170",
      "180",
      "합계",
    ];
    const rows = filteredSummary
      .sort((a, b) => a.baseName.localeCompare(b.baseName, "ko", { sensitivity: "base" }))
      .map((row) => [
        row.design,
        row[90],
        row[100],
        row[110],
        row[120],
        row[130],
        row[140],
        row[150],
        row[160],
        row[170],
        row[180],
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

  return (
    <div className="min-h-screen flex flex-col items-center bg-white py-8">
      <header className="w-11/12 max-w-5xl text-center mb-10">
        <img
          src="https://emhcrace.github.io/newyork-kids/logo_on.png"
          alt="뉴욕꼬맹이 로고"
          className="mx-auto mb-4 h-16 md:h-20"
        />
        <p className="text-gray-600">Excel 주문서를 즉시 집계표로 변환해보세요</p>
      </header>

      <div className="w-11/12 max-w-5xl">
        <UploadForm onData={handleData} />
      </div>

      {summary.length === 0 && <StepSection />}

      {summary.length > 0 && !showPrintLayout && (
        <div className="w-11/12 max-w-5xl mt-12 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-2">
              <button
                onClick={() => setShowPrintLayout(true)}
                className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
              >
                인쇄하기
              </button>
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                요약 결과 다운로드
              </button>
              <button
                onClick={handleMergeSelected}
                className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
              >
                선택 항목 병합
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
                  ✕
                </button>
              )}
            </div>
          </div>
          <SummaryTable
            data={filteredSummary}
            selectedIds={selectedIds}
            onToggleRow={handleToggleRow}
            onToggleAll={handleToggleAll}
            onUpdateCell={handleUpdateCell}
            fixedHeight={query.length > 0}
          />
        </div>
      )}

      {showPrintLayout && (
        <PrintLayout
          data={filteredSummary}
          onClose={() => setShowPrintLayout(false)}
        />
      )}

      <footer className="mt-auto py-8 text-sm text-gray-400">© 2025 뉴욕꼬맹이</footer>
    </div>
  );
}
