# 玄学 Skill 可靠执行套件

**版本：v1.1**（工程版本 `1.1.0`）。提供八字、紫微斗数、梅花易数及多方法主路由四个自包含 Skill，包含原生计算、个案与时间管理、解释草稿校验和交付检查。功能与改进见 [更新日志](CHANGELOG.md)，安装包见 [v1.1 发布页](https://github.com/endview/metaphysics-skill-true-solar/releases/tag/v1.1)。

本版本整合 `0.1.0-rc.1` 开发交付源码，公开版本沿用仓库的 v1.0 → v1.1 编号。工程发布与真实模型／宿主生产验收分别记录；后者仍未完成。

## 组成

`metaphysics` 负责 method-v5 编排；`analyze-bazi` 检查给定四柱并承载有限传统解释；`analyze-ziwei` 使用完整保留的 iztro 2.5.8；`cast-meihua` 保留数字法和农历时间法。三条方法均使用计算→模型草稿→校验→标准子结果，不让计算器自动制造预测。

新增内容包括：事件冻结与复用、明确技术重试、对象/事件/命题绑定、时间来源和精度、可选授权包外存储、解释版本史、固定事实块、知识卡、候选关联、源码摘要、输入输出限制和进程超时。紫微改为预检后加载引擎。主路由可接续解释草稿，但本地主机没有独立模型上下文，组合状态会诚实降级。

## 运行与复测

锁定复现环境为 Node.js 22.16.0；测试使用 Node 内置运行器，无 npm 运行依赖。构建需要 Python 3，静态 YAML 校验使用 PyYAML。

```bash
node tooling/sync-runtime.mjs --check
node tooling/verify-complete-baseline.mjs
node tooling/check-skills.mjs
node tooling/test-report.mjs
python tooling/build-skills.py
python tooling/smoke-archives.py
node tooling/release-gate.mjs --local
node tooling/release-gate.mjs
```

最后一个命令是完整生产验收检查：缺真实模型/宿主行为验收时返回非零；旧审计不可逐项复现另列来源警告，该状态独立于 GitHub 工程版本发布。`--local` 只检查当前源码的确定性测试、四包构建和实际 ZIP 冒烟，不覆盖模型质量。

独立包位于 `dist/<skill-name>/skill.zip`。开发源码、测试、合成夹具、日志不进入这些包。每包包含必要运行代码、来源锁、参考、卡片和许可证；主包不包含三个方法的算法。复制单个目录不依赖兄弟目录。入口详情见每包 SKILL.md 和 [使用说明](docs/usage.md)。

## 验证边界

测试报告记录实际数量、Node/ICU/时区版本、源码摘要及命令，不复用旧数字。原始 468 项审计测试源码未取得，新的完整回归覆盖其已描述的卦形和时辰边界维度，但不冒称原审计逐项复现。全部 53 个原始文件已取得并按 Git blob 核对。

没有接入或调用真实模型评测服务；行为矩阵工具和合成验收场景已提供，默认报告 not_run。发布流水线在 Linux、Windows、macOS 上运行工程验证，实际结果以对应提交的 Actions 记录为准；这些测试不代表产品安装认证。没有自动安装到 ChatGPT，没有已审查的外部真太阳时转换器。转换接口在无 provider 时返回未解析，不用近似公式。

知识卡是来源可查的简短传统框架及解释边界，不是事实探测系统。哈希只检查内容变化；HMAC 只约束本地记录；VM 只隔离配置。自然语言检查不能保证识别所有读心或事后拟合。

## 文档与许可证

[运行矩阵](docs/runtime-support.md) · [迁移与回滚](docs/protocol-migration.md) · [验收状态](docs/release-status.md)。`upstream/pinned-baseline` 保留完整基线用于比较，`docs/history` 保留早期文档并明确不是当前状态。

项目为 AGPL-3.0-only。第三方 iztro 及随包归属说明按原许可保留；新知识卡文本是短小原创概括，来源与权利说明在各包 `knowledge/SOURCES.md`。正式包不包含真实咨询资料、姓名、出生记录或密钥。