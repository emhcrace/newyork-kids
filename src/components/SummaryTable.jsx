export default function SummaryTable({ data }) {
  const sizes = [90, 100, 110, 120, 130, 140, 150, 160, 170, 180];
  const sizeTotals = sizes.map((sz) => data.reduce((acc, row) => acc + (Number(row[sz]) || 0), 0));
  const grandTotal = data.reduce((acc, row) => acc + (Number(row.total) || 0), 0);

  return (
    <div className="bg-white shadow-md rounded-lg overflow-x-auto overflow-y-auto max-h-[35vh] md:max-h-[37.5vh] lg:max-h-[40vh]">
      <table className="min-w-full text-base md:text-lg">
        <thead className="sticky top-0 z-10 bg-gray-100">
          <tr>
            <th className="px-3 py-4 text-left">상품명</th>
            <th className="px-3 py-4 text-left">색상</th>
            {sizes.map((sz) => (
              <th key={sz} className="px-3 py-4 text-center">
                {sz}
              </th>
            ))}
            <th className="px-3 py-4 text-center">합계</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const m = String(row.design || '').match(/^(.*?)(?:\(([^)]+)\))?$/);
            const name = m ? m[1] : row.design;
            const color = m && m[2] ? m[2] : '';
            return (
              <tr
                key={row.design}
                className="border-b even:bg-gray-50 transition-colors hover:bg-indigo-600 hover:text-white"
              >
                <td className="px-3 py-3">{name}</td>
                <td className="px-3 py-3">{color || '-'}</td>
                {sizes.map((sz) => (
                  <td key={sz} className="px-3 py-3 text-center">
                    {row[sz]}
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
            <td className="px-3 py-3" colSpan={2}>합계</td>
            {sizes.map((sz, idx) => (
              <td key={`total-${sz}`} className="px-3 py-3 text-center">{sizeTotals[idx]}</td>
            ))}
            <td className="px-3 py-3 text-center">{grandTotal}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}


