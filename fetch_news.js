const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

// ตั้งค่าให้ดึงรูปภาพ และจำกัดเวลา Timeout ไม่เกิน 10 วินาทีต่อเว็บ (เว็บไหนช้าให้ข้ามทันที บอทจะไม่ค้าง)
const parser = new Parser({
    timeout: 10000, 
    customFields: {
        item: [
            ['media:content', 'mediaContent', {keepArray: true}],
            ['enclosure', 'enclosure'],
            ['description', 'description']
        ]
    }
});

// คัดเลือกเฉพาะคลังข่าวไอทีไทยที่เปิด RSS Feed เสถียรและโหลดเร็ว
const FEEDS = [
    { url: 'https://www.blognone.com/atom.xml', category: 'General' },
    { url: 'https://www.beartai.com/feed', category: 'General' }
];

function findImage(item) {
    if (item.mediaContent && item.mediaContent.length > 0) {
        if (item.mediaContent[0].$ && item.mediaContent[0].$.url) return item.mediaContent[0].$.url;
    }
    if (item.enclosure && item.enclosure.url) return item.enclosure.url;
    
    const searchTarget = (item.description || '') + (item.content || '');
    const imgMatch = searchTarget.match(/<img[^>]+src="([^">]+)"/i);
    if (imgMatch && imgMatch[1]) return imgMatch[1];

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
            const content = fs.readFileSync(filePath, 'utf-8');
            
            const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
            
            let title = file.replace('.md', '');
            let category = 'Internal';
            let source = 'คู่มือภายใน';
            let thumbnail = null;
            let actualContent = content;

            if (match) {
                const yamlLines = match[1].split('\n');
                actualContent = match[2].trim();
                
                yamlLines.forEach(line => {
                    const [key, ...val] = line.split(':');
                    if (key && val) {
                        const value = val.join(':').trim();
                        if (key.trim() === 'title') title = value;
                        if (key.trim() === 'category') category = value;
                        if (key.trim() === 'source') source = value;
                        if (key.trim() === 'thumbnail') thumbnail = value;
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

    for (const feedConfig of FEEDS) {
        try {
            console.log(`กำลังดึงข้อมูลจาก: ${feedConfig.url}`);
            const feed = await parser.parseURL(feedConfig.url);
            
            feed.items.forEach(item => {
                allArticles.push({
                    id: item.guid || item.id || Math.random().toString(36).substr(2, 9),
                    title: item.title,
                    link: item.link,
                    content: item.contentSnippet || item.content || "",
                    pubDate: item.pubDate || item.isoDate,
                    source: feed.title,
                    category: feedConfig.category,
                    thumbnail: findImage(item)
                });
            });
            console.log(`ดึงสำเร็จจาก: ${feedConfig.url}`);
        } catch (error) {
            // หากเว็บไหนโหลดช้าเกิน 10 วินาที จะตกมาที่นี่ และข้ามไปรันเว็บถัดไปทันที ระบบจะไม่ค้าง
            console.error(`ข้ามเนื่องจากเกิดข้อผิดพลาดหรือช้าเกินไปที่ ${feedConfig.url}:`, error.message);
        }
    }

    const localData = readLocalKnowledge();
    allArticles = [...localData, ...allArticles];
    allArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    fs.writeFileSync('data.json', JSON.stringify(allArticles, null, 2), 'utf-8');
    console.log(`ดึงข้อมูลเสร็จสิ้นทั้งหมด ${allArticles.length} รายการ`);
}

main();
