# 事实层结构

## 目录

- [目的](#目的)
- [顶层封装](#顶层封装)
- [候选与归并](#候选与归并)
- [哈希语义](#哈希语义)
- [用户给定命盘](#用户给定命盘)

## 目的

事实层只保存输入、协议、真太阳时来源、候选参数和按已声明协议计算出的盘面结构，不写性格、吉凶、事件或行动结论。CLI 的输入版本为 `ziwei.input.v2`，输出版本为 `ziwei.facts.v2`。

同一输入、同一 `ziwei-core-true-solar-v2` profile 与相同运行环境应产生相同规范化输出。跨运行环境比较盘面时使用候选组的 `chart_hash`，不要把包含运行时元数据的 `result_hash` 当作现实效度或预测准确率。

## 顶层封装

```text
schema_version
status
facts_available
source
engine
profile
input
candidates
missing_fields
follow_up_needed
hash
result_hash
```

### `source`

- `birth_grade`：`B1` 或 `B2`；CLI 缺省保守记为 `B1`；
- `chart_grade`：CLI 单一可追溯引擎生成时固定为 `P1`，不得自行升为 `P2`；
- `chart_source`：记录为内置计算引擎；
- `tool_or_source_version`：固定记录 iztro 版本；
- `school`：记录 profile 声明的算法配置；
- `time_basis`：固定为 `true_solar`；
- `time_provenance`：分别记录出生和目标的原始民用记录、`verification_status=tool_verified|user_declared`、换算来源、解析状态与选择器数量；
- `calendar_assumptions`：记录民用字段仅作来源、禁止回退、年界、运限边界及候选维度；
- `unresolved_fields`：记录出生资料不确定性、真太阳时候选集及仍在变化的候选参数。

已解析但 `verification_status=user_declared` 时仍可生成事实盘，同时把相应 verification 路径放入 `unresolved_fields`，表示该真太阳时结果尚未由工具独立核验；这不等同于 `status=unresolved`。

`status=ok` 时 `facts_available=true`、`engine` 有值且候选组包含事实盘。`status=insufficient_input` 时 `facts_available=false`、`engine=null`、候选为空；`source.time_provenance` 保留 civil 输入与 `resolution_status=unresolved`，`missing_fields` 和 `follow_up_needed` 指出怎样取得可靠真太阳时。该状态不是技术错误，也不会调用排盘引擎。

`P1` 只表示计算来源与参数可追溯，不表示现实预测已经得到验证。只有按 `input-contract.md` 的独立来源条件完成核对，解释层才可另行记录 `P2`。

### `engine` 与 `profile`

`engine` 保存引擎名称、版本、vendor 完整性摘要及 Node/ICU/时区数据版本。`profile` 原样保存 `ziwei-core-true-solar-v2` 的冻结配置。具体值见 `profiles.md` 与 `scripts/profiles/ziwei-core-true-solar-v2.json`。

### `input`

`input` 是规范化后的计算输入，包括：

- `birth.civil`：原始公历日期、民用钟点、IANA 时区、可选 UTC offset、地点和经度，仅作来源；
- `birth.true_solar`：`time_basis=true_solar`、换算来源及已解析出生选择器；
- `target.civil`：原始目标日期、IANA 时区、可选 UTC offset、地点和经度，仅作来源；
- `target.true_solar`：换算来源及 date-only 真太阳目标选择器；
- `interpretation_contract`：明确引擎只消费已解析真太阳时，civil 字段不得作为排盘选择器，CLI 不计算近似太阳时且 `civil_fallback=false`。

不得从规范化结果反推用户未提供的地点、历史夏令时或真实出生时刻。

## 候选与归并

`candidates` 包含：

- `requested_count`：参数组合数量；
- `accepted_count`：成功生成事实盘的候选数量；`status=ok` 时与 `requested_count` 相等；
- `unique_chart_count`：去重后的事实盘数量；
- `items`：每个参数候选的维度、候选标识和对应盘面哈希；
- `groups`：按完整事实盘归并后的候选组；
- `comparison`：候选维度，以及原局、大限、流年三个范围是否稳定。

候选参数只来自同一排盘 profile 内的出生真太阳时选择器、目标真太阳日期选择器与 `late_zi_policy`。维度明确记录出生／目标选择器标识、真太阳日期、出生时辰以及晚子时规则。不同排盘 profile 或流派不得放入同一候选集合。

同一个 `birth.true_solar.resolved_candidates` 数组共享其出生换算来源／profile；同一个 `target.true_solar.resolved_candidates` 数组共享其目标换算来源／profile。出生与目标属于两个独立时点，允许分别披露不同的核验状态和来源。引擎不参与换算，也不从 civil 字段派生候选。`unresolved` 时返回结构化 `insufficient_input` 且不生成候选；声称 `resolved`／`candidate_set` 却缺失来源或选择器结构无效时视为协议错误。任一已声明候选在计算阶段失败时，整个 CLI 失败且不返回部分事实盘，避免静默丢弃候选。

每个 `groups[].facts` 使用以下结构：

```text
target
origin
decadal
yearly
```

### `target`

记录请求的 date-only 真太阳日期、`time_basis=true_solar`、目标粒度、profile 固定的引擎定位时辰及引擎返回的公历和农历日期。固定时辰没有用户时刻语义，只用于确认大限和流年所对应的目标日期，不产生流月、流日或流时解释。

### `origin.natal`

记录：

- 已解析真太阳日期／时辰，以及引擎返回的公历、农历、干支日期与时辰；
- 命宫、身宫地支；
- 命主、身主；
- 五行局；
- 算法性别参数、生肖、星座和引擎时辰范围。

这些是传统排盘结构，不是关于人格或命运的现实事实。

### `origin.palaces[12]`

每宫统一记录：

- `index`、规范宫位 `id`、来源宫名；
- 宫干、宫支、是否身宫、是否来因宫；
- `stars.major`、`stars.minor`、`stars.adjective`；
- 十二长生、博士十二神、将前十二神、岁前十二神；
- 该宫的大限年龄范围与干支。

星曜记录名称、类型、作用层、庙旺标签及四化标签。星曜分组和名称中的褒贬字样不直接代表现实好坏。

### `origin.relations`

为十二宫分别记录目标宫、对宫及两个三合宫。这里的 `wealth` 与 `career` 是引擎对两组三合位的结构字段名；解释时仍须按当前目标宫的三方四正读取，不得把字段名直接翻译成财运或事业事件。

### `decadal`

记录目标日期所在大限的：

- 宫位索引、干支及十二宫映射；
- 四化星曜与该层流曜；
- 三方四正关系；
- `applicability.age_range`、`target_nominal_age`、`age_basis=nominal_age` 与范围来源。

大限层只能说明阶段关注重点，不得覆盖或改写原局事实。

### `yearly`

记录目标真太阳日期所属农历流年周期的：

- 宫位索引、干支及十二宫映射；
- 四化星曜、该层流曜及年度装饰星；
- 三方四正关系；
- `applicability.target_solar_date`、`target_solar_year`、`effective_year_ganzhi`、`target_nominal_age`、虚岁口径和年度边界规则；
- `applicable_cycle=target_date_lunar_year_cycle` 与 `full_gregorian_year=false`，防止把目标日所在周期外推成完整公历年。

`target_solar_year` 只索引目标日期的公历年份，不是解读的完整公历年范围。具体流年宫位以返回干支、农历日期与冻结的 `horoscope_divide` 共同确定。

## 哈希语义

- `candidate_id`：候选参数维度的规范化 SHA-256；
- `chart_hash`／`group_id`：单个完整事实盘的规范化 SHA-256；
- `result_hash`：连同来源、引擎、运行时和候选比较信息在内的整个输出摘要。

哈希只用于重现、归并和发现差异，不代表命中率、可信度、吉凶强度或概率。

## 用户给定命盘

用户直接提供命盘时，不伪造 CLI 封装。先核对其真太阳时口径和来源，再按来源标为 `P0` 或 `P1`，只保存能够直接确认的宫位、星曜、四化和运限字段；缺项保持未知。民用时或时间口径不明的既有命盘只能转录可见字段，不能形成正式领域结论。只有确需重新排盘且输入达到契约时，才改走 CLI 入口。
