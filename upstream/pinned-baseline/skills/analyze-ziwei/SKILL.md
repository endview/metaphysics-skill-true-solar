---
name: analyze-ziwei
description: "以统一真太阳时、版本化且可追溯的协议排出或校验紫微斗数命盘，并围绕十二宫领域、本命、大限与流年分析事业角色、关系中的自身互动模式、迁移环境和阶段主轴；区分工具核验与用户声明的真太阳时结果，不以民用时回退，支持候选盘敏感性、依据与反面依据及现实行动。仅在用户明确要求单独使用紫微斗数、紫微命盘、紫微语境下的十二宫或大限、紫微流年，明确调用 $analyze-ziwei，或由 $metaphysics 分派时使用；同时点名多个方法、要求组合或综合分析时优先交给 $metaphysics；不要因普通事业、感情、运势、人格或出生资料自动触发。"
---

# 紫微斗数分析

将紫微斗数限定为传统命盘的可复现计算与人生领域反思。统一采用真太阳时；把原始民用时仅作为来源记录，禁止用它直接排盘或在换算失败时回退。只解释本命、大限与流年，并区分盘面事实、传统解释与现实事实。

## 执行流程

1. 明确用户要分析的一个主要领域、对象、现实目标与时间范围。用户只说“整体看看”时，只识别两三个领域主轴，不输出十二宫百科。
2. 先完整读取[输入契约](references/input-contract.md)与[输出契约](references/output-contract.md)。涉及命盘生成或来源校验时，再读取[协议配置](references/profiles.md)与[事实结构](references/facts-schema.md)；存在时间、闰月、时区、换日或流派歧义时，再读取[候选盘处理](references/candidate-sensitivity.md)。
3. 按输入契约确定命盘来源等级。确认既有命盘明确采用可追溯的真太阳时；未知或民用时命盘不能作为本 Skill 的核定盘。优先使用本 Skill 生成的版本化事实；其次使用带工具、版本与协议的结构化真太阳时命盘；来源不完整时保留未知，不凭截图或常识补盘。
4. 需要从出生资料排盘时，先取得已解析的真太阳时结果，再按 `ziwei.input.v2` 在 Skill 根目录调用 `node scripts/ziwei-cli.mjs`。使用 `ziwei-core-true-solar-v2`，只把 `status=ok` 的 `ziwei.facts.v2` 输出视为盘面事实。完整执行须有原始民用日期时间、IANA 时区、地点与经度、`verification_status=tool_verified|user_declared`，以及已解析真太阳日期时间或候选时辰。工具核验结果还须提供来源／profile／版本；用户直接提供的已换算结果允许按 `user_declared` 执行，但必须保留未独立核验限制，不伪造工具版本。若只有民用时，先引导补充地点／经度以便换算，或请其提供已换算结果。可让 CLI 返回结构化 `insufficient_input` 和下一步，不把这表述为拒绝。脚本不计算或近似真太阳时，也不得改用民用时。
5. 完整读取[领域映射](references/domain-map.md)与[解释工作流](references/interpretation-workflow.md)，再围绕用户问题读取相关宫位。每个重要结论同时检查目标宫位、三方四正、主星结构、四化以及相应大限或流年，并明确反面依据。
6. 只给二至四项主要解读。区分现实事实、盘面事实、传统解释、候选敏感性和行动建议；不要用吉凶计分、命中率、概率或多层呼应制造确定感。
7. 按标准子结果返回，供直接交付或主 Skill 综合。单独使用紫微时直接执行本流程；同时点名多个方法、要求组合或综合分析时，把本方法负责的领域与时间尺度交回 `$metaphysics`，不要自行模拟八字或梅花。

## 时间和能力范围

- 使用本命讨论领域结构与角色偏好，不作固定人格诊断。
- 使用大限讨论十年阶段的主要领域、资源、代价与转换条件。
- 使用流年讨论目标日所属农历流年周期的领域重点与可观察条件，不承诺具体事件；不得用一个目标日代表完整公历年。
- 分析基准只要求已解析的真太阳日期，用于定位大限和该日期所属流年周期；profile 内的固定目标时辰只服务引擎定位，不解释流日或流时。
- 不解释流月、流日或流时；短期具体事件可交回 `$metaphysics` 判断是否适合已接入的有界事件方法。
- 不做自动校时、双人匹配分数、多流派混合或精确应期。

## 标准子结果

返回以下字段；状态仅使用 `ok`、`insufficient_input` 或 `error`：

- `schema_version`: 固定为 `metaphysics.standard-child.v1`。
- `method_id`: 固定为 `ziwei`。
- `skill_name`: 固定为 `$analyze-ziwei`。
- `status`: 记录执行状态。
- `question_answered`: 记录实际回答的问题。
- `applicable_time_scale`: 本命用 `structural`，大限用 `multi_year_stage`，流年用 `annual_cycle`；具体农历流年周期留在原生结果中。
- `findings`: 字符串数组；保留主要传统解读。
- `claims`: 必填数组；`ok` 时至少记录一项可比较主张，其他状态返回空数组。路由分派时，每项原样透传 `proposition_id` 与 `subject_ref`；直接调用时在本次请求内建立稳定标识。每项还包含唯一 `claim_id`、主张文本 `statement`、`direction`（仅 `supportive`、`cautionary`、`mixed`、`neutral` 或 `unknown`）、成立条件 `conditions[]`、规范化 `applicable_time_scale` 与可定位依据 `basis_refs[]`。
- `basis`: 字符串数组；摘要列出盘面事实、三方四正、四化和运限依据。
- `assumptions_and_uncertainty`: 字符串数组；列出来源等级、`time_basis=true_solar`、`verification_status`、换算来源、profile、候选盘与未知项。
- `limitations`: 字符串数组；列出缺失资料、未覆盖能力和认识限制。
- `follow_up_needed`: 字符串数组；只列真正阻塞结论的资料。
- `method_payload`: 完整紫微原生结果的 JSON 对象且只保留一次；尚未执行或失败时为 `null`。标准摘要通过 `basis_refs` 引用它，不复制第二份完整结果，也不要因其他方法的结论回写。

## 输出原则

- 先写回答范围与盘面依据，再写传统解读。
- 将“规则支持清晰”与“现实预测准确”分开；前者不能证明后者。
- 主要结论只取全部合理候选共有的稳定核心；另设“敏感差异”说明会改变理解或行动的分歧，但不选择赢家。候选覆盖比例不是概率。
- 使用现代、中性、条件式语言，不继承古籍中的性别、阶层、疾病或灾祸污名。
- 现实证据与命盘解释冲突时，以现实证据为准。
