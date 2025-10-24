const XLSX = require('xlsx');
const file = process.argv[2];
const wb = XLSX.readFile(file);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws,{defval:'',raw:false});
console.log('Headers:', Object.keys(rows[0]||{}));
for(const r of rows){
  const sale = r['판매처상품명']||r['상품명']||r['발주명']||'';
  if(/\/|색상|상품명/.test(sale)) { console.log(sale, r['수량']); }
}
