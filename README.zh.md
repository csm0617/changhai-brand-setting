# changhai-brand-setting

[English](README.md) | 中文

在设置里新增一个**品牌**页，把 DeepSeek Harness Web GUI 换成你自己的品牌：侧栏标志与名称、空会话首页标题、小标语与徽标、浏览器标签页标题与站点图标。关掉总开关即立刻恢复官方品牌。

和「样式覆盖型」换肤插件不同，本插件填的是外壳**本来就声明好的品牌槽位**，所以侧栏的布局、点击区、折叠行为与悬停态全部保持不变。

## 改了什么、怎么改的

| 位置 | 机制 |
| --- | --- |
| 侧栏标志（展开行与折叠导轨） | 占用 `sidebar.brand.mark` 槽位 |
| 侧栏名称（字标） | 占用 `sidebar.brand.name` 槽位 |
| 空会话首页标志 | 占用 `conversation.hero.brand.mark` 槽位 |
| 首页标题 / 版本徽标 | 与官方文案做等值匹配后改写文本，官方文案取自当前语言的词典 |
| 首页小标语 | 插件**新建**的一行，插在标题行之后；自带默认文案，选「隐藏」才移除 |
| 标语对齐 | 仅在该节点上写测得的内缩量；标题永不被改写样式 |
| 标签页标题、favicon | 受控改写 `document.title` 与 `rel="icon"` |

前三个槽位都是 `kind: 'single'`，而 `@deepseek-ai/dsh-client-ui-brand-official` 已在默认优先级占用了侧栏的两个。槽位按优先级遮蔽（同一格里最低优先级的存活条目渲染），所以本插件用 `priority: -100` 注册，并且**只在该位置的确和官方呈现不同时才占用**。总开关关闭时它什么都不注册，官方占用者、官方回退与构建徽标原封不动。

标志**自带图**——长海波浪，以 PNG data URL 内嵌在浏览器半里——所以 `logoKind` 默认就是 `image`，只要打开总开关，新装环境立刻就有品牌标志，无需随包携带任何文件。用户选图即替换它；选「官方」则把槽位交还官方占用者。内嵌的是原图的 50×51px，因为图像处理链**从不放大**（见 `MAX_IMAGE_EDGE`），在这里重采样只会让包变大、画质更差。

首页标题与徽标不是槽位（它们是编译进 `ui-conversation` 的 i18n 文案），`document.title` 与 favicon 也没有扩展点。这三处按需、受控地改写：先按当前语言读出官方文案，只替换与它完全相等的文本节点，字段清空即恢复原样。界面结构变化时最坏结果是「找不到、不改」，而不会改错节点。

**小标语**是插件唯一「新建」而非「替换」的表面：官方首页既没有标语槽位也没有对应文案，无物可改。插件插入一个带标记的单例节点（`data-dsh-brand-tagline`），作为标题行的兄弟节点，于是它自然排在标题正下方、输入区上方。标题行同样由首页标志锚点定位，且只接受**最内层**含标题文案的元素——外层的首页容器也含标题，插到那里会把标语落到输入区下面。

它也是唯一**自带文案**的表面（`创新求变破困局，冲上山头论英雄`），所以字段留空表示「用内置这句」而非「什么都不显示」；隐藏是另一个明确的选项，这样两种意图不会挤在同一个空值里冲突。关闭总开关会直接移除该节点，官方首页保持逐字节不变。

小标语默认**与标题对齐**（另一选项是居中）。此时**只有标语会移动**，标题保持官方布局不动——所以覆盖只写在标语节点自己的 `text-align` 与 `padding-left` 上，而不是去改写标题行。这个 `padding-left` 是**实测**出来的「标题行左边缘 → 居中标题文字实际起始位置」的距离：用 `Range` 量标题内容的字形盒，因为该距离随标题的**渲染宽度**变化，无法由文案推导（真机实测：长标题约 158px，短标题约 319px）。文案变化时会重新测量，`resize` 时也会——因为视口变化或字体切换都会让标题重排，却不产生任何可被观察到的 DOM 变更。选择居中则不测量、也不写内缩量。

## 安装

本包是标准 bundle（声明了 `dsh.bundle.patch`），走常规安装路径即可：

```sh
dsh plugin --profile web add /绝对路径/changhai-brand-setting
```

这条路通过 `dsh.profile.bundles` 注册加载器条目，启动时读取，所以安装后需要重启一次 `dsh web`，再刷新页面。

本地开发也可以直接在 profile 自己的 `cordis.patch.yml` 里激活（加载器会热重载这个文件）：

```yaml
- insert:
    - id: changhai-brand-setting
      name: changhai-brand-setting
```

**两条路只能选一条**：同一个加载器条目 id 注册两次，启动时会抛 `duplicate loader entry id`。

## 离线安装

本包**没有任何运行时依赖**，也不需要构建：浏览器半只 `require("react")`，而 react 由外壳自己提供。所以离线机器只需要拿到文件本身，什么都不用联网拉取。

### 1. 拷贝目录 + 跑安装脚本（推荐）

把整个项目目录拷过去（U 盘 / 内网共享 / `scp`），然后：

```sh
./scripts/install-offline.sh                        # 复制进 $DSH_HOME/profiles/web
./scripts/install-offline.sh --mode link            # 改为软链（本机开发循环）
./scripts/install-offline.sh --profile tui          # 换 profile
./scripts/install-offline.sh --home /opt/dsh        # 换 DSH_HOME
./scripts/install-offline.sh --uninstall            # 卸载插件并移除加载条目
```

脚本会：把包**真实复制**进 `<DSH_HOME>/profiles/<profile>/node_modules/`（源目录之后删掉也不影响）；在 profile 的 `cordis.patch.yml` 里只加一条加载条目（文件不存在时按 `[]` 创建，且不会动使用者自己的注释和其他插件的条目）；对两半做语法检查。可重复执行；若该包已列在 `dsh.profile.bundles` 里会拒绝制造重复激活（`--force` 可强制）；`--uninstall` 会把补丁文件恢复成 `[]`。

### 2. 手工两步（脚本做的就是这两步）

```sh
cp -R /media/usb/changhai-brand-setting "$DSH_HOME/profiles/web/node_modules/"
```

然后往 `$DSH_HOME/profiles/web/cordis.patch.yml` 追加：

```yaml
- insert:
    - id: changhai-brand-setting
      name: changhai-brand-setting
```

补丁文件的根节点必须保持为列表：如果文件里现在只有 `[]`，要用上面的条目**替换**那一行，而不是追加在它后面。

### 3. 打包分发（tarball）

```sh
pnpm pack                                 # 在有源码的机器上执行
# 把 changhai-brand-setting-0.1.0.tgz 拷到目标机，然后：
dsh plugin --profile web add --offline ./changhai-brand-setting-0.1.0.tgz
```

本地 tarball 不需要 registry，本包也没有依赖要解析，profile 自己的依赖早已在它的 store 里，所以 `--offline` 全程不碰网络（已实测：在空项目里 `pnpm add --offline ./changhai-brand-setting-0.1.0.tgz` 能正常解析并装好）。这条路走的是 `dsh.profile.bundles`，因此需要重启 `dsh web`；之后请把 `cordis.patch.yml` 里同 id 的条目删掉（两条路只能留一条）。也可以直接把 tarball 解包进 profile 的 `node_modules`，那就等同于第 1 种方式。

Windows 上请用第 2 或第 3 种方式；shell 安装脚本只支持 POSIX。

### 安装后自检

```sh
node --check "$DSH_HOME/profiles/web/node_modules/changhai-brand-setting/lib/client.js"
curl -s -X POST http://127.0.0.1:3080/changhai-brand-setting/api \
  -H 'content-type: application/json' -d '{"method":"status"}'
```

返回里 `client.registered: true` 表示浏览器行已进入启动图、页面会去取这个 bundle；然后刷新 GUI 页面即可。

## 使用

设置 → **品牌**（在设置导航里，位于「外观」旁边）。

- **启用自定义品牌**：总开关。默认关闭，关闭时官方品牌完全不受影响，配置会保留。
- **标志**：图片（默认项，即内置的长海波浪；也可选文件替换，自动压到最多 512px 并转成 PNG data URL）/ 官方 / 文字（字母组合或 emoji）/ 隐藏，并可调大小。
- **名称**：侧栏字标，可用文字（可调字号、字重、字距、颜色）、图片或隐藏。
- **首页**：空会话标题与版本徽标（跟随官方 / 自定义文字 / 隐藏），以及标题下方的**小标语**（可单独调字号、颜色与对齐）。标语字段留空即用内置句（`创新求变破困局，冲上山头论英雄`），也可填自己的文案，或选**隐藏**彻底移除。对齐可选**与标题对齐**（默认，跟着标题左边缘）或**居中**；标题本身始终不动。
- **浏览器**：标签页标题（在 `document.title` 里替换产品名，保留会话标题部分）与站点图标。
- **实时预览**：页面顶部按当前配置预览标志与字标。

## 控制台 API

```js
__DSH_BRAND.set({ enabled: '1', logoKind: 'text', logoText: '长海', nameKind: 'text', nameText: 'changhai' })
__DSH_BRAND.set({ heroTagline: '让每一次对话都通向未来', taglineSize: '15', taglineAlign: 'title' })
__DSH_BRAND.set({ heroTagline: '', taglineHidden: '1' })   // 内置句 → 隐藏
__DSH_BRAND.get()    // 当前配置
__DSH_BRAND.slots()  // 当前占用的槽位
__DSH_BRAND.reset()  // 恢复官方品牌
__DSH_BRAND.help()
```

来源取值为 `shipped | image | text | none`；把字段设成空字符串即恢复该项的官方默认。

## 配置存放位置

`$DSH_HOME/changhai-brand-setting.json`（默认 `~/.dsh/changhai-brand-setting.json`），由本包的宿主半原子写入、仅本人可读。浏览器通过一个带围栏的 JSON 接口 `POST /changhai-brand-setting/api` 访问：

- `{ "method": "get" }` → 返回整个状态对象；
- `{ "method": "set", "patch": { ... } }` → 合并补丁：字符串写入、`null` 删除、白名单外的键直接丢弃；
- `{ "method": "status" }` → `{ file, client: { registered, url, rev } }`，用来快速回答「浏览器半边接上了没有」。

路由只接受回环地址（或配置的受信主机）且浏览器标记同源的请求——这是防 DNS 重绑定 / 跨站写的手法，不是鉴权。`localStorage` 只作为首屏种子：它按 origin 隔离，而桌面端每次启动端口都会变。

为什么不走产品自带的设置通道：`dsh-host-apiproxy` 对浏览器客户端只暴露一份显式的命名空间白名单，第三方命名空间按设计一律返回 `settings-not-exposed`。

## 开发

纯 ESM + 纯 CJS 的浏览器 bundle，无构建步骤。

```sh
npm run check   # 两半的语法检查
npm test        # 在模拟外壳里真实执行浏览器半
```

冒烟测试通过捕获 `window.__ModuleLoader__.load` 加载 `lib/client.js`，用仿造的 cordis 上下文、DOM 与存储驱动它，断言：设置页已注册、槽位只在需要时被占用（关闭后释放）、每个已注册组件都能渲染、新装环境下标志即显示内置图且可被选图替换、标签页标题替换生效、小标语在零配置下即显示内置句且仅在显式隐藏时移除、重复同步时复用同一节点而不重复创建，以及「与标题对齐」会写出实测的内缩量且从不改写标题的样式。React 依次从 `$DSH_WEB_MODULES`、`$DSH_HOME/profiles/web/node_modules`、`./node_modules` 解析。

改宿主半需要重启 `dsh web`（宿主侧加载器按 specifier 缓存模块）；改浏览器半会被 `dsh-client-hmr` 捕获，直接在已打开的页面里热重载插件。

## 已知边界

- **占用名称槽位会带走官方的本地构建徽标**，因为徽标就在官方占用者替换掉的那个回退里。把名称切回「官方」即可恢复。
- **首页文案按等值文本替换**。若未来版本改名了插件探测的类名，兜底路径是全文档的精确文本匹配，再失败则不改动。
- **小标语依赖同一个首页锚点**：它被插到「含标题行的那层」的兄弟位置，所以首页若被改到面目全非，标语就干脆不显示——它从不猜测插入点。由于该节点是在 `MutationObserver` 回调里写入的，每次写入都先做等值判断、且复用同一个节点而非重建，稳定状态下不会再产生任何 DOM 变更。
- **「与标题对齐」实测的是实时布局**：内缩量取自标题的实际渲染位置，所以对当前画出来的标题是精确的——但它是**测量值而非规则**，因此在文案变化与 `resize` 时都会重测。若某次重排两者都不触发（例如某种只移动标题、不改变窗口尺寸的动画），内缩量会停留到下一次同步为止。标题若无法测量，标语回退为 0 内缩——可见且可恢复，绝不抛错。
- **图片以 data URL 存进配置文件**，所以标志建议用简单图形而非照片；超过 150 万字符的图片会被拒绝，并在设置页上直接提示（不再只写控制台）。选了「图片」但还没选图（或已清除）时显示**内置的长海波浪**，不会留白。
- **内置标志是 50×51px 的原图**，保留原样内嵌（约 5.5KB）。侧栏按 24px、首页按 34px 渲染，因此显示清晰；但若你想在更大尺寸下使用，请换一张更高分辨率的图——插件永远不会把这张图放大。
- **选图失败会显示在设置页上**，不必去翻控制台。

## 许可证

MIT
