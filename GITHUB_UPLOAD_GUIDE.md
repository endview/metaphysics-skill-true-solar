# 源码合并与版本发布

在分支上修改源码，通过 Pull Request 合并到 `main`。`Reliability validation and release` 工作流在 Linux、Windows、macOS 上使用 `.node-version` 指定的 Node.js 和固定 Python 依赖运行完整工程验证。

`main` 的验证成功后，发布任务在 Linux 上重新构建四个独立 Skill ZIP、总包、完整源码与验证记录，并发布 v1.1。发布页标题只使用版本号，内容来自 `docs/releases/v1.1.md`；源码中的更新记录见 `CHANGELOG.md`。

当前 v1.1 发布操作还将 v1.0 的发布页改为 `docs/releases/v1.0.md` 中的功能介绍，并更新对应说明附件及校验文件。v1.0 标签和两个代码 ZIP 保留。

本地准备发布附件（输出目录必须位于源码树之外）：

```bash
python -m pip install -r requirements-dev.txt
node tooling/verify-local.mjs
python tooling/publish-release.py --output ../release-v1.1
```

最后一条命令仅构建附件。仅 GitHub Actions 发布任务传入 `--publish`，使用该仓库的临时工作流凭据。脚本核对主线提交、v1.0 标签和 v1.1 标签；已发布的 v1.1 不会被其他提交覆盖。未来发布需同步修改工程版本、发布说明与发布脚本的目标版本。

真实模型／宿主矩阵仍独立记录。未配置适配器时 `behavior-matrix.mjs` 返回 `not_run`，完整生产验收仍返回非零；工程版本发布不修改此状态。
