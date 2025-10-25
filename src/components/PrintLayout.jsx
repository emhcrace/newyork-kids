import { useEffect, useMemo, useRef } from "react";

const SIZES = [90, 100, 110, 120, 130, 140, 150, 160, 170, 180];

const formatTimestamp = () => {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  return `${date} ${time}`;
};

export default function PrintLayout({ data, onClose, viewMode = "all" }) {
  const hasPrinted = useRef(false);
  const showPrintColumn = viewMode === "print";

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

  const grandTotal = useMemo(
    () => data.reduce((acc, row) => acc + (Number(row.total) || 0), 0),
    [data]
  );

  const timestamp = useMemo(() => formatTimestamp(), []);

  return (
    <div className="fixed inset-0 bg-white p-8 overflow-auto z-50">
      <button
        onClick={onClose}
        className="print:hidden absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded"
        type="button"
      >
        닫기
      </button>

      <h1 className="text-2xl font-bold mb-4">
        {timestamp} 인쇄 · 총합계 {grandTotal.toLocaleString()}개
      </h1>

      <table className="min-w-full border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            {showPrintColumn && (
              <th className="border px-2 py-1">나염번호</th>
            )}
            <th className="border px-2 py-1">상품명</th>
            <th className="border px-2 py-1">색상</th>
            {SIZES.map((size) => (
              <th key={size} className="border px-2 py-1 text-center">
                {size}
              </th>
            ))}
            <th className="border px-2 py-1 text-center">합계</th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row) => {
            const name = showPrintColumn
              ? row.baseName || row.displayName || "상품명 없음"
              : row.displayName || row.baseName || "상품명 없음";
            return (
              <tr key={row.id || row.displayName}>
                {showPrintColumn && (
                  <td className="border px-2 py-1 text-center">
                    {row.printCode || "-"}
                  </td>
                )}
                <td className="border px-2 py-1">{name}</td>
                <td className="border px-2 py-1">{row.color || "-"}</td>
                {SIZES.map((size) => (
                  <td key={size} className="border px-2 py-1 text-center">
                    {row[size]}
                  </td>
                ))}
                <td className="border px-2 py-1 text-center">{row.total}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
