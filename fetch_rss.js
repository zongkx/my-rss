// fetch_rss.js
const fs = require('fs');
const { execSync } = require('child_process');

// 动态安装依赖
try {
    require('rss-parser');
} catch (e) {
    execSync('npm install rss-parser');
}

const Parser = require('rss-parser');
const parser = new Parser();

// ================= 配置区域 =================
const RSS_FEEDS = [
    'https://sspai.com/feed',                  // 少数派
    'https://www.infoq.cn/feed',               // InfoQ
    // 'https://example.com/feed',             // 可以在这里无限追加你的 RSS 源
];

const CACHE_FILE = 'cache.json';
const OUTPUT_FILE = 'pending_posts.json'; // 暂存给 Action 使用的新文章
// ============================================

async function run() {
    // 1. 读取历史缓存
    let urlCache = [];
    if (fs.existsSync(CACHE_FILE)) {
        try {
            urlCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        } catch (e) {
            console.error('读取缓存失败，重置缓存', e);
        }
    }

    const newPosts = [];

    // 2. 遍历所有 RSS 源抓取数据
    for (const url of RSS_FEEDS) {
        console.log(`正在抓取 RSS 源: ${url}`);
        try {
            const feed = await parser.parseURL(url);
            
            // 遍历每个源最新的 5 条内容（防止单次任务堆积太多）
            const items = feed.items.slice(0, 5); 
            
            for (const item of items) {
                const postUrl = item.link || item.guid;
                
                // 检查是否已经存在于缓存中
                if (!urlCache.includes(postUrl)) {
                    newPosts.push({
                        title: `【${feed.title || 'RSS'}】${item.title}`,
                        body: `### [${item.title}](${postUrl})\n\n${item.contentSnippet || item.content || ''}\n\n--- \n*发布时间：${item.pubDate || '未知'}*`,
                        url: postUrl
                    });
                }
            }
        } catch (error) {
            console.error(`抓取源失败 ${url}:`, error.message);
        }
    }

    // 3. 如果有新文章，写入临时文件供给 Action 处理
    if (newPosts.length > 0) {
        console.log(`发现了 ${newPosts.length} 篇新文章！`);
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(newPosts, null, 2));
        
        // 更新缓存列表（把新文章的 URL 加进去）
        const updatedCache = [...urlCache, ...newPosts.map(p => p.url)];
        // 保持缓存不要无限大，只保留最近的 500 条记录
        if (updatedCache.length > 500) {
            updatedCache.splice(0, updatedCache.length - 500);
        }
        fs.writeFileSync(CACHE_FILE, JSON.stringify(updatedCache, null, 2));
    } else {
        console.log('没有发现新文章。');
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify([]));
    }
}

run();
