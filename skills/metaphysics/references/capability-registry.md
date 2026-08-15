# 能力清单维护

[能力清单](capability-manifest.v1.json)位于具体方法清单和编排协议之前，只登记 provider 类型、execution profile 与具体记录的唯一绑定。它不复制方法能力、输入要求、调用名或生命周期；这些内容继续由绑定的类型 registry 负责。

## 通用记录

每个 `providers[]` 元素包含：

| 字段 | 约束 |
| --- | --- |
| `provider_id` | 平台内稳定且唯一的 provider 标识。 |
| `provider_type` | 必须来自顶层 `provider_types`。 |
| `record_version` | 该通用绑定的语义版本。 |
| `execution_profile` | 必须来自顶层 `execution_profiles`，并支持当前 provider 类型。 |
| `record_ref` | 指向具体 registry 中唯一记录，不在本清单复制该记录内容。 |

`record_ref` 完整声明 `manifest_path`、`manifest_schema_version`、`collection`、`id_field` 与 `id_value`。解析结果必须恰好一条，并满足：

- 引用文件存在，schema 主版本受支持。
- 引用记录的稳定 ID 与 `provider_id` 一致。
- provider 类型处于 `active`，引用记录也处于可执行生命周期。
- execution profile 支持该 provider 类型，并与来源结果及编排协议一致。
- 引用的 invocation 对应真实可调用能力；相似名称不能替代。

任一条件不满足时停止该 provider，不猜测路径、字段或旧版本。

## 类型与 execution profile

`method` 当前使用 `method-v4`；其具体记录由[方法清单](method-manifest.v1.json)管理，维护规则见[方法清单维护说明](method-registry.md)。

`knowledge`、`utility` 与 `workflow` 当前仅为 `reserved` 类型，不是隐藏能力，也不能由语言模型临时模拟，或由多个活动方法临时拼装成等价能力。主要交付依赖保留类型时，说明缺口后停止；只有用户明确把请求改成某个活动方法能独立回答的较窄问题时，才进入方法编排。激活任一类型前必须同时具备：

1. 至少一个真实可调用 provider。
2. 版本化的能力、输入和运行依赖记录。
3. 可校验的来源结果契约和规范化路径。
4. 不会伪装其他 provider 类型语义的 execution profile。
5. 明确的独立执行、组合、失败和呈现规则。

如果新类型无法完整复用现有对象语义，先升级编排协议；不要把知识查询、确定性工具结果或工作流输出塞入 `method_id`、`method_inputs`、`method_payload` 等方法字段。

## 新增与更新

1. 先实现并验证真实 provider，再登记绑定；不要加入无调用目标的占位 provider。
2. 优先复用现有 provider 类型；只有职责和结果语义确实不同才新增类型。
3. 在类型 registry 中维护具体能力；通用清单只增加唯一 `record_ref`。
4. 先确认 execution profile 与来源结果契约兼容，再允许进入选择集合。
5. 停用具体 provider 时在类型 registry 中保留记录并改变生命周期；不要删除通用绑定来掩盖历史身份。

## 版本规则

- 顶层 `schema_version` 标识清单结构，`manifest_version` 标识当前内容版本。
- 增加不改变既有语义的可选字段可升次版本；改变必填字段、枚举、绑定解析或 execution profile 语义必须升主版本。
- `record_version` 只描述通用绑定；具体 provider 记录仍有自己的独立版本。
- 新增方法且完整复用 `method-v4` 时，只需新增一条通用绑定和一条方法记录；非方法 provider 不默认具有这种兼容性。
