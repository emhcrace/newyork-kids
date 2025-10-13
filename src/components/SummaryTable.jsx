export default function SummaryTable({ data }) {
  const sizes = [90, 100, 110, 120, 130, 140, 150, 160, 170, 180];

  return (
    <div className="bg-white shadow-md rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-2 py-3 text-left">디자인명</th>
            {sizes.map((sz) => (
              <th key={sz} className="px-2 py-3 text-center">
                {sz}
              </th>
            ))}
            <th className="px-2 py-3 text-center">합계</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.design} className="border-b">
              <td className="px-2 py-2">{row.design}</td>
              {sizes.map((sz) => (
                <td key={sz} className="px-2 py-2 text-center">
                  {row[sz]}
                </td>
              ))}
              <td className="px-2 py-2 text-center font-semibold">
                {row.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
