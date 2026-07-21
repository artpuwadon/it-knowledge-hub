const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

// 🚨 [ระบบป้องกันบอทค้าง] Global Safeguard Timeout (60 วินาที)
setTimeout(() => {
    console.error('⚠️ สคริปต์ทำงานนานเกินไป ระบบสั่งปิดอัตโนมัติเพื่อป้องกันบอทค้าง');
    process.exit(0); 
}, 60000);

// ตั้งค่า Parser พร้อม Header แบบเต็มรูปแบบเพื่อป้องกัน Firewall / Cloudflare บล็อก
const parser = new Parser({
    timeout: 10000, 
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Referer': 'https://www.google.com/'
    },
    customFields: {
        item: [
            ['media:content', 'mediaContent', {keepArray: true}],
            ['enclosure', 'enclosure'],
            ['description', 'description'],
            ['content:encoded', 'contentEncoded']
        ]
    }
});

// รายชื่อแหล่งข่าว RSS
const FEEDS = [
    { url: 'https://www.blognone.com/atom.xml', category: 'General', sourceName: 'Blognone' },
    { url: 'https://www.beartai.com/feed', category: 'General', sourceName: 'Beartai' },
    { url: 'https://www.techtalkthai.com/category/security/feed/', category: 'Security', sourceName: 'TechTalk Thai' },
    { url: 'https://www.enterpriseitpro.net/category/security/feed/', category: 'Security', sourceName: 'Enterprise IT Pro' },  
    { url: 'https://www.thaicert.or.th/cyber-threat-news-th/feed/', category: 'Security', sourceName: 'ThaiCERT' },      
    { url: 'https://www.techtalkthai.com/feed/', category: 'General', sourceName: 'TechTalk Thai' },
    { url: 'https://techsauce.co/feed', category: 'General', sourceName: 'Techsauce' },
    { url: 'https://it24hrs.com/category/it-news/feed/', category: 'General', sourceName: 'IT24Hrs' }
];

// 🤖 คำค้นหาสำหรับคัดแยกข่าว AI อัตโนมัติ
const AI_KEYWORDS = [
    'artificial intelligence', 'chatgpt', 'openai', 'gemini', 'claude', 
    'llm', 'deepseek', 'copilot', 'เอไอ', 'ปัญญาประดิษฐ์', 'machine learning', 
    'generative ai', 'prompt', 'midjourney', 'sora', 'nvda', 'nvidia'
];

// 🛡️ คำค้นหาสำหรับคัดแยกข่าว Cyber Security อัตโนมัติ
const SECURITY_KEYWORDS = [
    'security', 'cyber', 'ไซเบอร์', 'แฮก', 'hack', 'malware', 'มัลแวร์', 
    'ช่องโหว่', 'phishing', 'ฟิชชิ่ง', 'ransomware', 'แรนซัมแวร์', 
    'ความปลอดภัย', 'cve-', 'cisa', 'pdpa', 'vulnerability', 'ddos', 'ภัยคุกคาม', 'zero-day'
];

function detectCategory(title, content, defaultCategory) {
    const textToTest = `${title || ''} ${content || ''}`.toLowerCase();
    
    // 1. ตรวจจับข่าว AI
    const isAI = AI_KEYWORDS.some(k => textToTest.includes(k)) || /\bai\b/i.test(textToTest);
    if (isAI) return 'AI';

    // 2. ตรวจจับข่าว Security
    const isSecurity = SECURITY_KEYWORDS.some(k => textToTest.includes(k));
    if (isSecurity || defaultCategory === 'Security') return 'Security';
    
    return defaultCategory;
}

function findImage(item) {
    if (item.mediaContent && item.mediaContent.length > 0) {
        if (item.mediaContent[0].$ && item.mediaContent[0].$.url) return item.mediaContent[0].$.url;
    }
    if (item.enclosure && item.enclosure.url) return item.enclosure.url;
    
    const searchTarget = (item.contentEncoded || '') + (item.description || '') + (item.content || '');
    const imgMatch = searchTarget.match(/<img[^>]+src="([^">]+)"/i);
    if (imgMatch && imgMatch[1]) {
        let url = imgMatch[1];
        if (url.startsWith('//')) url = 'https:' + url;
        return url;
    }

    return null;
}

function readLocalKnowledge() {
    const knowledgeDir = path.join(__dirname, 'knowledge');
    let localArticles = [];

    if (!fs.existsSync(knowledgeDir)) return localArticles;

    const files = fs.readdirSync(knowledgeDir);
    files.forEach(file => {
        if (path.extname(file) === '.md') {
            const filePath = path.join(knowledgeDir, file);
            
            const contentRaw = fs.readFileSync(filePath, 'utf-8');
            const content = contentRaw.replace(/^\uFEFF/, '').trim(); 
            
            const match = content.match(/---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)/);
            
            let title = file.replace('.md', '');
            let category = 'Internal'; 
            let source = 'คู่มือภายใน';
            let thumbnail = null;
            let actualContent = content;

            if (match) {
                const yamlLines = match[1].split(/\r?\n/);
                actualContent = match[2].trim();
                
                yamlLines.forEach(line => {
                    const splitIndex = line.indexOf(':');
                    if (splitIndex > -1) {
                        const key = line.slice(0, splitIndex).trim().toLowerCase();
                        const value = line.slice(splitIndex + 1).trim();
                        
                        if (key === 'title') title = value;
                        if (key === 'category') category = value;
                        if (key === 'source') source = value;
                        if (key === 'thumbnail') thumbnail = value;
                    }
                });
            }

            localArticles.push({
                id: `local-${file}`,
                title: title,
                link: `https://github.com/`, 
                content: actualContent,
                pubDate: new Date().toISOString(),
                source: source,
                category: category,
                thumbnail: thumbnail
            });
        }
    });

    return localArticles;
}

async function main() {
    let allArticles = [];
    const seenUrls = new Set(); // ตารางบันทึก URL ป้องกันข่าวซ้ำ

    for (const feedConfig of FEEDS) {
        try {
            console.log(`กำลังดึงข้อมูลจาก: ${feedConfig.sourceName}`);
            const feed = await parser.parseURL(feedConfig.url);
            
            let addedCount = 0;
            feed.items.forEach(item => {
                // ข้ามถ้าเป็นข่าวที่ดึงมาแล้ว
                if (item.link && seenUrls.has(item.link)) return;
                if (item.link) seenUrls.add(item.link);

                const contentText = item.contentSnippet || item.content || "";
                const finalCategory = detectCategory(item.title, contentText, feedConfig.category);

                allArticles.push({
                    id: item.guid || item.id || Math.random().toString(36).substr(2, 9),
                    title: item.title,
                    link: item.link,
                    content: contentText,
                    pubDate: item.pubDate || item.isoDate,
                    source: feedConfig.sourceName, 
                    category: finalCategory,
                    thumbnail: findImage(item)
                });
                addedCount++;
            });
            console.log(`✅ ดึงสำเร็จจาก: ${feedConfig.sourceName} (เพิ่ม ${addedCount} ข่าว)`);
        } catch (error) {
            console.error(`❌ ข้ามแหล่งข้อมูล ${feedConfig.sourceName} (${feedConfig.url}) เนื่องจาก:`, error.message);
        }
    }

    const localData = readLocalKnowledge();
    allArticles = [...localData, ...allArticles];
    allArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    fs.writeFileSync('data.json', JSON.stringify(allArticles, null, 2), 'utf-8');
    console.log(`🎉 สรุปคลังความรู้ใหม่เสร็จสิ้นทั้งหมด ${allArticles.length} รายการ`);

    process.exit(0);
}

main();
