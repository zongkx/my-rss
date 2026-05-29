const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const TurndownService = require('turndown');

const parser = new Parser();
// 初始化 HTML 转 Markdown 工具
const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced'
});

// ================= 配置区域 =================
const RSS_FEEDS = [
    'https://sspai.com/feed',
    'https://www.infoq.cn/feed',
];
const CACHE_FILE = 'cache.json';
// ============================================

async function run() {
    let urlCache = [];
    if (fs.existsSync(CACHE_FILE)) {
        try {
            urlCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        } catch (e) {
            console.error('读取缓存失败', e);
        }
    }

    // 创建一个临时目录用来存今天新文章的 md 内容
    const postsDir = path.join(__dirname, 'pending_posts');
    if (fs.existsSync(postsDir)) {
        fs.rmSync(postsDir, { recursive: true, force: true });
    }
    fs.mkdirSync(postsDir);

    let newPostCount = 0;

    for (const url of RSS_FEEDS) {
        console.log(`正在抓取: ${url}`);
        try {
            const feed = await parser.parseURL(url);
            const items = feed.items.slice(0, 5); 
            
            for (const item of items) {
                const postUrl = item.link || item.guid;
                
                if (!urlCache.includes(postUrl)) {
                    // 1. 提取正文（有些源是 content, 有些是 contentSnippet）
                    const rawContent = item.content || item.contentSnippet || '';
                    
                    // 2. 将 HTML 转为 Markdown
                    let markdownContent = turndownService.turndown(rawContent);
                    
                    // 3. 组装 Issue 的完整正文
                    const issueBody = [
                        `# [${item.title}](${postUrl})`,
                        `> 来自源：${feed.title || '未知'} | 发布时间：${item.pubDate || '未知'}`,
                        `\n--- \n`,
                        markdownContent
                    ].join('\n');

                    // 4. 将每篇文章内容安全地写入独立的 md 文件，文件名用计数器代替防止特殊字符报错
                    fs.writeFileSync(
                        path.join(postsDir, `${newPostCount}.md`), 
                        JSON.stringify({ title: `【${feed.title || 'RSS'}】${item.title}`, bodyFile: `${newPostCount}.body.md` })
                    );
                    fs.writeFileSync(path.join(postsDir, `${newPostCount}.body.md`), issueBody);

                    urlCache.push(postUrl);
                    newPostCount++;
                }
            }
        } catch (error) {
            console.error(`抓取失败 ${url}:`, error.message);
        }
    }

    // 更新缓存文件
    if (urlCache.length > 500) {
        urlCache.splice(0, urlCache.length - 500);
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(urlCache, null, 2));
    console.log(`处理完毕，发现 ${newPostCount} 篇新文章。`);
}

run();
