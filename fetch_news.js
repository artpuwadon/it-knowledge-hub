const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

// ปรับค่า Timeout ให้กระชับขึ้นเป็น 8 วินาที หากเว็บไหนไม่ตอบรับให้ตัดจบทันที บอทจะไม่ค้าง
const parser = new Parser({
    timeout: 8000, 
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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

// คัดเหลือเฉพาะแหล่งข่าวเสรีที่เปิดให้ดึงข้อมูลได้ 100% ไม่ติดบล็อก Firewall
const FEEDS = [
    { url: 'https://www.blognone.com/atom.xml', category: 'General', sourceName: 'Blognone' },
    { url: 'https://www.beartai.com/feed', category: 'General', sourceName: 'Beartai' },
    { url: 'https://www.it24hrs.com/feed/', category: 'Security', sourceName: 'iT24Hrs' },
    { url: 'https://techsauce.co/feed', category: 'General', sourceName: 'Techsauce' },
    { url: 'https://www.techtalkthai.com/feed/', category: 'General', sourceName: 'TechTalk Thai' },
    
    // คลังความรู้ระดับสากลจาก Medium เข้าถึงได้เสถียรมาก
    //{ url: 'https://medium.com/feed/tag/cybersecurity', category: 'Security', sourceName: 'Medium (Cybersecurity)' },
    //{ url: 'https://medium.com/feed/tag/cloud-computing', category: 'General', sourceName: 'Medium (Cloud)' }
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
        
        // 1. อ่านไฟล์และกำจัดอักขระล่องหน (BOM) ที่มักแฝงมากับไฟล์ Text 
        const contentRaw = fs.readFileSync(filePath, 'utf-8');
        const content = contentRaw.replace(/^\uFEFF/, '').trim(); 
        
        // 2. ใช้ Regex ที่ยืดหยุ่นขึ้น (เอา ^ ออก เพื่อไม่บังคับว่าต้องติดบรรทัดแรกสุดเผื่อมีเคาะว่าง)
        const match = content.match(/---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)/);
        
        // ค่าเริ่มต้น (หากไฟล์ไหนไม่มีหัวไฟล์ จะถูกจัดลงหมวดนี้)
        let title = file.replace('.md', '');
        let category = 'Internal'; 
        let source = 'คู่มือภายใน';
        let thumbnail = null;
        let actualContent = content;

        if (match) {
            // 3. ใช้การสับบรรทัดแบบรองรับทั้ง Windows (\r\n) และ Mac/Linux (\n)
            const yamlLines = match[1].split(/\r?\n/);
            actualContent = match[2].trim();
            
            yamlLines.forEach(line => {
                // 4. แยก Key และ Value แบบปลอดภัย (ใช้ indexOf ป้องกันปัญหาเครื่องหมาย : ซ้อนใน URL รูปภาพ)
                const splitIndex = line.indexOf(':');
                if (splitIndex > -1) {
                    const key = line.slice(0, splitIndex).trim().toLowerCase(); // แปลงคีย์เป็นพิมพ์เล็กเสมอ
                    const value = line.slice(splitIndex + 1).trim(); // ตัดช่องว่างหัวท้ายของค่า
                    
                    if (key === 'title') title = value;
                    if (key === 'category') category = value; // จะดึงคำว่า "Law" มาได้แน่นอน
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

    for (const feedConfig of FEEDS) {
        try {
            console.log(`กำลังดึงข้อมูลจาก: ${feedConfig.sourceName}`);
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
            console.error(`❌ ข้ามแหล่งข้อมูล ${feedConfig.sourceName} เนื่องจาก:`, error.message);
        }
    }

    const localData = readLocalKnowledge();
    allArticles = [...localData, ...allArticles];
    allArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    fs.writeFileSync('data.json', JSON.stringify(allArticles, null, 2), 'utf-8');
    console.log(`🎉 สรุปคลังความรู้ใหม่เสร็จสิ้นทั้งหมด ${allArticles.length} รายการ`);
}

main();
