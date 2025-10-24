const XLSX = require('xlsx');
const RULES = require('../src/lib/rules.json');

const SIZES = RULES.allowedSizes;
const ADULT_SIZE_MAP = RULES.adultSizeMap;
const COLOR_WORDS = new Set(RULES.colors);
const KEYWORDS = [...RULES.keywords].sort((a, b) => b.length - a.length);

const toNumber = (v) => {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  const parsed = parseInt(String(v).replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const cleanup = (s) => String(s ?? '').trim();
const isColor = (token = '') => COLOR_WORDS.has(cleanup(token));

const extractSize = (text) => {
  const s = cleanup(text);
  if (!s) return null;
  const label = s.match(/사이즈\s*[:=]\s*(\d{2,3}|S|M|L|XL|2XL)\b/i);
  if (label) {
    const tok = label[1].toUpperCase();
    return /\d{2,3}/.test(tok) ? toNumber(tok) : ADULT_SIZE_MAP[tok] || null;
  }
  const colonAdult = s.match(/:\s*(?:\(성인\)|\(아동\))?\s*(S|M|L|XL|2XL)\b/i);
  if (colonAdult) return ADULT_SIZE_MAP[colonAdult[1].toUpperCase()] || null;
  const colonDigits = s.match(/:\s*(\d{2,3})(?!\d)/);
  if (colonDigits) {
    const size = toNumber(colonDigits[1]);
    if (SIZES.includes(size)) return size;
  }
  const tagged = s.match(/\((성인|아동)\)\s*(\d{2,3})/);
  if (tagged) {
    const size = toNumber(tagged[2]);
    if (SIZES.includes(size)) return size;
  }
  const tokens = [...s.matchAll(/(\d{2,3})/g)];
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const match = tokens[i];
    const prev = s[(match.index || 0) - 1] || ' ';
    if (/^[A-Za-z]$/.test(prev)) continue;
    const size = toNumber(match[1]);
    if (SIZES.includes(size)) return size;
  }
  const adultTokens = [...s.matchAll(/(S|M|L|XL|2XL)\b/gi)];
  if (adultTokens.length) {
    const tok = adultTokens[adultTokens.length - 1][1].toUpperCase();
    return ADULT_SIZE_MAP[tok] || null;
  }
  return null;
};

const extractColor = (text) => {
  const s = cleanup(text);
  if (!s) return '';
  const label = s.match(/색상\s*[:=]\s*([^,/\s)]+)/);
  if (label) return cleanup(label[1]);
  const colon = s.match(/([가-힣A-Za-z]+)\s*:\s*(?:\(성인\)|\(아동\))?\s*(S|M|L|XL|2XL|\d{2,3})\b/);
  if (colon) {
    const cand = cleanup(colon[1]);
    if (cand && !ADULT_SIZE_MAP[cand.toUpperCase()]) return cand;
  }
  const slash = s.match(/\/\s*([가-힣A-Za-z]+)\s*(?:\(.*?\))?/);
  if (slash) {
    const cand = cleanup(slash[1]);
    if (cand) return cand;
  }
  const paren = s.match(/\(([^)]+)\)/);
  if (paren) {
    const cand = cleanup(paren[1]);
    if (cand && !ADULT_SIZE_MAP[cand.toUpperCase()]) return cand;
  }
  return [...COLOR_WORDS].find((color) => s.includes(color)) || '';
};

const extractDesignFromText = (text) => {
  const s = cleanup(text);
  if (!s) return '';
  const code = s.match(/\b([A-Z]{1,4}\d{2,3})\b/);
  if (!code) return '';
  const keyword = KEYWORDS.find((kw) => s.includes(kw));
  return keyword ? `${code[1]}${keyword}` : code[1];
};

const extractDesignFromSale = (text) => {
  let s = cleanup(text);
  if (!s) return '';
  s = s.replace(/상품명\s*[:=]\s*/gi, '');
  s = s.replace(/색상\s*[:=].*?(?:,|\/|\s사이즈|$)/gi, '');
  const size = extractSize(s);
  if (size) s = s.replace(new RegExp(`(:|\\b)${size}(?:\\b|$)`), '');
  if (s.includes(':')) s = s.split(':')[0];
  if (s.includes('/')) s = s.split('/')[0];
  if (s.includes(',')) s = s.split(',')[0];
  s = s.replace(/^(\d+\.|\d+[_-])/, '');
  return cleanup(s);
};

const extractHangulName = (text) => {
  const tokens = (cleanup(text).match(/[가-힣]{2,}/g) || []).filter((tok) => tok.length > 1 && !isColor(tok));
  if (!tokens.length) return '';
  const unique = Array.from(new Set(tokens));
  unique.sort((a, b) => b.length - a.length);
  return unique[0];
};

const resolveDesign = (fields, color) => {
  const candidates = [];
  fields.forEach((field) => {
    const keywordDesign = extractDesignFromText(field);
    if (keywordDesign) candidates.push(keywordDesign);
  });
  fields.forEach((field) => {
    const saleDesign = extractDesignFromSale(field);
    if (saleDesign) candidates.push(saleDesign);
  });
  fields.forEach((field) => {
    const hangul = extractHangulName(field);
    if (hangul) candidates.push(hangul);
  });
  return (
    candidates.find((item) => item && item.length > 1 && item !== color && !isColor(item)) ||
    '상품명 없음'
  );
};

const finalize = (design, color) => {
  let d = cleanup(design);
  let c = cleanup(color);
  if (!c) {
    const match = d.match(/\(([^)]+)\)$/);
    if (match) {
      c = cleanup(match[1]);
      d = d.replace(/\([^)]*\)$/, '').trim();
    }
  }
  d = cleanup(d);
  if (!d || isColor(d)) {
    if (!c) c = d;
    d = '상품명 없음';
  }
  return { design: d, color: c };
};

const resolveSize = (fields) => {
  for (const field of fields) {
    const size = extractSize(field);
    if (size) return size;
  }
  return null;
};

const resolveColor = (fields) => {
  for (const field of fields) {
    const color = extractColor(field);
    if (color) return color;
  }
  return '';
};

const parseGmarketRow = (row) => {
  const sale = cleanup(row['판매처상품명'] || row['상품명']);
  const option = cleanup(row['옵션명'] || row['옵션'] || '');
  const expo = cleanup(row['노출명'] || '');
  const combined = cleanup(`${sale} ${option}`);
  const fields = [combined, sale, option, expo];
  const size = resolveSize(fields);
  if (!size) return null;
  const color = resolveColor(fields);
  const design = resolveDesign(fields, color);
  const finalized = finalize(design, color);
  return { ...finalized, size };
};

const files = [
  'public/[원본] 16일.xlsx',
  'public/[원본] 17일.xlsx',
  'public/[원본] 21일.xlsx',
  'public/[원본] 22일.xlsx'
];

for (const file of files) {
  const wb = XLSX.readFile(file);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const target = rows.filter((r) => String(r['쇼핑몰명']).toLowerCase().includes('g마켓'));
  const parsed = target.map((row) => {
    const info = parseGmarketRow(row);
    return {
      raw: row['판매처상품명'],
      ...(info || {}),
      qty: toNumber(row['수량'])
    };
  });
  console.log(`\n${file}`);
  console.log(parsed);
}
