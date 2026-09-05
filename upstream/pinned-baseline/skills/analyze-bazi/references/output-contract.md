# 输出契约

## 分析答复

除非用户只问一个窄问题，按以下顺序输出：

1. **范围与证据**：文化解释框架声明、用户问题、`B/P` 等级；分列原始民用日期时间、出生地点/经度/时区，以及真太阳时换算工具、版本、访问日期、方程时差/经度修正或工具披露参数、换算后的日期时间及时辰。
2. **事实层**：四柱/所给岁运、日主、明干与藏干十神、固定关系、候选盘差异。
3. **解释层**：分别呈现旺衰、调候、格局、用神；每项标流派/判据、反证和置信度。
4. **时间层**：先大运后流年；区分干支事实、传统解释和现实条件。
5. **敏感性/核对**：候选盘稳定项、敏感项，以及冻结后的历史核对结果。
6. **现实行动**：给不依赖命理也成立的建议、观察指标和复盘点。
7. **限制**：缺失信息、无法确认项、禁止外推及总体置信度；无法可靠换算真太阳时时明确返回资料不足。

把结构事实与解释分段，不用“合”“冲”“十神”直接替代事件论证。引用脚本结果时说明它只检查结构，不负责历法排盘。

用户明确提供真太阳时或确认四柱采用该口径时，记录 `verification_status=user_declared`，可输出 `P0/P1` 的谨慎解读，但必须说明尚未独立核盘；只有民用时且仍未解析真太阳时时，才暂停旺衰、调候、格局、用神或起运等依赖时刻的结论并列出补充路径。

## 检查器命令

```text
node scripts/inspect_bazi.mjs --pillars <年柱> <月柱> <日柱> <时柱> [--dayun <大运>] [--liunian <流年>]
```

四柱必须是四个合法的干支二字组合；脚本还检查天干与地支阴阳序位是否能组成六十甲子中的合法配对。`--dayun`、`--liunian` 可省略。用 `--help` 查看用法。错误写入标准错误并返回非零状态。

## JSON 字段

- `schemaVersion`：输出结构版本。
- `input`：规范化后的原局四柱及可选大运、流年。
- `dayMaster`：日干、五行、阴阳。
- `pillars[]`：每柱的位置、明干属性及十神、地支、依约定次序展开的藏干属性及十神。
- `relationships.heavenlyStemFiveCombinations`：存在的天干五合及位置配对。
- `relationships.earthlyBranchSixCombinations`：存在的地支六合及位置配对。
- `relationships.earthlyBranchClashes`：存在的六冲及位置配对。
- `relationships.earthlyBranchHarms`：存在的六害及位置配对。
- `relationships.completeThreeHarmonies`：三个成员全出现的三合及各成员位置。
- `relationships.completeThreeMeetings`：三个成员全出现的三会及各成员位置。
- `relationships.repeatedBranches`：重复支、次数与位置。
- `limitations`：脚本不提供的能力。

所有关系在原局与所给大运/流年的合并观察范围内检测，位置标签用来区分来源。数组顺序由内置表固定，因而同一输入产生同一 JSON。结果只表示关系存在，不表示合化、成局、强弱、吉凶或事件。

## 标准子结果

无论直接调用还是由 `$metaphysics` 分派，内部先生成以下稳定结构，再按用户所需形式呈现。完整八字原生结果只放入 `method_payload` 一次；其他字段只提供索引、摘要或可比较命题，不复制完整结果，也不要让主 Skill 重新推导八字内容：

| 字段 | 值或约束 |
|---|---|
| `schema_version` | 固定为 `metaphysics.standard-child.v1` |
| `method_id` | 固定为 `bazi` |
| `skill_name` | 固定为 `$analyze-bazi` |
| `status` | `ok`、`insufficient_input` 或 `error` |
| `question_answered` | 实际回答的八字子问题 |
| `applicable_time_scale` | 只使用 `structural`、`multi_year_stage`、`annual_cycle` 或 `unknown`；具体阶段边界留在原生结果中 |
| `findings` | 字符串数组；主要传统解读摘要，不得改写成事实或复制完整答复 |
| `basis` | 字符串数组；`B/P` 等级、结构事实、采用流派与关键判据的摘要 |
| `claims` | 必填数组；按下述契约输出可比较命题 |
| `assumptions_and_uncertainty` | 字符串数组；候选盘、缺失资料、反证与置信度限制 |
| `limitations` | 字符串数组；缺失资料、认识限制及不能由八字确定的部分 |
| `follow_up_needed` | 字符串数组；只列真正阻塞该子问题的信息 |
| `method_payload` | 完整八字原生结果的 JSON 对象，生成后冻结；尚未执行或失败时为 `null`，不得在其他字段再次保存完整副本 |

`method_payload` 的证据区必须含 `time_basis` 对象，并使用以下稳定字段：

| 分组 | 字段 |
|---|---|
| 原始来源 | `raw_calendar`、`raw_civil_datetime`、`birth_place`、`birth_longitude`、`civil_timezone`、`historical_timezone_or_dst` |
| 换算依据 | `conversion_tool`、`conversion_version`、`conversion_access_date`、`equation_of_time_correction`、`longitude_correction`、`conversion_parameters` |
| 换算结果 | `resolution_status`、`verification_status`、`resolved_candidates[]` |

`resolution_status` 只用 `resolved`、`candidate_set` 或 `unresolved`。前两者的 `verification_status` 只用 `tool_verified` 或 `user_declared`；`unresolved` 时固定为 `null`。二者不得混用。资料不足时保留已知字段，以 `null` 表示未知值，不得虚构换算值。

`resolved_candidates[]` 每项包含 `candidate_id`、`true_solar_datetime`、`true_solar_shichen`、`source_ref`、`conversion_parameters`、`boundary_reasons[]` 与 `chart_ref`。与之配套的 `chart_candidates[]` 每项包含 `chart_id`、`candidate_id`、`four_pillars`、`charting_source`、`charting_version`、`charting_access_date` 和 `calendar_rules`。单盘也使用一个元素的数组；`basis_refs` 应指向稳定 ID，不以数组位置代替引用。

`resolved` 必须恰有一对换算／命盘候选，`candidate_set` 至少两对，`unresolved` 时两个数组都为空。两个数组内的 `candidate_id`／`chart_id` 分别唯一；每个 `chart_ref` 必须唯一命中 `chart_id`，且关联两项的 `candidate_id` 相同。存在悬空、重复或错配引用时不得标记 `ok`。

请求从出生资料生成/核验命盘却只有民用时且仍缺少真太阳时结果时，使用 `status=insufficient_input`；`claims` 为空，并在 `follow_up_needed` 按顺序指明缺少的时间精度、IANA 时区、地点／经度，或请用户提供外部换算结果。若同时完成了结构检查，只把结构事实放入 `method_payload`，不得据此提升状态。`user_declared` 的真太阳时四柱可进入 `P0/P1` 解读；工具换算并重排一致后才可标 `P2/tool_verified`。

`claims` 字段始终存在。`status=ok` 时至少包含一项；`insufficient_input` 或 `error` 时必须为空数组。每项 claim 必须包含：

| 字段 | 值或约束 |
|---|---|
| `claim_id` | 当前子结果内唯一且稳定的标识 |
| `proposition_id` | 路由分派时原样透传路由命题标识；直接调用时为该命题创建稳定标识 |
| `subject_ref` | 路由分派时原样透传对象引用；直接调用时建立本次请求内稳定引用，例如 `primary_chart`、`relationship_pair` |
| `statement` | 可独立理解、可与其他方法比较的命题陈述 |
| `direction` | `supportive`、`cautionary`、`mixed`、`neutral` 或 `unknown` |
| `conditions` | 必填数组；列出命题成立所依赖的条件，无条件时为空数组 |
| `applicable_time_scale` | 只使用 `structural`、`multi_year_stage`、`annual_cycle` 或 `unknown`，并与该命题实际范围一致 |
| `basis_refs` | 必填数组；指向 `method_payload` 内相应事实、判据、反证或不确定性的位置 |

每个 `basis_refs` 都必须能在 `method_payload` 中解析，不得用无对应依据的标签。不要读取或迎合其他方法的结果。将标准子结果交给路由器后，不因另一方法的结论回写或重算。
