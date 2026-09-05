# 可靠执行协议

本文件规定当前候选实现的正式调用路径。原生 CLI 仅供开发与历史复现，不绕过本流程用于新咨询。算法协议不变；新增包装层不提升原始资料的真实性或传统术数的现实预测效度。

## 会话入口

在当前 Skill 目录启动 `node scripts/run-verified.mjs`。标准输入按行发送 JSON，每行返回一个 `metaphysics.session-response.v1`；同一个进程保存会话。宿主应维持该进程或程序化持有 `ReviewSession`，不能每问一句就另开无状态进程再宣称已经去重。单次调用可用 `--once`。

默认不写咨询记录。只有用户明确授权后，使用 `--state-dir <包外目录> --authorize-storage`。目录使用私有权限，状态经原子写入与本地 HMAC 检查；这不是宿主认证或加密存储。状态不可读、锁残留、会话丢失时停止自动重起并说明去重边界。不要把资料写入 Skill、测试、公开仓库。删除记录使用 `AuthorizedStore.deleteState({confirm:true})`；保留或删除整个私有目录由用户决定。

## 最短调用链

1. `subject`：给出 `label`，返回对象标识。标签不是现实身份，不能根据同名自动复用。
2. `event`：给出对象标识、标签及 `relationship:{reason:...}`。仅独立的新事件新建；改措辞、换数字、改期限不是新事件。
3. `open`：`input` 包含对象、事件、命题、问题、判断标准、`analysis_scope`、`window`、本方法 `method_inputs`；梅花还含 `time_request`。返回冻结的 case 与 task。输入完整即执行，不机械重复要求“开始”。
4. `compute`：发送 `case_id`、`task_id`。保存执行引用与原生载荷；成功结果复用。技术重试需 `retry_reason`，仍用原冻结输入。
5. `facts_draft` 和 `knowledge`：取得固定事实草稿及本分支匹配知识卡。事实块不得手工改名、改数字、改时辰。知识卡不全就缩小解释，不凭记忆补成“库内依据”。
6. 模型在草稿 `claims` 添加 `traditional_interpretation` 主张：唯一 `claim_id`、原样 `binding`、条件式 `text`、`direction`、指向本载荷的 JSON Pointer `basis_refs`、实际返回的 `knowledge_card_refs`。同时写出 `conditions` 和 `counter_reading`；引用卡中反证和不可推断边界。
7. `finalize`：发送 case、task、draft。校验失败只改草稿，不调用新计算。成功返回唯一 `child_result.method_payload`、执行引用、固定事实块和校验记录。
8. `deliver` 标记交付；`interpretation_history` 读取解释修订史。`observe` 单独保存现实信息及来源，不改原预测。

`review` 是仅审阅计算事实的便捷入口：需明确 `new_event:true` 和区别理由，重复同一 `request_id` 复用结果。它不自动生成传统解释，不允许以事实审阅冒充用户要求的完整咨询。路由分派用 `dispatch`，保持外部 case/task/subject/proposition 标识不变。

## 字段与范围

`window` 使用 `interval` 或 `cycle`。前者含原文、来源、带偏移起止时点、IANA 时区、包含边界、历法、边界 profile；后者含原文、来源、周期 ID、历法、边界 profile、精度。分钟输入可内部补零秒，但原精度不升级。历史指定时间不能用当前日期覆盖；`now` 只由宿主在冻结前读取一次。

八字/紫微：`structural_review` 仅事实；`traditional_structure` 为本命传统解释；`annual_cycle`、`multi_year_stage` 为明确给定的年运与阶段。梅花：`calculation_review` 仅事实；`symbolic_event` 为固定观察期的象征解释。未登记的流月、流日、流时和隐藏事实探测一律不模拟。

`binding` 由工具生成，勿拼造。标准子结果保留 `metaphysics.standard-child.v1` 和 `ok/insufficient_input/error`。生命周期状态、解释待完成、能力不可用不混写为子结果成功。

## 解释边界

计算事实、传统解释、现实事实、行动建议分开。传统主张需知识卡与计算依据；现实信息通过 `observe` 获得 `observation_ref` 后引用。不得断定他人隐藏思想、失物精确位置、隐藏故障、疾病、必然成败或经验百分比。卡片的 `reviewed` 仅表示来源与契约整理，不表示科学证实或外部人工认证。字符串规则只能拦截部分明显越界；语义仍需模型审阅、行为矩阵和独立复核。

`stage-within-horizon-v1` 只输出与动爻对应的相对阶段，不细化日期；计数 profile 必须保持预先固定单位、锚点和窗口。遇到相反候选、缺分支或不可比较窗口，原样保留，不投票。

## 纠错

`change_request` 对解释、期限、方法、输入和现实信息分别给出处理路径，不自动重算。`related_case` 仅允许有原因和证据的纠错，或期限已结束且已复盘的新周期；保留旧结果与失效理由。转述错误修复事实块，不是重新起卦。

## 运行能力

本包可读取资源并运行 Node 计算器；不自动安装依赖，不联网、不索取密钥。默认本地观察级别是 `local_runner_observed`，不是自证的 `host_observed`。当前没有已认证的外部真太阳时转换器。用户声明不能因执行成功升级成独立核盘。VM 和摘要不是安全沙箱或执行真实性证明。

完整命令、合成用例、测试和模型验收资产位于开发工程；不放进正式 Skill 包。