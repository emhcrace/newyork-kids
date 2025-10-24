import { useState } from "react";
import * as XLSX from "xlsx";
import { computeSummary } from "../lib/summary";

export default function UploadForm({ onData }) {
  const [dragActive, setDragActive] = useState(false);

  // 업로드한 파일을 읽어 summary 생성
  const processFile = (file) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      const summary = computeSummary(rows);
      onData(summary);
    };
    reader.readAsArrayBuffer(file);
  };

  // input change 핸들러
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      processFile(file);
    }
  };

  // Drag & Drop 이벤트
  const preventDefaults = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDragEnter = (e) => {
    preventDefaults(e);
    setDragActive(true);
  };
  const handleDragLeave = (e) => {
    preventDefaults(e);
    setDragActive(false);
  };
  const handleDrop = (e) => {
    preventDefaults(e);
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
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
      {/* 헤더 영역 */}
      <div className="flex flex-col items-center mb-6 mt-20">
        <h2 className="text-2xl font-bold text-gray-700">엑셀 주문서 변환기</h2>
        <p className="text-gray-600 mt-2">
          Excel 주문서를 즉시 디자인·사이즈별 집계표로 변환합니다.
        </p>
      </div>

      {/* 업로드 버튼 (label + 숨김 input) */}
      <label className="inline-flex items-center px-6 py-3 bg-blue-500 text-white font-medium rounded-lg cursor-pointer hover:bg-blue-600 transition-colors">
        Excel 문서 선택
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
        />
      </label>

      {/* 드래그 중일 때 오버레이 표시 */}
      {dragActive && (
        <div className="absolute inset-0 bg-blue-100 bg-opacity-50 flex items-center justify-center rounded-2xl pointer-events-none">
          <p className="text-blue-700 font-medium">여기로 파일을 끌어오세요</p>
        </div>
      )}
    </div>
  );
}

