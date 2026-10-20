# GoboSolution Simulator：Mac 本地开发

核查日期：2026-10-20（Asia/Shanghai）。

当前应用已升级为 Simulator V2；当前范围、规则和验证结果见 `V2_DEVELOPMENT.md`。下文保留迁移及 V1 初次核查记录。


## 已确认

- GitHub：<https://github.com/xiaowen1845/repository-1>，默认分支 `main`。
- 本地仓库：`/Users/alex/Projects/simulator`。
- 应用在子目录 `gobo-simulator/`。
- 基线提交：`17c2c66fc8944a4bf13f6e948cbbca4e7ec1d8c4`（update page title）。
- 本地开发分支：`codex/local-development`，未推送。
- Next.js 16.1.6、React 19.2.3、Fabric.js 7.2.0（锁定版本）。
- 初次核查使用 Node.js 26.8.1 / npm 11.19.0；当前项目已使用独立的 Node.js 24.22.0 验证，匹配 Vercel 24.x。系统 Node.js 保持原样。根目录及应用目录的 `.nvmrc` 固定 24.22.0，package.json engines 为 24.x。
- 用户提供的线上地址：<https://simulator.gobosolution.com/>，页面可访问，标题与源码一致。
- GitHub 最新 Production 部署记录对应基线提交，部署成功，时间为 2026-03-18 14:46:25（Asia/Shanghai）。
- Vercel 项目：`xiaowen1845s-projects/repository-1`。
- 部署详情：<https://vercel.com/xiaowen1845s-projects/repository-1/6BfqCy1RiYQhvnLbtsUsYePU5sXX>。
- GitHub 记录的部署网址：<https://repository-1-1txt8ddsu-xiaowen1845s-projects.vercel.app>。

## 已核实的 Vercel 设置

依据用户于 2026-10-20 提供的 Build and Deployment / Environments 设置截图：

- Framework Preset：Next.js。
- Root Directory：`gobo-simulator`；Include files outside the root directory in the Build Step 为 Enabled。
- Build Command、Output Directory、Install Command、Development Command 的 Override 均关闭，使用框架默认行为；截图中的灰色提示不是自定义命令值。
- Node.js Version：`24.x`（项目设置值，不能据此断言历史部署的实际构建版本）。
- Ignored Build Step：Automatic。
- Production 的 Branch Tracking：`main`。
- Production 域名中包含 `simulator.gobosolution.com`，另有 3 个域名未展开。
- Preview 的 Branch Tracking：All unassigned git branches；No custom domains。
- Development：Accessible via CLI；No custom domains。

当前设置下，`main` 对应生产环境，未分配的功能分支对应 Preview。后续获准推送功能分支时，可能触发 Preview 自动构建；不要把它合并到 `main` 或提升为 Production，除非用户明确要求发布。

## 仍待核实

- 环境变量的作用环境及 Preview 是否连接生产服务。
- Shopify 实际 iframe / 嵌入代码使用的网址。
- 线上域名当前解析到的具体部署，以及未展开的其他 3 个生产域名。

这些设置不阻碍本地开发。本地 Node.js 已对齐 24.x，当前继续在独立开发分支验证页面修改。发布前仍需核实相关环境变量与 Shopify 嵌入方式；本次没有修改任何 Vercel 设置。

## 启动

在 Codex 中打开上述本地仓库文件夹。当前聊天也可以直接继续修改这个目录。

```bash
cd /Users/alex/Projects/simulator/gobo-simulator
npm exec --yes --package=node@24.22.0 -- npm ci --ignore-scripts
npm exec --yes --package=node@24.22.0 -- npm run dev -- --hostname 127.0.0.1 --port 3000
```

上述命令无需更换系统 Node.js；已安装 nvm 的环境也可以先运行 `nvm install` / `nvm use`，再使用普通 npm 命令。npm exec 首次运行需要联网下载 Node.js；后续复用本机缓存。

访问 <http://127.0.0.1:3000/>。停止服务器使用 Ctrl+C。先停止服务器再重装依赖，避免开发服务器在依赖替换期间重载。

本次安装未执行第三方安装脚本；已验证当前浏览器端 Fabric.js 预览和 Next 构建可用。若以后引入服务端 canvas 等原生模块，需要另外验证其安装步骤。

```bash
npm exec --yes --package=node@24.22.0 -- npm run lint
npm exec --yes --package=node@24.22.0 -- node node_modules/typescript/bin/tsc --noEmit
npm exec --yes --package=node@24.22.0 -- npm run build
```

`next/font/google` 会在构建时下载 Geist 字体，需要可用网络；开发和正式构建应顺序进行。

## 本次修改与验证

- 原始 `npm ci` 失败：锁文件缺少 `@csstools/css-parser-algorithms`、`@csstools/css-tokenizer` 和 `canvas` 条目。
- 在开发分支补齐 `package-lock.json`，保留原有依赖版本声明；未修改页面业务逻辑或线上配置。
- 停止开发服务器后，修复后的锁文件已通过 `npm ci --ignore-scripts --no-audit --no-fund --offline` 重装验证；随后生产构建再次通过。
- 新增此说明和仓库 `AGENTS.md`，明确本地开发及发布边界。
- TypeScript 检查通过。
- Lint 通过：0 个错误、5 个现存警告（两处 Hook 依赖、三处普通 img）。
- 生产构建通过，首页静态生成成功；首次受网络限制无法获取 Google 字体，联网重试成功。
- 浏览器手动走通场景选择、内置 Restaurant Logo 选择、Fabric 画布预览；Logo、背景及尺寸标注实际可见。
- 无 `test` 脚本或现有自动化测试；本次未声称已完成上传、导出、移动端及全部交互回归。

## 初次核查发现的问题（处理进度见下文）

- `PRODUCT_MAP` 引用 `/products/*.jpg`，仓库没有这些商品图；本地实际收到 `/products/35w.jpg` 404。
- 商品按钮使用 `/products/35w` 等相对链接，落在 Simulator 域名；需要 Shopify 商品实际地址才能正确连接。
- 画布截图中顶部宽度标注存在重叠，需后续调整。
- 两处 Hook 依赖警告需要结合画布生命周期分析，避免直接加依赖造成重复初始化。
- 依赖版本、安全更新及 Node 版本对齐应作为单独变更验证，不在迁移时批量升级。

本次没有推送 GitHub、修改 Vercel 设置、部署生产版本或修改 Shopify。


## 2026-10-20 本地第一轮修复

- 新增两份 `.nvmrc`，固定 Node.js 24.22.0，并在 package.json / lockfile 中声明 engines 24.x；没有替换系统 Node.js。
- Node.js 24 下锁定依赖安装通过，生产构建（包含 TypeScript 检查）通过；Lint 0 错误、5 条现有警告。
- 尺寸标签移出标线并避开旋转手柄，计算旋转后的 Logo 边界；靠近画布边缘时约束文字位置。
- 离开预览时清理尺寸线和文字引用，重新进入时在新画布创建，避免复用已销毁画布中的标注。
- 用户确认店铺为 <https://gobosolution.com/>。根据公开商品页，将 35W、50W 室内，60W、80W、100W 室外，以及 200W 高功率六个型号连接到真实商品页。
- 25W、120W、150W 未在对应公开系列中找到匹配，保留既有功率推荐算法，明确显示需确认型号，并导向真实询价页；没有擅自改成功率不同的商品。
- 移除原演示价格，提示访问商品页查看当前价格及供货状态。
- 移除不存在的本地商品图路径，使用明确的功率图示，保留可选真实图片字段和加载失败回退。店铺公开 JSON / HTML 的直接读取返回 429，尚未取得可靠商品图片；图示不代表实物外观。
- 商品链接在新标签页打开，避免替换嵌入 Simulator 的 Shopify 页面。
- 浏览器验证：三步流程、35W 商品链接、1ft 下询价入口、返回素材页再进入预览、页面重载后尺寸文字不再与旋转手柄或标线重叠。
- 导出按钮点击后没有浏览器错误，但工具等待下载超时，不能确认文件成功保存；下载结果仍待人工验证。
- 修复现有 Fabric.js 7 窗口缩放报错：将已移除的 setWidth/setHeight 调用替换为 setDimensions，同时按画布变化同步 Logo 位置、大小和尺寸标注。已验证 390px 与 1024px 宽度切换及恢复默认尺寸，浏览器没有新增错误。
- 尚未完成上传文件、全部场景/镜头及连续旋转的完整回归。
- 修改仍位于 `codex/local-development`，没有推送、合并、部署或修改 Shopify。

商品页来源（核实日期：2026-10-20）：

- <https://gobosolution.com/collections/indoor-logo-projectors/products/gobosolution-indoor-35w-logo-projector>
- <https://gobosolution.com/collections/indoor-logo-projectors/products/gobosolution-indoor-50w-logo-projector>
- <https://gobosolution.com/collections/outdoor-logo-projectors/products/gobosolution-outdoor-60w-logo-projector>
- <https://gobosolution.com/collections/outdoor-logo-projectors/products/gobosolution-outdoor-80w-logo-projector>
- <https://gobosolution.com/collections/outdoor-logo-projectors/products/gobosolution-outdoor-100w-logo-projector>
- <https://gobosolution.com/collections/high-power-logo-projectors/products/gobosolution-high-power-200w-logo-projector>
- <https://gobosolution.com/pages/request-a-quote>
