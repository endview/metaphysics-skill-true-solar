# 原生接入说明：必须先取得固定基线

本文件描述下一步接入动作，不表示这些动作已经执行。

## 先验证源码身份

```bash
node tooling/verify-baseline.mjs /path/to/metaphysics-skill-true-solar
```

工具检查实际 Git HEAD 是否为方案指定提交、工作区是否干净、四个 Skill 入口与原 LICENSE 是否存在，以及跟踪文件是否出现软链接。成功只意味着源码身份检查，不代表原 468 项审计已复现或算法已正确。

## 不猜原生 CLI 或标准子结果

本轮没有读到完整原生脚本，故没有登记 `analyze-bazi`、`analyze-ziwei`、`cast-meihua`，也没有伪造一个通用 CLI 适配器。

`NativeRegistry.register()` 的 profile 必须由已审查代码构造，不能从用户上传 JSON 任意选择命令。关键函数如下：

| 函数 | 接入时必须完成的核查 |
|---|---|
| `preflight(inputs, case)` | 真太阳时来源、候选关联、目标层级、期限、方法参数 |
| `prepareInput(inputs, case)` | 按真实 CLI 协议映射冻结资料，不能重新读取 now |
| `validateNative(output, input)` | 原生 schema、输入回显、枚举、方法专有结构与来源 |
| `factDefinitions(payload)` | 仅声明已校验的事实字段，禁止从自由文本重算 |
| `buildChild(parts)` | 严格遵循原 `metaphysics.standard-child.v1`，原生载荷只放一处 |
| `validateChild(child)` | 原标准子结果的全部字段、状态、来源与版本校验 |

当前进程执行器使用 JSON 标准输入。若原生脚本只支持 CLI 参数，应在对应 Skill 内写固定适配脚本，由该脚本以参数数组调用原生程序，不用字符串拼接 shell；适配脚本和所有依赖必须一同纳入源码摘要。不能把这个接入要求描述成现有原脚本已经支持标准输入。

## 各方法的待办

八字：保留 `inspect_bazi.mjs` 的原生输出和规则表，补齐 `provided_chart_review` 来源分支、候选绑定及解释范围。不能由检查器推导出生历法四柱。

紫微：保留现有 iztro 版本、profile 和分块校验；核实原入口后做预检通过再懒加载。资料不足、vendor 损坏均不得回退民用时或手工造盘。该改动本轮尚未执行。

梅花：保留 `lunar-time-v2`、`numbers-v2` 和 `cast-meihua/result-v2`；核对两数/三数规则、当地日期载体、时辰与取余黄金样例。先复现旧审计，再测试受控入口的个案、窗口和事实渲染。

## 不提前激活

真实适配器完成之前保持空的生产方法登记表。原 `standard-child.v1` 不因为外层候选协议而改名。路由 v5、四个独立包、原算法离线回归和宿主/模型行为矩阵全部通过后，再讨论候选发布与默认 profile 切换。