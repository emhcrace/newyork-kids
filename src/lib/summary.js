// Summary computation (rules-driven, mall-aware)
// Extracts product name, size, color and aggregates counts by product(color) x size

import RULES from './rules.json';

export const SIZES = RULES.allowedSizes;
const ADULT_SIZE_MAP = RULES.adultSizeMap;
const COLOR_WORDS = RULES.colors;
const STOP_WORDS = RULES.stopwords || [];
const KEYWORDS = RULES.keywords;
const CODE_CANON = RULES.codeCanon || {};

function toNumber(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  const s = String(val).replace(/[\s,]/g, '');
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}

function applyAliases(s) {
  if (!Array.isArray(RULES.aliases)) return s;
  let out = s;
  for (const a of RULES.aliases) {
    try { out = out.replace(new RegExp(a.pattern, 'g'), a.replace); } catch { /* ignore */ }
  }
  return out;
}

function cleanupDesign(name) {
  if (!name) return '';
  let s = String(name).trim();
  s = applyAliases(s); // e.g., strip leading '='
  s = s.replace(/^(\d+\.|\d+[_-])/, '').trim();
  s = s.split('/')[0].trim();
  s = s.replace(/[\s/,-]+$/, '').trim();
  s = s.split('_')[0].trim();
  s = s.replace(/^([A-Z]{1,4}\d{2,3})\s+/, '$1');
  s = applyAliases(s);
  return s;
}

function canonicalizeDesign(design) {
  const m = String(design).match(/^([A-Z]{1,4}\d{2,3})/);
  if (m && CODE_CANON[m[1]]) return `${m[1]}${CODE_CANON[m[1]]}`;
  return design;
}

function detectColorFromText(s) {
  const m1 = s.match(/색상\s*[:=]\s*([^,\/\s)]+)/);
  if (m1) return applyAliases(m1[1]).trim();
  const m2 = s.match(/\/([^\s/]+)\s+\d{2,3}\s*$/);
  if (m2) return applyAliases(m2[1]).trim();
  const m3 = s.match(/\(([^)]+)\)/);
  if (m3) {
    const cand = applyAliases(m3[1]).trim();
    if (COLOR_WORDS.includes(cand)) return cand;
  }
  return '';
}

function parseFromSaleName(name) {
  if (!name) return null;
  const s = String(name).trim();
  // Colon size
  const mCol = s.match(/:([0-9]{2,3})(?!.*:)/);
  if (mCol) {
    const size = toNumber(mCol[1]);
    if (SIZES.includes(size)) {
      const left = s.substring(0, mCol.index).trim();
      return { design: cleanupDesign(left), size, color: detectColorFromText(s), score: 3 };
    }
  }
  // Adult size token
  const mAdult = s.match(/(?:\(성인\))?\s*(S|M|L|XL|2XL)\s*$/i);
  if (mAdult) {
    const size = ADULT_SIZE_MAP[mAdult[1].toUpperCase()];
    if (size) {
      const left = s.slice(0, mAdult.index).trim();
      return { design: cleanupDesign(left), size, color: detectColorFromText(s), score: 2 };
    }
  }
  // Slash/Hyphen
  let m = s.match(/^\s*(.+?)\s*[\/\-]([^\s/]+)?\s+(\d{2,3})\s*$/);
  if (m) return { design: cleanupDesign(m[1]), size: toNumber(m[3]), color: detectColorFromText(s), score: 2 };
  // Numbered
  m = s.match(/^\s*(\d+\.)?\s*(.+?)\s+(\d{2,3})\s*$/);
  if (m) {
    let design = m[2];
    const nameLabel = String(design).match(/상품명\s*[:=]?\s*([^/]+)/);
    if (nameLabel) design = nameLabel[1];
    return { design: cleanupDesign(design), size: toNumber(m[3]), color: detectColorFromText(s), score: 2 };
  }
  // Label-based
  const lbl = s.match(/사이즈\s*[:=]\s*(\d{2,3}|S|M|L|XL|2XL)/i);
  if (lbl) {
    const token = String(lbl[1]).toUpperCase();
    const size = /\d{2,3}/.test(token) ? toNumber(token) : ADULT_SIZE_MAP[token];
    let design = '';
    const colorLabel = s.match(/색상\s*[:=]\s*(.*?)\s*(?:[\/|,]|\s{2,}|\s*\/\s*사이즈|,\s*사이즈)/);
    if (colorLabel) design = cleanupDesign(colorLabel[1]);
    else {
      const nameLabel2 = s.match(/상품명\/?\s*[:]?\s*(.*?)\s*(?:\/|,\s*사이즈)/);
      if (nameLabel2) design = cleanupDesign(nameLabel2[1]);
      else {
        const before = s.split(/\/?\s*사이즈\s*[:=]/)[0];
        const parts = before.split('/');
        design = cleanupDesign(parts[0]);
      }
    }
    if (design) return { design, size, color: detectColorFromText(s), score: 2 };
  }
  // Fallback numeric
  const matches = [...s.matchAll(/\d{2,3}/g)].map((mm) => ({ n: toNumber(mm[0]), idx: mm.index }));
  const cands = matches.filter((x) => SIZES.includes(x.n));
  if (cands.length) {
    const pick = cands[cands.length - 1];
    const size = pick.n;
    const left = s.slice(0, pick.idx).trim();
    const design = cleanupDesign(left.split('/')[0]);
    if (design) return { design, size, color: detectColorFromText(s), score: 1 };
  }
  return null;
}

function parseFromExposure(exposure) {
  if (!exposure) return null;
  const s = String(exposure).trim();
  let m = s.match(/,\s*(\d+\.[^,]+),\s*(\d{2,3})\s*$/);
  if (m) return { design: cleanupDesign(m[1]), size: toNumber(m[2]), color: detectColorFromText(s), score: 2 };
  let sizeM = s.match(/(\d{2,3})\s*$/);
  if (!sizeM) sizeM = s.match(/(S|M|L|XL|2XL)\s*$/i);
  const codeM = s.match(/\b([A-Z]{1,4}\d{2,3})\b/);
  const found = KEYWORDS.filter((k) => s.includes(k)).sort((a,b)=>b.length-a.length)[0];
  if (sizeM && codeM && found) {
    const token = String(sizeM[1]).toUpperCase();
    const size = /\d{2,3}/.test(token) ? toNumber(token) : ADULT_SIZE_MAP[token];
    const design = cleanupDesign(`${codeM[1]}${found}`);
    return { design, size, color: detectColorFromText(s), score: 3 };
  }
  return null;
}

function findQty(row) {
  if (Object.prototype.hasOwnProperty.call(row, '수량')) return toNumber(row['수량']);
  for (const k of Object.keys(row)) {
    if (k && k.includes('수량')) return toNumber(row[k]);
  }
  return 0;
}

function findNameFields(row) {
  const mall = String(row['쇼핑몰명'] || '').trim();
  const mq = RULES.marketplaces?.find((m)=>m.name===mall) || RULES.marketplaces?.[0] || { nameFields: ['판매처상품명','상품명','발주명'], exposureFields: ['노출명'] };
  const findFirst = (keys) => keys.find((k) => Object.prototype.hasOwnProperty.call(row, k) && String(row[k]).trim() !== '');
  const saleKey = findFirst(mq.nameFields) || '판매처상품명';
  const exposureKey = findFirst(mq.exposureFields) || '노출명';
  return { mall, sale: row[saleKey] || '', exposure: row[exposureKey] || '' };
}

export function computeSummary(rows) {
  const result = {};
  for (const row of rows) {
    const qty = findQty(row);
    if (!qty) continue;
    const { mall, sale, exposure } = findNameFields(row);
    const parsedSale = parseFromSaleName(sale);
    const parsedExpo = parseFromExposure(exposure);
    let parsed = null;
    const mq = RULES.marketplaces?.find((m)=>m.name===mall);
    if (mq?.preferExposureWithCode && parsedExpo && /[A-Z]{1,4}\d{2,3}/.test(parsedExpo.design)) parsed = parsedExpo;
    else {
      const cands = [parsedSale, parsedExpo].filter(Boolean).sort((a,b)=> (b.score||0)-(a.score||0));
      parsed = cands[0] || null;
    }
    if (!parsed) continue;
    let { design, size, color } = parsed;
    if (!design) continue;
    if (/^상품명/.test(design) || COLOR_WORDS.includes(design) || STOP_WORDS.includes(design)) continue;
    if (!SIZES.includes(size)) continue;
    design = canonicalizeDesign(design);
    const key = color ? `${design}(${color})` : design;
    if (!result[key]) result[key] = {};
    if (!result[key][size]) result[key][size] = 0;
    result[key][size] += qty;
  }
  return Object.keys(result).map((design) => {
    let total = 0;
    const row = { design };
    for (const sz of SIZES) {
      const val = result[design][sz] || 0;
      row[sz] = val;
      total += val;
    }
    row.total = total;
    return row;
  });
}

