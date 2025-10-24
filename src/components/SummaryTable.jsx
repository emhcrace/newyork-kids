import { useMemo, useState } from "react";

const SIZES = [90, 100, 110, 120, 130, 140, 150, 160, 170, 180];

function cleanseDesign(value) {
  return String(value ?? "")
    .replace(/,\s*사이즈\s*=\s*/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export default function SummaryTable({ data, fixedHeight = false }) {
  const sizeTotals = SIZES.map((size) =>
    data.reduce((acc, row) => acc + (Number(row[size]) || 0), 0)
  );
  const grandTotal = data.reduce((acc, row) => acc + (Number(row.total) || 0), 0);

  const [sortKey, setSortKey] = useState("name"); // 'name' | 'total'
  const [sortDir, setSortDir] = useState("asc"); // 'asc' | 'desc'

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedRows = useMemo(() => {
    if (!sortKey) return data;
    const rows = [...data];
    const getName = (row) => {
      const cleaned = cleanseDesign(row.design);
      const match = cleaned.match(/^(.*?)(?:\(([^)]+)\))?$/);
      return (match ? match[1] : cleaned).trim();
    };
    rows.sort((a, b) => {
      if (sortKey === "name") {
        const nameA = getName(a);
        const nameB = getName(b);
        let cmp = nameA.localeCompare(nameB, "ko", { sensitivity: "base" });
        if (cmp === 0) {
          const colorA = (cleanseDesign(a.design).match(/\(([^)]+)\)$/) || ["", ""])[1];
          const colorB = (cleanseDesign(b.design).match(/\(([^)]+)\)$/) || ["", ""])[1];
          cmp = colorA.localeCompare(colorB, "ko", { sensitivity: "base" });
          if (cmp === 0) cmp = (Number(b.total) || 0) - (Number(a.total) || 0);
        }
        return sortDir === "asc" ? cmp : -cmp;
      }
      const totalA = Number(a.total) || 0;
      const totalB = Number(b.total) || 0;
      return sortDir === "asc" ? totalA - totalB : totalB - totalA;
    });
    return rows;
  }, [data, sortDir, sortKey]);

  return (
    <div
      className={`bg-white shadow-md rounded-lg overflow-x-auto overflow-y-auto ${
        fixedHeight
          ? "h-[35vh] md:h-[37.5vh] lg:h-[40vh]"
          : "max-h-[35vh] md:max-h-[37.5vh] lg:max-h-[40vh]"
      }`}
    >
      <table className="min-w-full text-base md:text-lg">
        <thead className="sticky top-0 z-10 bg-gray-100">
          <tr>
            <th
              className="px-3 py-4 text-left select-none cursor-pointer"
              onClick={() => toggleSort("name")}
              title="상품명 정렬"
            >
              상품명
              {sortKey === "name" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
            </th>
            <th className="px-3 py-4 text-left">색상</th>
            {SIZES.map((size) => (
              <th key={size} className="px-3 py-4 text-center">
                {size}
              </th>
            ))}
            <th
              className="px-3 py-4 text-center select-none cursor-pointer"
              onClick={() => toggleSort("total")}
              title="합계 정렬"
            >
              합계
              {sortKey === "total" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => {
            const cleaned = cleanseDesign(row.design);
            const match = cleaned.match(/^(.*?)(?:\(([^)]+)\))?$/);
            const name = match ? match[1] : cleaned;
            const color = match && match[2] ? match[2] : "";
            return (
              <tr
                key={row.design}
                className="border-b even:bg-gray-50 transition-colors hover:bg-indigo-600 hover:text-white"
              >
                <td className="px-3 py-3">{name}</td>
                <td className="px-3 py-3">{color || "-"}</td>
                {SIZES.map((size) => (
                  <td key={size} className="px-3 py-3 text-center">
                    {row[size]}
                  </td>
                ))}
                <td className="px-3 py-3 text-center font-semibold">{row.total}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="sticky bottom-0 z-10 bg-gray-100 border-t font-semibold">
            <td className="px-3 py-3" colSpan={2}>
              합계
            </td>
            {SIZES.map((size, index) => (
              <td key={`total-${size}`} className="px-3 py-3 text-center">
                {sizeTotals[index]}
              </td>
            ))}
            <td className="px-3 py-3 text-center">{grandTotal}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

