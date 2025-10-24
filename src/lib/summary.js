// Robust summary computation from various marketplace order formats
export const SIZES = [90, 100, 110, 120, 130, 140, 150, 160, 170, 180];

function toNumber(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  const s = String(val).replace(/[,\s]/g, '');
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}

function cleanupDesign(name) {
  if (!name) return '';
  let s = String(name).trim();
  s = s.replace(/^(\d+\.|\d+[_-])/, '').trim(); // remove leading numbering like '29.' or '03_'
  // drop trailing color after '/'
  s = s.split('/')[0].trim();
  s = s.replace(/[\s/,-]+$/, '').trim();
  // remove trailing color part after underscore if present
  s = s.split('_')[0].trim();
  // compact code + name (e.g., 'W152 맨투맨' -> 'W152맨투맨')
  s = s.replace(/^([A-Z]{1,4}\d{2,3})\s+/, '$1');
  return s;
}

function parseFromSaleName(name) {
  if (!name) return null;
  const s = String(name).trim();
  // Prefer slash-format first to drop colors like '/네이비'
  let m = s.match(/^\s*(.+?)\s*[\/\-]([^\s/]+)?\s+(\d{2,3})\s*$/);
  if (m) {
    return { design: cleanupDesign(m[1]), size: toNumber(m[3]) };
  }
  // Pattern 1: "29.노란나비 110"
  m = s.match(/^\s*(\d+\.)?\s*(.+?)\s+(\d{2,3})\s*$/);
  if (m) {
    let design = m[2];
    // handle embedded label like '상품명: 05.과일나라 / 사이즈:'
    const nameLabel = String(design).match(/상품명\s*[:]\s*([^/]+)/);
    if (nameLabel) design = nameLabel[1];
    return { design: cleanupDesign(design), size: toNumber(m[3]) };
  }
  // Pattern 3: 라벨 기반 "색상: ... / 사이즈: 110" 또는 "상품명: ... / 사이즈: 110"
  const sizeFromLabel = s.match(/사이즈\s*[:]\s*(\d{2,3})/);
  if (sizeFromLabel) {
    const size = toNumber(sizeFromLabel[1]);
    let design = '';
    const colorLabel = s.match(/색상\s*[:]\s*(.*?)\s*(?:[\/|,]|\s{2,}|\s*\/\s*사이즈)/);
    if (colorLabel) {
      design = cleanupDesign(colorLabel[1]);
    } else {
      // try 상품명: ... / 사이즈:
      const nameLabel = s.match(/상품명\s*[:]\s*(.*?)\s*\//);
      if (nameLabel) {
        design = cleanupDesign(nameLabel[1]);
      } else {
        // part before '/ 사이즈'
        const before = s.split(/\/?\s*사이즈\s*[:]/)[0];
        const parts = before.split('/');
        design = cleanupDesign(parts[0]);
      }
    }
    if (design) return { design, size };
  }
  // Pattern 4: fallback last token size
  const lastNum = s.match(/(\d{2,3})\s*$/);
  if (lastNum) {
    const size = toNumber(lastNum[1]);
    const left = s.replace(/(\d{2,3})\s*$/, '').trim();
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
  const sizeM = s.match(/(\d{2,3})\s*$/);
  const codeM = s.match(/\b([A-Z]{1,4}\d{2,3})\b/);
  const keywords = [
    '맨투맨z', '오버핏맨투맨', '기모맨투맨', '스웨트셔츠', '후드', '후드티', '캐주얼후드',
    '기모오버핏후드', '기모트레이닝팬츠', '기모트레이닝세트', '오버핏맨투맨', '반팔', '티셔츠'
  ];
  const found = keywords.filter((k) => s.includes(k)).sort((a,b)=>b.length-a.length)[0];
  if (sizeM && codeM && found) {
    const size = toNumber(sizeM[1]);
    const design = cleanupDesign(`${codeM[1]}${found}`);
    return { design, size };
  }
  return null;
}

function findQty(row) {
  // prefer exact '수량'
  if (Object.prototype.hasOwnProperty.call(row, '수량')) return toNumber(row['수량']);
  // otherwise search keys including '수량'
  for (const k of Object.keys(row)) {
    if (k && k.includes('수량')) return toNumber(row[k]);
  }
  return 0;
}

function findNameFields(row) {
  const sale = row['판매처상품명'] || row['상품명'] || row['발주명'] || '';
  const exposure = row['노출명'] || '';
  return { sale, exposure };
}

export function computeSummary(rows) {
  const result = {};
  const colorWords = ['화이트','블랙','네이비','베이지','퍼플','옐로우','스카이블루','백멜란지','레드','블루','그레이','아이보리'];
  for (const row of rows) {
    const qty = findQty(row);
    if (!qty) continue;
    const { sale, exposure } = findNameFields(row);
    const parsedSale = parseFromSaleName(sale);
    const parsedExpo = parseFromExposure(exposure);
    let parsed = null;
    if (parsedExpo && /[A-Z]{1,4}\d{2,3}/.test(parsedExpo.design)) {
      // prefer exposure when it yields code+keyword pattern
      parsed = parsedExpo;
    } else {
      parsed = parsedSale || parsedExpo;
    }
    if (!parsed) continue; // cannot place without size/design reliably
    let { design, size } = parsed;
    if (!design || /^상품명/.test(design) || colorWords.includes(design)) continue;
    if (!SIZES.includes(size)) continue;
    if (!design) design = '미지정';
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
