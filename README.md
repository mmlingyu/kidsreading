# kidsreading · R4 维护基线

已验收发布是 `reader-phase1-20261117-r4`。分支 `R4` 保存这份源码；`main` 仍是原来的静态站，不从本分支合并。

- 要改的前端只在 `frontend/app/`。
- 后端、技能、部署模板、测试、锁文件和原清单在仓库里按已验收树的路径存放。
- `SHA256MANIFEST.txt` 与 `TRUSTED-SHA256.json` 保持已验收字节。维护文件不写进清单，也不改清单去声称新的部署哈希。
- r5 和未完成的 TTS 服务工作没有进入本分支。
- 本仓库不另加项目级 LICENSE。pixelfx 的许可只在 `frontend/app/vendor/pixelfx/LICENSE`。

核对已验收文件：

```bash
python3 maintenance/reproduce-r4-archive.py --check
```

路径、版本标签、打包和测试边界见 `MAINTENANCE.zh-CN.md`。
