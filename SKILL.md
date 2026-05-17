---
name: 千牛聊天记录获取
description: 淘宝千牛客服聊天记录提取。从千牛平台提取指定日期的客服聊天记录，逐条导出为Excel文件到桌面。触发词：千牛聊天、提取千牛记录、导出千牛聊天、千牛聊天Excel。
agent_created: true
---

# 千牛聊天记录提取

从淘宝千牛平台自动提取指定日期的客服聊天记录，输出 Excel 到桌面。

## 前置条件

Chrome 需以 CDP 调试模式启动（端口 9222）：

```powershell
# 关闭已有 Chrome
Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force

# 使用临时 profile 启动 CDP 模式
$tmpProfile = "$env:TEMP\chrome-debug-profile"
New-Item -ItemType Directory -Force -Path $tmpProfile | Out-Null
Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  -ArgumentList "--remote-debugging-port=9222","--user-data-dir=$tmpProfile","--no-first-run"

# 验证 CDP
Invoke-WebRequest -Uri "http://127.0.0.1:9222/json/version" -UseBasicParsing
```

## 提取流程

### 执行方式

直接运行提取脚本，参数通过命令行传入：

```bash
node scripts/extract.js --date "2026-05-09" --output "C:\Users\SZR0405\Desktop\千牛聊天记录_5月9日.xlsx"
```

### 脚本工作流（5 步）

1. **CDP 连接** → `http://127.0.0.1:9222`
2. **打开千牛消息页** → `https://qn.taobao.com/home.htm/app-customer-service/toolpage/Message`
3. **自动登录**（如检测到登录页）→ 在 iframe 内填写账号密码并提交
4. **设置日期并查询** → `im-history-search` iframe 内操作日历 → 点击查询
5. **逐一点击客户提取消息** → 遍历 `.results-list` → 提取聊天内容 → 写入 Excel

### 账号凭据

| 店铺 | 子账号 | 密码 |
|------|--------|------|
| 大趣数码旗舰店 | 大趣数码旗舰店:小颖 | 2025fafafa |

## 关键 DOM 结构

### 登录页（自动跳转）

登录表单在 iframe `https://havanalogin.taobao.com/mini_login.htm` 内：

| 元素 | 选择器 |
|------|--------|
| 账号输入框 | `input#fm-login-id` |
| 密码输入框 | `input#fm-login-password` |
| 密码登录标签 | `.password-login-tab-item` |
| 提交按钮 | `button.fm-button.fm-submit.password-login` |
| 滑块验证 | `#nc_1__scale_text`（需手动完成） |

### 聊天记录页

聊天记录在 iframe `market.m.taobao.com/app/qn/im-history-search` 内：

| 元素 | 选择器 |
|------|--------|
| 日期范围选择器 | `.next-range-picker` |
| 日历单元格 | `.next-calendar-cell` |
| 查询按钮 | 含"查询"文本的 button |
| 客户列表 | `.results-list`（每个客户一行） |
| 客户行 | `.results-list` 下的子元素 |
| 消息容器 | `[class*="chatWrap"]` |
| 消息时间 | `[class*="chatTime"]` |
| 发送者名称 | `[class*="chatName"]` |
| 消息内容 | `[class*="chatTextLeft"]` |

## 输出规范

输出 Excel 到桌面：`C:\Users\SZR0405\Desktop\千牛聊天记录_{日期}.xlsx`

| 列名 | 内容 |
|------|------|
| 客户ID | 客户昵称或ID |
| 聊天记录 | `时间 发送者：消息内容`（多条用换行分隔） |

## 已知注意事项

1. **页面选择**：CDP 可能打开多个 taobao.com 页面，必须选择 URL 含 `qn.taobao.com` 的那个（而非 `work.taobao.com`）
2. **登录 iframe**：账号密码在子 frame 内，不在主页面，需 `frames().find()` 定位
3. **滑块验证**：如出现 `#nc_1__scale_text`，脚本暂停提示手动完成
4. **查询后等待**：日期查询后需等待客户列表加载完成再遍历
5. **消息滚动**：每个客户的消息区域可能需要滚动才能加载完整内容
