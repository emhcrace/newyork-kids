const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname,'..','src','lib','rules.json'), 'utf8'));
const KEYWORDS = RULES.keywords || [];

function cleanup(s){ return String(s||'').trim(); }
function hasLabelSize(s){ return /사이즈\s*[:=]\s*(\d{2,3}|S|M|L|XL|2XL)/i.test(s); }
function hasLabelColor(s){ return /색상\s*[:=]\s*[^,\/\s\)]+/i.test(s); }
function hasSlashColorSize(s){ return /\/[^\s/]+\s+\d{2,3}\s*$/.test(s); }
function hasNumberedPrefix(s){ return /^\s*\d+\./.test(s); }
function endsWithSize(s){ return /(\d{2,3})\s*$/.test(s); }
function hasAdultSize(s){ return /(\b|\()(S|M|L|XL|2XL)(\b|\))/i.test(s); }
function hasCode(s){ return /\b[A-Z]{1,4}\d{2,3}\b/.test(s); }
function hasKeyword(s){ return KEYWORDS.some(k=> s.includes(k)); }
function hasParenColor(s){ const m = s.match(/\(([^)]+)\)/); return !!m; }
function hasExpoCommaTriplet(s){ return /,\s*[^,]+,\s*\d{2,3}\s*$/.test(s); }
function isColorOnlyWithSize(s){
  // 한글 2자 이상 토큰 중 색상 사전에 해당하는 것만 있고 고유명(상품명)이 없는 경우
  const colors = new Set(RULES.colors||[]);
  const toks = (s.match(/[가-힣]{2,}/g)||[]);
  if(toks.length===0) return false;
  return toks.every(t=> colors.has(t));
}

function patternOf(row){
  const sale = cleanup(row['판매처상품명'] || row['상품명'] || row['발주명']);
  const expo = cleanup(row['노출명'] || '');
  const parts = [];
  // 판매처상품명 기준 특징
  if(hasLabelSize(sale)) parts.push('SALE_LABEL_SIZE');
  if(hasLabelColor(sale)) parts.push('SALE_LABEL_COLOR');
  if(hasSlashColorSize(sale)) parts.push('SALE_SLASH_COLOR_SIZE');
  if(hasNumberedPrefix(sale)) parts.push('SALE_NUMBERED');
  if(endsWithSize(sale)) parts.push('SALE_END_SIZE');
  if(hasAdultSize(sale)) parts.push('SALE_ADULT');
  if(hasCode(sale)) parts.push('SALE_CODE');
  if(hasKeyword(sale)) parts.push('SALE_KW');
  if(hasParenColor(sale)) parts.push('SALE_PAREN_COLOR');
  if(isColorOnlyWithSize(sale)) parts.push('SALE_COLOR_ONLY');
  // 노출명 기준 특징
  if(hasLabelSize(expo)) parts.push('EXPO_LABEL_SIZE');
  if(hasLabelColor(expo)) parts.push('EXPO_LABEL_COLOR');
  if(hasSlashColorSize(expo)) parts.push('EXPO_SLASH_COLOR_SIZE');
  if(hasNumberedPrefix(expo)) parts.push('EXPO_NUMBERED');
  if(endsWithSize(expo)) parts.push('EXPO_END_SIZE');
  if(hasAdultSize(expo)) parts.push('EXPO_ADULT');
  if(hasCode(expo)) parts.push('EXPO_CODE');
  if(hasKeyword(expo)) parts.push('EXPO_KW');
  if(hasParenColor(expo)) parts.push('EXPO_PAREN_COLOR');
  if(hasExpoCommaTriplet(expo)) parts.push('EXPO_COMMA_TRIPLET');

  if(parts.length===0) parts.push('PLAIN');
  return parts.join('+');
}

function main(){
  const inputPath = process.argv[2];
  const wb = XLSX.readFile(inputPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws,{defval:'', raw:false});
  const seen = new Map();
  rows.forEach((r, i)=>{
    const pat = patternOf(r);
    if(!seen.has(pat)) seen.set(pat, {count:0, sampleIndex:i, sample:{
      쇼핑몰명:r['쇼핑몰명'], 판매처상품명:r['판매처상품명']||r['상품명']||r['발주명'], 노출명:r['노출명'], 수량:r['수량']
    }});
    seen.get(pat).count++;
  });
  const list = [...seen.entries()].sort((a,b)=> b[1].count - a[1].count);
  console.log('Unique patterns:', list.length);
  for(const [pat,info] of list){
    console.log(`\n[${info.count} rows] ${pat}`);
    console.log('  sample:', info.sample);
  }
}

main();
