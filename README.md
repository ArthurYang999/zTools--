# ZTools 批量启动

ZTools 插件：扫描本机应用、手动分类，并把启动组注册为 ZTools Feature，在主搜索里一键批量启动。

## 功能

- **扫描应用**：系统已安装应用 + 自定义目录
- **手动分类**：自建分类并分配应用
- **启动组**：勾选应用组成组；保存后注册为 ZTools Feature/指令，搜索点选即可批量启动

## 要求

- Node.js >= 16
- [ZTools](https://ztoolscenter.github.io/ZTools-doc/) 宿主环境

## 开发

```bash
npm i
npm run dev          # Vite 开发服务（配合 development.main）
npm run build        # UI → src-ztools/dist，preload → src-ztools/preload/services.js
npm test
```

完整可安装插件目录是 **`src-ztools/`**（与官方 CLI Vue 模板一致），不是源码根目录，也不是单独的 `dist/`。

## 本地安装（ZTools）

依据官方 [CLI Vue 模板](https://github.com/ZToolsCenter/ztools-plugin-cli/tree/main/templates/vue-vite)、[目录结构](https://ztoolscenter.github.io/ZTools-doc/file-structure.html)、[Vibe Coding](https://ztoolscenter.github.io/ZTools-doc/vibe-coding.html)：

1. 构建：

```bash
npm i
npm run build
```

2. ZTools → **插件管理** → **本地安装**
3. 选择文件夹：**`D:\MyWorkSpace\zTools-BatchStart\src-ztools`**
   - 或安装打包好的 `batch-start-plugin.zip`（内容为 `src-ztools`）
4. 若之前装过错误目录，请先卸载旧插件再装
5. 主搜索 **「批量启动」**

说明：`vite` 必须使用 `base: './'`，否则 `index.html` 里的 `/assets/...` 在 ZTools 的 file 协议下会变成空白页。

开发热更新：先 `npm run dev`，本地安装/开发模式加载 `src-ztools`（`development.main` → `http://localhost:5173`）。

## 用法

1. 在 ZTools 搜索 **「批量启动」**，打开管理页
2. **扫描**应用（可添加自定义目录）
3. 按需 **分类**
4. **创建启动组**（勾选应用、设置指令名）
5. 回到 ZTools 主搜索，输入组指令并触发 → 组内应用几乎同时启动

## 平台说明

| 平台 | 可加入启动组的类型 |
|------|-------------------|
| Windows | `.exe` / `.bat` / `.cmd` / `.lnk` |
| macOS | `.app` 等 |
| Linux | `.desktop` / 可执行文件 |

## 手动冒烟（开发者）

单元测试与 `npm run build` 覆盖核心逻辑；**在 ZTools 宿主内的端到端冒烟需由开发者本地完成**，例如：

- 「批量启动」能打开管理 UI
- 保存启动组后，指令出现在主搜索
- 触发组指令后应用启动，插件退出
- Windows 下自定义目录 / 手动添加的 `.bat` 等可进组并启动
- 删除组后对应 Feature 消失
- 部分路径失效时仍有成功/失败汇总提示
