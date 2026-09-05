# 方法清单维护

[机器可读清单](method-manifest.v1.json)是方法能力、输入要求、适配契约与组合政策的唯一权威来源。本文件只解释维护规则，不重复保存具体方法记录；运行时方法选择直接读取 JSON。

## 记录结构

每个 `methods[]` 元素完整声明：

| 字段 | 约束 |
| --- | --- |
| `method_id` | 稳定方法标识；发布后不得改变原含义。 |
| `record_version` | 该记录的语义版本。能力、输入或结果契约发生不兼容变化时升主版本。 |
| `display_name` | 面向用户的方法名称。 |
| `invocation` | 当前实际可调用的子 Skill；不能由相似名称替代。 |
| `lifecycle_status` | 只用 `active`、`disabled` 或 `retired`，仅表示静态登记状态。 |
| `domain_scope` | 方法自身覆盖范围；不是按领域硬编码的路由规则。 |
| `capabilities[]` | 每项声明 `capability_id`、`question_shapes`、`time_scales` 与 `orchestration_role`。 |
| `input_requirements` | 分开记录可替代输入方案、各方案的 `ready`/`conditional` 就绪度、机器可读运行依赖、条件字段及交由子 Skill 判断的事项。 |
| `exclusions[]` | 该方法不覆盖的问题形态或时间尺度。 |
| `adapter_contract` | 声明来源 schema、来源状态、目标 schema 与规范化器。 |
| `combination_policy` | 声明能否组合、是否独立执行、职责与重叠组。 |

顶层 `question_shapes`、`time_scales`、`exclusion_codes`、`runtime_dependencies` 和 `readiness_checks` 是规范词汇表。`time_basis_policy` 是所有需要出生时刻、起卦时点、时辰、换日或节气边界的方法共同前置契约。领域标签保持开放；除非新增方法无法由现有问题形态表达，否则不要扩充词汇表。

## 方法级时间口径

- 民用时间始终可以作为原始输入。八字、紫微以及未来六爻的时辰计算要求真太阳时；缺失时进入 `needs_input`，先补地区／经度或让用户提供换算结果，不得标为 `error` 或静默用民用时计算。
- 八字与紫微使用 `resolution_status`／`verification_status` 状态模型；已解析结果可为 `tool_verified` 或 `user_declared`。工具核验所需的 provider、profile、版本、访问日期或参数由各方法 profile 分别规定，不能从另一方法照抄。主 Skill 不自行编造近似换算。
- `resolved` 可直接使用；`candidate_set` 必须保留全部合理候选并按方法契约分别处理；`unresolved` 通过 `follow_up_needed` 等待补充。
- 梅花易数按 input profile 接受 `civil` 或 `true_solar`。民用时是正式口径，不是失败后的回退；真太阳时 profile 要求地点、经度与 `conversion_source`，但不使用八字／紫微的 resolution／verification 状态枚举。
- 已有命盘或卦例的时间口径与方法 profile 不一致时，只进入不依赖时刻的局部结构检查。任何新方法必须复用顶层状态词汇或显式升级清单协议。

## 运行时语义

- `active` 只代表该方法可进入候选集，不代表本轮已经加载或依赖一定可用。
- 分派前检查 invocation、记录版本、来源 schema 与方法所需运行依赖。
- 能力没有登记或不适配时由路由生成 `unsupported`；能力已登记但本轮不能调用时由路由生成 `unavailable`。
- 子 Skill 自身只返回其来源契约允许的状态；路由不得要求子 Skill 伪造运行时可用性状态。
- 清单记录与当前 Skill 元数据不一致时，按契约不兼容处理，不猜测映射。

## 新增或更新方法

1. 先确认存在真实可调用的子 Skill，并定义稳定的 `method_id`。
2. 在 JSON 中新增或更新一条完整方法记录，不在主 `SKILL.md` 增加方法专属分支。
3. 复用现有问题形态与时间尺度；只在确有新语义时升级清单协议。
4. V4 下新增活动方法必须原生实现 `metaphysics.standard-child.v1`，并明确状态枚举与规范化器；异构来源 schema 需要先升级编排并实现真实规范化器，不能只登记名称。
5. 明确组合职责和重叠组，使路由能够选择最少、非重复的方法集合。

只在新方法复用现有问题形态、时间尺度、运行依赖词汇与共同子结果契约时，新增一条方法记录即可接入；出现新语义或异构协议时必须先升级对应词汇或编排实现。停用方法时保留记录并设为 `disabled`；永久退出自动选择但仍需兼容历史引用时设为 `retired`。两者都不得参与自动候选过滤。

## 版本规则

- 顶层 `schema_version` 标识清单结构；`manifest_version` 标识本次清单内容版本。
- `time_basis_policy` 是 schema v1 的向后兼容扩展字段；从 `manifest_version: 3.x` 起，本路由将其视为必需内容并在缺失时 fail closed。不了解清单内容主版本 3 的旧消费者必须停止，不能忽略该政策继续执行。
- 增加不改变既有语义的可选字段可以升次版本；修改必填字段、枚举或既有字段语义必须升主版本。
- 每个方法的 `record_version` 独立演进；路由计划必须冻结本轮实际使用的记录版本。
- 遇到未知主版本、缺失必填字段或 method、invocation、schema 不一致时，停止该分支，不自动回退到相似方法或旧解释。
