# GitHub 上传说明（交给 Codex）

本文用于指导后续 Codex 将 `metaphysics-skill-true-solar.zip` 中的项目源码上传到 GitHub。它是操作说明，不代表对任何外部写入的永久授权。

## 一、开始前向用户确认

如果当前对话中尚未明确，请只询问真正缺少的项目：

1. GitHub owner 或 organization；
2. 仓库名称；
3. 新建仓库还是导入既有仓库；
4. 仓库可见性，未指定时建议先使用 `private`；
5. 目标默认分支，未指定时使用 `main`；
6. 是否只推送分支，还是还需要创建 Pull Request；
7. 公开仓库的项目级许可证或授权方式。

不要要求用户在聊天中粘贴 GitHub token、私钥或密码。只使用当前环境已经配置并获准使用的 GitHub 连接或凭据。

## 二、解压与只读检查

先查看 ZIP 清单。解压前必须确认每个条目均为相对路径、不包含 `..` 路径段，也不是符号链接；发现异常时立即停止。确认安全后，使用 `mktemp -d` 建立全新的临时目录再解压：

```bash
unzip -l metaphysics-skill-true-solar.zip
bundle_temp_dir="$(mktemp -d)"
unzip metaphysics-skill-true-solar.zip -d "$bundle_temp_dir"
cd "$bundle_temp_dir/metaphysics-skill-true-solar"
```

压缩包应当只有一个顶层目录 `metaphysics-skill-true-solar/`，并至少包含：

```text
README.md
LICENSE
GITHUB_UPLOAD_GUIDE.md
.gitignore
.gitattributes
skills/metaphysics/
skills/analyze-bazi/
skills/analyze-ziwei/
skills/cast-meihua/
```

上传前确认：

- 四个 Skill 均存在有效的 `SKILL.md`；
- 每个 Skill 引用的脚本、资源和 reference 都位于自身目录；
- 没有嵌套 `.git/`、符号链接、路径穿越项或未知文件；
- 紫微斗数包的 `scripts/vendor/`、manifest 与许可证文件完整；
- 仓库根目录的 `LICENSE` 是项目所有者明确选择的 AGPL-3.0，且不覆盖紫微斗数包内的第三方许可；
- README 和本上传说明只位于仓库根目录，没有被复制进 `skills/*`；
- 不把 ZIP 本身提交进源码仓库，除非用户另行明确要求将其作为 GitHub Release 附件。

## 三、上传前必须拦截的内容

发现以下任一内容时，立即停止，不上传，也不要自行删除后继续：

- 真实姓名、出生日期、出生时间、出生地点、命盘、问事内容、联系方式或聊天记录；
- API key、GitHub token、SSH／私钥、cookie、session、云凭据、`.env` 或本机认证配置；
- 真实案例、测试用例、fixture、测试报告、运行日志、调试转储、截图或临时验证产物；
- `.git/`、`__MACOSX/`、`.DS_Store`、IDE 配置、缓存、虚拟环境、`node_modules/` 或构建目录；
- 内部安装目录 ID、Codex 会话内容、系统指令转储或绝对工作区路径；
- 未核权的第三方知识库、现代整理文本或其他来源不明的大段语料。

秘密扫描只报告文件路径和风险类型，不要把疑似密钥正文打印到终端回传或聊天中。

抽象、无个人信息的调用示例可以保留在仓库根 README 中，但不得作为 Skill 运行内容或测试材料放进 `skills/*`。

## 四、校验项目

在不修改项目内容的前提下完成以下检查：

1. 使用当前环境的 Skill 校验工具检查四个 `skills/*` 目录；
2. 解析全部 JSON 与 YAML；
3. 对全部 `.mjs` 执行语法检查；
4. 检查 Markdown 本地引用不存在断链；
5. 确认 `skills/*` 内不存在测试、fixture、示例、用户资料和日志目录；
6. 核对时间口径契约：八字／紫微缺真太阳时时返回可补充输入，梅花同时支持冻结的民用时与真太阳时，任何方法都不静默切换；
7. 查看 `git diff --check` 或等价空白检查；
8. 核对最终文件清单，只允许本项目声明的文件。

校验产生的临时输入或输出必须留在临时目录，并在操作结束时清理；不得回写项目或提交到 GitHub。

## 五、上传到全新仓库

只有用户已经明确确认 owner、仓库名、可见性与创建授权时，才创建空远端仓库。可建议使用私有仓库，但不得在可见性未确认时自行创建。不要代替用户选择或生成项目级 `LICENSE`；若项目所有者已经明确选择许可证，必须保留对应的标准许可证正文并在 README 中如实说明。

在项目根目录初始化 Git：

```bash
git init -b <target-default-branch>
git remote add origin <canonical-repository-url>
git status --short
```

只显式暂存本项目文件，不使用 `git add .`、`git add -A` 或 `git add --all`：

```bash
git add -- README.md LICENSE GITHUB_UPLOAD_GUIDE.md .gitignore .gitattributes \
  skills/metaphysics \
  skills/analyze-bazi \
  skills/analyze-ziwei \
  skills/cast-meihua
```

检查暂存内容：

```bash
git status --short
git diff --cached --stat
git diff --cached
```

确认内容准确且当次操作已经获得授权后，再提交：

```bash
git commit -m "Initial import: metaphysics skill suite"
```

推送属于独立外部写入；再次确认目标 remote 与分支，并在获得当次授权后执行：

```bash
git remote -v
git branch --show-current
git push -u origin <target-default-branch>
```

## 六、导入既有仓库

不要在现有本地工作树中直接覆盖文件。先在新目录 clone 远端，确认 owner、仓库、remote、默认分支与工作树状态：

```bash
git clone <canonical-repository-url>
cd <repository-directory>
git remote -v
git status --short
```

从最新默认分支创建导入分支，例如：

```bash
git switch -c codex/import-metaphysics-skill
```

再把已检查的项目内容复制到用户指定位置。若目标仓库存在同名文件、已有 Skill 或其他冲突，先展示差异并等待用户决定，不得静默覆盖。

只显式暂存本次导入路径，检查完整 staged diff，获得授权后提交并推送该分支。只有用户明确要求时才创建 Pull Request；已有对应 PR 时复用，不要重复创建。

禁止强推、改写历史、删除远端分支或标签，除非用户对具体操作另行明确授权。

## 七、上传后验证

本地检查：

```bash
git status --short
git show --stat --oneline HEAD
git ls-files
```

推送后 fetch 并确认本地提交与远端目标分支一致：

```bash
git fetch origin
git rev-parse HEAD
git rev-parse origin/<uploaded-branch>
```

再以只读方式核对 GitHub 上的：

- 仓库 URL 与可见性；
- 上传分支与 commit SHA；
- 文件树和 README 渲染；
- 项目级 AGPL-3.0 许可证及 GitHub 的许可证识别；
- 紫微第三方许可文件；
- Pull Request 的 base、head、draft 状态与变更文件（如有）。

最终向用户报告：仓库 URL、可见性、上传分支、commit SHA、PR URL（如有），以及任何未上传或被拦截的内容和原因。

## 八、硬性停止条件

只要发现用户资料、密钥、来源不明的知识库、异常压缩路径、符号链接、目标仓库或分支不明确、文件冲突、权限不足，或校验结果与 README 声明不一致，就立即停止。不要上传、不要自行修补，也不要通过更换工具或仓库绕过问题；先向用户报告并请求决定。
