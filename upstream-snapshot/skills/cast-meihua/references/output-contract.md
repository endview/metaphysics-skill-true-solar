# 输出契约

## 交付结构

在标准子结果的 `method_payload` 中完整保留脚本 JSON，再用人类可读结构呈现。完整原生结果只保存一次；摘要和主张通过引用指向它，不复制另一份。默认不要把整份 JSON 粘贴给用户；仅在用户明确要求审计原始输出时全文展示。可读答复至少包含：

1. **个案冻结**：具体问题、观察期限、应期单位、应期规则、`timeBasis: civil|true_solar`、民用时与 IANA 时区、方法与数字（如有）；真太阳时分支另列连续太阳钟面、地点、经度和换算来源。
2. **审计记录**：协议／schema 版本、实际计算口径、历法日期 carrier、历法原始字段或数字原值、中间加总、除数、原始余数、余零是否触发及映射值，Node／V8／ICU／CLDR／tz 版本；真太阳时分支另列 `wallClockShiftSeconds` 与 `performedByScript: false`。
3. **卦象结果**：本卦名、上下卦、六爻自下而上、动爻及阴阳变化、变卦、互卦、错卦、综卦、体用位置和五行关系。
4. **分层解读**：严格按解释优先级，把计算事实与象征性诠释分段。
5. **认识说明**：这是传统象数框架下的反思材料，不是事实证据或经验概率。

不得省略看似“不重要”或不利于叙事的原始值。若手工摘要与 JSON 不一致，以脚本 JSON 为准并更正摘要，不另起一卦。

脚本 schema 使用 `cast-meihua/result-v2`，协议只接受 `lunar-time-v2` 或 `numbers-v2`。`case.castTime` 是由 `timeBasis` 标记的联合结构：

- `civil`：`civil` 保存 `specified|now` 来源、请求值、冻结 instant、IANA 时区及当地钟面；`resolvedTrueSolar`、`location` 与 `conversion` 固定为 `null`。
- `true_solar`：`civil` 保存原始民用时；`resolvedTrueSolar` 保存无 offset 的连续太阳钟面及参考 IANA 时区，但不得含太阳时 instant；`location` 保存地点与经度；`conversion` 保存来源、`wallClockShiftSeconds` 及 `performedByScript: false`。

字段形态与 `timeBasis` 不匹配时不得把结果标记为 `ok`。`calculation.rawValues.selectedTimeBasis` 与 `selectedLocalDateTime` 必须和冻结口径一致；`calendarCarrier` 只承载当地公历日期，不得呈现为起卦 instant。

## 认识边界

- 算式、卦名和派生卦彼此一致，只证明协议内部计算一致；不代表现实事件更可能发生。
- 不给百分比、置信度、统计显著性或“准确率”，除非另有真实、适当的数据模型；卦象不能充当该模型。
- 不把象征解释陈述为已知事实，不声称它能提供超自然事实依据，也不利用含糊命中制造确定感。

## 标准子结果

直接调用和由 `$metaphysics` 分派都返回同一结构：

- `schema_version: metaphysics.standard-child.v1`
- `method_id: meihua`
- `skill_name: $cast-meihua`
- `status`
- `question_answered`
- `applicable_time_scale`：固定使用规范值 `bounded_event`；具体观察期限保留在冻结个案与 `method_payload` 中
- `findings[]`
- `claims[]`
- `basis[]`
- `assumptions_and_uncertainty[]`
- `limitations[]`
- `follow_up_needed[]`
- `method_payload`

`method_payload` 是完整脚本 JSON 的唯一存放位置。成功时放入脚本原生结果；尚未执行或执行失败时为 `null`。不要另设原始结果副本字段，也不要在 `basis`、`findings` 或其他字段复制完整原生结果。

`claims` 字段始终必填。`status: ok` 时至少包含一个直接回答冻结问题的主张；其他状态使用空数组。每项主张必须包含：

- `claim_id`：当前子结果内唯一的标识；
- `proposition_id`：由主路由分派时原样透传，不得另建或改写；直接调用时为当前问题建立 `p1`；
- `subject_ref`：主张所指向的问题对象；主 Skill 分派时原样透传对象引用，直接调用时使用局部标识 `q1`；
- `statement`：条件式、可理解的主张正文；
- `direction`：只使用 `supportive`、`cautionary`、`mixed`、`neutral` 或 `unknown`；
- `conditions[]`：主张成立所依赖的冻结条件；无额外条件时为空数组；
- `applicable_time_scale`：固定使用规范值 `bounded_event`，并与冻结观察期限一致；
- `basis_refs[]`：指向 `method_payload` 中计算事实的字段路径；不得指向另一份复制数据。

直接调用时使用 `claims[].subject_ref: q1` 和 `claims[].proposition_id: p1`。由主 Skill 分派时，`claims[]` 原样保留 `proposition_id` 与 `subject_ref`；`question_id` 留在分派和适配上下文，不加入标准子结果顶层。不要读取其他玄学方法的结果，也不要为迎合另一方法回写或重起本卦。

`status` 只使用：

- `ok`：输入完整、脚本成功且存在可交付解读；
- `insufficient_input`：缺少冻结个案或所选口径的阻塞信息；`civil` 包括时点／`now` 或 IANA 时区，`true_solar` 另包括原始民用时、连续太阳钟面、可靠换算来源、地点、经度，或尚未冻结的边界候选；
- `error`：脚本、执行或输出处理失败。

`unavailable` 与 `unsupported` 由主路由在调用前根据运行时可用性和能力范围生成，本 Skill 不自行返回。不得使用 `success`、`needs_input`、`partial` 或其他近义状态。

`basis` 必须以简洁字段路径指向协议版本、算式与卦象事实；不要复制 `method_payload` 内容。
