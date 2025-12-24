import { useEffect, useMemo, useRef } from "react";
import { NUMERIC_SIZES, ADULT_SIZES } from "../lib/summary";

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
}) {
  const hasPrinted = useRef(false);
  const showPrintColumn = viewMode === "print";

  useEffect(() => {
    if (!hasPrinted.current) {
      hasPrinted.current = true;
      window.print();
    }
  }, []);

  const { childrenData, adultData } = useMemo(() => {
    const children = [];
    const adults = [];

    data.forEach((row) => {
      if (row.ageGroup === "어린이") {
        children.push(row);
      } else if (row.ageGroup === "성인") {
        adults.push(row);
      }
    });

    const sortFn = (a, b) =>
      (a.baseName || a.displayName || "").localeCompare(
        b.baseName || b.displayName || "",
        "ko",
        { sensitivity: "base" }
      );

    children.sort(sortFn);
    adults.sort(sortFn);

    return { childrenData: children, adultData: adults };
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

  const renderTable = (title, tableData, sizeColumns) => {
    if (tableData.length === 0) return null;

    return (
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-3">{title}</h2>
        <table className="min-w-full border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              {showPrintColumn && <th className="border px-2 py-1">나염번호</th>}
              <th className="border px-2 py-1">상품명</th>
              <th className="border px-2 py-1">색상</th>
              {sizeColumns.map((size) => (
                <th key={size} className="border px-2 py-1 text-center">
                  {size}
                </th>
              ))}
              <th className="border px-2 py-1 text-center">합계</th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row) => {
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
                  {sizeColumns.map((size) => {
                    const hasValue = Number(row[size]) > 0;
                    return (
                      <td
                        key={size}
                        className={`border px-2 py-1 text-center ${
                          hasValue ? "bg-gray-200" : ""
                        }`}
                      >
                        <Cell label={size} value={row[size]} align="center" />
                      </td>
                    );
                  })}
                  <td className="border px-2 py-1 text-center font-semibold">
                    <Cell label="합계" value={row.total} align="center" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-white p-8 overflow-auto z-50 print:relative print:inset-auto print:p-4 print:overflow-visible print:h-auto">
      <style>{`
        @media print {
          table { page-break-inside: auto; }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          td { page-break-inside: avoid; page-break-after: auto; }
        }
      `}</style>
      <button
        onClick={onClose}
        className="print:hidden absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded"
        type="button"
      >
        닫기
      </button>

      <h1 className="text-2xl font-bold mb-6">
        {timestamp} {totalLabel} {totalValue.toLocaleString()}개{totalDetail}
      </h1>

      {renderTable("어린이", childrenData, NUMERIC_SIZES)}
      {renderTable("성인", adultData, ADULT_SIZES)}
    </div>
  );
}
