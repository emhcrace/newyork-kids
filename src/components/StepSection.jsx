export default function StepSection() {
  const steps = [
    { title: "파일 업로드", description: "변환할 Excel 주문서를 선택합니다" },
    { title: "자동 처리", description: "자동 분석하여 집계표를 만듭니다." },
    { title: "결과 확인", description: "바로 확인하고 필요하면 다운로드합니다" },
  ];

  return (
    <section className="mt-12 w-11/12 max-w-5xl">
      <h2 className="text-2xl font-bold text-center mb-8">
        엑셀 문서를 집계표로 변환하는 방법
      </h2>
      <div className="flex flex-col md:flex-row justify-between items-center space-y-6 md:space-y-0">
        {steps.map((step, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center mb-4">
              {idx + 1}
            </div>
            <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
            <p className="text-gray-600 text-sm">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

