---
name: cast-meihua
description: "以民用时或已解析真太阳时和可复现、版本化协议执行并解释梅花易数起卦，支持农历时起卦与两数／三数起卦。仅当用户明确要求单独使用梅花易数、梅花起卦／占卜、明确调用 $cast-meihua，或由 $metaphysics 明确分派到梅花易数时使用；同时点名多个玄学方法、要求组合／综合分析或未指定方法时交由 $metaphysics 编排。不要因泛泛提及运势、出生资料、八字、易经、占卜或决策建议而自动使用。"
---

# 梅花易数起卦

把起卦当作版本化、可复核的象征性反思工具，不把它当作事实侦测或概率模型。

## 固定个案

在计算前确认并复述以下项目；缺一项就先询问，不要先起卦后补条件：

1. 一个具体问题。把复合问题拆开，只为当前明确问题起一卦。
   对二选一、成本阈值或事件是否成立的问题，同时冻结选项定义、判定标准和用户自己接受的阈值；缺失时先询问，不要在看到卦象后替用户发明。
2. 观察期限、应期单位，以及应期规则：默认使用 `stage-within-horizon-v1`，需要明确计数时可选 `moving-line-count-v1`。如果用户未指定，先提出一个适合期限的建议并取得确认；不得看到卦象后再更改。
3. 起卦前冻结 `time_basis` 为 `civil` 或 `true_solar`。民用时口径冻结带偏移时点与 IANA 时区；真太阳时口径另冻结地点标签、经度（东经为正、西经为负）、无偏移的连续真太阳钟面，以及可靠换算工具／服务的名称、版本或结果引用。即使数字起卦不以时间计算，也记录所选口径的完整上下文。
4. 方法：`lunar-time-v2` 或 `numbers-v2`。数字法还要固定恰好两个或三个正整数。

未指定口径时建议使用 `civil` 并在起卦前明确复述；不得看到卦象后切换口径。`civil` 可使用指定时点或 `--now`，后者运行后立即以输出时点冻结。`true_solar` 不接受 `--now`：先取得原始民用时，再由可靠外部来源解析真太阳钟面；脚本不内置或临时编写太阳时近似公式。缺少换算结果、来源、地点或经度时返回 `insufficient_input`。如果来源给出多个换日或时支边界候选，先列出并冻结一个；无法确定时不要执行脚本。

纯梅花易数不需要出生日期、出生时辰、出生地点、性别或姓名。不要索取这些资料；用户主动提供时，说明本方法不使用它们并忽略。

## 执行计算

计算前读取 [references/protocol.md](references/protocol.md)，不得凭记忆替换算法。

农历时起卦，使用民用时：

```bash
node scripts/cast_meihua.mjs \
  --method lunar-time-v2 \
  --question QUESTION \
  --horizon HORIZON \
  --timing-unit UNIT \
  --timing-profile stage-within-horizon-v1 \
  --time-basis civil \
  --datetime RFC3339_CIVIL_DATETIME \
  --timezone IANA_TIMEZONE \
  --pretty
```

如以当前民用时起卦，以 `--now` 取代 `--datetime`。使用真太阳时：

```bash
node scripts/cast_meihua.mjs \
  --method lunar-time-v2 \
  --question QUESTION \
  --horizon HORIZON \
  --timing-unit UNIT \
  --timing-profile stage-within-horizon-v1 \
  --time-basis true_solar \
  --civil-datetime RFC3339_CIVIL_DATETIME \
  --true-solar-local-datetime LOCAL_TRUE_SOLAR_DATETIME \
  --timezone IANA_TIMEZONE \
  --location LOCATION_LABEL \
  --longitude DECIMAL_DEGREES_EAST \
  --conversion-source SOURCE_AND_VERSION_OR_RESULT_REFERENCE \
  --pretty
```

数字起卦沿用相同的时间口径参数；以下为民用时写法：

```bash
node scripts/cast_meihua.mjs \
  --method numbers-v2 \
  --numbers N1,N2 \
  --question QUESTION \
  --horizon HORIZON \
  --timing-unit UNIT \
  --timing-profile stage-within-horizon-v1 \
  --time-basis civil \
  --datetime RFC3339_CIVIL_DATETIME \
  --timezone IANA_TIMEZONE \
  --pretty
```

民用时的 `--datetime`／`--civil-datetime` 必须是带 `Z` 或显式偏移的 RFC 3339 时点，且钟面字段与 IANA 时区一致。`--true-solar-local-datetime` 固定使用无偏移的 `YYYY-MM-DDTHH:MM:SS`；它是连续太阳钟面，不是物理 instant，也不按 IANA 夏令时缺口验证。农历时法只使用所选口径的当地日期与小时；数字法不以时间取数，但保留所选时间上下文。

只使用脚本返回的原始值、中间值和卦象。不得手动“修正”不合预期的余数、卦名、爻序或派生卦。脚本失败时停止解读并报告错误；由主路由分派时返回 `status: error`，不要换一种算法静默重算。

## 解读与交付

解读前读取 [references/interpretation.md](references/interpretation.md) 和 [references/output-contract.md](references/output-contract.md)。

按以下顺序交付：

1. 冻结的个案条件、时间口径与协议版本；真太阳时分支另列地点、经度和换算来源。
2. 可复核计算摘要，包括原始值、算式、原始余数、余零映射、Node／ICU 版本；完整脚本 JSON 只在标准子结果的 `method_payload` 中保留一次，仅在用户要求时全文展示。
3. 本卦、上下卦、六爻（自下而上）、动爻、变卦、互卦、错卦、综卦、体用与五行关系。
4. 依参考文件中的优先级给出简洁、条件式的象征性解读。
5. 明示观察期限、固定应期单位与规则及认识限制。

无论直接调用还是由主路由分派，都按 `metaphysics.standard-child.v1` 生成标准子结果。直接调用时为当前问题建立局部 `q1`／`p1` 标识；由主路由分派时原样透传其 `proposition_id`。具体字段与 `claims[]` 规则见输出契约。

同一问题与同一期限只起一次。结果不合期待、措辞不悦或用户想“再确认”都不是重起理由；改问法但实质相同也视为同一问题。只有问题实质改变、期限届满，或先前输入／计算确有可证明的错误时，才建立新的个案并说明原因。
