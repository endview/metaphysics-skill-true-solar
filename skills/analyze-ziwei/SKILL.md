---
name: analyze-ziwei
description: 以统一真太阳时、版本化且可追溯的协议排出或校验紫微斗数命盘，并围绕十二宫领域、本命、大限与流年分析事业角色、关系中的自身互动模式、迁移环境和阶段主轴；区分工具核验与用户声明的真太阳时结果，不以民用时回退，支持候选盘敏感性、依据与反面依据及现实行动。仅在用户明确要求单独使用紫微斗数、紫微命盘、紫微语境下的十二宫或大限、紫微流年，明确调用
  $analyze-ziwei，或由 $metaphysics 分派时使用；同时点名多个方法、要求组合或综合分析时优先交给 $metaphysics；不要因普通事业、感情、运势、人格或出生资料自动触发。
---

# 紫微斗数：来源、候选与事实盘

把紫微作为传统文化解释。先读取[可靠执行协议](references/runtime-protocol.md)及[输入契约](references/input-contract.md)。多方法由 `$metaphysics` 编排，勿启动嵌套路由。

## 执行

使用 `scripts/run-verified.mjs`。`method_inputs.native_input` 保持原 `ziwei.input.v2` 契约；原始民用资料、出生与目标的已解析真太阳时、候选、profile 和定位目标不得静默替换。已由用户确认的太阳时记为 `user_declared`，当前包装器不接纳上传 JSON 自报的独立工具核验。没有解析结果时返回资料不足，不回退民用时，也不从四柱猜出紫微宫位。

轻量 profile 和 manifest → 来源与输入预检 → 最多 64 个组合候选 → 校验引擎分块及整体摘要 → 调用保留的 iztro 2.5.8 → 原生事实盘验证。预检不足不实例化重型引擎；进程级超时覆盖整个原生计算。VM 仅隔离配置，不是安全沙箱。完整性失败时停止，不手工安星。

本包保留本命、大限、流年范围。目标日仅用于定位，不等于支持流日；不给未登记的流月流日流时解释。单引擎结果仍为 P1，不因星盘完整而变为 P2 或跨方法独立验证。

## 解读

读[profile](references/profiles.md)、[事实结构](references/facts-schema.md)、[候选敏感性](references/candidate-sensitivity.md)、[领域映射](references/domain-map.md)及[解释工作流](references/interpretation-workflow.md)。仅选择当前星曜、候选和领域匹配的知识卡，不能因某颗星就断定现实事件。

先本命结构再大限、流年；保留各候选和星曜事实。以宫位组合、四化及所选传统规则给条件式说明，写明反证、不确定性和现实条件。解释草稿引用本分支事实与卡片，经 finalize 后交付。[输出契约](references/output-contract.md)中的原生格式和标准子结果保持不变；新执行证据以外层 bundle 附着。

不要从星曜推断他人思想、健康诊断、出轨、灾害或必定录用；有现实反馈时单独更新观察记录，不重写旧星盘和旧解释。没有全部候选的一致依据，不宣称稳健结论。