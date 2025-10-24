// Summary computation (rules-driven)
// Handles: numbered names, slash color parts, label forms, adult sizes, and normalization

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
    try {
      const re = new RegExp(a.pattern, 'g');
      out = out.replace(re, a.replace);
    } catch (_) {}
  }
  return out;
}

function cleanupDesign(name) {
  if (!name) return '';
  let s = String(name).trim();
  // Apply aliases early (e.g., strip leading '=') so prefix removal works
  s = applyAliases(s);
  s = s.replace(/^(\d+\.|\d+[_-])/, '').trim();
  s = s.split('/')[0].trim();
  s = s.replace(/[\s/,-]+$/, '').trim();
  s = s.split('_')[0].trim();
  s = s.replace(/^([A-Z]{1,4}\d{2,3})\s+/, '$1');
  // Final alias pass
  s = applyAliases(s);
  return s;
}

function canonicalizeDesign(design) {
  const m = String(design).match(/^([A-Z]{1,4}\d{2,3})/);
  if (m && CODE_CANON[m[1]]) return `${m[1]}${CODE_CANON[m[1]]}`;
  return design;
}

function parseFromSaleName(name) {
  if (!name) return null;
  const s = String(name).trim();

  // Colon-number near end, prefer as size e.g., ":120"
  const mCol = s.match(/:([0-9]{2,3})(?!.*:)/);
  if (mCol) {
    const size = toNumber(mCol[1]);
    if (SIZES.includes(size)) {
      const left = s.substring(0, mCol.index).trim();
      return { design: cleanupDesign(left), size };
    }
  }

  // Adult size letters at end e.g., "... (성인)XL"
  const mAdult = s.match(/(?:\(성인\))?\s*(S|M|L|XL|2XL)\s*$/i);
  if (mAdult) {
    const size = ADULT_SIZE_MAP[mAdult[1].toUpperCase()];
    if (size) {
      const left = s.slice(0, mAdult.index).trim();
      return { design: cleanupDesign(left), size };
    }
  }

  // Slash/Hyphen pattern: "J015 맨투맨z/네이비 140"
  let m = s.match(/^\s*(.+?)\s*[\/\-]([^\s/]+)?\s+(\d{2,3})\s*$/);
  if (m) return { design: cleanupDesign(m[1]), size: toNumber(m[3]) };

  // Numbered pattern: "29.노란나비 110"
  m = s.match(/^\s*(\d+\.)?\s*(.+?)\s+(\d{2,3})\s*$/);
  if (m) {
    let design = m[2];
    const nameLabel = String(design).match(/상품명\s*[:=]?\s*([^/]+)/);
    if (nameLabel) design = nameLabel[1];
    return { design: cleanupDesign(design), size: toNumber(m[3]) };
  }

  // Label-based: e.g., "색상: ..., 사이즈: 110" or "상품명: ..., 사이즈: M"
  const lbl = s.match(/사이즈\s*[:=]\s*(\d{2,3}|S|M|L|XL|2XL)/i);
  if (lbl) {
    const token = String(lbl[1]).toUpperCase();
    const size = /\d{2,3}/.test(token) ? toNumber(token) : ADULT_SIZE_MAP[token];
    let design = '';
    const colorLabel = s.match(/색상\s*[:=]\s*(.*?)\s*(?:[\/|,]|\s{2,}|\s*\/\s*사이즈|,\s*사이즈)/);
    if (colorLabel) {
      design = cleanupDesign(colorLabel[1]);
    } else {
      const nameLabel2 = s.match(/상품명\/?\s*[:]?\s*(.*?)\s*(?:\/|,\s*사이즈)/);
      if (nameLabel2) design = cleanupDesign(nameLabel2[1]);
      else {
        const before = s.split(/\/?\s*사이즈\s*[:=]/)[0];
        const parts = before.split('/');
        design = cleanupDesign(parts[0]);
      }
    }
    if (design) return { design, size };
  }

  // Numeric fallback: last numeric token among allowed sizes
  const matches = [...s.matchAll(/\d{2,3}/g)].map((mm) => ({ n: toNumber(mm[0]), idx: mm.index }));
  const cands = matches.filter((x) => SIZES.includes(x.n));
  if (cands.length) {
    const pick = cands[cands.length - 1];
    const size = pick.n;
    const left = s.slice(0, pick.idx).trim();
    const design = cleanupDesign(left.split('/')[0]);
    if (design) return { design, size };
  }
  return null;
}

function parseFromExposure(exposure) {
  if (!exposure) return null;
  const s = String(exposure).trim();
  // Case 1: '..., 29.디자인명, 110'
  let m = s.match(/,\s*(\d+\.[^,]+),\s*(\d{2,3})\s*$/);
  if (m) return { design: cleanupDesign(m[1]), size: toNumber(m[2]) };

  // Case 2: garments: find code (e.g., W152) and keyword (e.g., 오버핏맨투맨), and size
  let sizeM = s.match(/(\d{2,3})\s*$/);
  if (!sizeM) sizeM = s.match(/(S|M|L|XL|2XL)\s*$/i);
  const codeM = s.match(/\b([A-Z]{1,4}\d{2,3})\b/);
  const found = KEYWORDS.filter((k) => s.includes(k)).sort((a,b)=>b.length-a.length)[0];
  if (sizeM && codeM && found) {
    const token = String(sizeM[1]).toUpperCase();
    const size = /\d{2,3}/.test(token) ? toNumber(token) : ADULT_SIZE_MAP[token];
    const design = cleanupDesign(`${codeM[1]}${found}`);
    return { design, size };
  }
  return null;
}

function findQty(row) {
  // prefer exact '수량'
  if (Object.prototype.hasOwnProperty.call(row, '수량')) return toNumber(row['수량']);
  for (const k of Object.keys(row)) {
    if (k && k.includes('수량')) return toNumber(row[k]);
  }
  return 0;
}

function findNameFields(row) {
  const mq = RULES.marketplaces?.[0] || { quantityFields: ['수량'], nameFields: ['판매처상품명', '상품명', '발주명'], exposureFields: ['노출명'] };
  const findFirst = (keys) => keys.find((k) => Object.prototype.hasOwnProperty.call(row, k) && String(row[k]).trim() !== '');
  const saleKey = findFirst(mq.nameFields) || '판매처상품명';
  const exposureKey = findFirst(mq.exposureFields) || '노출명';
  return { sale: row[saleKey] || '', exposure: row[exposureKey] || '' };
}

export function computeSummary(rows) {
  const result = {};
  for (const row of rows) {
    const qty = findQty(row);
    if (!qty) continue;
    const { sale, exposure } = findNameFields(row);
    const parsedSale = parseFromSaleName(sale);
    const parsedExpo = parseFromExposure(exposure);
    let parsed = null;
    if (parsedExpo && /[A-Z]{1,4}\d{2,3}/.test(parsedExpo.design)) parsed = parsedExpo;
    else parsed = parsedSale || parsedExpo;
    if (!parsed) continue;
    let { design, size } = parsed;
    if (!design) continue;
    if (/^상품명/.test(design) || COLOR_WORDS.includes(design) || STOP_WORDS.includes(design)) continue;
    if (!SIZES.includes(size)) continue;
    design = canonicalizeDesign(design);
    if (!result[design]) result[design] = {};
    if (!result[design][size]) result[design][size] = 0;
    result[design][size] += qty;
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
