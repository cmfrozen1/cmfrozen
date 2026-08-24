const https = require('https');

const CHANNEL_ACCESS_TOKEN = 'M3Kq6rRtEbwEqw8FwrwE961ZFGyH/XO5doAy6BYwQQF+adWLctYF162u2ruTk114Oas14dPVOE03uOR2fsh7g82UkFtc4Ssx3ryMhUQgeJ48vpoVkFv9ZsllbsdRJEneCuL6/mWsCKHYlrnKURr1CAdB04t89/1O/w1cDnyilFU=';
const USER_ID = 'Udbbade279eccf58a2092f492a452e608';
const SERPAPI_URL = 'https://serpapi.com/search.json?engine=google_news&q=space';

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJSON(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('JSON parse error')); }
      });
    }).on('error', reject);
  });
}

function lineApiRequest(path, method, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.line.me',
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN,
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('LINE API [' + res.statusCode + ']:', data.slice(0,300));
        try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr.replace(',',''));
    return d.toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'numeric' });
  } catch { return dateStr.split(',')[0]; }
}

function buildFlexMessage(news, profile) {
  const displayName = profile.displayName || 'ผู้ใช้';
  const pictureUrl  = profile.pictureUrl  || 'https://via.placeholder.com/50';

  const stories = [];
  for (const group of news.news_results) {
    const s = group.stories ? group.stories[0] : group;
    if (s && s.title) stories.push(s);
    if (stories.length >= 5) break;
  }

  const heroBanner = {
    type: 'box',
    layout: 'vertical',
    paddingAll: '0px',
    contents: [
      {
        type: 'image',
        url: stories[0] && stories[0].thumbnail ? stories[0].thumbnail : 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800',
        size: 'full',
        aspectRatio: '20:9',
        aspectMode: 'cover'
      },
      {
        type: 'box',
        layout: 'vertical',
        position: 'absolute',
        offsetTop: '0px', offsetBottom: '0px',
        offsetStart: '0px', offsetEnd: '0px',
        backgroundColor: '#00000077',
        contents: []
      },
      {
        type: 'box',
        layout: 'vertical',
        position: 'absolute',
        offsetBottom: '16px',
        offsetStart: '16px',
        offsetEnd: '80px',
        contents: [
          { type: 'text', text: '🚀 SPACE NEWS', size: 'xs', color: '#4FC3F7', weight: 'bold' },
          { type: 'text', text: stories[0] ? stories[0].title : 'Latest Space News', size: 'md', color: '#FFFFFF', weight: 'bold', wrap: true, maxLines: 3 },
          { type: 'text', text: stories[0] && stories[0].source ? stories[0].source.name : '', size: 'xxs', color: '#B0BEC5', margin: 'sm' }
        ]
      },
      {
        type: 'box',
        layout: 'vertical',
        position: 'absolute',
        offsetTop: '12px',
        offsetEnd: '12px',
        width: '52px',
        height: '52px',
        cornerRadius: '999px',
        borderWidth: '3px',
        borderColor: '#4FC3F7',
        contents: [
          { type: 'image', url: pictureUrl, size: 'full', aspectRatio: '1:1', aspectMode: 'cover' }
        ]
      },
      {
        type: 'box',
        layout: 'vertical',
        position: 'absolute',
        offsetTop: '68px',
        offsetEnd: '6px',
        backgroundColor: '#1565C0CC',
        cornerRadius: '8px',
        paddingAll: '3px',
        paddingStart: '5px',
        paddingEnd: '5px',
        contents: [
          { type: 'text', text: displayName, size: 'xxs', color: '#E3F2FD', align: 'center', maxLines: 1 }
        ]
      }
    ]
  };

  const accentColors = ['#1565C0','#4527A0','#1B5E20','#BF360C'];

  function newsCard(story, index) {
    const accent = accentColors[index % accentColors.length];
    return {
      type: 'box',
      layout: 'horizontal',
      spacing: 'md',
      paddingAll: '12px',
      contents: [
        {
          type: 'box',
          layout: 'vertical',
          width: '70px',
          height: '70px',
          cornerRadius: '10px',
          contents: [
            {
              type: 'image',
              url: story.thumbnail || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=200',
              size: 'full',
              aspectRatio: '1:1',
              aspectMode: 'cover'
            }
          ]
        },
        {
          type: 'box',
          layout: 'vertical',
          flex: 1,
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              alignItems: 'center',
              contents: [
                { type: 'box', layout: 'vertical', width: '4px', height: '14px', backgroundColor: accent, contents: [] },
                { type: 'text', text: story.source ? story.source.name : 'News', size: 'xxs', color: '#78909C', margin: 'sm', flex: 1 }
              ]
            },
            { type: 'text', text: story.title, size: 'sm', color: '#E0E0E0', weight: 'bold', wrap: true, maxLines: 2, margin: 'xs' },
            { type: 'text', text: story.date ? formatDate(story.date) : '', size: 'xxs', color: '#546E7A', margin: 'xs' }
          ]
        }
      ]
    };
  }

  const sep = { type: 'separator', color: '#263238', margin: 'none' };
  const newsItems = [];
  for (let i = 1; i < stories.length; i++) {
    if (i > 1) newsItems.push(sep);
    newsItems.push(newsCard(stories[i], i));
  }

  const footer = {
    type: 'box',
    layout: 'horizontal',
    paddingAll: '12px',
    backgroundColor: '#0D1117',
    alignItems: 'center',
    contents: [
      {
        type: 'box',
        layout: 'horizontal',
        flex: 1,
        alignItems: 'center',
        contents: [
          { type: 'image', url: pictureUrl, size: '24px', aspectRatio: '1:1', aspectMode: 'cover' },
          { type: 'text', text: 'สวัสดี ' + displayName + ' 👋', size: 'xs', color: '#B0BEC5', margin: 'sm' }
        ]
      },
      { type: 'text', text: 'Google News · Space', size: 'xxs', color: '#4FC3F7', align: 'end', flex: 1 }
    ]
  };

  return {
    type: 'flex',
    altText: '🚀 Space News: ' + (stories[0] ? stories[0].title.slice(0,60) : 'Latest updates'),
    contents: {
      type: 'bubble',
      size: 'giga',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'none',
        paddingAll: '0px',
        backgroundColor: '#161B22',
        contents: [
          heroBanner,
          {
            type: 'box',
            layout: 'horizontal',
            paddingStart: '16px',
            paddingEnd: '16px',
            paddingTop: '14px',
            paddingBottom: '6px',
            contents: [
              { type: 'text', text: 'ข่าวล่าสุด', size: 'sm', color: '#90A4AE', weight: 'bold', flex: 1 },
              { type: 'text', text: stories.length + ' เรื่อง', size: 'xxs', color: '#4FC3F7' }
            ]
          },
          sep,
          { type: 'box', layout: 'vertical', backgroundColor: '#0D1117', contents: newsItems },
          sep,
          footer
        ]
      }
    }
  };
}

async function main() {
  console.log('👤 ดึงโปรไฟล์ LINE...');
  const profile = await lineApiRequest('/v2/bot/profile/' + USER_ID, 'GET');
  console.log('✅ โปรไฟล์:', profile.displayName);

  console.log('📰 ดึงข่าวจาก SerpAPI...');
  const news = await fetchJSON(SERPAPI_URL);
  console.log('✅ พบข่าว:', news.news_results ? news.news_results.length : 0, 'กลุ่ม');

  console.log('🎨 สร้าง Flex Message...');
  const flexMsg = buildFlexMessage(news, profile);

  console.log('📤 ส่งไปยัง LINE...');
  const result = await lineApiRequest('/v2/bot/message/push', 'POST', { to: USER_ID, messages: [flexMsg] });

  const resultStr = JSON.stringify(result);
  if (resultStr === '{}' || result.message === '') {
    console.log('🎉 ส่งสำเร็จ! ตรวจสอบ LINE ของคุณได้เลย');
  } else {
    console.log('📬 ผลลัพธ์:', resultStr);
  }
}

main().catch(err => { console.error('❌ Error:', err.message); process.exit(1); });
