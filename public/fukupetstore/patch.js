const fs = require('fs');

// Patch index.html
let indexContent = fs.readFileSync('index.html', 'utf-8');

// 1. Hide/show trust-badges-row
indexContent = indexContent.replace(
  /<div className="trust-badges-row">/g,
  '{siteData.section_visibility?.trust_badges !== false && (\n                  <div className="trust-badges-row">'
);
indexContent = indexContent.replace(
  /<\/div>\n                <\/div>\n\n                {\/\* Product Form Column \(Right\) \*\//g,
  '</div>\n                  )}\n                </div>\n\n                {/* Product Form Column (Right) */'
);

// 2. Add SEO meta tags in index.html inside the main App return or handle via useEffect
const seoEffectCode = `
      // Update SEO Meta Tags
      useEffect(() => {
        if (siteData.seo) {
          if (siteData.seo.title) document.title = siteData.seo.title;
          
          let metaDesc = document.querySelector('meta[name="description"]');
          if (metaDesc && siteData.seo.description) {
            metaDesc.setAttribute("content", siteData.seo.description);
          }
          
          let metaKeywords = document.querySelector('meta[name="keywords"]');
          if (!metaKeywords && siteData.seo.keywords) {
            metaKeywords = document.createElement('meta');
            metaKeywords.name = "keywords";
            document.head.appendChild(metaKeywords);
          }
          if (metaKeywords && siteData.seo.keywords) {
            metaKeywords.setAttribute("content", siteData.seo.keywords);
          }
        }
      }, [siteData.seo]);
`;

indexContent = indexContent.replace(
  /\/\/ Sync countdown timer with admin-configured duration/,
  seoEffectCode + '\n      // Sync countdown timer with admin-configured duration'
);

fs.writeFileSync('index.html', indexContent, 'utf-8');

// Patch admin.html
let adminContent = fs.readFileSync('admin.html', 'utf-8');

// Add SEO to Sidebar Menu
const seoMenuCode = `
                  <li className="sidebar-menu-item">
                    <a
                      className={\`sidebar-menu-link \${activeTab === 'seo' ? 'active' : ''}\`}
                      onClick={() => setActiveTab('seo')}
                    >
                      <i className="bi bi-search"></i>
                      <span>ตั้งค่า SEO</span>
                    </a>
                  </li>
`;
adminContent = adminContent.replace(
  /<span>ฐานข้อมูล SQL<\/span>\n                    <\/a>\n                  <\/li>/,
  '<span>ฐานข้อมูล SQL</span>\n                    </a>\n                  </li>\n' + seoMenuCode
);

// Add SEO Tab Content
const seoTabCode = `
            {/* TAB: SEO SETTINGS */}
            {activeTab === 'seo' && (
              <div className="fukupet-card">
                <div className="fukupet-card-header">
                  <h3 className="fukupet-card-title">
                    <i className="bi bi-search"></i>
                    ตั้งค่า SEO (Search Engine Optimization)
                  </h3>
                  <button className="btn-fukupet-primary btn-sm" onClick={() => saveSection('seo')}>
                    💾 บันทึกส่วนนี้
                  </button>
                </div>
                <div className="form-grid">
                  <div className="form-group full-width">
                    <label className="form-label">Meta Title (ชื่อหน้าเว็บ)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={siteData.seo?.title || ''}
                      onChange={e => setSiteData({ ...siteData, seo: { ...siteData.seo, title: e.target.value } })}
                      placeholder="เช่น หมอนโคซี่ Fukupetstore - หมอนสุขภาพที่ดีที่สุด"
                    />
                  </div>
                  <div className="form-group full-width">
                    <label className="form-label">Meta Description (คำอธิบายหน้าเว็บ)</label>
                    <textarea
                      className="form-textarea"
                      value={siteData.seo?.description || ''}
                      onChange={e => setSiteData({ ...siteData, seo: { ...siteData.seo, description: e.target.value } })}
                      placeholder="อธิบายเกี่ยวกับหน้าเว็บสั้นๆ เพื่อให้แสดงผลบน Google"
                    ></textarea>
                  </div>
                  <div className="form-group full-width">
                    <label className="form-label">Meta Keywords (คำค้นหา)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={siteData.seo?.keywords || ''}
                      onChange={e => setSiteData({ ...siteData, seo: { ...siteData.seo, keywords: e.target.value } })}
                      placeholder="เช่น หมอนสุขภาพ, หมอนเมมโมรี่โฟม, แก้ปวดคอ (คั่นด้วยลูกน้ำ)"
                    />
                  </div>
                </div>
              </div>
            )}
`;
adminContent = adminContent.replace(
  /\{\/\* TAB 2: ORDERS TABLE \*\/\}/,
  seoTabCode + '\n            {/* TAB 2: ORDERS TABLE */}'
);

// Add Trust Badges toggle in Product Tab
const trustBadgeToggleCode = `
                      <div className="form-group full-width">
                        <label className="form-label">แสดงไอคอนความน่าเชื่อถือ (Trust Badges)</label>
                        <select
                          className="form-select"
                          value={siteData.section_visibility?.trust_badges !== false ? '1' : '0'}
                          onChange={e => toggleSectionVisibility('trust_badges')}
                        >
                          <option value="1">แสดง (Show)</option>
                          <option value="0">ซ่อน (Hide)</option>
                        </select>
                      </div>
`;
adminContent = adminContent.replace(
  /<label className="form-label">ข้อความรับประกัน \(ใต้ปุ่มสั่งซื้อ\)<\/label>/,
  trustBadgeToggleCode + '\n                        <label className="form-label">ข้อความรับประกัน (ใต้ปุ่มสั่งซื้อ)</label>'
);

fs.writeFileSync('admin.html', adminContent, 'utf-8');
console.log("Patched successfully");
