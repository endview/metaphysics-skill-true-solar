# 通用编排契约

本文件定义 `metaphysics.orchestration.v4`。内部对象使用版本化结构；面向用户默认使用自然语言，不直接展示 schema、状态码或方法载荷。

本版本是[能力清单](capability-manifest.v1.json)中的 `method-v4` execution profile，只执行绑定到 `provider_type: method` 的活动 provider。`knowledge`、`utility` 与 `workflow` 不得进入本契约，也不得使用本契约带有方法语义的字段伪装执行；未来 provider 若不能完整复用本契约语义，必须先升级编排版本并登记真实结果契约。

## 目录

- [问题包](#问题包)
- [路由计划与预检](#路由计划与预检)
- [子任务](#子任务)
- [标准子结果](#标准子结果)
- [路由适配结果](#路由适配结果)
- [独立执行与比较](#独立执行与比较)
- [失败与降级](#失败与降级)
- [上下文复用](#上下文复用)
- [版本兼容](#版本兼容)
- [交付结构](#交付结构)

## 问题包

把请求规范化为 `metaphysics.query-envelope.v2`；不得为了填满字段而追问或猜测。

| 字段 | 约束 |
| --- | --- |
| `schema_version` | 固定为 `metaphysics.query-envelope.v2`。 |
| `original_request` | 原样保留用户请求。 |
| `questions[]` | 一个或多个可独立回答的问题单元。 |
| `requested_methods` | 用户明确点名的方法；未点名时为空。 |
| `method_preference` | `auto`、`single` 或 `combined`；只记录意图。 |
| `known_context` | 与本请求有关的资料及其来源状态。 |
| `unknowns` | 缺失、近似、争议和待子 Skill 判断的信息。 |
| `constraints` | 期限、选项、成本、排除方法等用户约束。 |
| `output_mode` | `brief`、`standard` 或 `research`；默认 `standard`。 |

每个 `questions[]` 单元包含 `question_id`、`text`、`goal`、`subject_ref`、开放式 `domain_tags`、`proposition_id`、`proposition`、清单登记的 `question_shape`、清单登记的时间尺度 `time_scope` 与用户给出的 `target_window`。复合请求按对象、命题或时间尺度拆分；不得用一个全局 `mixed` 丢失差异。

`target_window` 是结构化对象：

| 字段 | 约束 |
| --- | --- |
| `kind` | `unbounded`、`interval`、`cycle` 或 `unknown`；`unbounded` 只用于没有日期边界的结构层。 |
| `start` / `end` | `interval` 使用带边界含义的 RFC 3339 instant 或 `YYYY-MM-DD`；其他类型为 `null`。 |
| `end_inclusive` | `interval` 必填布尔值；其他类型为 `null`。 |
| `boundary_system` | 稳定的日界、年界或 profile 标识；不适用时为 `null`。 |
| `timezone` | 需要当地边界时使用 IANA 时区；不适用时为 `null`。 |
| `calendar` | `gregorian`、`chinese_lunar`、`profile_defined`、`not_applicable` 或 `unknown`。 |
| `cycle_ref` | `cycle` 的稳定周期标识；其他类型为 `null`。 |
| `raw_text` | 用户原始时间表述，仅用于展示，不参与比较。 |

无法在不换算、不猜测的前提下形成上述字段时使用 `kind: unknown`。不得把自由文本自动解析成隐含日期、历法周期或时区。

`known_context` 中的资料标为 `user_confirmed`、`user_approximate`、`reality_source` 或 `method_output`。方法输出不会升级成现实资料。不要虚构出生时间、地点、时区、数字、事件时点、命盘来源或默认答案。

需要出生时刻、起卦时点、时辰、换日或节气边界的分支，必须在 `known_context` 中保存原始民用时间，并按方法 profile 记录本次 `time_basis`。八字、紫微及未来六爻的计算分支另存已解析真太阳时、地点／经度、原民用时区，以及可靠换算来源的标识、版本或访问日期；只有民用时间时先收集地区／经度并引导换算，不能直接当作错误，也不能静默冒充真太阳时。梅花可冻结 `civil` 或 `true_solar`；只有后者才要求换算元数据。

## 路由计划与预检

选择前形成 `metaphysics.route-plan.v3`：

| 字段 | 约束 |
| --- | --- |
| `schema_version` | 固定为 `metaphysics.route-plan.v3`。 |
| `capability_manifest_schema_version` / `capability_manifest_version` | 使用通用能力选择层时冻结本轮能力清单版本；旧生产者可省略。 |
| `manifest_schema_version` / `manifest_version` | 冻结 execution profile 引用的类型清单版本；`method-v4` 中明确指方法清单。 |
| `decision` | `selected`、`none`、`unsupported` 或 `needs_input`。 |
| `selected_capabilities[]` | 保存 question、method、capability、职责、`input_profile_id`、就绪度、方法记录版本、来源与目标 schema；使用通用能力选择层时另存 `provider_id`、`provider_type`、`provider_record_version` 与 `execution_profile`。 |
| `subtasks[]` | 准备分派的独立子问题，不含其他方法结果。 |
| `rejected_candidates[]` | 方法及稳定原因；不使用虚假数值评分。 |
| `blocking_inputs[]` | 当前计划真正缺少的阻塞字段。 |
| `coverage` | 哪些问题单元已覆盖或未覆盖。 |

`none` 表示无需玄学方法，`unsupported` 表示指定方法或问题形态没有活动能力，`needs_input` 表示补充最少信息后可形成计划。常用未选原因包括 `capability_mismatch`、`time_scope_mismatch`、`method_inactive`、`higher_input_burden`、`redundant_role` 与 `user_excluded`。

按主 `SKILL.md` 的选择规则与机器清单筛选后，在分派前逐项确认：

1. invocation 确实对应当前可调用的子 Skill。
2. 清单 schema、manifest、方法记录及来源结果主版本均受支持。
3. 所选能力、输入 profile、`readiness` 与 `readiness_checks` 和计划一致。
4. 该输入 profile 的 `runtime_requirements` 当前可用。
5. 时间输入满足方法清单的 `time_basis_policy`；缺少真太阳时但已有民用时的分支先收集地区／经度或请用户提供换算结果，以 `needs_input` 等待补充，不得改用相近时辰。允许民用时的方法则按已冻结口径继续。

用户明确点名的分支不可用时，不静默替代。自动选择的分支若在预检阶段不可用，可从同一问题单元的非重复候选中重规划一次，并向用户说明替换；没有等价候选就保留不可用状态。

## 子任务

向每个分支发送 `metaphysics.adapter-task.v3`：

| 字段 | 约束 |
| --- | --- |
| `schema_version` | 固定为 `metaphysics.adapter-task.v3`。 |
| `capability_manifest_schema_version` / `capability_manifest_version` | 使用通用能力选择层时冻结本轮能力清单版本；旧生产者可省略。 |
| `provider_id` / `provider_type` / `provider_record_version` / `execution_profile` | 使用通用能力选择层时原样透传已解析的 provider 绑定；`method-v4` 必须与方法记录一致。 |
| `question_id` / `method_id` / `capability_id` | 与问题包和活动清单一致。 |
| `manifest_schema_version` / `manifest_record_version` | 冻结 execution profile 引用的类型清单与具体记录版本；`method-v4` 中明确指方法清单和方法记录。 |
| `subquestion` / `goal` | 该方法独立负责的一个问题与现实目标。 |
| `answer_scope` | 原样透传 `subject_ref`、`proposition_id`、命题原文、领域标签、规范时间尺度与 `target_window`。 |
| `known_context` | 只传相关且带来源状态的资料；时间相关分支传原始民用时间、本次口径，以及该口径要求的真太阳时与换算来源。 |
| `method_inputs` | 只传当前能力所需字段，并保留未知。 |
| `source_result_schema` | 固定为 `metaphysics.standard-child.v1`。 |
| `target_result_schema` | 固定为 `metaphysics.adapter-result.v3`。 |

组合分支互相看不到结果；不得要求一个子 Skill 评论、修正或迎合另一方法。

## 标准子结果

活动子 Skill 原生返回 `metaphysics.standard-child.v1`，必填字段为：

- `schema_version`、`method_id`、`skill_name`、`status`
- `question_answered`、`applicable_time_scale`
- `claims[]`、`findings`、`basis`
- `assumptions_and_uncertainty`、`limitations`、`follow_up_needed`
- `method_payload`

子状态只使用 `ok`、`insufficient_input` 或 `error`。`method_payload` 保存完整方法原生内容且只出现一次；不得另设第二份原生载荷。`ok` 结果至少包含一项 claim，非 `ok` 结果的 `claims[]` 必须为空。

`question_answered` 是字符串；`findings`、`basis`、`assumptions_and_uncertainty`、`limitations` 与 `follow_up_needed` 都是字符串数组，没有内容时为空数组。`method_payload` 是 JSON 对象；尚未执行或执行失败时为 `null`。不得把完整原生载荷复制进任一摘要数组。

`applicable_time_scale` 只使用方法清单顶层登记的规范值：`structural`、`multi_year_stage`、`annual_cycle`、`bounded_event` 或 `unknown`。具体日期、农历周期、阶段边界和观察期限保留在分派 `answer_scope.target_window`、结构化适配 `time_scope` 与 `method_payload` 中，不塞入该枚举字段。

每个 `claims[]` 元素必须包含：

| 字段 | 约束 |
| --- | --- |
| `claim_id` | 当前子结果内唯一。 |
| `proposition_id` | 路由调用时原样透传；直接调用时由子 Skill 建立。 |
| `subject_ref` | 与分派对象一致。 |
| `statement` | 能独立理解的单一结论，不扩写成用户未问的事实。 |
| `direction` | 只用 `supportive`、`cautionary`、`mixed`、`neutral` 或 `unknown`。 |
| `conditions[]` | 结论成立所依赖的条件；没有则为空。 |
| `applicable_time_scale` | 使用清单登记的规范时间尺度，并与该结论实际覆盖范围一致。 |
| `basis_refs[]` | 指向 `method_payload` 中支持该结论的可定位字段路径；无法定位时为空。 |

`claims[]` 是综合层的唯一结论来源；路由不得从 `findings` 或 `method_payload` 再抽取新结论。若标准子结果缺字段、方法标识不一致或状态超出枚举，该分支按契约不兼容处理。

## 路由适配结果

路由把标准子结果规范化为 `metaphysics.adapter-result.v3`，不得改写其语义：

- 将顶层 `schema_version` 设为 `metaphysics.adapter-result.v3`，并把来源值原样记录为 `source_schema_version: metaphysics.standard-child.v1`。
- 除顶层版本标识外，原样复制全部标准字段及 `claims[]`。
- 增加 `capability_id`、`reason_code`、`input_readiness`、`question_requested`、结构化 `answer_scope`、`time_scope`、`coverage`、`comparison_units`、`versions` 与 `provenance`。
- 使用通用能力选择层时，`versions` 原样保留能力清单 schema／内容版本、provider 绑定版本与 execution profile；不得仅保留方法清单版本而丢失上层绑定。
- `input_readiness` 使用 `ready`、`conditional`、`not_ready` 或 `not_applicable`；`coverage` 使用 `complete`、`partial` 或 `none`。
- `method_payload` 精确保留一次，不再嵌套完整子封装，也不新增第二份原生载荷。

路由可以为没有执行的分支生成 `unsupported` 或 `unavailable` 适配结果；此时 `claims[]` 为空、`method_payload` 为 `null`，并填写稳定 `reason_code`。已执行子分支的状态只来自标准子结果。

路由生成结果没有来源子封装时，`source_schema_version` 为 `null`。常用 `reason_code` 只使用 `unsupported_method`、`unsupported_capability`、`method_inactive`、`skill_not_loaded`、`runtime_dependency_unavailable`、`missing_required_input`、`execution_failed`、`contract_incompatible` 或 `result_unusable`；新增代码须先升级契约词汇。

结构化 `time_scope` 由 `applicable_time_scale` 与分派 `target_window` 组成，只使用分派范围和子 Skill 明确返回的信息。无法可靠规范化时将窗口设为 `kind: unknown`；若返回范围与分派范围矛盾，保留子结果并标记契约不兼容，不静默覆盖。

## 独立执行与比较

每个标准 claim 原样形成一个 `comparison_unit`，保存 method、claim、subject、proposition、direction、conditions、规范时间尺度、分派目标窗口与 basis refs。不得从自由文本生成额外单元。

两个单元只有同时满足以下条件才可比较：`subject_ref` 与 `proposition_id` 相同；条件不互斥；规范时间尺度相同；结构化目标窗口兼容；方向均不是 `neutral` 或 `unknown`。窗口兼容只按以下确定性规则判断：两个 `unbounded` 可比较；两个 `cycle` 仅在非空 `cycle_ref` 完全相同时可比较；两个 `interval` 仅在 calendar、boundary_system、所需 timezone 兼容且规范化起止相同、重叠或一方包含另一方时可比较。`unknown`、不同 kind、缺少必要边界，或只能依赖 `raw_text` 时均标为不可比较。然后使用：

| 标签 | 条件 |
| --- | --- |
| `consistent` | 可比较，且方向相同或都为 `mixed`。 |
| `conflict` | 可比较，且一方 `supportive`、另一方 `cautionary`。 |
| `complementary` | 对象与命题相容、回答层面不同且方向不冲突。 |
| `not_comparable` | 任一可比较条件不满足，或方向关系无法确定。 |

不要投票、平均、挑选更讨喜的一方，也不要把一致解释成事实概率、准确率或可信度提高。冲突必须保留双方条件；无法解释时明确未解决。

## 失败与降级

| 情况 | 分支结果 | 总体处理 |
| --- | --- | --- |
| 未登记、停用、退役或能力不适配 | `unsupported` | 说明未接入或不适配，不模拟。 |
| 活动能力未加载或依赖不可用 | `unavailable` | 用户点名时不自动替代。 |
| 缺少阻塞输入 | `insufficient_input` | 只询问去重后的最少字段。 |
| 执行失败 | `error` | 保留简短原因，不自行复算。 |
| 版本、字段或标识不兼容 | `error` + `contract_incompatible` | 不进入综合。 |
| 部分分支可用 | 成功分支保持原状态 | `overall_status: partial`，只呈现仍独立有用的结果。 |
| 没有可用分支 | 各自保留原因 | 以阻塞整个请求的主要原因返回，不压成虚假统一原因。 |

`unsupported`、`unavailable`、`insufficient_input` 与 `error` 不得互换；`partial` 只用于总体覆盖度，不是子 Skill 状态。

## 上下文复用

- 复用同一对话中已确认的对象、目标、资料来源、时间范围与方法偏好，避免重复询问。
- 资料保留原来源状态；近似值和未知项不会自动变成确定值。
- 真太阳时结论只复用其已冻结的换算来源与参数；原始民用时间不得在要求真太阳时的后续分支中冒充计算时刻。梅花等允许多口径的方法复用已冻结的 `time_basis`，不在看到结果后切换。
- 用户的新确认或纠正替换同一字段的旧值，并记录被替换值不再用于本轮分派。
- 子 Skill 结果不得回填为现实事实或成为另一子 Skill 的输入依据。
- 对象改变时建立新的 `subject_ref`；命题或期限实质改变时建立新的问题单元和 proposition_id。
- 只复用完成当前任务所需的资料。

## 版本兼容

- 当前对象版本为 `capability-manifest.v1`、`query-envelope.v2`、`method-manifest.v1`、`route-plan.v3`、`adapter-task.v3`、`standard-child.v1`、`adapter-result.v3` 与 `route-output.v4`。
- 增加不改变语义的可选字段可以保留主版本；改变必填字段、状态或字段语义必须升级主版本。
- 来源结果只接受清单明确登记的主版本。未知格式、未知主版本或字段相似的旧返回不得猜测升级。
- method、invocation、计划、记录版本与返回不一致时标为 `contract_incompatible`。
- 只记录子结果实际披露的算法、profile、历法或原生载荷版本；清单支持范围不能冒充本次执行版本。

## 交付结构

内部交付使用 `metaphysics.route-output.v4`：

1. `schema_version`：固定为 `metaphysics.route-output.v4`。
2. `route`：kind、选定方法、能力角色、覆盖与省略单元；kind 使用 `single`、`combined`、`none`、`unsupported` 或 `needs_input`。
3. `overall_status`：`ok`、`partial`、`insufficient_input`、`unsupported`、`unavailable` 或 `error`。
4. `why`：说明问题形态、时间尺度与输入如何支持选择。
5. `method_status` / `method_results`：保存各分支状态、适配结果、范围与不确定性。
6. `comparison`：只保存基于 claims 的关系标签、单元标识与依据。
7. `reality_context`：与传统方法解读分层保存的现实资料。
8. `open_questions`：只保留会实质改变下一步的未知信息。
9. `output_mode`：本轮呈现深度。

计划 `selected` 按方法数量映射为 `single` 或 `combined`；其余映射为同名 kind。`none` 的总体状态为 `ok`，`needs_input` 的总体状态为 `insufficient_input`，`unsupported` 的总体状态为 `unsupported`。

`brief` 给出主要结论和下一步；`standard` 说明选择、分支结果、可比较关系与关键未知；`research` 再增加来源状态、协议版本、候选敏感性和可审计依据摘要。呈现深度不改变方法边界和不确定性。对 `none` 直接回答请求；对 `unsupported` 只把活动方法列为不等价选择。除非用户明确要求协议审阅，不展示内部 schema、reason code、完整 route 对象或 method payload。
