export default function SummaryTable({ data }) {
  const sizes = [90, 100, 110, 120, 130, 140, 150, 160, 170, 180];

  return (
    <div className="bg-white shadow-md rounded-lg overflow-x-auto overflow-y-auto max-h-[35vh] md:max-h-[37.5vh] lg:max-h-[40vh]">
      <table className="min-w-full text-base md:text-lg">
        <thead className="sticky top-0 z-10 bg-gray-100">
          <tr>
            <th className="px-3 py-4 text-left">상품명</th>
            {sizes.map((sz) => (
              <th key={sz} className="px-3 py-4 text-center">
                {sz}
              </th>
            ))}
            <th className="px-3 py-4 text-center">합계</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={row.design}
              className="border-b even:bg-gray-50 transition-colors hover:bg-indigo-600 hover:text-white"
            >
              <td className="px-3 py-3">{row.design}</td>
              {sizes.map((sz) => (
                <td key={sz} className="px-3 py-3 text-center">
                  {row[sz]}
                </td>
              ))}
              <td className="px-3 py-3 text-center font-semibold">
                {row.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
