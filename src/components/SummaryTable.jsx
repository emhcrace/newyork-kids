import { useMemo, useState } from "react";

const SIZES = [90, 100, 110, 120, 130, 140, 150, 160, 170, 180];

export default function SummaryTable({
  data,
  selectedIds = [],
  onToggleRow,
  onToggleAll,
  onUpdateCell,
  fixedHeight = false,
  viewMode = "all",
}) {
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [editing, setEditing] = useState(null);
  const [inputValue, setInputValue] = useState("");

  const showPrintColumn = viewMode === "print";

  const isSelected = (id) => selectedIds.includes(id);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedRows = useMemo(() => {
    const rows = [...data];
    const compareStrings = (a, b) => a.localeCompare(b, "ko", { sensitivity: "base" });

    rows.sort((a, b) => {
      if (sortKey === "name") {
        const nameCompare = compareStrings(a.baseName || "", b.baseName || "");
        if (nameCompare !== 0) return sortDir === "asc" ? nameCompare : -nameCompare;

        const colorCompare = compareStrings(a.color || "", b.color || "");
        if (colorCompare !== 0) return sortDir === "asc" ? colorCompare : -colorCompare;

        const totalDiff = (Number(a.total) || 0) - (Number(b.total) || 0);
        return sortDir === "asc" ? totalDiff : -totalDiff;
      }

      const totalDiff = (Number(a.total) || 0) - (Number(b.total) || 0);
      return sortDir === "asc" ? totalDiff : -totalDiff;
    });

    return rows;
  }, [data, sortDir, sortKey]);

  const sizeTotals = useMemo(
    () =>
      SIZES.map((size) =>
        data.reduce((acc, row) => acc + (Number(row[size]) || 0), 0)
      ),
    [data]
  );

  const grandTotal = useMemo(
    () => data.reduce((acc, row) => acc + (Number(row.total) || 0), 0),
    [data]
  );

  const visibleIds = useMemo(() => sortedRows.map((row) => row.id), [sortedRows]);
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  const startEditing = (row, field) => {
    let value = "";
    if (field === "name") value = row.baseName || "";
    else if (field === "color") value = row.color || "";
    else if (SIZES.includes(field)) value = String(row[field] ?? "");
    else return;

    setEditing({ id: row.id, field });
    setInputValue(value);
  };

  const commitEdit = () => {
    if (!editing) return;
    onUpdateCell?.(editing.id, editing.field, inputValue);
    setEditing(null);
    setInputValue("");
  };

  const cancelEdit = () => {
    setEditing(null);
    setInputValue("");
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitEdit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
    }
  };

  const renderNameCell = (row, isEditingRow, editingField) => {
    if (isEditingRow && editingField === "name") {
      return (
        <input
          autoFocus
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          className="w-full px-2 py-1 rounded border text-black"
        />
      );
    }

    if (showPrintColumn) {
      return row.baseName || "상품명 없음";
    }

    return row.displayName || row.baseName || "상품명 없음";
  };

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
            <th className="px-3 py-4 text-center w-12">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(event) =>
                  onToggleAll?.(visibleIds, event.target.checked)
                }
              />
            </th>
            {showPrintColumn && <th className="px-3 py-4 text-left">나염번호</th>}
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
              합계{sortKey === "total" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => {
            const isEditingRow = editing && editing.id === row.id;
            const editingField = isEditingRow ? editing.field : null;
            return (
              <tr
                key={row.id}
                className="border-b even:bg-gray-50 transition-colors hover:bg-indigo-600 hover:text-white"
              >
                <td className="px-3 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={isSelected(row.id)}
                    onChange={() => onToggleRow?.(row.id)}
                  />
                </td>
                {showPrintColumn && (
                  <td className="px-3 py-3 text-left">{row.printCode || "-"}</td>
                )}
                <td
                  className="px-3 py-3 cursor-pointer"
                  onDoubleClick={() => startEditing(row, "name")}
                >
                  {renderNameCell(row, isEditingRow, editingField)}
                </td>
                <td
                  className="px-3 py-3 cursor-pointer"
                  onDoubleClick={() => startEditing(row, "color")}
                >
                  {isEditingRow && editingField === "color" ? (
                    <input
                      autoFocus
                      value={inputValue}
                      onChange={(event) => setInputValue(event.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={handleKeyDown}
                      className="w-full px-2 py-1 rounded border text-black"
                    />
                  ) : (
                    row.color || "-"
                  )}
                </td>
                {SIZES.map((size) => (
                  <td
                    key={size}
                    className="px-3 py-3 text-center cursor-pointer"
                    onDoubleClick={() => startEditing(row, size)}
                  >
                    {isEditingRow && editingField === size ? (
                      <input
                        autoFocus
                        type="number"
                        min="0"
                        value={inputValue}
                        onChange={(event) => setInputValue(event.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={handleKeyDown}
                        className="w-20 px-2 py-1 rounded border text-black text-right"
                      />
                    ) : (
                      row[size]
                    )}
                  </td>
                ))}
                <td className="px-3 py-3 text-center font-semibold">
                  {row.total}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="sticky bottom-0 z-10 bg-gray-100 border-t font-semibold">
            <td className="px-3 py-3 text-center">-</td>
            {showPrintColumn && <td className="px-3 py-3 text-center">-</td>}
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