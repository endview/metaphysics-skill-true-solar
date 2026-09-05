#!/usr/bin/env node

import { pathToFileURL } from "node:url";

const STEM_ORDER = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCH_ORDER = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

const STEM_META = {
  甲: { element: "木", polarity: "阳" },
  乙: { element: "木", polarity: "阴" },
  丙: { element: "火", polarity: "阳" },
  丁: { element: "火", polarity: "阴" },
  戊: { element: "土", polarity: "阳" },
  己: { element: "土", polarity: "阴" },
  庚: { element: "金", polarity: "阳" },
  辛: { element: "金", polarity: "阴" },
  壬: { element: "水", polarity: "阳" },
  癸: { element: "水", polarity: "阴" },
};

const HIDDEN_STEMS = {
  子: ["癸"],
  丑: ["己", "癸", "辛"],
  寅: ["甲", "丙", "戊"],
  卯: ["乙"],
  辰: ["戊", "乙", "癸"],
  巳: ["丙", "戊", "庚"],
  午: ["丁", "己"],
  未: ["己", "丁", "乙"],
  申: ["庚", "壬", "戊"],
  酉: ["辛"],
  戌: ["戊", "辛", "丁"],
  亥: ["壬", "甲"],
};

const GENERATES = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };
const CONTROLS = { 木: "土", 土: "水", 水: "火", 火: "金", 金: "木" };

const STEM_FIVE_COMBINATIONS = [
  ["甲", "己"],
  ["乙", "庚"],
  ["丙", "辛"],
  ["丁", "壬"],
  ["戊", "癸"],
];

const BRANCH_SIX_COMBINATIONS = [
  ["子", "丑"],
  ["寅", "亥"],
  ["卯", "戌"],
  ["辰", "酉"],
  ["巳", "申"],
  ["午", "未"],
];

const BRANCH_CLASHES = [
  ["子", "午"],
  ["丑", "未"],
  ["寅", "申"],
  ["卯", "酉"],
  ["辰", "戌"],
  ["巳", "亥"],
];

const BRANCH_HARMS = [
  ["子", "未"],
  ["丑", "午"],
  ["寅", "巳"],
  ["卯", "辰"],
  ["申", "亥"],
  ["酉", "戌"],
];

const THREE_HARMONIES = [
  ["申", "子", "辰"],
  ["亥", "卯", "未"],
  ["寅", "午", "戌"],
  ["巳", "酉", "丑"],
];

const THREE_MEETINGS = [
  ["亥", "子", "丑"],
  ["寅", "卯", "辰"],
  ["巳", "午", "未"],
  ["申", "酉", "戌"],
];

const USAGE = `用法:
  node scripts/inspect_bazi.mjs --pillars <年柱> <月柱> <日柱> <时柱> [--dayun <大运>] [--liunian <流年>]

说明:
  只检查所给干支的结构与固定关系；不从出生资料排盘，不判断合化、成局或吉凶。`;

function requireStem(stem, label) {
  if (!Object.hasOwn(STEM_META, stem)) {
    throw new Error(`${label}“${stem}”不是十天干之一`);
  }
  return STEM_META[stem];
}

export function tenGodFor(dayMasterStem, targetStem) {
  const dayMaster = requireStem(dayMasterStem, "日主");
  const target = requireStem(targetStem, "目标天干");
  const samePolarity = dayMaster.polarity === target.polarity;

  if (dayMaster.element === target.element) {
    return samePolarity ? "比肩" : "劫财";
  }
  if (GENERATES[target.element] === dayMaster.element) {
    return samePolarity ? "偏印" : "正印";
  }
  if (GENERATES[dayMaster.element] === target.element) {
    return samePolarity ? "食神" : "伤官";
  }
  if (CONTROLS[dayMaster.element] === target.element) {
    return samePolarity ? "偏财" : "正财";
  }
  if (CONTROLS[target.element] === dayMaster.element) {
    return samePolarity ? "七杀" : "正官";
  }
  throw new Error(`无法判定日主“${dayMasterStem}”与目标天干“${targetStem}”的十神关系`);
}

export function parsePillar(rawValue, label = "柱") {
  const value = String(rawValue ?? "").trim();
  const characters = Array.from(value);
  if (characters.length !== 2) {
    throw new Error(`${label}必须是一个天干加一个地支，例如“甲子”；收到“${value}”`);
  }

  const [stem, branch] = characters;
  requireStem(stem, `${label}天干`);
  if (!BRANCH_ORDER.includes(branch)) {
    throw new Error(`${label}地支“${branch}”不是十二地支之一`);
  }

  const stemParity = STEM_ORDER.indexOf(stem) % 2;
  const branchParity = BRANCH_ORDER.indexOf(branch) % 2;
  if (stemParity !== branchParity) {
    throw new Error(`${label}“${value}”的干支阴阳序位不匹配，不是六十甲子中的合法配对`);
  }

  return { value, stem, branch };
}

function stemDescription(stem, dayMasterStem) {
  const meta = requireStem(stem, "天干");
  return {
    symbol: stem,
    element: meta.element,
    polarity: meta.polarity,
    tenGod: tenGodFor(dayMasterStem, stem),
  };
}

function pillarDescription(config, parsedPillar, dayMasterStem) {
  return {
    scope: config.scope,
    position: config.position,
    location: config.location,
    pillar: parsedPillar.value,
    heavenlyStem: stemDescription(parsedPillar.stem, dayMasterStem),
    earthlyBranch: {
      symbol: parsedPillar.branch,
      hiddenStems: HIDDEN_STEMS[parsedPillar.branch].map((stem, index) => ({
        order: index + 1,
        ...stemDescription(stem, dayMasterStem),
      })),
    },
  };
}

function findPairRelations(table, occurrences) {
  return table.flatMap(([leftSymbol, rightSymbol]) => {
    const leftOccurrences = occurrences.filter(({ symbol }) => symbol === leftSymbol);
    const rightOccurrences = occurrences.filter(({ symbol }) => symbol === rightSymbol);
    const locationPairs = [];

    for (const left of leftOccurrences) {
      for (const right of rightOccurrences) {
        locationPairs.push([left.location, right.location]);
      }
    }

    if (locationPairs.length === 0) {
      return [];
    }
    return [{ members: [leftSymbol, rightSymbol], locationPairs }];
  });
}

function findCompleteTriples(table, occurrences) {
  return table.flatMap((members) => {
    const locationsByMember = members.map((member) => ({
      member,
      locations: occurrences
        .filter(({ symbol }) => symbol === member)
        .map(({ location }) => location),
    }));

    if (locationsByMember.some(({ locations }) => locations.length === 0)) {
      return [];
    }
    return [{ members: [...members], locationsByMember }];
  });
}

function findRepeatedBranches(occurrences) {
  return BRANCH_ORDER.flatMap((branch) => {
    const locations = occurrences
      .filter(({ symbol }) => symbol === branch)
      .map(({ location }) => location);
    return locations.length > 1 ? [{ branch, count: locations.length, locations }] : [];
  });
}

export function inspectBazi({ pillars, dayun = null, liunian = null }) {
  if (!Array.isArray(pillars) || pillars.length !== 4) {
    throw new Error("pillars 必须依次包含年柱、月柱、日柱、时柱四项");
  }

  const natalConfigs = [
    { scope: "原局", position: "年柱", location: "原局年柱" },
    { scope: "原局", position: "月柱", location: "原局月柱" },
    { scope: "原局", position: "日柱", location: "原局日柱" },
    { scope: "原局", position: "时柱", location: "原局时柱" },
  ];
  const parsedNatal = pillars.map((pillar, index) => parsePillar(pillar, natalConfigs[index].location));
  const parsedDayun = dayun === null || dayun === undefined
    ? null
    : parsePillar(dayun, "大运");
  const parsedLiunian = liunian === null || liunian === undefined
    ? null
    : parsePillar(liunian, "流年");
  const dayMasterStem = parsedNatal[2].stem;

  const records = parsedNatal.map((pillar, index) =>
    pillarDescription(natalConfigs[index], pillar, dayMasterStem));
  if (parsedDayun) {
    records.push(pillarDescription(
      { scope: "大运", position: "大运", location: "大运" },
      parsedDayun,
      dayMasterStem,
    ));
  }
  if (parsedLiunian) {
    records.push(pillarDescription(
      { scope: "流年", position: "流年", location: "流年" },
      parsedLiunian,
      dayMasterStem,
    ));
  }

  const stemOccurrences = records.map((record) => ({
    symbol: record.heavenlyStem.symbol,
    location: record.location,
  }));
  const branchOccurrences = records.map((record) => ({
    symbol: record.earthlyBranch.symbol,
    location: record.location,
  }));
  const dayMasterMeta = requireStem(dayMasterStem, "日主");

  return {
    schemaVersion: "1.0.0",
    input: {
      natal: {
        year: parsedNatal[0].value,
        month: parsedNatal[1].value,
        day: parsedNatal[2].value,
        hour: parsedNatal[3].value,
      },
      dayun: parsedDayun?.value ?? null,
      liunian: parsedLiunian?.value ?? null,
    },
    dayMaster: {
      stem: dayMasterStem,
      element: dayMasterMeta.element,
      polarity: dayMasterMeta.polarity,
    },
    pillars: records,
    relationships: {
      heavenlyStemFiveCombinations: findPairRelations(STEM_FIVE_COMBINATIONS, stemOccurrences),
      earthlyBranchSixCombinations: findPairRelations(BRANCH_SIX_COMBINATIONS, branchOccurrences),
      earthlyBranchClashes: findPairRelations(BRANCH_CLASHES, branchOccurrences),
      earthlyBranchHarms: findPairRelations(BRANCH_HARMS, branchOccurrences),
      completeThreeHarmonies: findCompleteTriples(THREE_HARMONIES, branchOccurrences),
      completeThreeMeetings: findCompleteTriples(THREE_MEETINGS, branchOccurrences),
      repeatedBranches: findRepeatedBranches(branchOccurrences),
    },
    limitations: [
      "只检查所给干支的字符、阴阳配对、十神映射与固定关系，不从出生资料计算或核定四柱。",
      "关系结果只表示存在，不判断合化、成局、旺衰、用神、吉凶或具体事件。",
      "藏干采用本 Skill 参考表中的固定常见序列，不提供流派化权重。",
    ],
  };
}

function takeSingleValue(argv, index, option) {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${option} 后必须提供一个干支`);
  }
  return value;
}

function parseCli(argv) {
  const result = { pillars: null, dayun: null, liunian: null, help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === "--help" || option === "-h") {
      result.help = true;
      continue;
    }
    if (option === "--pillars") {
      if (result.pillars !== null) {
        throw new Error("--pillars 只能提供一次");
      }
      const first = takeSingleValue(argv, index, option);
      const delimited = first.split(/[，,、/\s]+/u).filter(Boolean);
      if (delimited.length === 4) {
        result.pillars = delimited;
        index += 1;
        continue;
      }
      const values = argv.slice(index + 1, index + 5);
      if (values.length !== 4 || values.some((value) => value.startsWith("--"))) {
        throw new Error("--pillars 后必须依次提供年、月、日、时四柱");
      }
      result.pillars = values;
      index += 4;
      continue;
    }
    if (option === "--dayun") {
      if (result.dayun !== null) {
        throw new Error("--dayun 只能提供一次");
      }
      result.dayun = takeSingleValue(argv, index, option);
      index += 1;
      continue;
    }
    if (option === "--liunian") {
      if (result.liunian !== null) {
        throw new Error("--liunian 只能提供一次");
      }
      result.liunian = takeSingleValue(argv, index, option);
      index += 1;
      continue;
    }
    throw new Error(`未知参数“${option}”`);
  }

  if (!result.help && result.pillars === null) {
    throw new Error("缺少 --pillars");
  }
  return result;
}

function main() {
  try {
    const options = parseCli(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(`${USAGE}\n`);
      return;
    }
    const output = inspectBazi(options);
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`错误: ${error.message}\n\n${USAGE}\n`);
    process.exitCode = 2;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (invokedPath === import.meta.url) {
  main();
}
