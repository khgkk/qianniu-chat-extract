/**
 * 千牛聊天记录提取脚本
 * 用法: node scripts/extract.js --date "2026-05-09" [--limit 50] [--output "path.xlsx"]
 *
 * 前置: Chrome 需以 --remote-debugging-port=9222 启动
 */

const puppeteer = require('puppeteer-core');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

// 命令行参数解析
function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach((arg, i, arr) => {
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const val = arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true;
      args[key] = val;
    }
  });
  return args;
}

const ARGS = parseArgs();
const TARGET_DATE = ARGS.date || '2026-05-09';
const MAX_CUSTOMERS = parseInt(ARGS.limit) || 0; // 0 = 全部
const OUTPUT_FILE = ARGS.output || path.join(process.env.USERPROFILE, 'Desktop', `千牛聊天记录_${TARGET_DATE.replace(/-/g, '月').replace(/^\d{4}/, '').replace(/0(\d)/, '$1').replace(/-0(\d)/, '$1')}日.xlsx`);

// 账号凭据
const ACCOUNT = {
  username: '大趣数码旗舰店:小颖',
  password: '2025fafafa',
};

const QIANNIU_URL = 'https://qn.taobao.com/home.htm/app-customer-service/toolpage/Message';
const CDP_URL = 'http://127.0.0.1:9222';

// 格式化日期为 MM月DD日 用于文件名
function formatDateForFilename(dateStr) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

// 等待指定毫秒
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 格式化日期为 年-月-日
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function main() {
  console.log('========================================');
  console.log('  千牛聊天记录提取工具');
  console.log('========================================');
  console.log(`目标日期: ${TARGET_DATE}`);
  console.log(`客户上限: ${MAX_CUSTOMERS || '全部'}`);
  console.log(`输出文件: ${OUTPUT_FILE}`);
  console.log('');

  // Step 1: 连接 CDP
  console.log('[1/5] 连接 Chrome CDP...');
  let browser;
  try {
    const resp = await fetch(`${CDP_URL}/json/version`);
    const versionData = await resp.json();
    const wsEndpoint = versionData.webSocketDebuggerUrl;
    if (!wsEndpoint) throw new Error('无法获取 WebSocket 端点');
    browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint, defaultViewport: null });
    console.log(`  已连接 Chrome: ${versionData.Browser}`);
  } catch (e) {
    console.error('❌ 无法连接 Chrome CDP，请确保 Chrome 已以调试模式启动（端口 9222）');
    console.error(`  错误: ${e.message}`);
    process.exit(1);
  }

  // Step 2: 打开千牛消息页
  console.log('[2/5] 打开千牛消息页面...');
  let page = (await browser.pages()).find(p => p.url().includes('qn.taobao.com'));
  if (!page) {
    page = await browser.newPage();
    await page.goto(QIANNIU_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('  已打开新页面');
  } else {
    console.log('  复用已有千牛页面');
    await page.bringToFront();
  }

  await sleep(3000);

  // Step 3: 检测并处理登录
  console.log('[3/5] 检测登录状态...');
  const currentUrl = page.url();
  let isLoggedIn = currentUrl.includes('qn.taobao.com') && !currentUrl.includes('login');

  if (!isLoggedIn) {
    console.log('  未登录，开始自动登录...');
    // 查找登录 iframe
    await sleep(3000);
    const frames = page.frames();
    const loginFrame = frames.find(f => f.url().includes('havanalogin.taobao.com'));

    if (loginFrame) {
      // 切换到密码登录
      await loginFrame.waitForSelector('.password-login-tab-item', { timeout: 10000 }).catch(() => {});
      await loginFrame.click('.password-login-tab-item').catch(() => {});
      await sleep(500);

      // 填写账号
      await loginFrame.waitForSelector('input#fm-login-id', { timeout: 10000 });
      await loginFrame.click('input#fm-login-id');
      await loginFrame.evaluate((el, val) => { el.value = val; }, await loginFrame.$('input#fm-login-id'), ACCOUNT.username);
      await loginFrame.type('input#fm-login-id', ' ', { delay: 50 });
      await sleep(300);

      // 填写密码
      await loginFrame.click('input#fm-login-password');
      await loginFrame.evaluate((el, val) => { el.value = val; }, await loginFrame.$('input#fm-login-password'), ACCOUNT.password);
      await sleep(300);

      // 点击登录
      await loginFrame.click('button.fm-button.fm-submit.password-login');
      console.log('  已提交登录，等待跳转...');
      await sleep(5000);

      // 检测滑块验证
      const slider = await loginFrame.$('#nc_1__scale_text').catch(() => null);
      if (slider) {
        console.log('  ⚠️ 检测到滑块验证，请在浏览器中手动完成滑块验证...');
        // 等待最多 60 秒
        for (let i = 0; i < 60; i++) {
          await sleep(1000);
          const url = page.url();
          if (url.includes('qn.taobao.com') && !url.includes('login')) {
            console.log('  登录成功！');
            break;
          }
        }
      }

      // 等待页面跳转到千牛
      await page.waitForFunction(
        () => window.location.href.includes('qn.taobao.com') && !window.location.href.includes('login'),
        { timeout: 30000 }
      ).catch(() => {
        console.log('  ⚠️ 登录超时，请手动完成登录后按回车继续...');
      });
    } else {
      console.log('  ⚠️ 未找到登录 iframe，请手动完成登录后继续...');
    }
  } else {
    console.log('  已登录 ✓');
  }

  // 确保在消息页面
  const msgUrl = 'https://qn.taobao.com/home.htm/app-customer-service/toolpage/Message';
  if (!page.url().includes('/Message')) {
    console.log('  导航到消息页面...');
    await page.goto(msgUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(5000);
  }

  // Step 4: 设置日期并查询
  console.log(`[4/5] 设置日期 ${TARGET_DATE} 并查询...`);

  // 定位 im-history-search iframe
  let imFrame = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    const allFrames = page.frames();
    imFrame = allFrames.find(f => f.url().includes('im-history-search'));
    if (imFrame) break;
    console.log(`  等待 iframe 加载... (${attempt + 1}/10)`);
    await sleep(2000);
  }

  if (!imFrame) {
    console.error('❌ 未找到聊天记录 iframe (im-history-search)，请确认页面已完全加载');
    console.log('  page.frames:');
    for (const f of page.frames()) {
      console.log(`    ${f.url().substring(0, 80)}`);
    }
    await browser.disconnect();
    process.exit(1);
  }
  console.log(`  已定位聊天记录 iframe ✓`);

  // 解析目标日期
  const targetYear = new Date(TARGET_DATE).getFullYear();
  const targetMonth = new Date(TARGET_DATE).getMonth();
  const targetDay = new Date(TARGET_DATE).getDate();

  // 点击日期范围选择器打开日历
  const rangePicker = await imFrame.waitForSelector('.next-range-picker', { timeout: 10000 }).catch(() => null);
  if (rangePicker) {
    // 点击开始日期输入框打开日历面板
    const startInput = await imFrame.$('.next-range-picker input:first-of-type');
    if (startInput) {
      await startInput.click();
      await sleep(1000);

      // 选择目标日期的日历格子
      // 日历面板的结构: .next-calendar-cell 每个格子有 title 属性如 "2026-05-09"
      const dateCell = await imFrame.$(`.next-calendar-cell[title="${TARGET_DATE}"]`);
      if (dateCell) {
        await dateCell.click();
        console.log(`  已点击日期: ${TARGET_DATE}`);
        await sleep(300);

        // 点击结束日期（同一天，形成单日范围）
        const endCell = await imFrame.$(`.next-calendar-cell[title="${TARGET_DATE}"]`);
        if (endCell) {
          await endCell.click();
          await sleep(300);
        }
      } else {
        console.log(`  ⚠️ 未找到日期 ${TARGET_DATE} 的日历格，尝试其他方式...`);
        // 尝试通过 input 直接设置
        const inputs = await imFrame.$$('.next-range-picker input');
        if (inputs.length >= 2) {
          await imFrame.evaluate((el, val) => { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, inputs[0], TARGET_DATE);
          await imFrame.evaluate((el, val) => { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, inputs[1], TARGET_DATE);
          console.log('  已通过 input 设置日期');
        }
      }
    }

    // 点击查询按钮
    await sleep(500);
    const queryBtn = await imFrame.$('button');
    if (queryBtn) {
      // 查找含"查询"文本的按钮
      const buttons = await imFrame.$$('button');
      for (const btn of buttons) {
        const text = await imFrame.evaluate(el => el.textContent, btn);
        if (text.includes('查询')) {
          await btn.click();
          console.log('  已点击查询按钮');
          break;
        }
      }
    }
  } else {
    console.log('  ⚠️ 未找到日期选择器，可能页面结构有变化');
  }

  // 等待查询结果加载
  console.log('  等待查询结果加载...');
  await sleep(5000);

  // Step 5: 提取聊天记录
  console.log('[5/5] 提取聊天记录...');

  // 获取客户列表
  const customers = await imFrame.$$('.results-list > div, .results-list > li, .results-list .item, .results-list [class*="item"]');
  console.log(`  找到 ${customers.length} 个客户记录`);

  const maxCount = MAX_CUSTOMERS > 0 ? Math.min(MAX_CUSTOMERS, customers.length) : customers.length;
  console.log(`  将提取 ${maxCount} 个客户的聊天记录`);

  // 提取结果
  const extractedData = [];

  for (let i = 0; i < maxCount; i++) {
    const customer = customers[i];
    try {
      // 获取客户名称/ID
      const customerName = await imFrame.evaluate(el => {
        const nameEl = el.querySelector('[class*="name"], [class*="nick"], [class*="title"] span, strong');
        return nameEl ? nameEl.textContent.trim() : el.textContent.trim().substring(0, 30);
      }, customer);

      console.log(`  [${i + 1}/${maxCount}] ${customerName}`);

      // 点击客户
      await customer.click();
      await sleep(800);

      // 提取消息
      const messages = await imFrame.evaluate(() => {
        const chatWraps = document.querySelectorAll('[class*="chatWrap"]');
        const result = [];
        chatWraps.forEach(wrap => {
          const timeEl = wrap.querySelector('[class*="chatTime"]');
          const nameEl = wrap.querySelector('[class*="chatName"]');
          const textEl = wrap.querySelector('[class*="chatTextLeft"], [class*="chatText"]');

          if (timeEl || textEl) {
            const time = timeEl ? timeEl.textContent.trim() : '';
            const name = nameEl ? nameEl.textContent.trim() : '';
            const text = textEl ? textEl.textContent.trim() : '';
            if (text) {
              result.push({ time, name, text });
            }
          }
        });
        return result;
      });

      // 格式化聊天记录
      const chatText = messages.map(m => {
        if (m.name) {
          return `${m.time}\n${m.name}: ${m.text}`;
        }
        return `${m.time}\n${m.text}`;
      }).join('\n\n');

      extractedData.push({
        id: customerName,
        chat: chatText || '(无聊天内容)',
      });

      console.log(`    提取到 ${messages.length} 条消息`);

    } catch (err) {
      console.log(`  [${i + 1}/${maxCount}] ❌ 提取失败: ${err.message}`);
      extractedData.push({
        id: `客户_${i + 1}`,
        chat: `(提取失败: ${err.message})`,
      });
    }
  }

  // Step 6: 写入 Excel
  console.log('');
  console.log('写入 Excel...');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('聊天记录');

  sheet.columns = [
    { header: '客户ID', key: 'id', width: 30 },
    { header: '聊天记录', key: 'chat', width: 80 },
  ];

  extractedData.forEach(row => {
    sheet.addRow(row);
  });

  // 设置样式
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  };
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // 自动换行
  sheet.getColumn('chat').alignment = { wrapText: true, vertical: 'top' };

  await workbook.xlsx.writeFile(OUTPUT_FILE);
  console.log(`✅ 已保存: ${OUTPUT_FILE}`);

  // 关闭连接
  await browser.disconnect();

  // 打印摘要
  console.log('');
  console.log('========================================');
  console.log('  提取完成');
  console.log('========================================');
  console.log(`  目标日期: ${TARGET_DATE}`);
  console.log(`  提取客户: ${extractedData.length}`);
  console.log(`  输出文件: ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error('❌ 脚本出错:', err);
  process.exit(1);
});
