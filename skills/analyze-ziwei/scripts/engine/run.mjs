import { readFileSync } from 'node:fs';
import process from 'node:process';
import { canonicalStringify, sha256Canonical } from './canonical-json.mjs';
import { loadIsolatedIztro, vendorManifest } from './load-iztro.mjs';

const PROFILE_ID = 'ziwei-core-true-solar-v2';
const profile = JSON.parse(readFileSync(new URL('../profiles/ziwei-core-true-solar-v2.json', import.meta.url), 'utf8'));
if (profile.id !== PROFILE_ID || profile.engine_version !== vendorManifest.version) {
  throw new Error('Profile and vendored engine versions do not match');
}

const PALACE_IDS = new Map([
  ['命宫', 'soul'], ['父母', 'parents'], ['福德', 'spirit'], ['田宅', 'property'],
  ['官禄', 'career'], ['事业', 'career'], ['交友', 'friends'], ['仆役', 'friends'],
  ['迁移', 'surface'], ['疾厄', 'health'], ['财帛', 'wealth'], ['子女', 'children'],
  ['夫妻', 'spouse'], ['兄弟', 'siblings']
]);
const BRIGHTNESS_CODES = new Map([
  ['庙', 'miao'], ['旺', 'wang'], ['得', 'de'], ['利', 'li'], ['平', 'ping'],
  ['不', 'bu'], ['陷', 'xian']
]);
const MUTAGEN_CODES = new Map([['禄', 'lu'], ['权', 'quan'], ['科', 'ke'], ['忌', 'ji']]);
const MUTAGEN_ORDER = [
  { code: 'lu', label: '禄' }, { code: 'quan', label: '权' },
  { code: 'ke', label: '科' }, { code: 'ji', label: '忌' }
];

function record(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value;
}

function allowedKeys(value, allowed, name) {
  const extra = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extra.length) throw new Error(`${name} contains unsupported field(s): ${extra.sort().join(', ')}`);
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${name} must be a non-empty string`);
  return value.trim().normalize('NFC');
}

function dateParts(value, name) {
  const normalized = text(value, name);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) throw new Error(`${name} must use YYYY-MM-DD`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new Error(`${name} is not a valid Gregorian date`);
  }
  return normalized;
}

function gregorianDayNumber(value, name) {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (!match) throw new Error(`${name} is not a Gregorian date returned by the engine`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new Error(`${name} is not a valid Gregorian date returned by the engine`);
  }
  return Math.floor(check.getTime() / 86400000);
}

function validateTimezone(value, name) {
  const zone = text(value, name);
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone }).format(0);
  } catch {
    throw new Error(`${name} is not a recognized IANA time zone`);
  }
  return zone;
}

function optionalOffset(value, name) {
  if (value === undefined) return null;
  const offset = text(value, name);
  if (offset === 'Z') return '+00:00';
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
  if (!match || Number(match[2]) > 14 || Number(match[3]) > 59 || (Number(match[2]) === 14 && Number(match[3]) !== 0)) {
    throw new Error(`${name} must be Z or an offset from -14:00 to +14:00`);
  }
  return offset;
}

function clockSeconds(value, name, allow24 = false) {
  const normalized = text(value, name);
  if (allow24 && /^24:00(?::00)?$/.exec(normalized)) return { normalized: '24:00:00', seconds: 86400 };
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(normalized);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59 || Number(match[3] ?? 0) > 59) {
    throw new Error(`${name} must use HH:MM or HH:MM:SS`);
  }
  const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] ?? 0);
  return { normalized: `${match[1]}:${match[2]}:${String(match[3] ?? '00').padStart(2, '0')}`, seconds };
}

function timeIndexFromSeconds(seconds) {
  if (seconds < 3600) return 0;
  if (seconds >= 23 * 3600) return 12;
  return Math.floor((seconds - 3600) / 7200) + 1;
}

function timeIndex(value, name) {
  if (!Number.isInteger(value) || value < 0 || value > 12) throw new Error(`${name} must be an integer from 0 through 12`);
  return value;
}

function uniqueSorted(values, compare) {
  const unique = [...new Set(values)];
  unique.sort(compare);
  return unique;
}

function policyCandidates(single, multiple) {
  if (single !== undefined && multiple !== undefined) throw new Error('late_zi_policy and late_zi_policy_candidates are mutually exclusive');
  const values = multiple === undefined ? [single ?? profile.config.day_divide_default] : multiple;
  if (!Array.isArray(values) || values.length === 0) throw new Error('late_zi_policy_candidates must be a non-empty array');
  const normalized = values.map((value, index) => {
    const item = text(value, `late_zi_policy[${index}]`);
    if (!['current', 'forward'].includes(item)) throw new Error('late_zi_policy must be current or forward');
    return item;
  });
  return uniqueSorted(normalized, (a, b) => a.localeCompare(b, 'en'));
}

function decimal(value, name, minimum, maximum) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be a finite number from ${minimum} through ${maximum}`);
  }
  return value;
}

function normalizeLocation(value, name) {
  const location = record(value, name);
  allowedKeys(location, ['name', 'longitude_deg'], name);
  return {
    name: text(location.name, `${name}.name`),
    longitude_deg: decimal(location.longitude_deg, `${name}.longitude_deg`, -180, 180)
  };
}

function normalizeCivil(value, name, requireTime) {
  const civil = record(value, name);
  allowedKeys(civil, ['date', 'local_time', 'timezone', 'utc_offset', 'location'], name);
  if (requireTime && civil.local_time === undefined) throw new Error(`${name}.local_time is required`);
  if (!requireTime && civil.local_time !== undefined) throw new Error(`${name}.local_time is not accepted for a date-only target`);
  return {
    date: dateParts(civil.date, `${name}.date`),
    local_time: requireTime ? clockSeconds(civil.local_time, `${name}.local_time`).normalized : null,
    timezone: validateTimezone(civil.timezone, `${name}.timezone`),
    utc_offset: optionalOffset(civil.utc_offset, `${name}.utc_offset`),
    location: normalizeLocation(civil.location, `${name}.location`)
  };
}

function optionalText(value, name) {
  if (value === undefined || value === null) return null;
  return text(value, name);
}

function normalizeConversionSource(value, name, verificationStatus) {
  if (value === undefined && verificationStatus === 'user_declared') {
    return { provider: 'user', profile_id: null, version: null, access_date: null, reference: null };
  }
  const source = record(value, name);
  allowedKeys(source, ['provider', 'profile_id', 'version', 'access_date', 'reference'], name);
  const provider = text(source.provider, `${name}.provider`);
  const profileId = optionalText(source.profile_id, `${name}.profile_id`);
  const version = optionalText(source.version, `${name}.version`);
  if (verificationStatus === 'tool_verified' && (profileId === null || profileId === 'unspecified' || version === null || version === 'unspecified')) {
    throw new Error(`${name} requires non-empty profile_id and a specific version when verification_status is tool_verified`);
  }
  if (verificationStatus === 'user_declared' && provider !== 'user') {
    throw new Error(`${name}.provider must be user when verification_status is user_declared`);
  }
  return {
    provider,
    profile_id: profileId,
    version,
    access_date: optionalText(source.access_date, `${name}.access_date`),
    reference: optionalText(source.reference, `${name}.reference`)
  };
}

function normalizeResolvedSelector(value, name, requireTime) {
  const selector = record(value, name);
  allowedKeys(selector, ['selector_id', 'date', 'local_time', 'time_index'], name);
  const selectorId = text(selector.selector_id, `${name}.selector_id`);
  const selectorKeys = ['local_time', 'time_index'].filter((key) => selector[key] !== undefined);
  if (requireTime && selectorKeys.length !== 1) throw new Error(`${name} requires exactly one of local_time or time_index`);
  if (!requireTime && selectorKeys.length !== 0) throw new Error(`${name} must be date-only and must not include local_time or time_index`);
  if (!requireTime) {
    return {
      selector_id: selectorId,
      date: dateParts(selector.date, `${name}.date`),
      selector_type: 'date',
      local_time: null,
      time_index: profile.time_contract.target_cycle_time_index
    };
  }
  if (selector.local_time !== undefined) {
    const parsed = clockSeconds(selector.local_time, `${name}.local_time`);
    return {
      selector_id: selectorId,
      date: dateParts(selector.date, `${name}.date`),
      selector_type: 'local_time',
      local_time: parsed.normalized,
      time_index: timeIndexFromSeconds(parsed.seconds)
    };
  }
  return {
    selector_id: selectorId,
    date: dateParts(selector.date, `${name}.date`),
    selector_type: 'time_index',
    local_time: null,
    time_index: timeIndex(selector.time_index, `${name}.time_index`)
  };
}

function normalizeTrueSolar(value, name, requireTime) {
  if (value === undefined) {
    return { status: 'unresolved', verification_status: null, time_basis: 'true_solar', conversion_source: null, resolved_candidates: [] };
  }
  const resolution = record(value, name);
  allowedKeys(resolution, ['status', 'verification_status', 'conversion_source', 'resolved_candidates'], name);
  const status = text(resolution.status, `${name}.status`);
  if (!['resolved', 'candidate_set', 'unresolved'].includes(status)) {
    throw new Error(`${name}.status must be resolved, candidate_set, or unresolved`);
  }
  if (status === 'unresolved') {
    if (resolution.verification_status !== undefined || resolution.conversion_source !== undefined || resolution.resolved_candidates !== undefined) {
      throw new Error(`${name} must not include verification_status, conversion_source, or resolved_candidates when status is unresolved`);
    }
    return { status, verification_status: null, time_basis: 'true_solar', conversion_source: null, resolved_candidates: [] };
  }
  const verificationStatus = text(resolution.verification_status, `${name}.verification_status`);
  if (!['tool_verified', 'user_declared'].includes(verificationStatus)) {
    throw new Error(`${name}.verification_status must be tool_verified or user_declared`);
  }
  const conversionSource = normalizeConversionSource(resolution.conversion_source, `${name}.conversion_source`, verificationStatus);
  if (!Array.isArray(resolution.resolved_candidates) || resolution.resolved_candidates.length === 0) {
    throw new Error(`${name}.resolved_candidates must be a non-empty array`);
  }
  const candidates = resolution.resolved_candidates.map((candidate, index) => normalizeResolvedSelector(candidate, `${name}.resolved_candidates[${index}]`, requireTime));
  const ids = candidates.map((candidate) => candidate.selector_id);
  if (new Set(ids).size !== ids.length) throw new Error(`${name}.resolved_candidates selector_id values must be unique`);
  if (status === 'resolved' && candidates.length !== 1) throw new Error(`${name}.status resolved requires exactly one resolved candidate`);
  if (status === 'candidate_set' && candidates.length < 2) throw new Error(`${name}.status candidate_set requires at least two resolved candidates`);
  candidates.sort((a, b) => a.selector_id.localeCompare(b.selector_id, 'en'));
  return { status, verification_status: verificationStatus, time_basis: 'true_solar', conversion_source: conversionSource, resolved_candidates: candidates };
}

function normalizeInput(input) {
  const root = record(input, 'input');
  allowedKeys(root, ['schema_version', 'profile_id', 'birth', 'target'], 'input');
  if (root.schema_version !== 'ziwei.input.v2') throw new Error('schema_version must be ziwei.input.v2');
  if (root.profile_id !== PROFILE_ID) throw new Error(`profile_id must be ${PROFILE_ID}`);
  const birth = record(root.birth, 'birth');
  const target = record(root.target, 'target');
  allowedKeys(birth, ['gender', 'algorithm_gender', 'civil', 'true_solar', 'late_zi_policy', 'late_zi_policy_candidates', 'source_grade'], 'birth');
  allowedKeys(target, ['civil', 'true_solar'], 'target');
  if (birth.gender !== undefined && birth.algorithm_gender !== undefined) throw new Error('birth.gender and birth.algorithm_gender are mutually exclusive');
  const genderInput = text(birth.gender ?? birth.algorithm_gender, 'birth.gender');
  const genderLookup = new Map([['男', 'male'], ['male', 'male'], ['女', 'female'], ['female', 'female']]);
  const gender = genderLookup.get(genderInput.toLowerCase()) ?? genderLookup.get(genderInput);
  if (!gender) throw new Error('birth.gender must be male/female or 男/女');
  const sourceGrade = birth.source_grade === undefined ? 'B1' : text(birth.source_grade, 'birth.source_grade');
  if (!['B1', 'B2'].includes(sourceGrade)) throw new Error('birth.source_grade must be B1 or B2');
  const birthTrueSolar = normalizeTrueSolar(birth.true_solar, 'birth.true_solar', true);
  const targetTrueSolar = normalizeTrueSolar(target.true_solar, 'target.true_solar', false);
  return {
    profile_id: PROFILE_ID,
    birth: {
      calendar: 'solar',
      gender,
      civil: normalizeCivil(birth.civil, 'birth.civil', true),
      true_solar: birthTrueSolar,
      late_zi_policy_candidates: policyCandidates(birth.late_zi_policy, birth.late_zi_policy_candidates),
      source_grade: sourceGrade
    },
    target: {
      civil: normalizeCivil(target.civil, 'target.civil', false),
      true_solar: targetTrueSolar
    },
    interpretation_contract: {
      time_basis: 'true_solar',
      selector_role: 'only externally resolved true-solar selectors are passed to the chart engine',
      civil_role: 'provenance only; civil date and clock are never used as chart selectors',
      conversion_role: 'the bundled engine does not calculate or approximate true solar time',
      target_role: 'the resolved true-solar target date is used only to locate decadal and yearly layers; the profile-fixed engine time index has no daily or hourly meaning',
      civil_fallback: false
    }
  };
}

function dimensions(normalized) {
  const items = [];
  for (const birthSelector of normalized.birth.true_solar.resolved_candidates) {
    for (const targetSelector of normalized.target.true_solar.resolved_candidates) {
      for (const lateZi of normalized.birth.late_zi_policy_candidates) {
        items.push({
          birth_true_solar_selector_id: birthSelector.selector_id,
          birth_true_solar_date: birthSelector.date,
          birth_time_index: birthSelector.time_index,
          target_true_solar_selector_id: targetSelector.selector_id,
          target_true_solar_date: targetSelector.date,
          late_zi_policy: lateZi
        });
      }
    }
  }
  if (items.length > 64) throw new Error(`Candidate cross-product is ${items.length}; maximum is 64`);
  return items;
}

function palaceId(name) {
  return PALACE_IDS.get(name) ?? `iztro.zh-CN:${name}`;
}

function starRef(name) {
  return { id: `iztro.zh-CN:${name}`, name };
}

function projectStar(star) {
  const brightnessLabel = star.brightness || null;
  const mutagenLabel = star.mutagen || null;
  return {
    ...starRef(star.name),
    type: star.type,
    scope: star.scope,
    brightness: brightnessLabel ? { code: BRIGHTNESS_CODES.get(brightnessLabel) ?? `iztro:${brightnessLabel}`, label: brightnessLabel } : null,
    transformation: mutagenLabel ? { code: MUTAGEN_CODES.get(mutagenLabel) ?? `iztro:${mutagenLabel}`, label: mutagenLabel } : null
  };
}

function palaceRef(palace, scopeNames = null) {
  const scopeName = scopeNames?.[palace.index] ?? null;
  return {
    index: palace.index,
    origin: { id: palaceId(palace.name), name: palace.name },
    scope: scopeName === null ? null : { id: palaceId(scopeName), name: scopeName }
  };
}

function projectRelation(surrounded, scopeNames = null) {
  return {
    target: palaceRef(surrounded.target, scopeNames),
    opposite: palaceRef(surrounded.opposite, scopeNames),
    wealth: palaceRef(surrounded.wealth, scopeNames),
    career: palaceRef(surrounded.career, scopeNames)
  };
}

function projectPalace(palace) {
  return {
    index: palace.index,
    id: palaceId(palace.name),
    name: palace.name,
    is_body_palace: palace.isBodyPalace,
    is_original_palace: palace.isOriginalPalace,
    heavenly_stem: palace.heavenlyStem,
    earthly_branch: palace.earthlyBranch,
    stars: {
      major: palace.majorStars.map(projectStar),
      minor: palace.minorStars.map(projectStar),
      adjective: palace.adjectiveStars.map(projectStar)
    },
    cycles: {
      changsheng12: palace.changsheng12,
      boshi12: palace.boshi12,
      jiangqian12: palace.jiangqian12,
      suiqian12: palace.suiqian12
    },
    decadal: {
      age_range: [...palace.decadal.range],
      heavenly_stem: palace.decadal.heavenlyStem,
      earthly_branch: palace.decadal.earthlyBranch
    }
  };
}

function transformations(mutagen) {
  return MUTAGEN_ORDER.map((type, index) => ({ type, star: starRef(mutagen[index]) }));
}

function projectHoroscopeItem(item, horoscope, scope) {
  const scopeNames = [...item.palaceNames];
  const stars = item.stars ?? Array.from({ length: 12 }, () => []);
  const targetYear = Number(horoscope.solarDate.slice(0, 4));
  const activePalace = horoscope.astrolabe.palaces[item.index];
  const applicability = scope === 'decadal'
    ? {
        age_range: activePalace?.decadal?.range ? [...activePalace.decadal.range] : null,
        age_basis: 'nominal_age',
        target_nominal_age: horoscope.age.nominalAge,
        range_source: 'iztro.palace.decadal.range'
      }
    : {
        target_solar_date: horoscope.solarDate,
        target_solar_year: targetYear,
        effective_year_ganzhi: `${item.heavenlyStem}${item.earthlyBranch}`,
        target_nominal_age: horoscope.age.nominalAge,
        age_basis: 'nominal_age',
        year_boundary: profile.config.horoscope_divide === 'normal' ? 'lunar_new_year' : 'start_of_spring',
        applicable_cycle: 'target_date_lunar_year_cycle',
        full_gregorian_year: false
      };
  return {
    index: item.index,
    name: item.name,
    heavenly_stem: item.heavenlyStem,
    earthly_branch: item.earthlyBranch,
    palace_names: scopeNames.map((name, index) => ({ index, id: palaceId(name), name })),
    transformations: transformations(item.mutagen),
    applicability,
    stars_by_palace: Array.from({ length: 12 }, (_, index) => ({ index, stars: (stars[index] ?? []).map(projectStar) })),
    relations: scopeNames.map((name) => projectRelation(horoscope.surroundPalaces(name, scope), scopeNames))
  };
}

function extractFacts(astrolabe, horoscope, candidate) {
  const raw = astrolabe.rawDates;
  return {
    target: {
      time_basis: 'true_solar',
      requested_true_solar_date: candidate.target_true_solar_date,
      target_granularity: profile.time_contract.target_granularity,
      engine_cycle_time_index: profile.time_contract.target_cycle_time_index,
      engine_cycle_time_semantics: profile.time_contract.target_cycle_time_semantics,
      returned_solar_date: horoscope.solarDate,
      returned_lunar_date: horoscope.lunarDate
    },
    origin: {
      natal: {
        gender: astrolabe.gender,
        solar_date: astrolabe.solarDate,
        lunar_date: astrolabe.lunarDate,
        chinese_date: astrolabe.chineseDate,
        raw_lunar_date: {
          year: raw.lunarDate.lunarYear,
          month: raw.lunarDate.lunarMonth,
          day: raw.lunarDate.lunarDay,
          is_leap: raw.lunarDate.isLeap
        },
        raw_chinese_date: {
          yearly: { heavenly_stem: raw.chineseDate.yearly[0], earthly_branch: raw.chineseDate.yearly[1] },
          monthly: { heavenly_stem: raw.chineseDate.monthly[0], earthly_branch: raw.chineseDate.monthly[1] },
          daily: { heavenly_stem: raw.chineseDate.daily[0], earthly_branch: raw.chineseDate.daily[1] },
          hourly: { heavenly_stem: raw.chineseDate.hourly[0], earthly_branch: raw.chineseDate.hourly[1] }
        },
        time_basis: 'true_solar',
        requested_true_solar_date: candidate.birth_true_solar_date,
        time_index: candidate.birth_time_index,
        chinese_time: astrolabe.time,
        time_range: astrolabe.timeRange,
        sign: astrolabe.sign,
        zodiac: astrolabe.zodiac,
        soul_palace_earthly_branch: astrolabe.earthlyBranchOfSoulPalace,
        body_palace_earthly_branch: astrolabe.earthlyBranchOfBodyPalace,
        soul_star: starRef(astrolabe.soul),
        body_star: starRef(astrolabe.body),
        five_elements_class: astrolabe.fiveElementsClass
      },
      palaces: astrolabe.palaces.map(projectPalace),
      relations: astrolabe.palaces.map((palace) => projectRelation(astrolabe.surroundedPalaces(palace.index)))
    },
    decadal: projectHoroscopeItem(horoscope.decadal, horoscope, 'decadal'),
    yearly: {
      ...projectHoroscopeItem(horoscope.yearly, horoscope, 'yearly'),
      yearly_decoration_stars: {
        jiangqian12: horoscope.yearly.yearlyDecStar.jiangqian12.map(starRef),
        suiqian12: horoscope.yearly.yearlyDecStar.suiqian12.map(starRef)
      }
    }
  };
}

function calculate(normalized, candidate) {
  const iztro = loadIsolatedIztro();
  const option = {
    type: 'solar',
    dateStr: candidate.birth_true_solar_date,
    timeIndex: candidate.birth_time_index,
    gender: normalized.birth.gender === 'male' ? '男' : '女',
    language: profile.language,
    astroType: profile.astro_type,
    config: {
      algorithm: profile.config.algorithm,
      yearDivide: profile.config.year_divide,
      horoscopeDivide: profile.config.horoscope_divide,
      ageDivide: profile.config.age_divide,
      dayDivide: candidate.late_zi_policy
    }
  };
  const astrolabe = iztro.astro.withOptions(option);
  if (gregorianDayNumber(candidate.target_true_solar_date, 'target true-solar date') < gregorianDayNumber(astrolabe.solarDate, 'engine birth date')) {
    throw new Error('target true-solar date must not be earlier than the candidate birth date');
  }
  const horoscope = astrolabe.horoscope(candidate.target_true_solar_date, profile.time_contract.target_cycle_time_index);
  if (!Number.isInteger(horoscope.decadal?.index) || horoscope.decadal.index < 0) {
    throw new Error(`target true-solar date does not fall in an active decadal range under ${PROFILE_ID}`);
  }
  const activeRange = astrolabe.palaces[horoscope.decadal.index]?.decadal?.range;
  const nominalAge = horoscope.age?.nominalAge;
  if (!Array.isArray(activeRange) || activeRange.length !== 2 || !Number.isFinite(nominalAge) || nominalAge < activeRange[0] || nominalAge > activeRange[1]) {
    throw new Error(`target true-solar date does not fall in an active decadal age range under ${PROFILE_ID}`);
  }
  return extractFacts(astrolabe, horoscope, candidate);
}

function scopeStability(groups, scope) {
  const byHash = new Map();
  for (const group of groups) {
    const hash = sha256Canonical(group.facts[scope]);
    const entry = byHash.get(hash) ?? { hash: `sha256:${hash}`, group_ids: [] };
    entry.group_ids.push(group.group_id);
    byHash.set(hash, entry);
  }
  const values = [...byHash.values()].sort((a, b) => a.hash.localeCompare(b.hash, 'en'));
  return { stable: values.length === 1, values };
}

function timeProvenance(normalized) {
  return {
    birth: {
      resolution_status: normalized.birth.true_solar.status,
      verification_status: normalized.birth.true_solar.verification_status,
      civil_record: normalized.birth.civil,
      conversion_source: normalized.birth.true_solar.conversion_source,
      resolved_selector_count: normalized.birth.true_solar.resolved_candidates.length
    },
    target: {
      resolution_status: normalized.target.true_solar.status,
      verification_status: normalized.target.true_solar.verification_status,
      civil_record: normalized.target.civil,
      conversion_source: normalized.target.true_solar.conversion_source,
      resolved_selector_count: normalized.target.true_solar.resolved_candidates.length,
      granularity: profile.time_contract.target_granularity
    }
  };
}

function insufficientInputResult(normalized) {
  const missingFields = [];
  const followUpNeeded = [];
  if (normalized.birth.true_solar.status === 'unresolved') {
    missingFields.push('birth.true_solar.verification_status', 'birth.true_solar.resolved_candidates');
    followUpNeeded.push('请依据已记录的出生地与经度，用可靠来源解析出生真太阳日期时间／时辰；或直接提供已换算结果并标注 verification_status=user_declared。');
  }
  if (normalized.target.true_solar.status === 'unresolved') {
    missingFields.push('target.true_solar.verification_status', 'target.true_solar.resolved_candidates');
    followUpNeeded.push('请提供 date-only 的目标真太阳日期及 verification_status；用户直接给定时可用 user_declared，该日期只用于大限和流年定位。');
  }
  const result = {
    schema_version: 'ziwei.facts.v2',
    status: 'insufficient_input',
    facts_available: false,
    source: {
      birth_grade: normalized.birth.source_grade,
      chart_grade: null,
      chart_source: null,
      tool_or_source_version: null,
      school: profile.config.algorithm,
      time_basis: 'true_solar',
      time_provenance: timeProvenance(normalized),
      calendar_assumptions: {
        time_basis: 'true_solar',
        civil_fields_role: normalized.interpretation_contract.civil_role,
        selector_role: normalized.interpretation_contract.selector_role,
        civil_fallback: false,
        year_divide: profile.config.year_divide,
        horoscope_divide: profile.config.horoscope_divide,
        candidate_dimensions: []
      },
      unresolved_fields: [...missingFields]
    },
    engine: null,
    profile,
    input: normalized,
    candidates: {
      requested_count: 0,
      accepted_count: 0,
      unique_chart_count: 0,
      items: [],
      groups: [],
      comparison: null
    },
    missing_fields: missingFields,
    follow_up_needed: followUpNeeded,
    hash: { algorithm: 'sha256', canonicalization: 'recursive-key-sort+nfc+json' }
  };
  return { ...result, result_hash: `sha256:${sha256Canonical(result)}` };
}

export function runZiwei(input) {
  const normalized = normalizeInput(input);
  if (normalized.birth.true_solar.status === 'unresolved' || normalized.target.true_solar.status === 'unresolved') {
    return insufficientInputResult(normalized);
  }
  const requested = dimensions(normalized);
  const candidateItems = [];
  const groupsByHash = new Map();
  for (const candidate of requested) {
    const candidateHash = sha256Canonical(candidate);
    const candidateId = `sha256:${candidateHash}`;
    const facts = calculate(normalized, candidate);
    const chartHash = sha256Canonical(facts);
    candidateItems.push({
      candidate_id: candidateId,
      dimensions: candidate,
      effective_profile: {
        id: PROFILE_ID,
        time_basis: 'true_solar',
        day_divide: candidate.late_zi_policy,
        target_cycle_time_index: profile.time_contract.target_cycle_time_index
      },
      chart_hash: `sha256:${chartHash}`
    });
    const group = groupsByHash.get(chartHash) ?? {
      group_id: `sha256:${chartHash}`,
      chart_hash: `sha256:${chartHash}`,
      candidate_ids: [],
      facts
    };
    group.candidate_ids.push(candidateId);
    groupsByHash.set(chartHash, group);
  }
  if (candidateItems.length === 0) throw new Error('No resolved true-solar candidate remained for calculation');
  candidateItems.sort((a, b) => a.candidate_id.localeCompare(b.candidate_id, 'en'));
  const groups = [...groupsByHash.values()].sort((a, b) => a.group_id.localeCompare(b.group_id, 'en'));
  for (const group of groups) group.candidate_ids.sort((a, b) => a.localeCompare(b, 'en'));
  const dimensionNames = [
    'birth_true_solar_date',
    'birth_time_index',
    'target_true_solar_date',
    'late_zi_policy'
  ];
  const acceptedDimensions = candidateItems.map((item) => item.dimensions);
  const variantDimensions = dimensionNames.filter((name) => new Set(acceptedDimensions.map((item) => canonicalStringify(item[name]))).size > 1);
  const result = {
    schema_version: 'ziwei.facts.v2',
    status: 'ok',
    facts_available: true,
    source: {
      birth_grade: normalized.birth.source_grade,
      chart_grade: 'P1',
      chart_source: 'bundled_calculation_engine',
      tool_or_source_version: `${vendorManifest.package} ${vendorManifest.version}`,
      school: profile.config.algorithm,
      time_basis: 'true_solar',
      time_provenance: timeProvenance(normalized),
      calendar_assumptions: {
        time_basis: 'true_solar',
        civil_fields_role: normalized.interpretation_contract.civil_role,
        selector_role: normalized.interpretation_contract.selector_role,
        civil_fallback: false,
        year_divide: profile.config.year_divide,
        horoscope_divide: profile.config.horoscope_divide,
        candidate_dimensions: variantDimensions
      },
      unresolved_fields: uniqueSorted([
        ...(normalized.birth.source_grade === 'B1' ? ['birth_data_contains_declared_or_unresolved_uncertainty'] : []),
        ...(normalized.birth.true_solar.verification_status === 'user_declared' ? ['birth.true_solar.verification_status'] : []),
        ...(normalized.target.true_solar.verification_status === 'user_declared' ? ['target.true_solar.verification_status'] : []),
        ...(normalized.birth.true_solar.status === 'candidate_set' ? ['birth.true_solar.resolved_candidates'] : []),
        ...(normalized.target.true_solar.status === 'candidate_set' ? ['target.true_solar.resolved_candidates'] : []),
        ...variantDimensions
      ], (a, b) => a.localeCompare(b, 'en'))
    },
    engine: {
      name: vendorManifest.package,
      version: vendorManifest.version,
      artifact_sha256: vendorManifest.artifact.sha256,
      npm_integrity: vendorManifest.source.npm_integrity,
      runtime: { node: process.versions.node, icu: process.versions.icu, tz: process.versions.tz ?? null }
    },
    profile,
    input: normalized,
    candidates: {
      requested_count: requested.length,
      accepted_count: candidateItems.length,
      unique_chart_count: groups.length,
      items: candidateItems,
      groups,
      comparison: {
        all_facts_stable: groups.length === 1,
        variant_dimensions: variantDimensions,
        scope_stability: {
          origin: scopeStability(groups, 'origin'),
          decadal: scopeStability(groups, 'decadal'),
          yearly: scopeStability(groups, 'yearly')
        }
      }
    },
    missing_fields: [],
    follow_up_needed: [],
    hash: { algorithm: 'sha256', canonicalization: 'recursive-key-sort+nfc+json' }
  };
  return { ...result, result_hash: `sha256:${sha256Canonical(result)}` };
}
