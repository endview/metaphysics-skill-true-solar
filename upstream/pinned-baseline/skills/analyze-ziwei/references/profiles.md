# 分析配置

## 目录

- [排盘 profile ziwei-core-true-solar-v2](#排盘-profile-ziwei-core-true-solar-v2)
- [核心解释配置 ZWDS-V1](#核心解释配置-zwds-v1)
- [流派配置](#流派配置)
- [时间配置](#时间配置)
- [正式领域配置](#正式领域配置)
- [领域转译配置](#领域转译配置)
- [选择规则](#选择规则)

## 排盘 profile `ziwei-core-true-solar-v2`

从出生资料生成命盘时只使用此 profile。它接受 `ziwei.input.v2`，输出 `ziwei.facts.v2`，具体配置冻结在 `scripts/profiles/ziwei-core-true-solar-v2.json`。

### 固定实现

- 引擎：iztro `2.5.8` 的内置 UMD；artifact SHA-256 为 `4b8eca323e5d4291471567c62255a2166471c55c77ebe8f0d2d38240e69d12b1`；
- 语言：`zh-CN`；盘型：`heaven`；算法：`default`；
- 时间口径固定为 `true_solar`；只接收可靠外部来源已解析的真太阳日期与时间／时辰，不内置换算或近似公式；
- 原始民用日期时间、IANA 时区、地点和经度只保留为来源，绝不作为排盘选择器；`civil_fallback=false`；
- `year_divide=normal`、`horoscope_divide=normal`、`age_divide=normal`；输出将年龄标为虚岁，并将年度边界记录为农历新年；
- 晚子时 `day_divide` 缺省为 `forward`；输入不确定时可并列 `current` 与 `forward`，不得静默选择；
- 出生选择器固定使用换算来源解析出的真太阳公历日期；原始记录只有农历时，须先由可追溯来源完成历法解析和真太阳时换算；
- 十二宫、三方四正以及主星／辅星／杂曜集合由 iztro `2.5.8` 固定生成；四化和庙旺表使用该版本默认映射；
- 只导出原局、大限、流年；不导出小限、流月、流日或流时；
- 目标基准为 date-only 真太阳日期；引擎接口所需 `target_cycle_time_index=0` 只作大限／流年定位坐标，不具有流日或流时解释含义；
- 每个候选在独立 VM 中载入引擎，避免一个候选的全局配置影响另一个候选。

此 profile 是明确的计算协议，不是传统流派真实性或现实预测效度声明。内置引擎生成的盘固定记为 `P1`，不能只因计算成功升为 `P2`。

`birth.true_solar.status` 或 `target.true_solar.status` 为 `unresolved`，或只给 civil 记录而省略 `true_solar` 时，CLI 返回结构化 `status=insufficient_input`、缺失字段和下一步，不调用排盘引擎。`resolved` 只接受一个选择器，`candidate_set` 至少接受两个；候选笛卡尔积最多 64 组。

### CLI

在 Skill 根目录执行：

```text
node scripts/ziwei-cli.mjs < INPUT_JSON
node scripts/ziwei-cli.mjs --input INPUT_FILE
```

根对象只接受 `schema_version`、`profile_id`、`birth` 和 `target`：

| 字段 | 约束 |
|---|---|
| `schema_version` | 固定为 `ziwei.input.v2` |
| `profile_id` | 必填且固定为 `ziwei-core-true-solar-v2` |
| `birth.gender` / `algorithm_gender` | 二选一；只接受算法所需的 `male/female` 或 `男/女`，不代表性别认同 |
| `birth.civil` | 原始公历日期、民用时间、IANA 时区、可选 UTC offset、地点和经度；只作来源 |
| `birth.true_solar` | `status`、`verification_status` 及含真太阳日期与 `local_time` 或 `time_index` 的选择器；工具核验时另含来源／profile／版本 |
| 可选候选 | `late_zi_policy(_candidates)`；晚子时值只用 `current` 或 `forward` |
| `birth.source_grade` | `B1` 或 `B2`；省略时保守记为 `B1`；只描述原始出生记录 |
| `target.civil` | 原始公历日期、IANA 时区、可选 UTC offset、地点和经度；date-only，不接收目标时刻 |
| `target.true_solar` | `status`、`verification_status` 及 date-only 真太阳日期选择器；工具核验时另含来源／profile／版本，用于确定目标大限与流年周期 |

出生 `time_index` 使用 0 至 12：0 表示早子时，1 至 11 依次表示丑至亥时，12 表示晚子时。它必须是工具核验或用户明确声明的真太阳时辰，不能由 CLI 从民用钟点直接取得。

每个已解析真太阳时对象必须披露 `verification_status=tool_verified|user_declared`。`tool_verified` 强制提供工具 `provider`、`profile_id` 与具体 `version`；`user_declared` 可省略 `conversion_source`，CLI 会如实规范化为 `provider=user`，`profile_id/version/access_date=null`，不得伪造工具信息。CLI 仅检查结构和来源完整性，不能替代对来源可靠性的审查。

`target` 必须显式给出已解析真太阳日期，因为事实层固定生成原局、大限和流年，不能让引擎以运行时当前日期作为隐藏默认值。即使用户只问本命，也给出分析基准日，并在解释层只读取 `origin`。基准日早于候选出生公历日或尚未进入有效大限时，CLI 明确报错，不生成负年龄或空大限事实。

## 核心解释配置 `ZWDS-V1`

V1 将紫微斗数作为传统解释与反思框架，使用十二宫领域地图、本命、大限和流年。它不把命盘当作已证实的现实预测模型，也不从命盘发现隐蔽事实。

核心证据单元为：

```text
目标宫 + 三方四正 + 命/身背景 + 对应四化 + 时间层 + 反证
```

缺少目标宫之外的结构证据时，不形成领域结论。星曜名称、单颗星、单一宫位、单个四化或一句古诀都不能独立定性。

## 流派配置

### 来源保持

用户提供完整命盘但未指定流派时，保持原排盘来源的星曜、四化与宫位映射，不擅自混入其他体系。把无法识别的扩展规则留空。

### 明示流派

用户明确指定流派时，整次分析使用同一规则集，并声明：

- 星曜集合；
- 四化表；
- 三方四正及宫位映射规则；
- 大限和流年叠加规则；
- 未纳入的扩展技法。

不同流派结论不兼容时并列呈现，不合并成“综合准确答案”，也不根据用户经历挑选更顺耳的一派。

## 时间配置

### `natal`

用于稳定的领域结构与用户自身模式。先完成本命结构，再讨论其他时间层。

### `decade`

用于大限阶段的资源重心、角色变化和需要适应的领域。大限只能激活或改变关注重点，不能改写本命。

### `annual`

用于目标真太阳日期所落入的农历流年周期之阶段主轴和观察项。`ziwei-core-true-solar-v2` 的 `horoscope_divide=normal`，流年从农历正月初一切换，到下一次切换前结束；同一公历年通常横跨两个流年周期。

用户只给“某公历年”时，先让用户选择一个具体目标日期／农历流年，或在可靠历法确定农历新年边界后分段。不得用年中或当前日期的一张流年盘代表完整公历年。流年不下钻到流月、流日或流时，也不承诺具体事件发生。

V1 不使用小限、流月、流日或流时，不以任何变体绕过该限制。

## 正式领域配置

### `career-self`

分析用户自己的工作角色、能力使用方式、组织互动、职业环境适配和阶段重心。输出范围不包括录用、晋升、解雇、考试或薪酬结果。

### `relationship-self`

分析用户在亲密关系中的期待、表达、边界、冲突处理和资源分配模式。输出对象是用户自身的互动结构，不扩展为他人的隐蔽信息或确定的婚离事件。

### `migration-environment`

分析用户对外部环境、异地、变化、网络和移动性的适应主题。输出是环境主题与现实条件，不指定唯一城市、国家或出行结果。

### `stage-axis`

整合本命、大限和流年，提炼当前阶段最值得关注的两至三个领域及现实观察项，不生成全年事件清单。

## 领域转译配置

### `finance-habits`

财帛宫转译为收入结构关注、预算、现金流、消费/储蓄习惯和风险承受边界，不计算资产价格、收益、买卖或借贷结果。

### `home-planning`

田宅宫转译为居住需求、家庭资源协商、文件检查和环境规划，不计算房价、交易时机、产权或工程状态。

### `wellbeing-routine`

疾厄宫转译为作息、压力负荷、就医准备和自我照护主题，不映射具体疾病、器官、诊断、疗效、寿命、孕产或精神状态。

## 选择规则

1. 优先选择一个正式领域配置；只有问题确实跨域时才增加第二个。
2. 先确定时间层，再读取所需宫位，不为“完整”堆叠全部星曜。
3. 领域转译配置只产出对应的行为与规划主题，不扩展为事件或事实结论。
4. 现实事实与命盘解释冲突时，以现实证据为行动依据。
