const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');
const parser = new Parser();

// 1. กำหนดแหล่งข้อมูล RSS แยกตามหมวดหมู่
const FEEDS = [
    { url: 'https://www.blognone.com/atom.xml', category: 'General' },
    { url: 'https://www.beartai.com/feed', category: 'General' },
    { url: 'https://threatpost.com/feed/', category: 'Security' } // ตัวอย่างเว็บข่าว Security ต่างประเทศ (หรือเปลี่ยนเป็นเว็บไทยที่มี RSS ได้)
];

// ฟังก์ชันสำหรับอ่านไฟล์ Markdown จากโฟลเดอร์ knowledge
function readLocalKnowledge() {
    const knowledgeDir = path.join(__dirname, 'knowledge');
    let localArticles = [];

    if (!fs.existsSync(knowledgeDir)) return localArticles;

    const files = fs.readdirSync(knowledgeDir);
    files.forEach(file => {
        if (path.extname(file) === '.md') {
            const filePath = path.join(knowledgeDir, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            
            // แยกส่วนหัว (Front Matter) และ เนื้อหา
            const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
            
            let title = file.replace('.md', '');
            let category = 'Internal';
            let source = 'คู่มือภายใน';
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
                    }
                });
            }

            localArticles.push({
                id: `local-${file}`,
                title: title,
                link: `https://github.com/`, // ใส่ลิงก์ไปยัง repo ของคุณได้
                content: actualContent,
                pubDate: new Date().toISOString(),
                source: source,
                category: category
            });
        }
    });

    return localArticles;
}

async function main() {
    let allArticles = [];

    // ดึงข้อมูลจาก RSS Feeds
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
                    category: feedConfig.category // ใส่หมวดหมู่ให้ข่าว
                });
            });
        } catch (error) {
            console.error(`เกิดข้อผิดพลาดกับ ${feedConfig.url}:`, error.message);
        }
    }

    // ดึงข้อมูลจากไฟล์คู่มือภายในองค์กร (.md)
    const localData = readLocalKnowledge();
    allArticles = [...localData, ...allArticles];

    // เรียงลำดับล่าสุดขึ้นก่อน
    allArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    // บันทึกลง data.json
    fs.writeFileSync('data.json', JSON.stringify(allArticles, null, 2), 'utf-8');
    console.log(`ดึงและรวมคลังความรู้สำเร็จ! ทั้งหมด ${allArticles.length} รายการ`);
}

main();
