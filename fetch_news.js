const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

const parser = new Parser({
    timeout: 15000, // เพิ่มเวลาเป็น 15 วินาทีเผื่อบางเว็บโหลดช้า
    customFields: {
        item: [
            ['media:content', 'mediaContent', {keepArray: true}],
            ['enclosure', 'enclosure'],
            ['description', 'description'],
            ['content:encoded', 'contentEncoded'] // เพิ่มสำหรับดึงเนื้อหาและรูปจาก Medium
        ]
    }
});

// รวมแหล่งข้อมูลทั้งหมด (คุณสามารถเปลี่ยนลิงก์ตรงนี้ได้ตามใจชอบ)
const FEEDS = [
    { url: 'https://www.blognone.com/atom.xml', category: 'General', sourceName: 'Blognone' },
    { url: 'https://www.beartai.com/feed', category: 'General', sourceName: 'Beartai' },
    { url: 'https://www.it24hrs.com/feed/', category: 'Security' }, // ดึงข้อมูลเพิ่มอัตโนมัติ
    { url: 'https://techsauce.co/feed', category: 'General' },      // ดึงข้อมูลเพิ่มอัตโนมัติ
    
    // [เพิ่ม] แหล่งข้อมูลจาก Medium (ตาม Tag ไอที)
    { url: 'https://medium.com/feed/tag/cybersecurity', category: 'Security', sourceName: 'Medium (Cybersecurity)' },
    { url: 'https://medium.com/feed/tag/cloud-computing', category: 'General', sourceName: 'Medium (Cloud)' },

    // [เพิ่ม] แหล่งข้อมูลจาก Facebook Page (ใส่ลิงก์ที่แปลงจาก rss.app ตรงนี้)
    // ลิงก์ด้านล่างนี้เป็นตัวอย่างโครงสร้าง ให้คุณนำลิงก์ที่ได้จากข้อ 1 มาเปลี่ยนใส่ได้เลยครับ
    { url: 'https://rss.app/r/feed/ka1sg6tTe0Lwo2rW', category: 'Info', sourceName: 'Facebook Page Enterprise ITPro ข่าวไอทีและบทความความรู้สำหรับองค์กร' } 
    { url: 'https://rss.app/r/feed/1K4gOhGLzk6DAc46', category: 'Info', sourceName: 'Facebook Page TechTalk Thai ข่าว Enterprise I.T. ภาษาไทย' }
    { url: 'https://rss.app/r/feed/Wyje7uvLch8WcB7r', category: 'Info', sourceName: 'Facebook Page NCSA Thailand' }
    { url: 'https://rss.app/r/feed/4Rw50WZSnq6bs0Nr', category: 'Info', sourceName: 'Facebook Page DGA Thailand' }
    { url: 'https://rss.app/r/feed/6pdUDaYQ2eVFg3J5', category: 'Info', sourceName: 'Facebook Page ThaiCERT' }
];

function findImage(item) {
    // 1. หาจากแท็ก media:content
    if (item.mediaContent && item.mediaContent.length > 0) {
        if (item.mediaContent[0].$ && item.mediaContent[0].$.url) return item.mediaContent[0].$.url;
    }
    // 2. หาจากแท็ก enclosure
    if (item.enclosure && item.enclosure.url) return item.enclosure.url;
    
    // 3. ควานหาแท็ก <img> จากเนื้อหาเต็มของ Medium หรือเว็บอื่นๆ
    const searchTarget = (item.contentEncoded || '') + (item.description || '') + (item.content || '');
    const imgMatch = searchTarget.match(/<img[^>]+src="([^">]+)"/i);
    if (imgMatch && imgMatch[1]) {
        // ดักแก้กรณีลิงก์รูปภาพของ Medium บางรูปที่ไม่มี https ติดมา
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
            console.log(`กำลังดึงข้อมูลจาก: ${feedConfig.url}`);
            const feed = await parser.parseURL(feedConfig.url);
            
            feed.items.forEach(item => {
                allArticles.push({
                    id: item.guid || item.id || Math.random().toString(36).substr(2, 9),
                    title: item.title,
                    link: item.link,
                    content: item.contentSnippet || item.content || "",
                    pubDate: item.pubDate || item.isoDate,
                    source: feedConfig.sourceName, // ใช้ชื่อแหล่งที่มาที่เราตั้งค่าไว้ให้จำง่าย
                    category: feedConfig.category,
                    thumbnail: findImage(item)
                });
            });
            console.log(`ดึงสำเร็จจาก: ${feedConfig.sourceName}`);
        } catch (error) {
            console.error(`ข้ามแหล่งข้อมูล ${feedConfig.sourceName} เนื่องจาก:`, error.message);
        }
    }

    const localData = readLocalKnowledge();
    allArticles = [...localData, ...allArticles];
    allArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    fs.writeFileSync('data.json', JSON.stringify(allArticles, null, 2), 'utf-8');
    console.log(`รวมคลังความรู้ใหม่เสร็จสิ้นทั้งหมด ${allArticles.length} รายการ`);
}

main();
