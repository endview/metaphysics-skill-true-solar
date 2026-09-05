# 使用说明

## 单方法

复制或导入对应 skill.zip 后，让宿主读取 SKILL.md。运行 `node scripts/run-verified.mjs` 并保持进程存活。按 JSON-lines 依次发送 subject、event、open、compute、facts_draft、knowledge、finalize、deliver。所有 case/task/对象/命题标识使用工具返回值。

开发者可直接导入该包 profile 和 `_runtime/session-host.mjs`，创建 ReviewSession 并调用 handle；不要向主路由复制算法。合成测试展示完整字段和两阶段过程，位于开发工程 tests/integration，正式包中不附示例个案。

普通一次性结构审阅可 `--once` 调用 review；重复同 request_id 只有在同会话或已授权同一状态区中才去重。传统咨询不能用 review 的事实输出冒充解释完成。

## 多方法

`node scripts/route.mjs --method-root bazi /实际八字目录 --method-root ziwei /实际紫微目录 --method-root meihua /实际梅花目录`。路径由宿主登记，不来自咨询文本。保持这个路由进程，发送 plan/run；随后 branch_context 取得单个分支的知识与事实，模型完成草稿后 finalize_branch。

原生计算可以都成功，但默认本地主机不能证明模型独立。此时会完整展示各单项结果，组合状态保持 blocked_isolation，不强行统一。具备独立模型上下文的宿主需实现并验证真实分派/回执/隔离适配器，再做形式比较。

## 来源与更正

已确认真太阳时无需重复确认，但仍保留 user_declared；外部资料自报 tool_verified 不被包装器当成独立核验。紫微缺出生日期不能只凭八字反推；缺资料时该分支仍未完成。

解释错误只改 draft；修改期限/方法提出 change_request，不自动重起。补充现实信息使用 observe，解释版本通过 interpretation_history 读取。新周期或有证据的输入更正走 related_case。

## 隐私

默认所有咨询状态仅在进程内。只有明确授权后使用 `--state-dir` 与 `--authorize-storage`，目录必须位于包外且私有。不得上传咨询状态到 GitHub、CI 或知识卡。源码 ZIP 内所有夹具均为合成工程用例。
## 缺输入分支的续接

未执行且预检未通过的分支可通过 `supply_input`（route_id、method、input）补齐；随后 `resume`（route_id）继续。已成功计算或已经发生原生执行失败的分支不能走这条捷径改输入。已完成分支保留原 run_id，不重新排盘；解释草稿仍使用 finalize_branch。单方法 open 在预检成功前不冻结事件，因此补全资料不会被误当成重起。
