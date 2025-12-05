import { useEffect, useMemo, useRef } from "react";
import { SIZES as DEFAULT_SIZES } from "../lib/summary";

const formatTimestamp = () => {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
    now.getSeconds()
  )}`;
  return `${date} ${time}`;
};

export default function PrintLayout({
  data,
  onClose,
  viewMode = "all",
  sizes = DEFAULT_SIZES,
}) {
  const hasPrinted = useRef(false);
  const showPrintColumn = viewMode === "print";
  const sizeList = sizes && sizes.length ? sizes : DEFAULT_SIZES;

  useEffect(() => {
    if (!hasPrinted.current) {
      hasPrinted.current = true;
      window.print();
    }
  }, []);

  const sortedData = useMemo(() => {
    const rows = [...data];
    rows.sort((a, b) =>
      (a.baseName || a.displayName || "").localeCompare(
        b.baseName || b.displayName || "",
        "ko",
        { sensitivity: "base" }
      )
    );
    return rows;
  }, [data]);

  const totals = useMemo(() => {
    let printTotal = 0;
    let generalTotal = 0;
    let allTotal = 0;
    data.forEach((row) => {
      const value = Number(row.total) || 0;
      allTotal += value;
      if (row.hasPrintCode) printTotal += value;
      else generalTotal += value;
    });
    return { allTotal, printTotal, generalTotal };
  }, [data]);

  const totalLabel =
    viewMode === "print"
      ? "나염 총합계"
      : viewMode === "general"
      ? "일반 총합계"
      : "전체 총합계";

  const totalValue =
    viewMode === "print"
      ? totals.printTotal
      : viewMode === "general"
      ? totals.generalTotal
      : totals.allTotal;

  const totalDetail =
    viewMode === "all"
      ? ` (나염 ${totals.printTotal.toLocaleString()}개 · 일반 ${totals.generalTotal.toLocaleString()}개)`
      : "";

  const Cell = ({ label, value, align = "left" }) => (
    <div
      className={`flex flex-col gap-1 ${
        align === "center"
          ? "items-center text-center"
          : "items-start text-left"
      }`}
    >
      <span className="text-[11px] font-semibold text-gray-500">{label}</span>
      <span className={align === "center" ? "text-center" : "text-left"}>
        {value}
      </span>
    </div>
  );

  const timestamp = useMemo(() => formatTimestamp(), []);

  return (
    <div className="fixed inset-0 bg-white p-8 overflow-auto z-50 print:relative print:inset-auto print:p-4 print:overflow-visible print:h-auto">
      <button
        onClick={onClose}
        className="print:hidden absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded"
        type="button"
      >
        닫기
      </button>

      <h1 className="text-2xl font-bold mb-4">
        {timestamp} {totalLabel} {totalValue.toLocaleString()}개{totalDetail}
      </h1>

      <table className="min-w-full border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            {showPrintColumn && <th className="border px-2 py-1">나염번호</th>}
            <th className="border px-2 py-1">상품명</th>
            <th className="border px-2 py-1">색상</th>
            {sizeList.map((size) => (
              <th key={size} className="border px-2 py-1 text-center">
                {size}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, index) => {
            const name = showPrintColumn
              ? row.baseName || row.displayName || "상품명 없음"
              : row.displayName || row.baseName || "상품명 없음";
            return (
              <tr key={row.id || row.displayName}>
                {showPrintColumn && (
                  <td className="border px-2 py-1 text-center">
                    <Cell
                      label="나염번호"
                      value={row.printCode || "-"}
                      align="center"
                    />
                  </td>
                )}
                <td className="border px-2 py-1">
                  <Cell label="상품명" value={name} />
                </td>
                <td className="border px-2 py-1">
                  <Cell label="색상" value={row.color || "-"} />
                </td>
                {sizeList.map((size) => (
                  <td key={size} className="border px-2 py-1 text-center">
                    <Cell label={size} value={row[size]} align="center" />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
