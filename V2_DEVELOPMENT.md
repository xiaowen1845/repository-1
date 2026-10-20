# Simulator V2 本地开发记录

日期：2026-10-20（Asia/Shanghai）。仓库 `/Users/alex/Projects/simulator`；开发分支 `codex/local-development`。用户已授权检查通过后上线；发布验证和回退基线见 `RELEASE.md`，最终状态以 GitHub/Vercel 部署记录为准。

## 实现范围

- Step 1：Indoor / Outdoor，场景库和自定义 PNG/JPG 背景上传；移除 Long Distance 分类及 GOBO 尺寸。
- Step 2：PNG/JPG/SVG Logo 上传及 Demo Logo。上传大小上限 10 MB；SVG 使用 Fabric 矢量解析，支持自包含的可渲染图形。
- Step 3：实际投影距离、目标投影直径、ft/m、三种环境光。自动匹配镜头，五种手动镜头移至高级设置；保留 Logo 缩放/位置/角度/连续旋转、独立亮度、重置和 PNG 导出。
- 标题、H1、副标题和品牌统一使用 GoboSolution。官网原始 Logo 图片点击后在顶层页面返回官网首页；favicon 和 Apple 图标使用官网素材。
- 全部界面和导出水印统一使用本地 Archivo，含 400/500/600/700 字重；已移除原有 Geist 网络字体依赖。眉题及主标题字号/字重/字距与 Finder 对齐。
- 根据用户最新授权恢复单个具体产品推荐，显示推荐理由、匹配镜头、距离、目标与预计直径。没有匹配或输入无效时移除商品入口，改为询价。保留移除演示价格、GOBO 尺寸和画布物理尺寸线。
- 主按钮 View Projector 进入已核实的商品页，次按钮 Request a Quote；Finder 降为文字入口，全部在新标签页打开。8 个链接于 2026-10-20 从店铺集合核实，不缓存价格或库存。商品页需要选择推荐的镜头，Simulator 不自动选择插头或加入购物车。
- 未加入光束、投影机位置或透视变形。

## 统一规则

`gobo-simulator/lib/projector-rules.ts` 是产品配置及选型规则来源。

- 米制原始值用于计算；显示格式化不写回原始数值。
- 镜头集合：0.3 / 0.36 / 0.5 / 0.8 / 1；0.3 仅用于 High-Power 160W/200W/300W。
- 产品与镜头的对应关系采用用户提供的 Finder 配置。
- 沿用现有距离和环境光功率参考表，没有凭空添加亮度或面积系数。
- 误差 ≤5% 为 Excellent，>5% 且 ≤15% 为 Good，超过 15% 不推荐确定型号。
- 先按匹配等级，再按满足门槛的功率，最后按尺寸误差排序。
- 规则层保留建议距离重新选型的回归检查；当前 Simulator 只显示输入安装距离对应的推荐，不自动改动安装距离。
- 无效输入清空旧推荐；不匹配时进入项目询价。
- Simulator 默认根据目标直径自动匹配；高级设置中的手动镜头是固定约束，不会偷偷改写目标尺寸。
- Logo 在背景照片中的大小和两个视觉亮度滑块是效果示意，不作为产品选型输入。环境光按钮仍作为实际选型条件。
- 距离和目标直径都保存原始米制数值，切换单位只格式化显示，不修改推荐输入。

## 范围与开发命令

用户明确要求只开发 Simulator V2。Finder 原代码仅用于参考产品配置与规则，线上 Finder 没有修改。试做的 Finder 草稿和对应生成器/事件测试已移出仓库，暂存在 `/private/tmp/gobo-finder-draft-withdrawn`，本地 3001 预览已停止；这些不是交付内容。

```bash
cd /Users/alex/Projects/simulator/gobo-simulator
npm exec --yes --package=node@24.22.0 -- npm test
npm exec --yes --package=node@24.22.0 -- npm run lint
npm exec --yes --package=node@24.22.0 -- npm run build
```

## 验证

- Node.js 24.22.0；发布候选已更新至 Next.js / eslint-config-next 16.4.2、Fabric 7.4.0，并安装兼容的间接依赖安全补丁。生产构建、TypeScript、Lint 和 11 项规则测试通过。
- 2026-10-20 生产依赖 `npm audit --omit=dev`：0 项已知漏洞。开发工具链遗留告警及原因见 `RELEASE.md`。
- 品牌回归：官网 Logo 图片加载正常、首页链接与 `_top` 目标正确；图标元数据仅使用官网 PNG/Apple 图标。正文、按钮、输入框和推荐卡片实际字体为 Archivo，390px/1280px 无横向溢出。
- 保留 11 项共用规则回归（含自动镜头和手动约束、目标直径变化）：无效输入、建议距离重新选型、15% 边界、镜头限制、环境筛选及功率排序。Simulator 的重复单位切换另经浏览器验证。
- 本次浏览器回归：距离/目标直径/环境光联动推荐，12 次 ft/m 往返后推荐不变，自动 0.3 限定 High-Power，手动镜头不匹配与清空目标尺寸时无商品入口，Logo/亮度滑块不影响型号，室外环境排除室内型号。
- 此前 V2 浏览器验证：三步流程、背景选择、自定义 JPG 背景、PNG/JPG/SVG Logo 上传、ft/m 多次切换、0.3 镜头计算、亮度独立调整、旋转停止保留角度、旋转中重置、无效距离清空结果。
- 390px 和 1280px 宽度下没有横向溢出，切换宽度没有新增画布错误，测试后恢复默认 viewport。
- 导出已经实际下载，并检查文件内容；SVG 图形已在 PNG 中出现。旧版本 SVG 以普通图片加载时未显示的问题已修复。

## 发布前剩余事项

- 功率表是经验参考，尚未按真实投影面积、光学损耗及现场照度校准。
- Finder 仅作为次要比较入口，不在本次开发范围内。线上 Finder 代码与规则保持原状。
- 店铺规格文字中仍有历史差异（如 35W Imaging Proportion、60W 镜头数量）；Simulator 采用用户明确确认的型号/镜头配置，不以旧文案覆盖。
- 未实现将背景、上传 Logo、截图自动带入 Quote（V2.1）。
- 复用现有 Vercel Git 集成：`main` 自动部署 Production，现有正式域名不变。应用未使用后端接口或环境变量；本次发布沿用现有 Shopify 嵌入，不修改其配置。
- 原始 Finder 附件保持原样；V2 前应用文件备份位于 `/private/tmp/gobo-v1-local-backup`，长期保留请使用 Git。
