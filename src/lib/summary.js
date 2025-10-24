// Fresh implementation for Coupang + G마켓 (16일 기준)
import RULES from "./rules.json";

export const SIZES = RULES.allowedSizes;
const ADULT_SIZE_MAP = { S: 90, M: 100, L: 110, XL: 120, "2XL": 130 };
const COLOR_WORDS = RULES.colors;
const KEYWORDS = RULES.keywords;

function toNumber(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/[\s,]/g, "");
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}
function cleanup(s) {
  return String(s || "").trim();
}

function extractSize(text) {
  const s = cleanup(text);
  const mLbl = s.match(/사이즈\s*[:=]\s*(\d{2,3}|S|M|L|XL|2XL)\b/i);
  if (mLbl) {
    const tok = mLbl[1].toUpperCase();
    return /\d{2,3}/.test(tok) ? toNumber(tok) : ADULT_SIZE_MAP[tok];
  }
  const mCol = s.match(/:([0-9]{2,3})(?!.*:)/);
  if (mCol) {
    const n = toNumber(mCol[1]);
    if (SIZES.includes(n)) return n;
  }
  const mEnd = s.match(/(\d{2,3})\s*$/);
  if (mEnd) {
    const n = toNumber(mEnd[1]);
    if (SIZES.includes(n)) return n;
  }
  const tokens = [...s.matchAll(/(\d{2,3})/g)];
  for (let i = tokens.length - 1; i >= 0; i--) {
    const mm = tokens[i];
    const idx = mm.index || 0;
    const prev = s[idx - 1] || " ";
    if (/^[A-Za-z]$/.test(prev)) continue; // exclude code like W152
    const n = toNumber(mm[1]);
    if (SIZES.includes(n)) return n;
  }
  return null;
}

function extractColor(text) {
  const s = cleanup(text);
  const m1 = s.match(/색상\s*[:=]\s*([^,\/\s)]+)/);
  if (m1) return m1[1].trim();
  const m2 = s.match(/\/([^\s/]+)\s+\d{2,3}\s*$/);
  if (m2) return m2[1].trim();
  const m3 = s.match(/\(([^)]+)\)/);
  if (m3 && COLOR_WORDS.includes(m3[1].trim())) return m3[1].trim();
  return "";
}

function extractDesignFromText(s) {
  const code = (s.match(/\b([A-Z]{1,4}\d{2,3})\b/) || [])[1];
  if (!code) return "";
  const found = KEYWORDS.filter((k) => s.includes(k)).sort(
    (a, b) => b.length - a.length
  )[0];
  return found ? code + found : code;
}

function extractDesignFromSale(sale) {
  let s = cleanup(sale);
  // remove labels and color chunk
  s = s
    .replace(/상품명\s*[:=]\s*/g, "")
    .replace(/색상\s*[:=].*?(?:,|\/|\s사이즈|$)/g, "");
  const size = extractSize(s);
  if (size) s = s.replace(new RegExp(`${size}\s*$`), "");
  s = s.split("/")[0];
  s = s.replace(/^(\d+\.|\d+[_-])/, "").trim();
  return s.trim();
}

function parseRowCoupang(row) {
  const sale = cleanup(row["판매처상품명"]);
  const expo = cleanup(row["노출명"]);
  let size = extractSize(sale) ?? extractSize(expo);
  if (!size) return null;
  let color = extractColor(sale) || extractColor(expo);

  // 1) 상품명: 판매처상품명에서 한글만 추출(숫자/기호/영문 제거), 색상 단어는 제외
  const hangulTokens = (sale.match(/[가-힣]{2,}/g) || []).filter(
    (t) => !COLOR_WORDS.includes(t)
  );
  let nameFromSale = hangulTokens.sort((a, b) => b.length - a.length)[0] || "";

  // 2) 판매처에 유의미한 한글명이 없거나 색상/일반어만 있는 경우, 노출명에서 추출
  //    우선 콤마 패턴: ", 22.리틀베어, 100" → 가운데 토큰 사용
  let nameFromExpo = "";
  const mComma = expo.match(/,\s*([^,]+),\s*(\d{2,3})\s*$/);
  if (mComma) {
    const middle = mComma[1];
    const tok = (middle.match(/[가-힣]{2,}/g) || []).filter(
      (t) => !COLOR_WORDS.includes(t)
    );
    nameFromExpo = tok.sort((a, b) => b.length - a.length)[0] || "";
  }
  if (!nameFromExpo) {
    const exTokens = (expo.match(/[가-힣]{2,}/g) || []).filter(
      (t) => !COLOR_WORDS.includes(t)
    );
    nameFromExpo = exTokens.sort((a, b) => b.length - a.length)[0] || "";
  }

  let design = nameFromSale || nameFromExpo;
  if (!design) {
    // 최후: 코드+키워드 조합 시도
    design =
      extractDesignFromText(expo) ||
      extractDesignFromText(sale) ||
      extractDesignFromSale(sale);
  }
  if (!design) design = "미지정상품";
  if (!color) color = "";
  if (!design) return null;
  design = design.replace(/\([^)]*\)$/, "").trim();
  return { design, color, size };
}

function parseRowGmarket(row) {
  // 흔한 필드: 판매처상품명, 상품명, 옵션명(색상/사이즈 포함 가능)
  const sale = cleanup(row["판매처상품명"] || row["상품명"]);
  const option = cleanup(row["옵션명"] || row["옵션"] || "");
  const combined = `${sale} ${option}`.trim();
  let size = extractSize(combined) ?? extractSize(sale);
  if (!size) return null;
  let color = extractColor(combined) || extractColor(sale);
  let design = extractDesignFromText(combined) || extractDesignFromSale(sale);
  if (!design) return null;
  design = design.replace(/\([^)]*\)$/, "").trim();
  return { design, color, size };
}

function parseRowCafe24(row) {
  // Cafe24 내보내기에서 옵션 필드명이 다양함: 옵션명/옵션/옵션정보/세부옵션/추가옵션 등
  const sale = cleanup(row["판매처상품명"] || row["상품명"]);
  const option = cleanup(
    row["옵션명"] ||
      row["옵션"] ||
      row["옵션정보"] ||
      row["세부옵션"] ||
      row["추가옵션"] ||
      ""
  );
  const combined = `${sale} ${option}`.trim();
  let size = extractSize(combined) ?? extractSize(sale);
  if (!size) return null;
  let color = extractColor(combined) || extractColor(sale);
  let design = extractDesignFromText(combined) || extractDesignFromSale(sale);
  if (!design) return null;
  design = design.replace(/\([^)]*\)$/, "").trim();
  return { design, color, size };
}

function parseRowSmartStore(row) {
  // 스토어팜(네이버) 추정 필드: 판매처상품명/상품명 + 옵션명/옵션/옵션정보/상품옵션/상세옵션
  const sale = cleanup(row["판매처상품명"] || row["상품명"]);
  const option = cleanup(
    row["옵션명"] ||
      row["옵션"] ||
      row["옵션정보"] ||
      row["상품옵션"] ||
      row["상세옵션"] ||
      ""
  );
  const combined = `${sale} ${option}`.trim();
  let size = extractSize(combined) ?? extractSize(sale);
  if (!size) return null;
  let color = extractColor(combined) || extractColor(sale);
  let design = extractDesignFromText(combined) || extractDesignFromSale(sale);
  if (!design) return null;
  design = design.replace(/\([^)]*\)$/, "").trim();
  return { design, color, size };
}

function parseRowGeneric(row) {
  // 쇼핑몰명이 없거나 미지정인 경우의 일반 규칙
  const sale = cleanup(row["판매처상품명"] || row["상품명"] || row["발주명"]);
  const option = cleanup(row["옵션명"] || row["옵션"] || row["옵션정보"] || "");
  const extra = cleanup(row["노출명"] || "");
  const combined = `${sale} ${option} ${extra}`.trim();
  let size = extractSize(combined) ?? extractSize(sale) ?? extractSize(extra);
  if (!size) return null;
  let color =
    extractColor(combined) || extractColor(sale) || extractColor(extra);
  let design = extractDesignFromText(combined) || extractDesignFromSale(sale);
  if (!design) return null;
  design = design.replace(/\([^)]*\)$/, "").trim();
  return { design, color, size };
}

export function computeSummary(rows) {
  const result = {};
  for (const r of rows) {
    const mall = cleanup(r["쇼핑몰명"]);
    const qty = toNumber(r["수량"]);
    if (!qty) continue;
    let parsed = null;
    if (mall === "쿠팡") parsed = parseRowCoupang(r);
    else if (mall === "G마켓" || mall.toLowerCase() === "gmarket")
      parsed = parseRowGmarket(r);
    else if (mall === "카페24" || mall.toLowerCase().includes("cafe24"))
      parsed = parseRowCafe24(r);
    else if (
      mall === "스토어팜" ||
      mall.includes("스토어") ||
      mall.includes("네이버")
    )
      parsed = parseRowSmartStore(r);
    else parsed = parseRowGeneric(r); // 쇼핑몰명 없음/기타
    if (!parsed) continue;
    const { design, color, size } = parsed;
    if (!SIZES.includes(size)) continue;
    const key = color ? `${design}(${color})` : design;
    if (!result[key]) result[key] = {};
    if (!result[key][size]) result[key][size] = 0;
    result[key][size] += qty;
  }
  return Object.keys(result).map((design) => {
    let total = 0;
    const row = { design };
    for (const sz of SIZES) {
      const v = result[design][sz] || 0;
      row[sz] = v;
      total += v;
    }
    row.total = total;
    return row;
  });
}
