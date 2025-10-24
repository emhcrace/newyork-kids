const XLSX = require('xlsx');

const SIZES = [90,100,110,120,130,140,150,160,170,180];`nconst ADULT_SIZE_MAP = { S: 90, M: 100, L: 110, XL: 120, "2XL": 130 };
function toNumber(v){ if(!v&&v!==0) return 0; const s = String(v).replace(/[\s,]/g,''); const n = parseInt(s,10); return Number.isFinite(n)?n:0; }
function cleanupDesign(n){ if(!n) return ""; let s=String(n).trim(); s=s.replace(/^(\\d+\\.|\\d+[_-])/, "").trim(); s = s.split("/")[0].trim(); s=s.replace(/[\\s/,-]+$/, "").trim(); s=s.split("_")[0].trim(); s=s.replace(/^([A-Z]{1,4}\\d{2,3})\\s+/, "$1"); return s; }{ if(!n) return ''; let s=String(n).trim(); s=s.replace(/^(\d+\.|\d+[_-])/, '').trim(); s=s.replace(/[\s/,-]+$/, '').trim(); s=s.split('_')[0].trim(); s=s.replace(/^([A-Z]{1,4}\d{2,3})\s+/, '$1'); return s; }
function parseFromSaleName(name){ if(!name) return null; const s=String(name).trim();
  let mAdult = s.match(/(?:\(성인\))?\s*(S|M|L|XL|2XL)\s*$/i); if(mAdult){ const size = ADULT_SIZE_MAP[mAdult[1].toUpperCase()]; if(size){ const left = s.slice(0, mAdult.index).trim(); return {design: cleanupDesign(left), size}; } }
  let m = s.match(/^\s*(.+?)\s*[\/\-]([^\s/]+)?\s+(\d{2,3})\s*$/); if(m){ return {design: cleanupDesign(m[1]), size: toNumber(m[3])}; }
  m = s.match(/^\s*(\d+\.)?\s*(.+?)\s+(\d{2,3})\s*$/); if(m){ let design=m[2]; const nameLabel = String(design).match(/상품명\s*[:]\s*([^/]+)/); if(nameLabel) design = nameLabel[1]; return {design: cleanupDesign(design), size: toNumber(m[3])}; }
  const lbl = s.match(/사이즈\s*[:=]\s*(\d{2,3}|S|M|L|XL|2XL)/i); if(lbl){ const token=String(lbl[1]).toUpperCase(); const size=/\d{2,3}/.test(token)?toNumber(token):ADULT_SIZE_MAP[token]; let design=''; const colorLabel = s.match(/색상\s*[:=]\s*(.*?)\s*(?:[\/|,]|\s{2,}|\s*\/\s*사이즈|,\s*사이즈)/); if(colorLabel){ design=cleanupDesign(colorLabel[1]); } else { const nameLabel2 = s.match(/상품명\/?\s*[:]?\s*(.*?)\s*(?:\/|,\s*사이즈)/); if(nameLabel2){ design=cleanupDesign(nameLabel2[1]); } else { const before = s.split(/\/?\s*사이즈\s*[:=]/)[0]; const parts=before.split('/'); design=cleanupDesign(parts[0]); } } if(design) return {design,size}; }
  const matches=[...s.matchAll(/\d{2,3}/g)].map(mm=>({n:toNumber(mm[0]), idx:mm.index})); const cands=matches.filter(x=>SIZES.includes(x.n)); if(cands.length){ const pick=cands[cands.length-1]; const size=pick.n; const left=s.slice(0,pick.idx).trim(); const design=cleanupDesign(left.split('/')[0]); if(design) return {design,size}; }
  return null; }
function parseFromExposure(exp){ if(!exp) return null; const s=String(exp).trim(); let m = s.match(/,\s*(\d+\.[^,]+),\s*(\d{2,3})\s*$/); if(m){ return {design: cleanupDesign(m[1]), size: toNumber(m[2])}; }
  let sizeM = s.match(/(\\d{2,3})\\s*$/); if(!sizeM) sizeM = s.match(/(S|M|L|XL|2XL)\\s*$/i); const codeM = s.match(/\b([A-Z]{1,4}\d{2,3})\b/);
  const keywords=['맨투맨z','오버핏맨투맨','기모맨투맨','스웨트셔츠','후드','후드티','캐주얼후드','기모오버핏후드','기모트레이닝팬츠','기모트레이닝세트','반팔','티셔츠'];
  const found=keywords.filter(k=>s.includes(k)).sort((a,b)=>b.length-a.length)[0];
  if(sizeM && codeM && found){ const token=String(sizeM[1]).toUpperCase(); const size=/\\d{2,3}/.test(token)?toNumber(token):ADULT_SIZE_MAP[token]; const design=cleanupDesign(`${codeM[1]}${found}`); return {design,size}; }
  return null;
}
function computeSummary(rows){ const result={}; for(const row of rows){
  let qty = 0; if(Object.prototype.hasOwnProperty.call(row,'수량')) qty = toNumber(row['수량']); else { for(const k of Object.keys(row)){ if(k.includes('수량')) { qty = toNumber(row[k]); break; } } }
  if(!qty) continue;
  const sale = row['판매처상품명'] || row['상품명'] || row['발주명'] || '';
  const exposure = row['노출명'] || '';
  let parsed = parseFromSaleName(sale) || parseFromExposure(exposure);
  if(!parsed) continue; let {design,size} = parsed; if(!SIZES.includes(size)) continue; if(!design) design='미지정';
  if(!result[design]) result[design] = {}; if(!result[design][size]) result[design][size]=0; result[design][size]+=qty;
 }
 return result;
}
function readInput(inputPath){ const wb=XLSX.readFile(inputPath); const ws=wb.Sheets[wb.SheetNames[0]]; const rows = XLSX.utils.sheet_to_json(ws, {defval:'', raw:false}); return computeSummary(rows); }
function readFinal(finalPath){ const wb=XLSX.readFile(finalPath); const ws=wb.Sheets[wb.SheetNames[0]]; const aoa = XLSX.utils.sheet_to_json(ws, {header:1, defval:''}); const map={};
 for(const row of aoa){ if(!row || !row.length) continue; const first = String(row[0]||'').trim(); if(!first || first.includes('주문현황')) continue; if(first==='상품명' || first==='칼라' || first==='합계' || first.includes('실내복')) continue; const design = first; if(!map[design]) map[design] = {}; for(let i=2;i<=11;i++){ const size = [null, null,90,100,110,120,130,140,150,160,170,180][i]; if(!size) continue; const val = toNumber(row[i]); if(!val) continue; if(!map[design][size]) map[design][size]=0; map[design][size]+=val; } }
 return map; }
function compare(a,b){ const d1 = Object.keys(a).sort(); const d2 = Object.keys(b).sort(); const diffs=[]; const set = new Set([...d1,...d2]); for(const design of set){ const ra=a[design]||{}; const rb=b[design]||{}; for(const sz of SIZES){ const va=ra[sz]||0; const vb=rb[sz]||0; if(va!==vb){ diffs.push(`${design} size ${sz}: input=${va}, final=${vb}`); } } } return diffs; }
const inputPath = process.argv[2]; const finalPath = process.argv[3];
const sumInput = readInput(inputPath); const sumFinal = readFinal(finalPath);
const diffs = compare(sumInput,sumFinal);
console.log('Designs in input:', Object.keys(sumInput).length);
console.log('Designs in final:', Object.keys(sumFinal).length);
if(diffs.length===0){ console.log('OK: summaries match'); } else { console.log('DIFFS:\n'+diffs.join('\n')); }

