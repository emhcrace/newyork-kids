import RULES from "./rules.json";

const FALLBACK_RULES = {
  allowedSizes: [90, 100, 110, 120, 130, 140, 150, 160, 170, 180],
  adultSizeMap: { S: 90, M: 100, L: 110, XL: 120, "2XL": 130 },
  colors: [
    "화이트",
    "블랙",
    "네이비",
    "베이지",
    "퍼플",
    "옐로우",
    "스카이블루",
    "백멜란지",
    "레드",
    "블루",
    "그레이",
    "아이보리",
    "차콜",
    "스틸블루",
    "다크민트",
    "인디핑크",
    "민트",
    "브라운",
    "와인",
    "올리브",
    "라일락",
    "핑크",
    "흰색"
  ],
  keywords: [
    "스웨트셔츠",
    "맨투맨",
    "오버핏맨투맨",
    "기모맨투맨",
    "후드",
    "후드티",
    "기모후드",
    "트레이닝팬츠",
    "트레이닝세트",
    "조거팬츠",
    "맨투맨z",
    "반팔",
    "긴팔티",
    "실내복",
    "기모내의",
    "발열내의",
    "특기모맨투맨",
    "패밀리맨투맨",
    "캐릭터티",
    "오버핏",
    "맨투맨티셔츠"
  ],
  stopwords: ["상품명", "색상", "사이즈", "옵션", "선택", "onecolor", "Onecolor"]
};

const dedupe = (arr = [], fallback = []) => {
  const merged = [...(Array.isArray(arr) ? arr : []), ...fallback];
  return Array.from(new Set(merged.filter(Boolean).map((v) => String(v).trim())));
};

export const SIZES = (RULES?.allowedSizes?.length
  ? RULES.allowedSizes
  : FALLBACK_RULES.allowedSizes
).slice();

const ADULT_SIZE_MAP = {
  ...FALLBACK_RULES.adultSizeMap,
  ...(RULES?.adultSizeMap || {})
};

const COLOR_WORDS = dedupe(RULES?.colors, FALLBACK_RULES.colors);
const KEYWORDS = dedupe(RULES?.keywords, FALLBACK_RULES.keywords).sort(
  (a, b) => b.length - a.length
);
const STOPWORDS = new Set(dedupe(RULES?.stopwords, FALLBACK_RULES.stopwords));
const COLOR_SET = new Set(COLOR_WORDS);
const ADULT_TOKENS = new Set(Object.keys(ADULT_SIZE_MAP));

function toNumber(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const cleaned = String(value).replace(/[^0-9-]/g, "");
  const parsed = parseInt(cleaned, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanup(text) {
  return String(text ?? "").trim();
}

function isColorWord(token = "") {
  const word = cleanup(token);
  if (!word) return false;
  return COLOR_SET.has(word) || /^(one)?color$/i.test(word);
}

function normalizeMallName(raw) {
  const s = cleanup(raw).toLowerCase();
  if (!s) return "generic";
  if (s.includes("쿠팡")) return "coupang";
  if (s.includes("g마켓") || s.includes("gmarket")) return "gmarket";
  if (s.includes("카페24") || s.includes("cafe24")) return "cafe24";
  if (
    s.includes("스토어팜") ||
    s.includes("스마트스토어") ||
    s.includes("스토어") ||
    s.includes("네이버") ||
    s.includes("smartstore") ||
    s.includes("naver")
  )
    return "smartstore";
  return "generic";
}

function detectMallByPattern(row) {
  const sale = cleanup(
    row["판매처상품명"] || row["상품명"] || row["발주명"] || ""
  ).toLowerCase();
  const option = cleanup(
    row["옵션명"] ||
      row["옵션"] ||
      row["옵션정보"] ||
      row["세부옵션"] ||
      row["추가옵션"] ||
      ""
  ).toLowerCase();
  const expo = cleanup(row["노출명"] || "").toLowerCase();
  const combined = `${sale} ${option} ${expo}`;

  if (/[,]\s*[^,]+[,]\s*\d{2,3}\s*$/.test(expo) || /^\d+[._]/.test(sale)) {
    return "coupang";
  }

  if (
    (sale.includes(":") && sale.includes("/")) ||
    (option.includes(":") && option.includes("/")) ||
    /원\/[0-9]+개/.test(sale)
  ) {
    return "gmarket";
  }

  if (
    sale.includes("색상=") ||
    sale.includes("사이즈=") ||
    option.includes("색상=") ||
    option.includes("사이즈=")
  ) {
    return "cafe24";
  }

  if (
    sale.includes("색상:") && sale.includes("사이즈:") ||
    option.includes("색상:") && option.includes("사이즈:") ||
    expo.includes("스마트스토어") ||
    expo.includes("네이버")
  ) {
    return "smartstore";
  }

  if (/색상[:=]/.test(combined) && /사이즈[:=]/.test(combined)) {
    return "smartstore";
  }

  return "";
}

function normalizeColor(color) {
  let c = cleanup(color);
  if (!c) return "";
  c = c.replace(/\((성인|아동)\)/g, "");
  c = c.replace(/[\s,/]+/g, "");
  return c;
}

function extractHangulName(text) {
  const tokens = (cleanup(text).match(/[가-힣]{2,}/g) || []).filter(
    (tok) => tok.length > 1 && !isColorWord(tok) && !STOPWORDS.has(tok)
  );
  if (!tokens.length) return "";
  const unique = Array.from(new Set(tokens));
  unique.sort((a, b) => b.length - a.length);
  return unique[0] || "";
}

function extractDesignFromText(text) {
  const s = cleanup(text);
  if (!s) return "";
  const codeMatch = s.match(/\b([A-Z]{1,4}\d{2,3})\b/);
  if (!codeMatch) return "";
  const code = codeMatch[1];
  const keyword = KEYWORDS.find((kw) => s.includes(kw));
  return keyword ? `${code}${keyword}` : code;
}

function extractDesignFromSale(text) {
  let s = cleanup(text);
  if (!s) return "";
  s = s.replace(/상품명\s*[:=]\s*/gi, "");
  s = s.replace(/색상\s*[:=].*?(?:,|\/|\s사이즈|$)/gi, "");
  const size = extractSize(s);
  if (size) {
    s = s.replace(new RegExp(`(:|\\b)${size}(?:\\b|$)`), "");
  }
  const adultToken = Array.from(ADULT_TOKENS).find((tok) =>
    new RegExp(`(:|\\b)${tok}(?:\\b|$)`, "i").test(s)
  );
  if (adultToken) {
    s = s.replace(new RegExp(`(:|\\b)${adultToken}(?:\\b|$)`, "i"), "");
  }
  if (s.includes(":")) {
    const [left] = s.split(":");
    s = left;
  }
  if (s.includes("/")) {
    const [left] = s.split("/");
    s = left;
  }
  if (s.includes(",")) {
    const [left] = s.split(",");
    s = left;
  }
  s = s.replace(/^(\d+\.|\d+[_-])/, "");
  return cleanup(s);
}

function normalizeDesign(design) {
  let s = cleanup(design);
  if (!s) return "";
  s = s.replace(/\((성인|아동)\)/g, "");
  s = s.replace(/\s*(상품명|색상|사이즈)\s*[:=].*$/gi, "");
  s = s.replace(/[,/]+\s*$/g, "");
  s = s.replace(/\s*[:]\s*(S|M|L|XL|2XL|\d{2,3})$/i, "");
  s = s.replace(/^=+/, "");
  s = s.replace(/^(\d+\.|\d+[_-])/, "");
  s = s.replace(/\s+/g, " ");
  s = s.replace(/^([A-Z]{1,4}\d{2,3})\s+/, "$1");
  return cleanup(s);
}

function finalizeDesignColor(design, color) {
  let d = cleanup(design);
  let c = cleanup(color);
  if (!c) {
    const match = d.match(/\(([^)]+)\)$/);
    if (match) {
      c = normalizeColor(match[1]);
      d = d.replace(/\([^)]*\)$/, "").trim();
    }
  }
  d = normalizeDesign(d);
  if (!d || isColorWord(d)) {
    if (!c) c = d;
    d = "상품명 없음";
  }
  return { design: d || "상품명 없음", color: c };
}

function extractSize(text) {
  const s = cleanup(text);
  if (!s) return null;

  const label = s.match(/사이즈\s*[:=]\s*(\d{2,3}|S|M|L|XL|2XL)\b/i);
  if (label) {
    const tok = label[1].toUpperCase();
    return /\d{2,3}/.test(tok) ? toNumber(tok) : ADULT_SIZE_MAP[tok] || null;
  }

  const adultTagged = s.match(/:\s*(?:\(성인\)|\(아동\))?\s*(S|M|L|XL|2XL)\b/i);
  if (adultTagged) {
    const tok = adultTagged[1].toUpperCase();
    return ADULT_SIZE_MAP[tok] || null;
  }

  const colonDigits = s.match(/:\s*(\d{2,3})(?!\d)/);
  if (colonDigits) {
    const size = toNumber(colonDigits[1]);
    if (SIZES.includes(size)) return size;
  }

  const taggedDigits = s.match(/\((성인|아동)\)\s*(\d{2,3})/);
  if (taggedDigits) {
    const size = toNumber(taggedDigits[2]);
    if (SIZES.includes(size)) return size;
  }

  const trailingDigits = s.match(/(\d{2,3})\s*(?:호|cm)?\s*(?:개|벌|$)/i);
  if (trailingDigits) {
    const size = toNumber(trailingDigits[1]);
    if (SIZES.includes(size)) return size;
  }

  const tokens = [...s.matchAll(/(S|M|L|XL|2XL)\b/gi)];
  if (tokens.length) {
    const tok = tokens[tokens.length - 1][1].toUpperCase();
    const mapped = ADULT_SIZE_MAP[tok];
    if (mapped) return mapped;
  }

  const digitTokens = [...s.matchAll(/(\d{2,3})/g)];
  for (let i = digitTokens.length - 1; i >= 0; i -= 1) {
    const match = digitTokens[i];
    const idx = match.index || 0;
    const prev = s[idx - 1] || " ";
    if (/^[A-Za-z]$/.test(prev)) continue;
    const size = toNumber(match[1]);
    if (SIZES.includes(size)) return size;
  }

  return null;
}

function findColorWord(text) {
  const s = cleanup(text);
  if (!s) return "";
  for (const color of COLOR_WORDS) {
    if (!color) continue;
    if (s.includes(color)) return color;
  }
  return "";
}

function extractColor(text) {
  const s = cleanup(text);
  if (!s) return "";

  const label = s.match(/색상\s*[:=]\s*([^,/\s)]+)/);
  if (label) return normalizeColor(label[1]);

  const colorSize = s.match(
    /([가-힣A-Za-z]+)\s*:\s*(?:\(성인\)|\(아동\))?\s*(S|M|L|XL|2XL|\d{2,3})\b/
  );
  if (colorSize) {
    const candidate = normalizeColor(colorSize[1]);
    if (candidate && !ADULT_TOKENS.has(candidate.toUpperCase())) return candidate;
  }

  const slashColor = s.match(/\/\s*([가-힣A-Za-z]+)\s*(?:\(.*?\))?\s*(S|M|L|XL|2XL|\d{2,3})?/);
  if (slashColor) {
    const candidate = normalizeColor(slashColor[1]);
    if (candidate) return candidate;
  }

  const parenColor = s.match(/\(([^)]+)\)/);
  if (parenColor) {
    const candidate = normalizeColor(parenColor[1]);
    if (candidate && !ADULT_TOKENS.has(candidate.toUpperCase())) return candidate;
  }

  const word = findColorWord(s);
  return normalizeColor(word);
}

function resolveSize(fields) {
  for (const field of fields) {
    const size = extractSize(field);
    if (size) return size;
  }
  return null;
}

function resolveColor(fields) {
  for (const field of fields) {
    const color = extractColor(field);
    if (color) return color;
  }
  return "";
}

function resolveDesign({ fields, color }) {
  const candidates = [];
  for (const field of fields) {
    const keywordDesign = extractDesignFromText(field);
    if (keywordDesign) candidates.push(keywordDesign);
  }
  for (const field of fields) {
    const saleDesign = extractDesignFromSale(field);
    if (saleDesign) candidates.push(saleDesign);
  }
  for (const field of fields) {
    const hangul = extractHangulName(field);
    if (hangul) candidates.push(hangul);
  }
  return (
    candidates.find(
      (item) =>
        item &&
        item.length > 1 &&
        !isColorWord(item) &&
        cleanup(item) !== cleanup(color) &&
        !STOPWORDS.has(item.replace(/\s+/g, ""))
    ) || "상품명 없음"
  );
}

function parseRowCoupang(row) {
  const sale = cleanup(row["판매처상품명"]);
  const expo = cleanup(row["노출명"]);
  const size = resolveSize([sale, expo]);
  if (!size) return null;
  const fields = [sale, expo];
  const color = resolveColor(fields);
  const design = resolveDesign({ fields, color });
  const finalized = finalizeDesignColor(design, color);
  return { design: finalized.design, color: finalized.color, size };
}

function parseRowGmarket(row) {
  const sale = cleanup(row["판매처상품명"] || row["상품명"]);
  const option = cleanup(row["옵션명"] || row["옵션"] || "");
  const expo = cleanup(row["노출명"] || "");
  const combined = cleanup(`${sale} ${option}`);
  const size = resolveSize([combined, sale, option, expo]);
  if (!size) return null;
  const fields = [combined, sale, option, expo];
  const color = resolveColor(fields);
  const design = resolveDesign({ fields, color });
  const finalized = finalizeDesignColor(design, color);
  return { design: finalized.design, color: finalized.color, size };
}

function parseRowCafe24(row) {
  const sale = cleanup(row["판매처상품명"] || row["상품명"]);
  const option = cleanup(
    row["옵션명"] ||
      row["옵션"] ||
      row["옵션정보"] ||
      row["세부옵션"] ||
      row["추가옵션"] ||
      ""
  );
  const expo = cleanup(row["노출명"] || "");
  const combined = cleanup(`${sale} ${option}`);
  const size = resolveSize([combined, sale, option, expo]);
  if (!size) return null;
  const fields = [combined, sale, option, expo];
  const color = resolveColor(fields);
  const design = resolveDesign({ fields, color });
  const finalized = finalizeDesignColor(design, color);
  return { design: finalized.design, color: finalized.color, size };
}

function parseRowSmartStore(row) {
  const sale = cleanup(row["판매처상품명"] || row["상품명"]);
  const option = cleanup(
    row["옵션명"] ||
      row["옵션"] ||
      row["옵션정보"] ||
      row["상품옵션"] ||
      row["상세옵션"] ||
      ""
  );
  const expo = cleanup(row["노출명"] || "");
  const combined = cleanup(`${sale} ${option}`);
  const size = resolveSize([combined, sale, option, expo]);
  if (!size) return null;
  const fields = [combined, sale, option, expo];
  const color = resolveColor(fields);
  const design = resolveDesign({ fields, color });
  const finalized = finalizeDesignColor(design, color);
  return { design: finalized.design, color: finalized.color, size };
}

function parseRowGeneric(row) {
  const sale = cleanup(row["판매처상품명"] || row["상품명"] || row["발주명"]);
  const option = cleanup(row["옵션명"] || row["옵션"] || row["옵션정보"] || "");
  const expo = cleanup(row["노출명"] || "");
  const combined = cleanup(`${sale} ${option} ${expo}`);
  const size = resolveSize([combined, sale, option, expo]);
  if (!size) return null;
  const fields = [combined, sale, option, expo];
  const color = resolveColor(fields);
  const design = resolveDesign({ fields, color });
  const finalized = finalizeDesignColor(design, color);
  return { design: finalized.design, color: finalized.color, size };
}

export function computeSummary(rows) {
  const result = {};

  for (const row of rows) {
    const qty = toNumber(row["수량"]);
    if (!qty) continue;

    let mallType = normalizeMallName(row["쇼핑몰명"]);
    if (mallType === "generic") {
      const inferred = detectMallByPattern(row);
      if (inferred) mallType = inferred;
    }
    let parsed = null;

    if (mallType === "coupang") parsed = parseRowCoupang(row);
    else if (mallType === "gmarket") parsed = parseRowGmarket(row);
    else if (mallType === "cafe24") parsed = parseRowCafe24(row);
    else if (mallType === "smartstore") parsed = parseRowSmartStore(row);
    else parsed = parseRowGeneric(row);

    if (!parsed) continue;

    const { design, color, size } = parsed;
    if (!SIZES.includes(size)) continue;

    const key = color ? `${design}(${color})` : design;
    if (!result[key]) result[key] = {};
    if (!result[key][size]) result[key][size] = 0;
    result[key][size] += qty;
  }

  return Object.keys(result).map((designKey) => {
    let total = 0;
    const row = { design: designKey };
    for (const size of SIZES) {
      const value = result[designKey][size] || 0;
      row[size] = value;
      total += value;
    }
    row.total = total;
    return row;
  });
}
