const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

// ตั้งค่าดึงข้อมูลจำกัดเวลาเข้มงวดขึ้น (10 วินาทีพอ) เพื่อไม่ให้บอทค้างนาน
const parser = new Parser({
    timeout: 10000, 
    customFields: {
        item: [
            ['media:content', 'mediaContent', {keepArray: true}],
            ['enclosure', 'enclosure'],
            ['description', 'description'],
            ['content:encoded', 'contentEncoded']
        ]
    }
});

const FEEDS = [
    { url: 'https://www.blognone.com/atom.xml', category: 'General', sourceName: 'Blognone' },
    { url: 'https://www.beartai.com/feed', category: 'General', sourceName: 'Beartai' },
    { url: 'https://www.it24hrs.com/feed/', category: 'Security', sourceName: 'iT24Hrs' }, // [แก้ไข] เติม sourceName
    { url: 'https://techsauce.co/feed', category: 'General', sourceName: 'Techsauce' },      // [แก้ไข] เติม sourceName
    
    // แหล่งข้อมูลจาก Medium
    { url: 'https://medium.com/feed/tag/cybersecurity', category: 'Security', sourceName: 'Medium (Cybersecurity)' },
    { url: 'https://medium.com/feed/tag/cloud-computing', category: 'General', sourceName: 'Medium (Cloud)' },

    // แหล่งข้อมูลจาก Facebook Page ผ่านตัวกลาง rss.app
    { url: 'https://rss.app/r/feed/ka1sg6tTe0Lwo2rW', category: 'Info', sourceName: 'FB: Enterprise ITPro' }, 
    { url: 'https://rss.app/r/feed/1K4gOhGLzk6DAc46', category: 'Info', sourceName: 'FB: TechTalk Thai' }
];

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
            console.log(`กำลังดึงข้อมูลจาก: ${feedConfig.sourceName} (${feedConfig.url})`);
            const feed = await parser.parseURL(feedConfig.url);
            
            feed.items.forEach(item => {
                allArticles.push({
                    id: item.guid || item.id || Math.random().toString(36).substr(2, 9),
                    title: item.title,
                    link: item.link,
                    content: item.contentSnippet || item.content || "",
                    pubDate: item.pubDate || item.isoDate,
                    source: feedConfig.sourceName, 
                    category: feedConfig.category,
                    thumbnail: findImage(item)
                });
            });
            console.log(`✅ ดึงสำเร็จจาก: ${feedConfig.sourceName}`);
        } catch (error) {
            // หากเว็บไหนช้าเกิน 10 วินาที จะหลุดมาตรงนี้แล้วข้ามไปทำเว็บต่อไปทันที โค้ดจะไม่ค้างตาย
            console.error(`❌ ข้ามแหล่งข้อมูล ${feedConfig.sourceName || 'Unknown'} เนื่องจากล่าช้าหรือผิดพลาด:`, error.message);
        }
    }

    const localData = readLocalKnowledge();
    allArticles = [...localData, ...allArticles];
    allArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    fs.writeFileSync('data.json', JSON.stringify(allArticles, null, 2), 'utf-8');
    console.log(`🎉 รวมคลังความรู้ใหม่เสร็จสิ้นทั้งหมด ${allArticles.length} รายการ`);
}

main();
