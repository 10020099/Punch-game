# Punch-game - Cloudflare Pages 部署版本

这是 Punch-game 项目的 Cloudflare Pages 部署版本。

## ⚠️ 重要提示 - 避免 404 错误

在 Cloudflare Pages 部署时，**必须正确配置构建输出目录**，否则会出现 404 错误。

## 📦 项目结构

```
cf/
├── index.html          # 游戏主页面
├── game.js            # 游戏核心逻辑
├── style.css          # 样式文件
├── wrangler.toml      # Cloudflare 配置文件
├── _headers           # 响应头配置
├── assets/            # 游戏资源文件夹
│   └── images/        # 图片资源
└── README.md          # 本文件
```

## 🚀 正确的部署方法

### 方法 1: 通过 Git 仓库部署（推荐）✅

#### 步骤 1: 准备 Git 仓库

**重要：只推送 cf 文件夹里的内容到仓库根目录**

```bash
# 进入 cf 文件夹
cd cf

# 初始化 Git 仓库
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit: Punch game for Cloudflare Pages"

# 添加远程仓库（替换为你的仓库地址）
git remote add origin https://github.com/你的用户名/你的仓库名.git

# 推送到远程仓库
git push -u origin main
```

#### 步骤 2: 在 Cloudflare 中部署

1. **登录 Cloudflare Dashboard**
   - 访问 https://dash.cloudflare.com/
   - 进入 **Workers & Pages**

2. **创建新的 Pages 项目**
   - 点击 **Create application**
   - 选择 **Pages**
   - 点击 **Connect to Git**

3. **连接 Git 仓库**
   - 选择你的 Git 提供商（GitHub/GitLab）
   - 授权 Cloudflare 访问
   - 选择刚才创建的仓库

4. **配置构建设置（关键步骤）**
   ```
   项目名称: punch-game（或你想要的名称）
   生产分支: main
   框架预设: None
   构建命令: 留空
   构建输出目录: / （根目录，非常重要！）
   根目录: / （保持为根目录）
   ```

5. **保存并部署**
   - 点击 **Save and Deploy**
   - 等待部署完成（约 1-2 分钟）

6. **访问你的网站**
   - 部署完成后会显示类似 `punch-game.pages.dev` 的地址
   - 点击访问即可开始游戏！

### 方法 2: 通过 Wrangler CLI 部署

```bash
# 1. 安装 Wrangler（如果还没安装）
npm install -g wrangler

# 2. 登录 Cloudflare
wrangler login

# 3. 进入 cf 目录
cd cf

# 4. 部署（会自动使用 wrangler.toml 配置）
wrangler pages deploy . --project-name=punch-game

# 或者不使用配置文件直接部署
wrangler pages deploy . --project-name=punch-game
```

### 方法 3: 通过 Dashboard 直接上传（最简单）

1. **准备上传文件**
   - 将 `cf` 文件夹中的**所有文件和文件夹**（不要包含 cf 文件夹本身）打包成 ZIP
   - 确保 ZIP 文件解压后直接是 index.html、game.js 等文件，而不是 cf 文件夹

2. **上传部署**
   - 登录 Cloudflare Dashboard
   - 进入 **Workers & Pages**
   - 点击 **Create application** → **Pages** → **Upload assets**
   - 输入项目名称（如 `punch-game`）
   - 拖拽上传 ZIP 文件
   - 点击 **Deploy site**

## 🔍 404 错误排查

如果部署后仍然出现 404 错误，请检查：

### 1. 检查文件结构
确保部署后的文件结构是：
```
你的项目根目录/
├── index.html      ← 必须在根目录
├── game.js
├── style.css
└── assets/
```

**而不是**：
```
你的项目根目录/
└── cf/
    ├── index.html  ← 错误：多了一层 cf 文件夹
    ├── game.js
    └── ...
```

### 2. 检查构建配置
- 在 Cloudflare Pages 项目设置中
- 进入 **Settings** → **Builds & deployments**
- 确认 **Build output directory** 设置为 `/` 或留空

### 3. 重新部署
如果之前部署错误：
- 删除旧的部署
- 重新按照上述正确步骤部署

## 🎮 游戏说明

### 游戏控制
- **方向键**: 移动飞机
- **空格键**: 切换场地Buff
- **U键**: 打开/关闭强化面板
- **F键**: 切换飞机（黄金飞机）
- **K键**: 打开作弊面板

### 游戏模式
1. **普通模式**: 标准游戏模式，击败敌人获得分数
2. **Boss关挑战**: 专门的Boss战模式
3. **挑战模式**: 高难度挑战，需要击败强化Boss并在狂暴阶段存活

### 游戏特色
- 🎯 多种敌人类型和Boss
- 💎 可升级的飞机属性系统
- 🌟 黄金飞机特殊系统
- 🎨 精美的视觉特效
- 🏆 挑战模式计分系统

## 🔧 自定义域名

部署完成后，你可以添加自定义域名：

1. 进入你的 Pages 项目
2. 点击 **Custom domains**
3. 点击 **Set up a custom domain**
4. 输入你的域名并按照指示配置 DNS

## 📝 技术细节

- **浏览器兼容性**: Chrome, Firefox, Safari, Edge
- **CDN**: 自动全球加速
- **数据存储**: LocalStorage（浏览器本地）
- **HTTPS**: 自动免费 SSL
- **缓存**: 通过 _headers 文件优化

## 🔄 更新部署

### Git 仓库方式
```bash
cd cf
git add .
git commit -m "Update game"
git push
```
Cloudflare Pages 会自动检测并重新部署。

### Wrangler CLI 方式
```bash
cd cf
wrangler pages deploy .
```

### Dashboard 上传方式
重新上传新的 ZIP 文件。

## 🎉 完成！

按照正确步骤部署后，你的游戏应该可以正常访问了！

访问地址格式：`https://你的项目名.pages.dev`

---

## ❓ 常见问题

**Q: 为什么会出现 404 错误？**
A: 最常见的原因是文件结构不正确。确保 index.html 在项目根目录，而不是在 cf 子文件夹中。

**Q: 如何检查部署是否成功？**
A: 在 Cloudflare Dashboard 的 Pages 项目中，查看 **Deployments** 标签，确保状态为 "Success"。

**Q: 游戏进度会保存吗？**
A: 是的，游戏进度保存在浏览器的 LocalStorage 中，清除浏览器数据会丢失进度。

**Q: 可以在手机上玩吗？**
A: 游戏使用键盘控制，建议在电脑上游玩以获得最佳体验。

## 📊 性能优化

已包含的优化：
- ✅ 静态资源长期缓存（1年）
- ✅ HTML 短期缓存（1小时）
- ✅ 安全响应头配置
- ✅ 全球 CDN 加速

## 许可证

请参考项目根目录的 LICENSE 文件。