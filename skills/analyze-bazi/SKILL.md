---
name: analyze-bazi
description: 可靠执行八字结构检查及有依据、有限度的传统解释，支持给定四柱、藏干十神、固定关系、原局、所给大运流年和候选盘敏感性。仅在用户明确要求单独使用八字、四柱、子平或相应原局/岁运解读，明确调用 $analyze-bazi，或由 $metaphysics 分派时使用。经过实际计算、知识卡草稿和校验后交付；不从出生日期自行排出四柱，不计算未经外部核验的起运，不保证事件成败。同时点名多个方法交给主路由；普通职业、关系或人生建议不自动触发。
---
# 八字：先核结构，再作有限解释

把八字作为传统文化框架，不作为现实预测证据。多方法请求返回 `$metaphysics` 编排；单方法在本 Skill 自包含执行。

## 执行

首先读取[可靠执行协议](references/runtime-protocol.md)。使用 `scripts/run-verified.mjs` 的冻结、计算、知识卡和 finalize 链路，不因读过源码而声称已经运行。

本包支持给定四柱的结构核对及有来源的原局、大运、流年解释，不从出生日期生成四柱。输入 `method_inputs` 为按年/月/日/时顺序的 `pillars`、可选 `dayun`/`liunian`、`review_chart_id`、`candidate_id` 与 `source`。来源含 `verification_status:unknown|user_declared` 和可核查 `source_ref`，可保留原始民用资料及已解析太阳时。候选集用 `candidate_set` 数组逐项传入上述完整单盘对象，2–64 项且候选和命盘 ID 唯一；必须逐盘保留，不能按经历选盘。

只有结构资料且未确认真太阳时时，只采用 `structural_review`。用户已确认真太阳时可采用传统解释范围，不再要求重复校准；记录 `user_declared`，不冒充 `tool_verified`。源盘仍为给定资料，本轮实际结构检查单列 P1；没有外部转换与独立历法重排就不标 P2。程序预检缺失时仅补问真正阻塞项。

## 按需引用

十神先读[十干与十神](references/ten-stems-and-ten-gods.md)，藏干读[藏干](references/branch-hidden-stems.md)，合冲害读[关系](references/relationships.md)，时间与起运读[边界](references/charting-boundaries.md)。解读先读[分析工作流](references/analysis-workflow.md)，关系主题读[合盘](references/compatibility.md)，交付读[输出契约](references/output-contract.md)。程序按需选取 `knowledge/cards.json`，不要整库注入上下文。

## 解读

保留固定事实块。旺衰、调候、格局、用神分别说明目标、证据、反证和传统适用条件；木多不直接等于身强，财未透不等于无藏财，局部支不能冒充完整三合三会。现有检查器不输出的刑、暗合、拱会、神煞是待核补充，不压过主分析链。

先原局后给定岁运；年度与大运边界来自用户资料或明确外部工具，不自行伪造交运日期。不得借 `liunian` 参数实现月日时层。若不同候选改变结论，列共同项、差异项与不能确定项。历史核对如果事后结果已可见，明确属于事后叙事，不宣称独立验证。

使用知识卡起草条件式解释并提交 finalize；指出至少一个反证和现实替代解释。妻星/夫星仅在用户主动选择角色化传统视角时采用。现实建议依据真实材料；不用于招聘筛选、诊断或保证录用。

普通答复给主要倾向、关键事实、限制和现实行动，完整 JSON 留给审计。脚本、引用或校验失败时停止依赖该结果的解释，不手算补齐。
