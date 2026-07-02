const Parser = require('rss-parser');
const fs = require('fs');
const parser = new Parser();

// ลิงก์ RSS Feed ข่าวไอทีที่ต้องการดึงข้อมูล
const FEED_URLS = [
    'https://www.blognone.com/atom.xml',
    'https://www.beartai.com/feed'
];

async function fetchNews() {
    let allArticles = [];

    for (const url of FEED_URLS) {
        try {
            console.log(`กำลังดึงข้อมูลจาก: ${url}`);
            const feed = await parser.parseURL(url);
            
            feed.items.forEach(item => {
                allArticles.push({
                    id: item.guid || item.id || Math.random().toString(36).substr(2, 9),
                    title: item.title,
                    link: item.link,
                    content: item.contentSnippet || item.content || "",
                    pubDate: item.pubDate || item.isoDate,
                    source: feed.title
                });
            });
        } catch (error) {
            console.error(`เกิดข้อผิดพลาดในการดึงข้อมูลจาก ${url}:`, error.message);
        }
    }

    // เรียงลำดับข่าวล่าสุดขึ้นก่อน
    allArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    // บันทึกลงไฟล์ data.json
    fs.writeFileSync('data.json', JSON.stringify(allArticles, null, 2), 'utf-8');
    console.log(`ดึงข่าวเสร็จสิ้น! บันทึกข้อมูลทั้งหมด ${allArticles.length} ข่าว ลง data.json แล้ว`);
}

fetchNews();
