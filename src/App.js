import { useState } from "react";
import * as XLSX from "xlsx";

export default function App() {
  const [fileName, setFileName] = useState("");
  const [summary, setSummary] = useState([]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      const summaryData = computeSummary(rows);
      setSummary(summaryData);
    };
    reader.readAsArrayBuffer(file);
  };

  // 엑셀 각 행을 디자인명·사이즈별 합계로 변환
  const computeSummary = (rows) => {
    const sizes = [90, 100, 110, 120, 130, 140, 150, 160, 170, 180];
    const result = {};

    rows.forEach((row) => {
      const name = row["노출명"];
      const qty = Number(row["수량"]);
      if (!name || !qty) return;

      const parts = name.split(",").map((p) => p.trim());
      let design = null;
      // 1) "숫자.디자인명" 패턴 찾기
      for (const part of parts) {
        const m = part.match(/\\d+\\.(.+)/);
        if (m) {
          design = m[1].trim();
          break;
        }
      }
      // 2) 패턴이 없으면 마지막-1 요소에서 색상 제거
      if (!design && parts.length >= 2) {
        const second = parts[parts.length - 2];
        design = second.split("/")[0].trim();
      }
      // 3) 마지막 요소를 사이즈로 파싱
      const size = parseInt(parts[parts.length - 1], 10);
      if (!sizes.includes(size) || !design) return;

      // 집계
      if (!result[design]) result[design] = {};
      if (!result[design][size]) result[design][size] = 0;
      result[design][size] += qty;
    });

    // 표 형태 배열로 변환 + 합계
    const summaryList = [];
    Object.keys(result).forEach((design) => {
      const row = { design };
      let total = 0;
      sizes.forEach((sz) => {
        const val = result[design][sz] || 0;
        row[sz] = val;
        total += val;
      });
      row.total = total;
      summaryList.push(row);
    });
    // 디자인명 순으로 정렬
    summaryList.sort((a, b) => a.design.localeCompare(b.design));
    return summaryList;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-blue-100 to-blue-50">
      <h1 className="text-4xl font-bold text-blue-600 mb-8">NewYork Kids</h1>

      <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-xl">
        <h2 className="text-xl font-semibold mb-4">엑셀 업로드</h2>

        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="mb-4 w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
        />

        {fileName && (
          <div className="mb-4 text-sm text-gray-600">
            📄 선택한 파일: {fileName}
          </div>
        )}

        {/* 요약표 출력 */}
        {summary.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-2 py-2">디자인명</th>
                  {[90, 100, 110, 120, 130, 140, 150, 160, 170, 180].map(
                    (sz) => (
                      <th key={sz} className="px-2 py-2">
                        {sz}
                      </th>
                    )
                  )}
                  <th className="px-2 py-2">합계</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((row) => (
                  <tr key={row.design} className="odd:bg-gray-50">
                    <td className="px-2 py-2 border-b border-gray-200 whitespace-nowrap">
                      {row.design}
                    </td>
                    {[90, 100, 110, 120, 130, 140, 150, 160, 170, 180].map(
                      (sz) => (
                        <td
                          key={sz}
                          className="px-2 py-2 border-b border-gray-200 text-center"
                        >
                          {row[sz] || 0}
                        </td>
                      )
                    )}
                    <td className="px-2 py-2 border-b border-gray-200 text-center font-semibold">
                      {row.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
