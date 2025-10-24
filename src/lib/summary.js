import RULES from "./rules.json";

const FALLBACK_RULES = {
  allowedSizes: [90, 100, 110, 120, 130, 140, 150, 160, 170, 180],
  adultSizeMap: { S: 90, M: 100, L: 110, XL: 120, "2XL": 130 },
  colors: ["white", "black", "navy", "beige", "gray"],
  keywords: ["sweatshirt", "hoodie", "training", "set", "pants"],
  stopwords: ["product", "color", "size", "option", "select"],
};

const dedupe = (list = [], fallback = []) => {
  const merged = [...(Array.isArray(list) ? list : []), ...fallback];
  return Array.from(new Set(merged.filter(Boolean).map((item) => String(item).trim())));
};

export const SIZES = (RULES?.allowedSizes?.length ? RULES.allowedSizes : FALLBACK_RULES.allowedSizes).map(
  (size) => Number(size)
);

const ADULT_SIZE_MAP = {
  ...FALLBACK_RULES.adultSizeMap,
  ...(RULES?.adultSizeMap || {}),
};

const COLOR_WORDS = dedupe(RULES?.colors, FALLBACK_RULES.colors);
const KEYWORDS = dedupe(RULES?.keywords, FALLBACK_RULES.keywords).sort((a, b) => b.length - a.length);
const STOPWORDS = new Set(dedupe(RULES?.stopwords, FALLBACK_RULES.stopwords));
const COLOR_SET = new Set(COLOR_WORDS);
const ADULT_TOKENS = new Set(Object.keys(ADULT_SIZE_MAP));

const HANGUL_REGEX = /[\uAC00-\uD7A3]{2,}/g;

function toNumber(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = parseInt(String(value).replace(/[^0-9-]/g, ""), 10);
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
  const lowered = cleanup(raw).toLowerCase();
  if (!lowered) return "generic";
  if (lowered.includes("\uCFE0\uD321")) return "coupang";
  if (lowered.includes("g\uB9C8\uCF13") || lowered.includes("gmarket")) return "gmarket";
  if (lowered.includes("\uCE74\uD39824") || lowered.includes("cafe24")) return "cafe24";
  if (
    lowered.includes("\uC2A4\uD1A0\uC5B4\uD31D") ||
    lowered.includes("\uC2A4\uB9C8\uD2B8\uC2A4\uD1A0\uC5B4") ||
    lowered.includes("\uC2A4\uD1A0\uC5B4") ||
    lowered.includes("\uB124\uC774\uBC84") ||
    lowered.includes("smartstore") ||
    lowered.includes("naver")
  ) {
    return "smartstore";
  }
  return "generic";
}

function detectMallByPattern(row) {
  const sale = cleanup(row["\uD310\uB9E4\uCC98\uC0C1\uD488\uBA85"] || row["\uC0C1\uD488\uBA85"] || row["\uBC1C\uC8FC\uBA85"] || "").toLowerCase();
  const option = cleanup(
    row["\uC635\uC158\uBA85"] ||
      row["\uC635\uC158"] ||
      row["\uC635\uC158\uC815\uBCF4"] ||
      row["\uC138\uBD80\uC635\uC158"] ||
      row["\uCD94\uAC00\uC635\uC158"] ||
      ""
  ).toLowerCase();
  const expo = cleanup(row["\uB178\uCD9C\uBA85"] || "").toLowerCase();
  const combined = [sale, option, expo].join(" ");

  if (/[,]\s*[^,]+[,]\s*\d{2,3}\s*$/.test(expo) || /^\d+[._]/.test(sale)) {
    return "coupang";
  }

  if (
    (sale.includes(":") && sale.includes("/")) ||
    (option.includes(":") && option.includes("/")) ||
    /\uC6D0\/[0-9]+\uAC1C/.test(sale)
  ) {
    return "gmarket";
  }

  if (
    sale.includes("\uC0C9\uC0C1=") ||
    sale.includes("\uC0AC\uC774\uC988=") ||
    option.includes("\uC0C9\uC0C1=") ||
    option.includes("\uC0AC\uC774\uC988=")
  ) {
    return "cafe24";
  }

  if (
    (sale.includes("\uC0C9\uC0C1:") && sale.includes("\uC0AC\uC774\uC988:")) ||
    (option.includes("\uC0C9\uC0C1:") && option.includes("\uC0AC\uC774\uC988:")) ||
    expo.includes("\uC2A4\uB9C8\uD2B8\uC2A4\uD1A0\uC5B4") ||
    expo.includes("\uB124\uC774\uBC84")
  ) {
    return "smartstore";
  }

  if (/\uC0C9\uC0C1[:=]/.test(combined) && /\uC0AC\uC774\uC988[:=]/.test(combined)) {
    return "smartstore";
  }

  return "";
}

function normalizeColor(color) {
  let result = cleanup(color);
  if (!result) return "";
  result = result.replace(/\((\uC131\uC778|\uC544\uB3D9)\)/g, "");
  result = result.replace(/\s+/g, " ").trim();
  return result;
}

function extractHangulName(text) {
  const tokens = (cleanup(text).match(HANGUL_REGEX) || []).filter(
    (token) => token.length > 1 && !isColorWord(token) && !STOPWORDS.has(token)
  );
  if (!tokens.length) return "";
  const unique = Array.from(new Set(tokens));
  unique.sort((a, b) => b.length - a.length);
  return unique[0] || "";
}

function extractDesignFromText(text) {
  const source = cleanup(text);
  if (!source) return "";
  const codeMatch = source.match(/\b([A-Z]{1,4}\d{2,3})\b/);
  if (!codeMatch) return "";
  const code = codeMatch[1];
  const keyword = KEYWORDS.find((item) => source.includes(item));
  return keyword ? code + keyword : code;
}

function extractDesignFromSale(text) {
  let source = cleanup(text);
  if (!source) return "";
  source = source.replace(/\uC0C1\uD488\uBA85\s*[:=]\s*/gi, "");
  source = source.replace(/\uC0C9\uC0C1\s*[:=].*?(?:,|\/|\s\uC0AC\uC774\uC988|$)/gi, "");
  const size = extractSize(source);
  if (size) {
    source = source.replace(new RegExp('(:|\\\\b)' + size + '(?:\\\\b|$)'), "");
  }
  const adultToken = Array.from(ADULT_TOKENS).find((token) =>
    new RegExp('(:|\\\\b)' + token + '(?:\\\\b|$)', "i").test(source)
  );
  if (adultToken) {
    source = source.replace(new RegExp('(:|\\\\b)' + adultToken + '(?:\\\\b|$)', "i"), "");
  }
  if (source.includes(":")) {
    source = source.split(":")[0];
  }
  if (source.includes("/")) {
    source = source.split("/")[0];
  }
  if (source.includes(",")) {
    source = source.split(",")[0];
  }
  source = source.replace(/^(\d+\.|\d+[_-])/, "");
  return cleanup(source);
}

function normalizeDesign(design) {
  let refined = cleanup(design);
  if (!refined) return "";
  refined = refined.replace(/\((\uC131\uC778|\uC544\uB3D9)\)/g, "");
  refined = refined.replace(/\s*(\uC0C1\uD488\uBA85|\uC0C9\uC0C1|\uC0AC\uC774\uC988)\s*[:=].*$/gi, "");
  refined = refined.replace(/[,/]+\s*$/g, "");
  refined = refined.replace(/\s*[:]\s*(S|M|L|XL|2XL|\d{2,3})$/i, "");
  refined = refined.replace(/^=+/, "");
  refined = refined.replace(/^(\d+\.|\d+[_-])/, "");
  refined = refined.replace(/\s+/g, " ").trim();
  refined = refined.replace(/^([A-Z]{1,4}\d{2,3})\s+/, "$1");
  return refined.trim();
}

function finalizeDesignColor(design, color) {
  let base = normalizeDesign(design);
  let tone = cleanup(color);
  if (!tone) {
    const match = base.match(/\(([^)]+)\)$/);
    if (match) {
      tone = normalizeColor(match[1]);
      base = base.replace(/\([^)]*\)$/, "").trim();
    }
  }
  if (!base) base = "\uC0C1\uD488\uBA85 \uC5C6\uC74C";
  if (!tone) {
    return { design: base, color: "" };
  }
  return { design: base + "(" + tone + ")", color: tone };
}

function extractSize(text) {
  const source = cleanup(text);
  if (!source) return null;

  const label = source.match(/\uC0AC\uC774\uC988\s*[:=]\s*(\d{2,3}|S|M|L|XL|2XL)\b/i);
  if (label) {
    const token = label[1].toUpperCase();
    return /\d{2,3}/.test(token) ? toNumber(token) : ADULT_SIZE_MAP[token] || null;
  }

  const taggedAdult = source.match(/:\s*(?:\(\uC131\uC778\)|\(\uC544\uB3D9\))?\s*(S|M|L|XL|2XL)\b/i);
  if (taggedAdult) {
    const mapped = ADULT_SIZE_MAP[taggedAdult[1].toUpperCase()];
    if (mapped) return mapped;
  }

  const colonDigits = source.match(/:\s*(\d{2,3})(?!\d)/);
  if (colonDigits) {
    const size = toNumber(colonDigits[1]);
    if (SIZES.includes(size)) return size;
  }

  const taggedDigits = source.match(/\((\uC131\uC778|\uC544\uB3D9)\)\s*(\d{2,3})/);
  if (taggedDigits) {
    const size = toNumber(taggedDigits[2]);
    if (SIZES.includes(size)) return size;
  }

  const trailing = source.match(/(\d{2,3})\s*(?:\uD638|cm)?\s*(?:\uAC1C|\uBC8C|$)/i);
  if (trailing) {
    const size = toNumber(trailing[1]);
    if (SIZES.includes(size)) return size;
  }

  const adultTokens = [...source.matchAll(/(S|M|L|XL|2XL)\b/gi)];
  if (adultTokens.length) {
    const mapped = ADULT_SIZE_MAP[adultTokens[adultTokens.length - 1][1].toUpperCase()];
    if (mapped) return mapped;
  }

  const digitTokens = [...source.matchAll(/(\d{2,3})/g)];
  for (let index = digitTokens.length - 1; index >= 0; index -= 1) {
    const match = digitTokens[index];
    const previous = source[(match.index || 0) - 1] || " ";
    if (/^[A-Za-z]$/.test(previous)) continue;
    const size = toNumber(match[1]);
    if (SIZES.includes(size)) return size;
  }

  return null;
}

function findColorWord(text) {
  const source = cleanup(text);
  if (!source) return "";
  return COLOR_WORDS.find((color) => color && source.includes(color)) || "";
}

function extractColor(text) {
  const source = cleanup(text);
  if (!source) return "";

  const label = source.match(/\uC0C9\uC0C1\s*[:=]\s*([^,/\s)]+)/);
  if (label) return normalizeColor(label[1]);

  const colon = source.match(/([\uAC00-\uD7A3A-Za-z]+)\s*:\s*(?:\(\uC131\uC778\)|\(\uC544\uB3D9\))?\s*(S|M|L|XL|2XL|\d{2,3})\b/);
  if (colon) {
    const candidate = normalizeColor(colon[1]);
    if (candidate && !ADULT_TOKENS.has(candidate.toUpperCase())) return candidate;
  }

  const slash = source.match(/\/\s*([\uAC00-\uD7A3A-Za-z]+)\s*(?:\(.*?\))?/);
  if (slash) {
    const candidate = normalizeColor(slash[1]);
    if (candidate) return candidate;
  }

  const paren = source.match(/\(([^)]+)\)/);
  if (paren) {
    const candidate = normalizeColor(paren[1]);
    if (candidate && !ADULT_TOKENS.has(candidate.toUpperCase())) return candidate;
  }

  return normalizeColor(findColorWord(source));
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

function resolveDesign(fields, color) {
  const candidates = [];
  fields.forEach((field) => {
    const candidate = extractDesignFromText(field);
    if (candidate) candidates.push(candidate);
  });
  fields.forEach((field) => {
    const candidate = extractDesignFromSale(field);
    if (candidate) candidates.push(candidate);
  });
  fields.forEach((field) => {
    const hangul = extractHangulName(field);
    if (hangul) candidates.push(hangul);
  });
  return (
    candidates.find(
      (item) =>
        item &&
        item.length > 1 &&
        !isColorWord(item) &&
        cleanup(item) !== cleanup(color) &&
        !STOPWORDS.has(item.replace(/\s+/g, ""))
    ) || "\uC0C1\uD488\uBA85 \uC5C6\uC74C"
  );
}

function parseRowCoupang(row) {
  const sale = cleanup(row["\uD310\uB9E4\uCC98\uC0C1\uD488\uBA85"]);
  const expo = cleanup(row["\uB178\uCD9C\uBA85"]);
  const size = resolveSize([sale, expo]);
  if (!size) return null;
  const fields = [sale, expo];
  const color = resolveColor(fields);
  const design = resolveDesign(fields, color);
  const finalized = finalizeDesignColor(design, color);
  return { design: finalized.design, color: finalized.color, size };
}

function parseRowGmarket(row) {
  const sale = cleanup(row["\uD310\uB9E4\uCC98\uC0C1\uD488\uBA85"] || row["\uC0C1\uD488\uBA85"]);
  const option = cleanup(row["\uC635\uC158\uBA85"] || row["\uC635\uC158"] || "");
  const expo = cleanup(row["\uB178\uCD9C\uBA85"] || "");
  const combined = [sale, option].join(" ").trim();
  const size = resolveSize([combined, sale, option, expo]);
  if (!size) return null;
  const fields = [combined, sale, option, expo];
  const color = resolveColor(fields);
  const design = resolveDesign(fields, color);
  const finalized = finalizeDesignColor(design, color);
  return { design: finalized.design, color: finalized.color, size };
}

function parseRowCafe24(row) {
  const sale = cleanup(row["\uD310\uB9E4\uCC98\uC0C1\uD488\uBA85"] || row["\uC0C1\uD488\uBA85"]);
  const option = cleanup(
    row["\uC635\uC158\uBA85"] ||
      row["\uC635\uC158"] ||
      row["\uC635\uC158\uC815\uBCF4"] ||
      row["\uC138\uBD80\uC635\uC158"] ||
      row["\uCD94\uAC00\uC635\uC158"] ||
      ""
  );
  const expo = cleanup(row["\uB178\uCD9C\uBA85"] || "");
  const combined = [sale, option].join(" ").trim();
  const size = resolveSize([combined, sale, option, expo]);
  if (!size) return null;
  const fields = [combined, sale, option, expo];
  const color = resolveColor(fields);
  const design = resolveDesign(fields, color);
  const finalized = finalizeDesignColor(design, color);
  return { design: finalized.design, color: finalized.color, size };
}

function parseRowSmartStore(row) {
  const sale = cleanup(row["\uD310\uB9E4\uCC98\uC0C1\uD488\uBA85"] || row["\uC0C1\uD488\uBA85"]);
  const option = cleanup(
    row["\uC635\uC158\uBA85"] ||
      row["\uC635\uC158"] ||
      row["\uC635\uC158\uC815\uBCF4"] ||
      row["\uC0C1\uD488\uC635\uC158"] ||
      row["\uC0C1\uC138\uC635\uC158"] ||
      ""
  );
  const expo = cleanup(row["\uB178\uCD9C\uBA85"] || "");
  const combined = [sale, option].join(" ").trim();
  const size = resolveSize([combined, sale, option, expo]);
  if (!size) return null;
  const fields = [combined, sale, option, expo];
  const color = resolveColor(fields);
  const design = resolveDesign(fields, color);
  const finalized = finalizeDesignColor(design, color);
  return { design: finalized.design, color: finalized.color, size };
}

function parseRowGeneric(row) {
  const sale = cleanup(row["\uD310\uB9E4\uCC98\uC0C1\uD488\uBA85"] || row["\uC0C1\uD488\uBA85"] || row["\uBC1C\uC8FC\uBA85"]);
  const option = cleanup(row["\uC635\uC158\uBA85"] || row["\uC635\uC158"] || row["\uC635\uC158\uC815\uBCF4"] || "");
  const expo = cleanup(row["\uB178\uCD9C\uBA85"] || "");
  const combined = [sale, option, expo].join(" ").trim();
  const size = resolveSize([combined, sale, option, expo]);
  if (!size) return null;
  const fields = [combined, sale, option, expo];
  const color = resolveColor(fields);
  const design = resolveDesign(fields, color);
  const finalized = finalizeDesignColor(design, color);
  return { design: finalized.design, color: finalized.color, size };
}

export function computeSummary(rows) {
  const result = {};

  for (const row of rows) {
    const quantity = toNumber(row["\uC218\uB7C9"]);
    if (!quantity) continue;

    let mallType = normalizeMallName(row["\uC1FC\uD551\uBAB0\uBA85"]);
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

    const designKey = parsed.design;
    const sizeKey = parsed.size;
    if (!SIZES.includes(sizeKey)) continue;

    if (!result[designKey]) result[designKey] = {};
    if (!result[designKey][sizeKey]) result[designKey][sizeKey] = 0;
    result[designKey][sizeKey] += quantity;
  }

  return Object.keys(result).map((design) => {
    let total = 0;
    const row = { design };
    for (const size of SIZES) {
      const value = result[design][size] || 0;
      row[size] = value;
      total += value;
    }
    row.total = total;
    return row;
  });
}


