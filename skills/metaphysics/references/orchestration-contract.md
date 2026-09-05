# method-v5 编排契约

项目候选版本 0.1.0-rc.1；实现已提供，生产/模型矩阵验收不因协议名而自动通过。既有原生算法及 `metaphysics.standard-child.v1` 不变。

## 输入

`plan` / `run` 接收 `{op,input}`。input 必填 `request_id,subject_ref,event_ref,proposition_id,question,criteria,methods,inputs`。methods 保留明确请求顺序；inputs 按方法键给出 `analysis_scope,window,method_inputs` 及必要 `time_request`。普通用户不能控制脚本入口或注册新 provider。

计划输出 `metaphysics.route-plan.v4`，任务为 `metaphysics.adapter-task.v4`；每项含路由、case/revision/task、对象/事件/命题、冻结问题、标准、范围、时间、profile 与方法输入。所有任务在首个分支结果前冻结。

## 分派、续接与证明

宿主接口：`methodCapability,capabilities,clock,dispatch,verifyInvocation`；需要传统草稿续接时实现 `finalizeBranch`。这些是程序化宿主方法，不采信用户 JSON 自称的观察等级。每次返回结果附带宿主保存的任务/结果摘要回执。独立比较还需宿主 `verifyIsolation(tasks,receipts)` 和真实独立模型上下文证据。

本地适配器只导入宿主登记的子包 profile 与 ReviewSession，由各包 VerifiedRunner 启动真实原生子进程。主包不含方法算法。它诚实声明 `branch_isolation:unavailable`，不是远程认证服务或安全沙箱。

`branch_context` 的入参是 `route_id,method`，返回该分支计算载荷、事实草稿、知识卡和执行记录。`finalize_branch` 另传 draft；必须保持原 `run_id`、输入及绑定，成功后重新整理总结果但不重算原生算法。同一 request 再次 run 返回已有结果。

## 输出

适配结果为 `metaphysics.adapter-result.v4`，只保留一份 `method_payload`，附绑定、执行引用、验证及主张来源。总结果为 `metaphysics.route-output.v5`，含原请求、已完成清单、未完成状态、隔离/比较状态、结果、回执引用、限制和复用标记。

只有子解释 finalize 后才进入完成清单。缺解释仍为 `interpretation_required`，非静默成功。缺方法显示 unavailable，未注册方法 unsupported，缺输入 insufficient_input，执行/契约错误 error。总体部分完成不写进标准子状态。

形式一致/冲突要求相同对象、事件、命题、标准、时间尺度、窗口及条件，且两边都是传统解释而不是计算事实；只对明确 supportive/cautionary 方向比较。没有经验证的独立模型上下文，不运行形式比较。共同目标但不同层面可提示互补，不构成预测证据。

## 迁移与安全

旧 method-v4、task/result v3、route-output v4 只读保存；不添加伪造执行记录升级。用户上传载荷是未验证导入，不可自行进入本地已发行回执表。遇到未知版本拒绝猜测。

默认个案仅当前路由会话。会话丢失明确去重范围；不以新 request_id 绕过同事件冻结。主路由不处理秘密、不联网获取出生资料，也不替子方法补造缺失盘面。
## 缺输入分支的续接

未执行且预检未通过的分支可通过 `supply_input`（route_id、method、input）补齐；随后 `resume`（route_id）继续。已成功计算或已经发生原生执行失败的分支不能走这条捷径改输入。已完成分支保留原 run_id，不重新排盘；解释草稿仍使用 finalize_branch。单方法 open 在预检成功前不冻结事件，因此补全资料不会被误当成重起。
