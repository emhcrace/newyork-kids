import { useState } from "react";
import * as XLSX from "xlsx";

/**
 * 업로드된 엑셀 데이터를 디자인·사이즈별로 합산하는 함수
 */
function computeSummary(rows) {
  const sizes = [90, 100, 110, 120, 130, 140, 150, 160, 170, 180];
  const result = {};
  rows.forEach((row) => {
    const name = row["노출명"];
    const qty = Number(row["수량"]);
    if (!name || !qty) return;

    const parts = name.split(",").map((p) => p.trim());
    let design = null;
    // "숫자.디자인명" 패턴 찾기
    for (const part of parts) {
      const match = part.match(/\\d+\\.(.+)/);
      if (match) {
        design = match[1].trim();
        break;
      }
    }
    // 없으면 마지막-1 요소에서 디자인 추출
    if (!design && parts.length >= 2) {
      const second = parts[parts.length - 2];
      design = second.split("/")[0].trim();
    }
    const size = parseInt(parts[parts.length - 1], 10);
    if (!sizes.includes(size) || !design) return;
    if (!result[design]) result[design] = {};
    if (!result[design][size]) result[design][size] = 0;
    result[design][size] += qty;
  });
  return Object.keys(result).map((design) => {
    let total = 0;
    const row = { design };
    sizes.forEach((sz) => {
      const val = result[design][sz] || 0;
      row[sz] = val;
      total += val;
    });
    row.total = total;
    return row;
  });
}

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
      {/* 나머지 UI는 동일 (제목, 설명, 버튼, 아이콘, 드래그 안내) */}

      {/* 제목 및 설명 */}
      <div className="flex flex-col items-center mb-6">
        <svg
          className="w-12 h-12 text-blue-500 mb-2"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          {/* 파일 모양 아이콘 */}
          <path d="M3 3a2 2 0 012-2h6l6 6v9a2 2 0 01-2 2H5a2 2 0 01-2-2V3z" />
          <path d="M15 8H9V2L15 8z" className="opacity-75" />
        </svg>
        <h2 className="text-2xl font-bold text-gray-700">엑셀 주문서 변환기</h2>
        <p className="text-gray-600 mt-2">
          Excel 주문서를 즉시 디자인·사이즈별 집계표로 변환합니다.
        </p>
      </div>

      {/* 업로드 버튼 (label + 숨겨진 input) */}
      <label className="inline-flex items-center px-6 py-3 bg-blue-500 text-white font-medium rounded-lg cursor-pointer hover:bg-blue-600 transition-colors">
        엑셀 문서 선택
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
        />
      </label>

      {/* 드래그 중일 때 오버레이 텍스트 */}
      {dragActive && (
        <div className="absolute inset-0 bg-blue-100 bg-opacity-50 flex items-center justify-center rounded-2xl pointer-events-none">
          <p className="text-blue-700 font-medium">여기에 파일을 놓아주세요</p>
        </div>
      )}
    </div>
  );
}
