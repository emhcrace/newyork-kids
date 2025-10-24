import { useState } from "react";
import * as XLSX from "xlsx";
import { computeSummary } from "../lib/summary";

export default function UploadForm({ onData }) {
  const [dragActive, setDragActive] = useState(false);

  const processFile = (file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      const summary = computeSummary(rows);
      onData(summary);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) processFile(file);
  };

  const preventDefaults = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDragEnter = (event) => {
    preventDefaults(event);
    setDragActive(true);
    if (typeof onData === "function") {
      onData([]);
    }
  };

  const handleDragLeave = (event) => {
    preventDefaults(event);
    setDragActive(false);
  };

  const handleDrop = (event) => {
    preventDefaults(event);
    setDragActive(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div
      className={`relative rounded-2xl p-8 border-2 ${
        dragActive
          ? "border-blue-500 bg-blue-100"
          : "border-dashed border-blue-300 bg-blue-50"
      } text-center transition-colors min-h-96`}
      onDragEnter={handleDragEnter}
      onDragOver={preventDefaults}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center mb-6 mt-20">
        <h2 className="text-2xl font-bold text-gray-700">엑셀 주문서를 업로드하세요</h2>
        <p className="text-gray-600 mt-2">
          파일을 끌어오거나 아래 버튼을 눌러 요약을 시작할 수 있습니다.
        </p>
      </div>

      <label className="inline-flex items-center px-6 py-3 bg-blue-500 text-white font-medium rounded-lg cursor-pointer hover:bg-blue-600 transition-colors">
        Excel 파일 선택
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
        />
      </label>

      {dragActive && (
        <div className="absolute inset-0 bg-blue-100 bg-opacity-50 flex items-center justify-center rounded-2xl pointer-events-none">
          <p className="text-blue-700 text-2xl font-bold">여기에 파일을 놓아주세요</p>
        </div>
      )}
    </div>
  );
}

