> 当前候选正式入口采用 runtime-protocol.md 的受控 runner；本文件的原生格式用于兼容与解释。原生 CLI 只用于开发复现，不能绕过冻结、执行记录和 finalize。

# 输出契约

## 标准输出

除非用户只问一个窄问题，按以下顺序输出：

1. **范围与依据**：实际回答的问题、时间层、`B/P` 等级、`time_basis=true_solar`、`verification_status`、换算来源／profile／版本、排盘来源与流派配置。
2. **结构事实**：命/身、目标宫、三方四正、相关四化及大限/流年的映射；不夹带事件结论。
3. **领域解释**：每项写支持结构、反证、成立条件及传统含义。
4. **阶段主轴**：先大限后流年，只到所选流年周期的主题。
5. **候选敏感性**：稳定项、敏感项、不可判断项。
6. **现实背景与行动**：已知事实、现实约束、可控制动作和观察点。
7. **限制**：缺失资料、未覆盖能力和总体确定性。

窄问题可压缩结构，但不能省略影响结论的候选差异。

## 措辞层级

明确区分：

- **结构事实**：命盘在所声明协议下显示的宫星和映射；
- **传统解释**：该流派如何理解结构；
- **现实事实**：用户提供或可靠来源确认的情况；
- **行动建议**：从上述信息推导出的可执行步骤。

不使用虚构百分比。可用低、中、高描述“在当前资料和规则下的解释确定性”，并说明原因；该标签不表示现实预测概率。

## 路由返回封装

由主路由分派时，返回：

| 字段 | 约束 |
|---|---|
| `schema_version` | 固定为 `metaphysics.standard-child.v1` |
| `method_id` | 固定为 `ziwei` |
| `skill_name` | 固定为 `$analyze-ziwei` |
| `status` | `ok`、`insufficient_input` 或 `error` |
| `question_answered` | 实际回答的紫微子问题 |
| `applicable_time_scale` | 本命用 `structural`，大限用 `multi_year_stage`，流年用 `annual_cycle`；具体周期保留在原生结果中 |
| `findings` | 字符串数组；主要传统解释，不改写为现实事实 |
| `claims` | 必填；`ok` 时至少记录一项结构化主张，其他状态必须为空数组 |
| `basis` | 字符串数组；`B/P` 等级、目标宫、三方四正、四化、时间层及配置摘要 |
| `assumptions_and_uncertainty` | 字符串数组；真太阳时换算来源、候选盘、反证、缺失信息与敏感性 |
| `limitations` | 字符串数组；缺失资料、未覆盖能力和认识限制 |
| `follow_up_needed` | 字符串数组；只列真正阻塞当前问题的信息 |
| `method_payload` | 完整紫微原生结果的 JSON 对象且只保存一次；尚未执行或失败时为 `null`，标准摘要通过引用定位其中依据 |

`claims[]` 每项必须包含：

| 字段 | 约束 |
|---|---|
| `claim_id` | 当前子结果内唯一的主张标识 |
| `proposition_id` | 路由分派时原样透传命题标识；直接调用时在本次请求内建立稳定命题键 |
| `subject_ref` | 路由分派时原样透传对象引用；直接调用时在本次请求内建立稳定引用 |
| `statement` | 条件式主张文本 |
| `direction` | 仅 `supportive`、`cautionary`、`mixed`、`neutral` 或 `unknown` |
| `conditions` | 数组；列出主张成立所需的现实条件和候选限制 |
| `applicable_time_scale` | 只用 `structural`、`multi_year_stage` 或 `annual_cycle`，并与主张实际时间层一致 |
| `basis_refs` | 数组；指向 `method_payload` 中能够复核的事实位置，不填无法定位的依据 |

`findings` 只提供面向阅读的摘要，不得嵌入另一份完整事实层。`method_payload` 保存 `ziwei.facts.v2` 事实及本方法必需的原生解释结构一次，不再保存相同内容的第二份副本。

`status=ok` 时，`basis` 或 `assumptions_and_uncertainty` 必须能定位 `source.time_basis`、`source.time_provenance`、`verification_status` 与所用候选。`birth.true_solar.status` 或 `target.true_solar.status` 为 `unresolved`、缺少有效核验状态或没有已解析选择器时，返回 `insufficient_input`、空 `claims`、`method_payload=null`，并在 `follow_up_needed` 说明需要的换算资料；不得用 civil 盘替代。`user_declared` 可执行，但要明示未独立核验。

不得读取其他玄学方法的结论后改写紫微结果。组合工作由路由层处理。

## 中性表达

- 不使用“注定”“一定”“必有灾”“克某人”或恐吓式化解话术；
- 不把星曜褒贬词当作人的价值判断；
- 不使用古代性别、贞洁、阶级、残障或疾病污名；
- 不因用户相信程度改变盘面事实；
- 不把多方法结论一致描述为准确率提升。
