# Writing-to-Improving · 海怪！海怪！

暗黑文艺复兴风格的航海叙事长卷：高小天与爱斯基摩海上的海怪传说，共**二十一幕**，以舵轮推进阅读。纯静态页面，零依赖、零构建、零外部请求。

> 英语写作提分方案补完计划 · 第 12 轮

## 在线浏览

仓库已设为公开。启用 GitHub Pages 后可直接在浏览器里阅读：

**Settings → Pages → Source: `Deploy from a branch` → Branch: `main` / `(root)` → Save**

入口是根目录的 [`index.html`](index.html)，地址形如 `https://girlleague.github.io/Writing-to-Improving/`。

## 目录结构

```
.
├── index.html              # 入口页面（仅结构，无内联样式 / 脚本）
├── assets/
│   ├── css/style.css       # 全部样式（377 行）
│   └── js/main.js          # 全部交互（610 行）
├── dist/
│   └── 海怪！海怪！.html   # 原始单文件版存档，双击即可离线打开
├── tools/
│   └── serve.mjs           # 零依赖静态服务器（Node 内置模块）
├── package.json
└── .gitignore
```

`dist/海怪！海怪！.html` 是把 `index.html` + `style.css` + `main.js` 重新内联回去的**等价单文件版**，162,699 字节，与拆分前逐字节一致，用于"拷一个文件就能看"的场景。两者内容同源，改动时请以后者为准回填，或跑一次内联脚本。

## 本地预览

```bash
npm start          # → http://localhost:8080/
```

无需 `npm install`——仓库里没有任何 npm 依赖，`tools/serve.mjs` 只用 Node 内置的 `http`/`fs`/`path`。Node 18+ 即可。

也可以直接双击 `index.html` 用 `file://` 打开：样式与脚本都是相对路径引用，本地双击同样能跑。

## 实现要点

- **二十一幕滚动叙事**，幕与幕之间用舵轮（`.helm`）推进，`body[data-act]` 记录当前幕。
- **五种版式**交替：满幅插画、双栏对读、题记页、特写格、卷首 / 收束页。
- **转场**用每一幕上下各 22vh 的墨色渐隐（`.act::before` / `.act::after`）实现；早期版本曾用 `content-visibility:auto` 做性能优化，但滚回旧幕时会丢失重绘导致黑闪，已移除。
- **水动效**按幕加权：潮 crests / 反光 glints / 涟漪 ripples / 浪花 spark 的数量、透明度与行波档位随幕变化，仅真实水面幕（1、7、10、14、20、21）挂载海面层。
- **四边黑边**由 fixed 的 `.vignette` 承担（12 档 radial + 四边渐隐），不随内容滚动。
- 全站素材均为**内联 SVG / CSS 生成**（包括噪点纹理的 `data:image/svg+xml`），运行时不发任何网络请求。

## 版本

| 提交 | 内容 |
| --- | --- |
| `first commit` | 单文件版 `海怪！海怪！.html` |
| 本次 | 拆分为 `index.html` + `assets/`，补 `package.json` / 本地服务器 / `.gitignore`，原文件存档至 `dist/` |

## 许可

未授权公开再分发，仅作个人作品展示使用。
