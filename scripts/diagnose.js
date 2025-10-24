const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname,'..','src','lib','rules.json'), 'utf8'));

const SIZES = RULES.allowedSizes;
const ADULT_SIZE_MAP = RULES.adultSizeMap;
const COLOR_WORDS = RULES.colors;
const STOP_WORDS = RULES.stopwords || [];
const KEYWORDS = RULES.keywords;
const CODE_CANON = RULES.codeCanon || {};

function toNumber(val){ if(val===null||val===undefined) return 0; if(typeof val==='number') return val; const s=String(val).replace(/[\s,]/g,''); const n=parseInt(s,10); return Number.isFinite(n)?n:0; }
function applyAliases(s){ if(!Array.isArray(RULES.aliases)) return s; let out=s; for(const a of RULES.aliases){ try{ out = out.replace(new RegExp(a.pattern,'g'), a.replace);}catch{} } return out; }
function cleanupDesign(name){ if(!name) return ''; let s=String(name).trim(); s=applyAliases(s); s=s.replace(/^(\d+\.|\d+[_-])/, '').trim(); s=s.split('/')[0].trim(); s=s.replace(/[\s/,-]+$/, '').trim(); s=s.split('_')[0].trim(); s=s.replace(/^([A-Z]{1,4}\d{2,3})\s+/, '$1'); s=applyAliases(s); return s; }
function canonicalizeDesign(design){ const m=String(design).match(/^([A-Z]{1,4}\d{2,3})/); if(m && CODE_CANON[m[1]]) return `${m[1]}${CODE_CANON[m[1]]}`; return design; }
function detectColorFromText(s){ const m1=s.match(/색상\s*[:=]\s*([^,\/\s)]+)/); if(m1) return applyAliases(m1[1]).trim(); const m2=s.match(/\/([^\s/]+)\s+\d{2,3}\s*$/); if(m2) return applyAliases(m2[1]).trim(); const m3=s.match(/\(([^)]+)\)/); if(m3){ const cand=applyAliases(m3[1]).trim(); if(COLOR_WORDS.includes(cand)) return cand; } return ''; }
function parseFromSaleName(name){ if(!name) return null; const s=String(name).trim();
  const mCol=s.match(/:([0-9]{2,3})(?!.*:)/); if(mCol){ const size=toNumber(mCol[1]); if(SIZES.includes(size)){ const left=s.substring(0,mCol.index).trim(); return {design:cleanupDesign(left), size, color:detectColorFromText(s), score:3, source:'sale:colon'}; } }
  const mAdult=s.match(/(?:\(성인\))?\s*(S|M|L|XL|2XL)\s*$/i); if(mAdult){ const size=ADULT_SIZE_MAP[mAdult[1].toUpperCase()]; if(size){ const left=s.slice(0,mAdult.index).trim(); return {design:cleanupDesign(left), size, color:detectColorFromText(s), score:2, source:'sale:adult'}; } }
  let m=s.match(/^\s*(.+?)\s*[\/\-]([^\s/]+)?\s+(\d{2,3})\s*$/); if(m){ return {design:cleanupDesign(m[1]), size:toNumber(m[3]), color:detectColorFromText(s), score:2, source:'sale:slash'}; }
  m=s.match(/^\s*(\d+\.)?\s*(.+?)\s+(\d{2,3})\s*$/); if(m){ let design=m[2]; const nameLabel=String(design).match(/상품명\s*[:=]?\s*([^/]+)/); if(nameLabel) design=nameLabel[1]; return {design:cleanupDesign(design), size:toNumber(m[3]), color:detectColorFromText(s), score:2, source:'sale:numbered'}; }
  const lbl=s.match(/사이즈\s*[:=]\s*(\d{2,3}|S|M|L|XL|2XL)/i); if(lbl){ const token=String(lbl[1]).toUpperCase(); const size=/\d{2,3}/.test(token)?toNumber(token):ADULT_SIZE_MAP[token]; let design=''; const colorLabel=s.match(/색상\s*[:=]\s*(.*?)\s*(?:[\/|,]|\s{2,}|\s*\/\s*사이즈|,\s*사이즈)/); if(colorLabel) design=cleanupDesign(colorLabel[1]); else { const nameLabel2=s.match(/상품명\/?\s*[:]?\s*(.*?)\s*(?:\/|,\s*사이즈)/); if(nameLabel2) design=cleanupDesign(nameLabel2[1]); else { const before=s.split(/\/?\s*사이즈\s*[:=]/)[0]; const parts=before.split('/'); design=cleanupDesign(parts[0]); } } if(design) return {design, size, color:detectColorFromText(s), score:2, source:'sale:label'}; }
  const matches=[...s.matchAll(/\d{2,3}/g)].map(mm=>({n:toNumber(mm[0]), idx:mm.index})); const cands=matches.filter(x=>SIZES.includes(x.n)); if(cands.length){ const pick=cands[cands.length-1]; const size=pick.n; const left=s.slice(0,pick.idx).trim(); const design=cleanupDesign(left.split('/')[0]); if(design) return {design, size, color:detectColorFromText(s), score:1, source:'sale:fallback'}; }
  return null; }
function parseFromExposure(exposure){ if(!exposure) return null; const s=String(exposure).trim(); let m=s.match(/,\s*(\d+\.[^,]+),\s*(\d{2,3})\s*$/); if(m) return {design:cleanupDesign(m[1]), size:toNumber(m[2]), color:detectColorFromText(s), score:2, source:'expo:numbered'}; let sizeM=s.match(/(\d{2,3})\s*$/); if(!sizeM) sizeM=s.match(/(S|M|L|XL|2XL)\s*$/i); const codeM=s.match(/\b([A-Z]{1,4}\d{2,3})\b/); const found=KEYWORDS.filter(k=>s.includes(k)).sort((a,b)=>b.length-a.length)[0]; if(sizeM && codeM && found){ const token=String(sizeM[1]).toUpperCase(); const size=/\d{2,3}/.test(token)?toNumber(token):ADULT_SIZE_MAP[token]; const design=cleanupDesign(`${codeM[1]}${found}`); return {design, size, color:detectColorFromText(s), score:3, source:'expo:code+keyword'}; } return null; }
function findQty(row){ if(Object.prototype.hasOwnProperty.call(row,'수량')) return toNumber(row['수량']); for(const k of Object.keys(row)){ if(k && k.includes('수량')) return toNumber(row[k]); } return 0; }
function findNameFields(row){ const mall=String(row['쇼핑몰명']||'').trim(); const mq=(RULES.marketplaces||[]).find(m=>m.name===mall) || (RULES.marketplaces||[])[0] || { nameFields:['판매처상품명','상품명','발주명'], exposureFields:['노출명'] }; const findFirst=(keys)=> keys.find(k=>Object.prototype.hasOwnProperty.call(row,k) && String(row[k]).trim()!==''); const saleKey=findFirst(mq.nameFields)||'판매처상품명'; const exposureKey=findFirst(mq.exposureFields)||'노출명'; return { mall, sale: row[saleKey]||'', exposure: row[exposureKey]||'', mq}; }

function summarize(rows){ const result={}; const dropped=[]; const parsedRows=[];
  rows.forEach((r, idx)=>{ const qty=findQty(r); if(!qty){ dropped.push({idx, reason:'no_qty', row:r}); return; } const {mall, sale, exposure, mq}=findNameFields(r); const fromSale=parseFromSaleName(sale); const fromExpo=parseFromExposure(exposure); let chosen=null; if(mq && mq.preferExposureWithCode && fromExpo && /[A-Z]{1,4}\d{2,3}/.test(fromExpo.design)) chosen = fromExpo; else { const cands=[fromSale, fromExpo].filter(Boolean).sort((a,b)=>(b.score||0)-(a.score||0)); chosen=cands[0]||null; }
    if(!chosen){ dropped.push({idx, reason:'unparsed', sale, exposure}); return; }
    let {design,size,color}=chosen; if(!design){ dropped.push({idx, reason:'no_design', sale, exposure}); return; }
    if(/^상품명/.test(design) || COLOR_WORDS.includes(design) || STOP_WORDS.includes(design)){ dropped.push({idx, reason:'filtered_design', design, sale, exposure}); return; }
    if(!SIZES.includes(size)){ dropped.push({idx, reason:'invalid_size', size, design, sale, exposure}); return; }
    design = canonicalizeDesign(design);
    const key = color ? `${design}(${color})` : design;
    if(!result[key]) result[key] = {}; if(!result[key][size]) result[key][size]=0; result[key][size]+=qty;
    parsedRows.push({idx, qty, key, size, color, source: chosen.source});
  });
  return {result, dropped, parsedRows};
}

function totalsFromSummary(map){ const totals = {}; for(const sz of SIZES){ totals[sz]=0; } let grand=0; for(const d of Object.keys(map)){ const sizesMap = map[d]; for(const sz of SIZES){ const v = sizesMap[sz]||0; totals[sz]+=v; grand+=v; } } return {totals, grand}; }

function readFinalTotals(finalPath){ const wb=XLSX.readFile(finalPath); const ws=wb.Sheets[wb.SheetNames[0]]; const aoa=XLSX.utils.sheet_to_json(ws,{header:1,defval:''}); const map={}; for(const row of aoa){ if(!row||!row.length) continue; const first=String(row[0]||'').trim(); if(!first||first.includes('주문현황')) continue; if(first==='상품명'||first==='칼라'||first==='합계'||first.includes('실내복')) continue; const design=first; if(!map[design]) map[design]={}; const sizeSeries=[,,90,100,110,120,130,140,150,160,170,180]; for(let i=2;i<=11;i++){ const sz=sizeSeries[i]; if(!sz) continue; const val=toNumber(row[i]); if(!val) continue; if(!map[design][sz]) map[design][sz]=0; map[design][sz]+=val; } } return totalsFromSummary(map); }

const inputPath = process.argv[2];
const finalPath = process.argv[3];
const wb = XLSX.readFile(inputPath); const ws=wb.Sheets[wb.SheetNames[0]]; const rows = XLSX.utils.sheet_to_json(ws,{defval:'',raw:false});
const {result, dropped, parsedRows} = summarize(rows);
const {totals, grand} = totalsFromSummary(result);
console.log('Computed totals by size:', SIZES.map(sz=>`${sz}:${totals[sz]}`).join(' '), 'grand=', grand);
if(finalPath){ const fin = readFinalTotals(finalPath); console.log('Final totals by size   :', SIZES.map(sz=>`${sz}:${fin.totals[sz]}`).join(' '), 'grand=', fin.grand); console.log('Diff by size           :', SIZES.map(sz=>`${sz}:${totals[sz]-(fin.totals[sz]||0)}`).join(' ')); }
console.log('\nDropped counts by reason:');
const byReason = dropped.reduce((m,d)=>{ m[d.reason]=(m[d.reason]||0)+1; return m; },{});
console.log(byReason);
const sample = (reason, n=10)=> dropped.filter(d=>d.reason===reason).slice(0,n);
console.log('\nSamples (unparsed):'); console.log(sample('unparsed', 15));
console.log('\nSamples (invalid_size):'); console.log(sample('invalid_size', 10));
console.log('\nSamples (filtered_design):'); console.log(sample('filtered_design', 10));
console.log('\nTop parsed sources:');
const srcCount = parsedRows.reduce((m,p)=>{ m[p.source]=(m[p.source]||0)+1; return m; },{}); console.log(srcCount);
