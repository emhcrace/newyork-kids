// PrintLayout.jsx
import { useEffect, useRef } from "react";

export default function PrintLayout({ data, onClose }) {
  const hasPrinted = useRef(false);

  useEffect(() => {
    // StrictMode로 인해 effect가 두 번 실행되는 것을 방지
    if (!hasPrinted.current) {
      hasPrinted.current = true;
      window.print();
    }
  }, []);

  const sizes = [90, 100, 110, 120, 130, 140, 150, 160, 170, 180];

  return (
    <div className="fixed inset-0 bg-white p-8 overflow-auto z-50">
      {/* ?リ린 踰꾪듉, ?꾨┛?????④? */}
      <button
        onClick={onClose}
        className="print:hidden absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded"
      >
        X
      </button>

      <h1 className="text-2xl font-bold mb-4">요약 결과</h1>
      <table className="min-w-full border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-2 py-1">상품명</th>
            {sizes.map((sz) => (
              <th key={sz} className="border px-2 py-1 text-center">
                {sz}
              </th>
            ))}
            <th className="border px-2 py-1 text-center">합계</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.design}>
              <td className="border px-2 py-1">{row.design}</td>
              {sizes.map((sz) => (
                <td key={sz} className="border px-2 py-1 text-center">
                  {row[sz]}
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

