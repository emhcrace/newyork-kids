import { useState } from "react";
import UploadForm from "../components/UploadForm";
import SummaryTable from "../components/SummaryTable";
import StepSection from "../components/StepSection";
import * as XLSX from "xlsx"; // 엑셀 변환을 위해 추가
import PrintLayout from "../components/PrintLayout";

export default function LandingPage() {
  const [summary, setSummary] = useState([]);
  const [showPrintLayout, setShowPrintLayout] = useState(false);

  // 요약 결과를 엑셀 파일로 저장하는 함수
  const handleDownload = () => {
    // 헤더 및 rows는 기존 로직과 동일
    const header = [
      "디자인명",
      "90",
      "100",
      "110",
      "120",
      "130",
      "140",
      "150",
      "160",
      "170",
      "180",
      "합계",
    ];
    const rows = summary.map((row) => [
      row.design,
      row[90],
      row[100],
      row[110],
      row[120],
      row[130],
      row[140],
      row[150],
      row[160],
      row[170],
      row[180],
      row.total,
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Summary");
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `nykids-summary-${timestamp}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  return (
    <div className="min-h-screen flex flex-col items-center bg-white py-8">
      <header className="w-11/12 max-w-5xl text-center mb-10">
        <img
          src="https://emhcrace.github.io/newyork-kids/logo_on.png"
          alt="뉴욕꼬맹이 로고"
          className="mx-auto mb-4 h-16 md:h-20"
        />
        <p className="text-gray-600">
          Excel 주문서를 즉시 디자인·사이즈별 집계표로 변환해보세요.
        </p>
      </header>

      {/* 업로드 카드 */}
      <div className="w-11/12 max-w-5xl">
        <UploadForm onData={setSummary} />
      </div>

      {/* 단계 설명 - 파일 업로드 전에는 이 안내를 표시 */}
      {summary.length === 0 && <StepSection />}

      {summary.length > 0 && !showPrintLayout && (
        <div className="w-11/12 max-w-5xl mt-12 space-y-4">
          <SummaryTable data={summary} />
          <div className="flex space-x-2">
            <button
              onClick={() => setShowPrintLayout(true)}
              className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
            >
              인쇄하기
            </button>
            {/* 다운로드 버튼은 그대로 */}
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              요약 엑셀 다운로드
            </button>
          </div>
        </div>
      )}

      {/* 프린트 레이아웃 표시 여부 */}
      {showPrintLayout && (
        <PrintLayout data={summary} onClose={() => setShowPrintLayout(false)} />
      )}

      <footer className="mt-auto py-8 text-sm text-gray-400">
        © 2025 뉴욕꼬맹이
      </footer>
    </div>
  );
}
