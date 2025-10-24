import { useEffect, useMemo, useRef } from "react";

const SIZES = [90, 100, 110, 120, 130, 140, 150, 160, 170, 180];

export default function PrintLayout({ data, onClose }) {
  const hasPrinted = useRef(false);

  useEffect(() => {
    if (!hasPrinted.current) {
      hasPrinted.current = true;
      window.print();
    }
  }, []);

  const sortedData = useMemo(() => {
    const rows = [...data];
    rows.sort((a, b) =>
      (a.baseName || a.design || "").localeCompare(b.baseName || b.design || "", "ko", {
        sensitivity: "base",
      })
    );
    return rows;
  }, [data]);

  return (
    <div className="fixed inset-0 bg-white p-8 overflow-auto z-50">
      <button
        onClick={onClose}
        className="print:hidden absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded"
        type="button"
      >
        닫기
      </button>

      <h1 className="text-2xl font-bold mb-4">요약 결과</h1>
      <table className="min-w-full border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
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
          {sortedData.map((row) => (
            <tr key={row.id || row.design}>
              <td className="border px-2 py-1">{row.baseName || row.design}</td>
              <td className="border px-2 py-1">{row.color || "-"}</td>
              {SIZES.map((size) => (
                <td key={size} className="border px-2 py-1 text-center">
                  {row[size]}
                </td>
              ))}
              <td className="border px-2 py-1 text-center">{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

