# 协议迁移与回滚

算法与原生结果保留：numbers-v2、lunar-time-v2、cast-meihua/result-v2、八字 schemaVersion 1.0.0、ziwei.input.v2、ziwei.facts.v2 及原安星 profile。单方法标准结果继续 metaphysics.standard-child.v1。

新增个案、时间、执行记录和 bundle v1；method-v5 使用 route-plan.v4、adapter-task.v4、adapter-result.v4、route-output.v5。变化是必须有冻结绑定和执行证据，比较窗口更严格，隔离及请求覆盖可检查，而非改变术数算法。

本候选内部默认入口为受控 runner / method-v5，旧原生 CLI 保留为开发复现用途。基线 v4 编排文档保存在 docs/history 和原始快照；新运行入口不并行启用第二条同事件取数路径。

旧记录只读视为 imported_unverified。能解析旧 JSON 不证明过去执行，不能编造旧 run_id 或时钟。重新核验须同输入明确记录为本次执行，非回填历史。未知 schema 不猜测。

若串案、事实篡改、来源升级或隐私问题被发现，暂停受影响路径，保留历史与失效标记。回滚只替换运行代码，不删除案例、不强写旧格式，也不重新启用已知错误结果。新版本源码锁变化会拒绝复用旧结果用于新解释；需要明确迁移或只读审阅。

持久化状态不在包内，备份/删除需用户授权。本地 HMAC 不是加密或远端证明。事件纠错保存旧记录、更正依据和新关联；文本更正不重新起卦。