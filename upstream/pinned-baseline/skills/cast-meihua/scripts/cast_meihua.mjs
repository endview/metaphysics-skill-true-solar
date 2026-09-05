#!/usr/bin/env node

import process from "node:process";
import { pathToFileURL } from "node:url";

const SCHEMA = "cast-meihua/result-v2";
const SUPPORTED_METHODS = new Set(["lunar-time-v2", "numbers-v2"]);
const TIMING_UNITS = new Set([
  "minutes",
  "hours",
  "days",
  "weeks",
  "months",
  "years",
  "events",
]);
const TIMING_PROFILES = new Set([
  "stage-within-horizon-v1",
  "moving-line-count-v1",
]);

const TRIGRAMS = [
  { number: 1, key: "qian", name: "乾", symbol: "☰", element: "金", lines: [1, 1, 1] },
  { number: 2, key: "dui", name: "兑", symbol: "☱", element: "金", lines: [1, 1, 0] },
  { number: 3, key: "li", name: "离", symbol: "☲", element: "火", lines: [1, 0, 1] },
  { number: 4, key: "zhen", name: "震", symbol: "☳", element: "木", lines: [1, 0, 0] },
  { number: 5, key: "xun", name: "巽", symbol: "☴", element: "木", lines: [0, 1, 1] },
  { number: 6, key: "kan", name: "坎", symbol: "☵", element: "水", lines: [0, 1, 0] },
  { number: 7, key: "gen", name: "艮", symbol: "☶", element: "土", lines: [0, 0, 1] },
  { number: 8, key: "kun", name: "坤", symbol: "☷", element: "土", lines: [0, 0, 0] },
];

const HEXAGRAM_NAMES = {
  乾: { 乾: "乾为天", 兑: "天泽履", 离: "天火同人", 震: "天雷无妄", 巽: "天风姤", 坎: "天水讼", 艮: "天山遁", 坤: "天地否" },
  兑: { 乾: "泽天夬", 兑: "兑为泽", 离: "泽火革", 震: "泽雷随", 巽: "泽风大过", 坎: "泽水困", 艮: "泽山咸", 坤: "泽地萃" },
  离: { 乾: "火天大有", 兑: "火泽睽", 离: "离为火", 震: "火雷噬嗑", 巽: "火风鼎", 坎: "火水未济", 艮: "火山旅", 坤: "火地晋" },
  震: { 乾: "雷天大壮", 兑: "雷泽归妹", 离: "雷火丰", 震: "震为雷", 巽: "雷风恒", 坎: "雷水解", 艮: "雷山小过", 坤: "雷地豫" },
  巽: { 乾: "风天小畜", 兑: "风泽中孚", 离: "风火家人", 震: "风雷益", 巽: "巽为风", 坎: "风水涣", 艮: "风山渐", 坤: "风地观" },
  坎: { 乾: "水天需", 兑: "水泽节", 离: "水火既济", 震: "水雷屯", 巽: "水风井", 坎: "坎为水", 艮: "水山蹇", 坤: "水地比" },
  艮: { 乾: "山天大畜", 兑: "山泽损", 离: "山火贲", 震: "山雷颐", 巽: "山风蛊", 坎: "山水蒙", 艮: "艮为山", 坤: "山地剥" },
  坤: { 乾: "地天泰", 兑: "地泽临", 离: "地火明夷", 震: "地雷复", 巽: "地风升", 坎: "地水师", 艮: "地山谦", 坤: "坤为地" },
};

const EARTHLY_BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const GENERATES = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };
const CONTROLS = { 木: "土", 土: "水", 水: "火", 火: "金", 金: "木" };

const TRIGRAM_BY_NUMBER = new Map(TRIGRAMS.map((item) => [item.number, item]));
const TRIGRAM_BY_LINES = new Map(TRIGRAMS.map((item) => [item.lines.join(""), item]));

function fail(message) {
  throw new Error(message);
}

function modulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function mappedRemainder(source, sourceValue, divisor) {
  const rawRemainder = modulo(sourceValue, divisor);
  return {
    source,
    sourceValue,
    divisor,
    rawRemainder,
    mappedValue: rawRemainder === 0 ? divisor : rawRemainder,
    zeroRuleApplied: rawRemainder === 0,
  };
}

function summarizeTrigram(trigram) {
  return {
    number: trigram.number,
    key: trigram.key,
    name: trigram.name,
    symbol: trigram.symbol,
    element: trigram.element,
    linesBottomUp: [...trigram.lines],
  };
}

function lineLabel(position, value) {
  if (position === 1) return `初${value === 1 ? "九" : "六"}`;
  if (position === 6) return `上${value === 1 ? "九" : "六"}`;
  const numeral = [null, null, "二", "三", "四", "五"][position];
  return `${value === 1 ? "九" : "六"}${numeral}`;
}

function describeLines(lines, movingLine = null) {
  return lines.map((value, index) => {
    const position = index + 1;
    return {
      position,
      label: lineLabel(position, value),
      value,
      polarity: value === 1 ? "阳" : "阴",
      moving: position === movingLine,
    };
  });
}

function hexagramFromLines(lines, label, movingLine = null) {
  if (!Array.isArray(lines) || lines.length !== 6 || lines.some((line) => line !== 0 && line !== 1)) {
    fail("Hexagram lines must contain exactly six binary values.");
  }
  const lower = TRIGRAM_BY_LINES.get(lines.slice(0, 3).join(""));
  const upper = TRIGRAM_BY_LINES.get(lines.slice(3, 6).join(""));
  if (!lower || !upper) fail("Unable to resolve trigram lines.");
  return {
    label,
    name: HEXAGRAM_NAMES[upper.name][lower.name],
    upper: summarizeTrigram(upper),
    lower: summarizeTrigram(lower),
    binaryBottomUp: lines.join(""),
    linesBottomUp: describeLines(lines, movingLine),
  };
}

function deriveHexagrams(upperNumber, lowerNumber, movingLine) {
  const upper = TRIGRAM_BY_NUMBER.get(upperNumber);
  const lower = TRIGRAM_BY_NUMBER.get(lowerNumber);
  if (!upper || !lower) fail("Mapped trigram number must be from 1 to 8.");
  if (!Number.isInteger(movingLine) || movingLine < 1 || movingLine > 6) {
    fail("Mapped moving line must be from 1 to 6.");
  }

  const originalLines = [...lower.lines, ...upper.lines];
  const changedLines = [...originalLines];
  changedLines[movingLine - 1] = changedLines[movingLine - 1] === 1 ? 0 : 1;
  const mutualLines = [
    ...originalLines.slice(1, 4),
    ...originalLines.slice(2, 5),
  ];
  const oppositeLines = originalLines.map((line) => (line === 1 ? 0 : 1));
  const reversedLines = [...originalLines].reverse();

  const primary = hexagramFromLines(originalLines, "本卦", movingLine);
  const changed = hexagramFromLines(changedLines, "变卦");
  const mutual = hexagramFromLines(mutualLines, "互卦");
  const opposite = hexagramFromLines(oppositeLines, "错卦");
  const reversed = hexagramFromLines(reversedLines, "综卦");

  const movingLocation = movingLine <= 3 ? "lower" : "upper";
  const bodyLocation = movingLocation === "lower" ? "upper" : "lower";
  const useTrigram = movingLocation === "lower" ? lower : upper;
  const bodyTrigram = bodyLocation === "lower" ? lower : upper;
  const relation = fiveElementRelation(bodyTrigram.element, useTrigram.element);
  const originalLine = originalLines[movingLine - 1];

  return {
    primary,
    movingLine: {
      position: movingLine,
      label: lineLabel(movingLine, originalLine),
      originalValue: originalLine,
      originalPolarity: originalLine === 1 ? "阳" : "阴",
      changedValue: originalLine === 1 ? 0 : 1,
      changedPolarity: originalLine === 1 ? "阴" : "阳",
      trigramLocation: movingLocation,
      role: "用",
    },
    changed,
    mutual,
    opposite,
    reversed,
    bodyUse: {
      principle: "动爻所在经卦为用，另一静卦为体",
      body: { location: bodyLocation, trigram: summarizeTrigram(bodyTrigram) },
      use: { location: movingLocation, trigram: summarizeTrigram(useTrigram) },
      fiveElementRelation: relation,
    },
  };
}

function fiveElementRelation(bodyElement, useElement) {
  let code;
  if (bodyElement === useElement) code = "比和";
  else if (GENERATES[bodyElement] === useElement) code = "体生用";
  else if (GENERATES[useElement] === bodyElement) code = "用生体";
  else if (CONTROLS[bodyElement] === useElement) code = "体克用";
  else if (CONTROLS[useElement] === bodyElement) code = "用克体";
  else fail(`Unable to resolve five-element relation: ${bodyElement}/${useElement}`);

  const descriptions = {
    比和: "体用同一五行",
    体生用: "体五行生用五行",
    用生体: "用五行生体五行",
    体克用: "体五行克用五行",
    用克体: "用五行克体五行",
  };
  return { code, bodyElement, useElement, description: descriptions[code] };
}

function parseArgs(argv) {
  const options = {};
  const flags = new Set(["help", "pretty", "now"]);
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) fail(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    if (Object.hasOwn(options, key)) fail(`Duplicate option: --${key}`);
    if (flags.has(key)) {
      options[key] = true;
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) fail(`Missing value for --${key}`);
    options[key] = value;
    index += 1;
  }
  return options;
}

function requireText(options, key) {
  const value = options[key];
  if (typeof value !== "string" || value.trim() === "") fail(`--${key} is required.`);
  return value.trim();
}

function validateWallFields(fields, optionName) {
  const { year, month, day, hour, minute, second } = fields;
  if (year === 0 || month < 1 || month > 12) {
    fail(`${optionName} contains an invalid calendar date.`);
  }
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > daysInMonth[month - 1]) {
    fail(`${optionName} contains a nonexistent calendar date.`);
  }
  if (hour > 23 || minute > 59 || second > 59) {
    fail(`${optionName} contains an invalid or unsupported time.`);
  }
}

function wallRecord(match) {
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6]),
    fractionalSecond: match[7] ? Number(match[7]) : 0,
  };
}

function formatWallDateTime(wall) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${String(wall.year).padStart(4, "0")}-${pad(wall.month)}-${pad(wall.day)}T${pad(wall.hour)}:${pad(wall.minute)}:${pad(wall.second)}`;
}

function wallClockEpochSeconds(wall) {
  const carrier = new Date(0);
  carrier.setUTCFullYear(wall.year, wall.month - 1, wall.day);
  carrier.setUTCHours(wall.hour, wall.minute, wall.second, 0);
  return carrier.getTime() / 1000 + (wall.fractionalSecond ?? 0);
}

function parseRfc3339DateTime(text, optionName) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/.exec(text);
  if (!match) {
    fail(`${optionName} must use YYYY-MM-DDTHH:MM:SS[.fraction] with uppercase Z or an explicit UTC offset.`);
  }

  const wall = wallRecord(match);
  const offsetHour = match[9] ? Number(match[10]) : 0;
  const offsetMinute = match[9] ? Number(match[11]) : 0;

  validateWallFields(wall, optionName);
  if (offsetHour > 23 || offsetMinute > 59) {
    fail(`${optionName} contains an invalid RFC 3339 UTC offset.`);
  }

  const instant = new Date(text);
  if (Number.isNaN(instant.getTime())) {
    fail(`${optionName} is outside the supported instant range.`);
  }
  return {
    instant,
    wall,
    wallDateTime: formatWallDateTime(wall),
  };
}

function parseTrueSolarLocalDateTime(text) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(text);
  if (!match) {
    fail("--true-solar-local-datetime must use YYYY-MM-DDTHH:MM:SS without Z or a UTC offset.");
  }
  const wall = wallRecord(match);
  validateWallFields(wall, "--true-solar-local-datetime");
  return {
    wall,
    wallDateTime: formatWallDateTime(wall),
  };
}

function parseLongitude(text) {
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) {
    fail("--longitude must be a decimal longitude in degrees, east positive and west negative.");
  }
  const value = Number(text);
  if (!Number.isFinite(value) || value < -180 || value > 180) {
    fail("--longitude must be between -180 and 180 degrees.");
  }
  return value;
}

function validateOptions(options) {
  const allowed = new Set([
    "help",
    "pretty",
    "now",
    "method",
    "numbers",
    "question",
    "horizon",
    "timing-unit",
    "timing-profile",
    "datetime",
    "civil-datetime",
    "true-solar-datetime",
    "true-solar-local-datetime",
    "time-basis",
    "timezone",
    "location",
    "longitude",
    "conversion-source",
  ]);
  for (const key of Object.keys(options)) {
    if (!allowed.has(key)) fail(`Unknown option: --${key}`);
  }
  if (options["true-solar-datetime"] !== undefined) {
    fail("--true-solar-datetime is not accepted: use --true-solar-local-datetime without an offset.");
  }

  const method = requireText(options, "method");
  if (!SUPPORTED_METHODS.has(method)) {
    fail(`--method must be one of: ${[...SUPPORTED_METHODS].join(", ")}`);
  }
  const question = requireText(options, "question");
  const horizon = requireText(options, "horizon");
  const timingUnit = requireText(options, "timing-unit");
  if (!TIMING_UNITS.has(timingUnit)) {
    fail(`--timing-unit must be one of: ${[...TIMING_UNITS].join(", ")}`);
  }
  const timingProfile = requireText(options, "timing-profile");
  if (!TIMING_PROFILES.has(timingProfile)) {
    fail(`--timing-profile must be one of: ${[...TIMING_PROFILES].join(", ")}`);
  }
  const timeZone = requireText(options, "timezone");
  validateTimeZone(timeZone);

  const timeBasis = requireText(options, "time-basis");
  if (timeBasis !== "civil" && timeBasis !== "true_solar") {
    fail("--time-basis must be civil or true_solar.");
  }

  let civilDateTime;
  let civilInstant;
  let civilTimeContext;
  let civilTimeSource;
  let trueSolarLocalDateTime = null;
  let trueSolarTimeContext = null;
  let location = null;
  let longitude = null;
  let conversionSource = null;

  if (timeBasis === "civil") {
    if (Boolean(options.now) === Boolean(options.datetime)) {
      fail("With --time-basis civil, specify exactly one of --datetime or --now.");
    }
    for (const key of ["civil-datetime", "true-solar-local-datetime", "location", "longitude", "conversion-source"]) {
      if (options[key] !== undefined) {
        fail(`--${key} is only valid with --time-basis true_solar.`);
      }
    }
    if (options.now) {
      civilDateTime = null;
      civilInstant = new Date();
      civilTimeSource = "now";
      civilTimeContext = readTimeContext(civilInstant, timeZone);
    } else {
      civilDateTime = requireText(options, "datetime");
      const civilParsed = parseRfc3339DateTime(civilDateTime, "--datetime");
      civilInstant = civilParsed.instant;
      civilTimeSource = "specified";
      civilTimeContext = readTimeContext(civilInstant, timeZone);
      if (civilTimeContext.localDateTime !== civilParsed.wallDateTime) {
        fail("--datetime offset is inconsistent with --timezone at the supplied civil clock time.");
      }
      civilTimeContext.wall = civilParsed.wall;
    }
  } else {
    if (options.now || options.datetime !== undefined) {
      fail("With --time-basis true_solar, provide explicit --civil-datetime and --true-solar-local-datetime; --datetime and --now are not accepted.");
    }
    civilDateTime = requireText(options, "civil-datetime");
    const civilParsed = parseRfc3339DateTime(civilDateTime, "--civil-datetime");
    civilInstant = civilParsed.instant;
    civilTimeSource = "specified";
    civilTimeContext = readTimeContext(civilInstant, timeZone);
    if (civilTimeContext.localDateTime !== civilParsed.wallDateTime) {
      fail("--civil-datetime offset is inconsistent with --timezone at the supplied civil clock time.");
    }
    civilTimeContext.wall = civilParsed.wall;
    trueSolarLocalDateTime = requireText(options, "true-solar-local-datetime");
    const trueSolarParsed = parseTrueSolarLocalDateTime(trueSolarLocalDateTime);
    trueSolarTimeContext = {
      localDateTime: trueSolarParsed.wallDateTime,
      localHour: trueSolarParsed.wall.hour,
      wall: trueSolarParsed.wall,
    };
    location = requireText(options, "location");
    longitude = parseLongitude(requireText(options, "longitude"));
    conversionSource = requireText(options, "conversion-source");
  }

  let numbers = null;
  if (method === "numbers-v2") {
    numbers = parseNumbers(requireText(options, "numbers"));
  } else if (options.numbers !== undefined) {
    fail("--numbers is only valid with numbers-v2.");
  }

  return {
    method,
    question,
    horizon,
    timingUnit,
    timingProfile,
    timeZone,
    timeBasis,
    civilDateTime,
    civilInstant,
    civilTimeContext,
    civilTimeSource,
    trueSolarLocalDateTime,
    trueSolarTimeContext,
    location,
    longitude,
    conversionSource,
    numbers,
  };
}

function validateTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format(new Date(0));
  } catch {
    fail(`Invalid or unsupported IANA time zone: ${timeZone}`);
  }
}

function parseNumbers(text) {
  const tokens = text.split(/[\s,，]+/u).filter(Boolean);
  if (tokens.length !== 2 && tokens.length !== 3) {
    fail("--numbers must contain exactly two or three positive integers.");
  }
  const numbers = tokens.map((token) => {
    if (!/^\d+$/.test(token)) fail(`Invalid positive integer: ${token}`);
    const value = Number(token);
    if (!Number.isSafeInteger(value) || value <= 0) {
      fail(`Number must be a positive safe integer: ${token}`);
    }
    return value;
  });
  if (numbers.length === 2 && !Number.isSafeInteger(numbers[0] + numbers[1])) {
    fail("For numbers-v2 with two numbers, their sum must also be a safe integer.");
  }
  return numbers;
}

function partsRecord(formatter, instant) {
  const record = {};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== "literal") record[part.type] = part.value;
  }
  return record;
}

function readTimeContext(instant, timeZone) {
  const localFormatter = new Intl.DateTimeFormat("en-CA-u-nu-latn", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "longOffset",
  });
  const local = partsRecord(localFormatter, instant);
  const localHour = Number(local.hour);
  if (!Number.isInteger(localHour) || localHour < 0 || localHour > 23) {
    fail(`Unable to parse local hour: ${local.hour}`);
  }
  const wall = {
    year: Number(local.year),
    month: Number(local.month),
    day: Number(local.day),
    hour: localHour,
    minute: Number(local.minute),
    second: Number(local.second),
  };
  validateWallFields(wall, "projected civil datetime");
  return {
    localDateTime: formatWallDateTime(wall),
    timeZoneOffset: local.timeZoneName,
    localHour,
    wall,
    formatter: localFormatter.resolvedOptions(),
  };
}

function readChineseCalendarFromWallDate(wall) {
  const calendarCarrier = new Date(0);
  calendarCarrier.setUTCFullYear(wall.year, wall.month - 1, wall.day);
  calendarCarrier.setUTCHours(12, 0, 0, 0);
  const formatter = new Intl.DateTimeFormat("en-u-ca-chinese-nu-latn", {
    timeZone: "UTC",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const resolved = formatter.resolvedOptions();
  if (resolved.calendar !== "chinese") {
    fail(`Runtime did not resolve the Chinese calendar (resolved: ${resolved.calendar}).`);
  }
  const parts = partsRecord(formatter, calendarCarrier);
  const relatedYear = Number(parts.relatedYear);
  const lunarDay = Number(parts.day);
  const monthMatch = /^(\d+)(bis)?$/i.exec(parts.month ?? "");
  if (!Number.isInteger(relatedYear) || !Number.isInteger(lunarDay) || !monthMatch) {
    fail(`Unable to parse Chinese calendar fields: ${JSON.stringify(parts)}`);
  }
  const lunarMonth = Number(monthMatch[1]);
  if (lunarMonth < 1 || lunarMonth > 12 || lunarDay < 1 || lunarDay > 30) {
    fail(`Chinese calendar fields are outside expected ranges: ${JSON.stringify(parts)}`);
  }
  return {
    relatedYear,
    lunarMonth,
    lunarMonthToken: parts.month,
    isLeapMonth: Boolean(monthMatch[2]),
    lunarDay,
    wallDate: formatWallDateTime({ ...wall, hour: 0, minute: 0, second: 0 }).slice(0, 10),
    calendarCarrier: calendarCarrier.toISOString(),
    rawParts: parts,
    formatter: resolved,
  };
}

function runtimeRecord() {
  return {
    node: process.version,
    v8: process.versions.v8 ?? null,
    icu: process.versions.icu ?? null,
    cldr: process.versions.cldr ?? null,
    tz: process.versions.tz ?? null,
    unicode: process.versions.unicode ?? null,
  };
}

function castLunarTime(context, timeContext) {
  const lunar = readChineseCalendarFromWallDate(timeContext.wall);
  const yearBranchIndex = modulo(lunar.relatedYear - 4, 12) + 1;
  const hourBranchIndex = Math.floor(((timeContext.localHour + 1) % 24) / 2) + 1;
  const upperSum = yearBranchIndex + lunar.lunarMonth + lunar.lunarDay;
  const lowerSum = upperSum + hourBranchIndex;
  const movingSum = lowerSum;
  const upper = mappedRemainder("yearBranch + lunarMonth + lunarDay", upperSum, 8);
  const lower = mappedRemainder("yearBranch + lunarMonth + lunarDay + hourBranch", lowerSum, 8);
  const moving = mappedRemainder("yearBranch + lunarMonth + lunarDay + hourBranch", movingSum, 6);

  return {
    protocol: {
      id: "lunar-time-v2",
      timeBasis: context.timeBasis,
      rules: {
        calendarProjection: "map the selected local Gregorian wall date through a UTC-noon calendar carrier; the carrier is not the cast instant",
        upper: "yearBranch + lunarMonth + lunarDay, modulo 8 with zero mapped to 8",
        lower: "yearBranch + lunarMonth + lunarDay + hourBranch, modulo 8 with zero mapped to 8",
        moving: "yearBranch + lunarMonth + lunarDay + hourBranch, modulo 6 with zero mapped to 6",
        leapMonth: "retain numeric month and record the leap marker without changing the number",
      },
    },
    calculation: {
      rawValues: {
        relatedYear: lunar.relatedYear,
        yearBranchIndex,
        yearBranchName: EARTHLY_BRANCHES[yearBranchIndex - 1],
        lunarMonth: lunar.lunarMonth,
        lunarMonthToken: lunar.lunarMonthToken,
        isLeapMonth: lunar.isLeapMonth,
        lunarDay: lunar.lunarDay,
        localHour24: timeContext.localHour,
        hourBranchIndex,
        hourBranchName: EARTHLY_BRANCHES[hourBranchIndex - 1],
        selectedTimeBasis: context.timeBasis,
        selectedLocalDateTime: timeContext.localDateTime,
        calendarWallDate: lunar.wallDate,
        calendarCarrier: lunar.calendarCarrier,
        intlChineseCalendarParts: lunar.rawParts,
      },
      intermediateValues: { upperSum, lowerSum, movingSum },
      remainderMapping: { upper, lower, moving },
      intlChineseCalendarFormatter: lunar.formatter,
    },
    result: deriveHexagrams(upper.mappedValue, lower.mappedValue, moving.mappedValue),
  };
}

function castNumbers(context) {
  const [a, b, c] = context.numbers;
  const isTwoNumberRule = context.numbers.length === 2;
  const upperValue = a;
  const lowerValue = b;
  const movingValue = isTwoNumberRule ? a + b : c;
  const upper = mappedRemainder("first number", upperValue, 8);
  const lower = mappedRemainder("second number", lowerValue, 8);
  const moving = mappedRemainder(
    isTwoNumberRule ? "first number + second number" : "third number",
    movingValue,
    6,
  );

  return {
    protocol: {
      id: "numbers-v2",
      variant: isTwoNumberRule ? "two-numbers" : "three-numbers",
      timeBasis: context.timeBasis,
      rules: isTwoNumberRule
        ? {
            upper: "first number, modulo 8 with zero mapped to 8",
            lower: "second number, modulo 8 with zero mapped to 8",
            moving: "first + second, modulo 6 with zero mapped to 6",
          }
        : {
            upper: "first number, modulo 8 with zero mapped to 8",
            lower: "second number, modulo 8 with zero mapped to 8",
            moving: "third number, modulo 6 with zero mapped to 6",
          },
    },
    calculation: {
      rawValues: {
        numbers: [...context.numbers],
        selectedTimeBasis: context.timeBasis,
        selectedLocalDateTime: context.timeBasis === "civil"
          ? context.civilTimeContext.localDateTime
          : context.trueSolarTimeContext.localDateTime,
      },
      intermediateValues: {
        upperValue,
        lowerValue,
        movingValue,
        movingExpression: isTwoNumberRule ? `${a} + ${b}` : `${c}`,
      },
      remainderMapping: { upper, lower, moving },
    },
    result: deriveHexagrams(upper.mappedValue, lower.mappedValue, moving.mappedValue),
  };
}

export function castMeihua(options) {
  const context = validateOptions(options);
  const selectedTimeContext = context.timeBasis === "civil"
    ? context.civilTimeContext
    : context.trueSolarTimeContext;
  const methodOutput = context.method === "lunar-time-v2"
    ? castLunarTime(context, selectedTimeContext)
    : castNumbers(context);
  const wallClockShiftSeconds = context.timeBasis === "true_solar"
    ? wallClockEpochSeconds(context.trueSolarTimeContext.wall)
      - wallClockEpochSeconds(context.civilTimeContext.wall)
    : null;

  return {
    schema: SCHEMA,
    case: {
      question: context.question,
      observationHorizon: context.horizon,
      timingUnit: context.timingUnit,
      timingProfile: context.timingProfile,
      castTime: {
        timeBasis: context.timeBasis,
        location: context.timeBasis === "true_solar"
          ? {
              label: context.location,
              longitudeDegreesEast: context.longitude,
            }
          : null,
        civil: {
          source: context.civilTimeSource,
          requestedDateTime: context.civilDateTime,
          instant: context.civilInstant.toISOString(),
          timeZone: context.timeZone,
          localDateTime: context.civilTimeContext.localDateTime,
          timeZoneOffset: context.civilTimeContext.timeZoneOffset,
        },
        resolvedTrueSolar: context.timeBasis === "true_solar"
          ? {
              requestedLocalDateTime: context.trueSolarLocalDateTime,
              localDateTime: context.trueSolarTimeContext.localDateTime,
              referenceTimeZone: context.timeZone,
              clockModel: "continuous-true-solar-wall-clock",
            }
          : null,
        conversion: context.timeBasis === "true_solar"
          ? {
              source: context.conversionSource,
              wallClockShiftSeconds,
              performedByScript: false,
            }
          : null,
      },
    },
    protocol: methodOutput.protocol,
    calculation: methodOutput.calculation,
    runtime: {
      ...runtimeRecord(),
      civilTimeFormatter: context.civilTimeContext.formatter,
      trueSolarWallClockParser: context.timeBasis === "true_solar"
        ? "YYYY-MM-DDTHH:MM:SS-no-offset"
        : null,
    },
    result: methodOutput.result,
    boundary: {
      interpretation: "Traditional symbolic reflection; not factual evidence, empirical probability, or professional advice.",
      recast: "Do not recast the same substantive question within the same observation horizon merely to obtain a preferred result.",
    },
  };
}

function printHelp() {
  process.stdout.write(`Usage (civil):\n  node scripts/cast_meihua.mjs --method <lunar-time-v2|numbers-v2> \\\n    --question <text> --horizon <text> --timing-unit <unit> --timing-profile <profile> \\\n    --time-basis civil (--datetime <RFC3339> | --now) --timezone <IANA-zone> \\\n    [--numbers <a,b[,c]>] [--pretty]\n\nUsage (true solar):\n  node scripts/cast_meihua.mjs --method <lunar-time-v2|numbers-v2> \\\n    --question <text> --horizon <text> --timing-unit <unit> --timing-profile <profile> \\\n    --time-basis true_solar --civil-datetime <RFC3339> \\\n    --true-solar-local-datetime <YYYY-MM-DDTHH:MM:SS> --timezone <IANA-zone> \\\n    --location <text> --longitude <degrees-east> \\\n    --conversion-source <tool/service-and-version-or-result-reference> \\\n    [--numbers <a,b[,c]>] [--pretty]\n\nTiming units: ${[...TIMING_UNITS].join(", ")}\nTiming profiles: ${[...TIMING_PROFILES].join(", ")}\n`);
}

function main(argv) {
  try {
    const options = parseArgs(argv);
    if (options.help) {
      printHelp();
      return;
    }
    const output = castMeihua(options);
    process.stdout.write(`${JSON.stringify(output, null, options.pretty ? 2 : 0)}\n`);
  } catch (error) {
    process.stderr.write(`cast_meihua: ${error.message}\n`);
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) main(process.argv.slice(2));
