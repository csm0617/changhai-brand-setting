# dsh-custom-brand

[English](README.md) | 中文

在设置里新增一个**品牌**页，把 DeepSeek Harness Web GUI 换成你自己的品牌：侧栏标志与名称、空会话首页标题与徽标、浏览器标签页标题与站点图标。关掉总开关即立刻恢复官方品牌。

和「样式覆盖型」换肤插件不同，本插件填的是外壳**本来就声明好的品牌槽位**，所以侧栏的布局、点击区、折叠行为与悬停态全部保持不变。

## 改了什么、怎么改的

| 位置 | 机制 |
| --- | --- |
| 侧栏标志（展开行与折叠导轨） | 占用 `sidebar.brand.mark` 槽位 |
| 侧栏名称（字标） | 占用 `sidebar.brand.name` 槽位 |
| 空会话首页标志 | 占用 `conversation.hero.brand.mark` 槽位 |
| 首页标题 / 版本徽标 | 与官方文案做等值匹配后改写文本，官方文案取自当前语言的词典 |
| 标签页标题、favicon | 受控改写 `document.title` 与 `rel="icon"` |

前三个槽位都是 `kind: 'single'`，而 `@deepseek-ai/dsh-client-ui-brand-official` 已在默认优先级占用了侧栏的两个。槽位按优先级遮蔽（同一格里最低优先级的存活条目渲染），所以本插件用 `priority: -100` 注册，并且**只在该位置的确和官方呈现不同时才占用**。总开关关闭时它什么都不注册，官方占用者、官方回退与构建徽标原封不动。

首页标题与徽标不是槽位（它们是编译进 `ui-conversation` 的 i18n 文案），`document.title` 与 favicon 也没有扩展点。这三处按需、受控地改写：先按当前语言读出官方文案，只替换与它完全相等的文本节点，字段清空即恢复原样。界面结构变化时最坏结果是「找不到、不改」，而不会改错节点。

## 安装

本包是标准 bundle（声明了 `dsh.bundle.patch`），走常规安装路径即可：

```sh
dsh plugin --profile web add /绝对路径/dsh-custom-brand
```

这条路通过 `dsh.profile.bundles` 注册加载器条目，启动时读取，所以安装后需要重启一次 `dsh web`，再刷新页面。

本地开发也可以直接在 profile 自己的 `cordis.patch.yml` 里激活（加载器会热重载这个文件）：

```yaml
- insert:
    - id: custom-brand
      name: dsh-custom-brand
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
cp -R /media/usb/dsh-custom-brand "$DSH_HOME/profiles/web/node_modules/"
```

然后往 `$DSH_HOME/profiles/web/cordis.patch.yml` 追加：

```yaml
- insert:
    - id: custom-brand
      name: dsh-custom-brand
```

补丁文件的根节点必须保持为列表：如果文件里现在只有 `[]`，要用上面的条目**替换**那一行，而不是追加在它后面。

### 3. 打包分发（tarball）

```sh
pnpm pack                                 # 在有源码的机器上执行
# 把 dsh-custom-brand-0.1.0.tgz 拷到目标机，然后：
dsh plugin --profile web add --offline ./dsh-custom-brand-0.1.0.tgz
```

本地 tarball 不需要 registry，本包也没有依赖要解析，profile 自己的依赖早已在它的 store 里，所以 `--offline` 全程不碰网络（已实测：在空项目里 `pnpm add --offline ./dsh-custom-brand-0.1.0.tgz` 能正常解析并装好）。这条路走的是 `dsh.profile.bundles`，因此需要重启 `dsh web`；之后请把 `cordis.patch.yml` 里同 id 的条目删掉（两条路只能留一条）。也可以直接把 tarball 解包进 profile 的 `node_modules`，那就等同于第 1 种方式。

Windows 上请用第 2 或第 3 种方式；shell 安装脚本只支持 POSIX。

### 安装后自检

```sh
node --check "$DSH_HOME/profiles/web/node_modules/dsh-custom-brand/lib/client.js"
curl -s -X POST http://127.0.0.1:3080/custom-brand/api \
  -H 'content-type: application/json' -d '{"method":"status"}'
```

返回里 `client.registered: true` 表示浏览器行已进入启动图、页面会去取这个 bundle；然后刷新 GUI 页面即可。

## 使用

设置 → **品牌**（在设置导航里，位于「外观」旁边）。

- **启用自定义品牌**：总开关。默认关闭，关闭时官方品牌完全不受影响，配置会保留。
- **标志**：官方 / 图片（选择文件，自动压到 512px 并转成 PNG data URL）/ 文字（字母组合或 emoji）/ 隐藏，并可调大小。
- **名称**：侧栏字标，可用文字（可调字号、字重、字距、颜色）、图片或隐藏。
- **首页**：空会话标题与版本徽标（跟随官方 / 自定义文字 / 隐藏）。
- **浏览器**：标签页标题（在 `document.title` 里替换产品名，保留会话标题部分）与站点图标。
- **实时预览**：页面顶部按当前配置预览标志与字标。

## 控制台 API

```js
__DSH_BRAND.set({ enabled: '1', logoKind: 'text', logoText: '长海', nameKind: 'text', nameText: 'changhai' })
__DSH_BRAND.get()    // 当前配置
__DSH_BRAND.slots()  // 当前占用的槽位
__DSH_BRAND.reset()  // 恢复官方品牌
__DSH_BRAND.help()
```

来源取值为 `shipped | image | text | none`；把字段设成空字符串即恢复该项的官方默认。

## 配置存放位置

`$DSH_HOME/custom-brand.json`（默认 `~/.dsh/custom-brand.json`），由本包的宿主半原子写入、仅本人可读。浏览器通过一个带围栏的 JSON 接口 `POST /custom-brand/api` 访问：

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

冒烟测试通过捕获 `window.__ModuleLoader__.load` 加载 `lib/client.js`，用仿造的 cordis 上下文、DOM 与存储驱动它，断言：设置页已注册、槽位只在需要时被占用（关闭后释放）、每个已注册组件都能渲染、标签页标题替换生效。React 依次从 `$DSH_WEB_MODULES`、`$DSH_HOME/profiles/web/node_modules`、`./node_modules` 解析。

改宿主半需要重启 `dsh web`（宿主侧加载器按 specifier 缓存模块）；改浏览器半会被 `dsh-client-hmr` 捕获，直接在已打开的页面里热重载插件。

## 已知边界

- **占用名称槽位会带走官方的本地构建徽标**，因为徽标就在官方占用者替换掉的那个回退里。把名称切回「官方」即可恢复。
- **首页文案按等值文本替换**。若未来版本改名了插件探测的类名，兜底路径是全文档的精确文本匹配，再失败则不改动。
- **图片以 data URL 存进配置文件**，所以标志建议用简单图形而非照片；超过 150 万字符的图片会被拒绝，并在设置页上直接提示（不再只写控制台）。选了「图片」但还没选图（或已清除）时会自动回退到文字值，不会留白。
- **选图失败会显示在设置页上**，不必去翻控制台。

## 许可证

MIT
