# 千牛聊天记录获取

淘宝千牛客服聊天记录自动提取工具。通过 Chrome CDP 浏览器自动化，自动登录千牛平台，按指定日期提取客服聊天记录，输出 Excel 到桌面。

## 功能

- 自动登录千牛平台
- 按日期查询聊天记录
- 逐客户提取完整聊天内容
- 输出格式化 Excel 文件

## 安装

```bash
git clone https://github.com/khgkk/qianniu-chat-extract.git
cd qianniu-chat-extract
npm install
```

## 使用

```bash
# 提取指定日期
node scripts/extract.js --date "2026-05-09"

# 限制条数
node scripts/extract.js --date "2026-05-09" --limit 50

# 指定输出路径
node scripts/extract.js --date "2026-05-09" --output "./output.xlsx"
```

## 前置条件

Chrome 需以调试模式启动（端口 9222）：

```powershell
Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force
$tmpProfile = "$env:TEMP\chrome-debug-profile"
New-Item -ItemType Directory -Force -Path $tmpProfile | Out-Null
Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  -ArgumentList "--remote-debugging-port=9222","--user-data-dir=$tmpProfile","--no-first-run"
```

## 输出

Excel 文件保存到桌面：`千牛聊天记录_5月9日.xlsx`

| 列名 | 内容 |
|------|------|
| 客户ID | 客户昵称 |
| 聊天记录 | 时间\n发送者：消息内容 |

## 在 WorkBuddy 中使用

WorkBuddy → 技能面板 → 添加技能 → 导入文件夹，选择本仓库根目录即可。

## 技术栈

- puppeteer-core - Chrome CDP 浏览器自动化
- exceljs - Excel 文件生成

## License

MIT
