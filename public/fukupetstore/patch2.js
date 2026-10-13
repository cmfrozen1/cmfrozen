const fs = require('fs');

/* ============================================================
   PATCH admin.html
   ============================================================ */
let admin = fs.readFileSync('admin.html', 'utf-8');

// 1. Fix SEO menu in sidebar (re-insert properly inside System & Settings section)
//    First remove the broken SEO entry if it exists from patch.js
admin = admin.replace(/\s*<li className="sidebar-menu-item">\s*<a\s*className=\{`sidebar-menu-link \$\{activeTab === 'seo' \? 'active' : ''\}`\}\s*onClick=\{.*?setActiveTab\('seo'\).*?\}\s*>\s*<i className="bi bi-search"><\/i>\s*<span>.*?<\/span>\s*<\/a>\s*<\/li>/s, '');

// Re-add SEO + Payment menus in System & Settings section
admin = admin.replace(
  /<span>ฐานข้อมูล SQL<\/span>\n                    <\/a>\n                  <\/li>/,
  `<span>ฐานข้อมูล SQL</span>
                    </a>
                  </li>
                  <li className="sidebar-menu-item">
                    <a
                      className={\`sidebar-menu-link \${activeTab === 'seo' ? 'active' : ''}\`}
                      onClick={() => setActiveTab('seo')}
                    >
                      <i className="bi bi-search"></i>
                      <span>ตั้งค่า SEO</span>
                    </a>
                  </li>
                  <li className="sidebar-menu-item">
                    <a
                      className={\`sidebar-menu-link \${activeTab === 'payment_settings' ? 'active' : ''}\`}
                      onClick={() => setActiveTab('payment_settings')}
                    >
                      <i className="bi bi-credit-card-fill"></i>
                      <span>ตั้งค่าการชำระเงิน</span>
                    </a>
                  </li>`
);

// 2. Fix navbar breadcrumb to include SEO and payment_settings tabs
admin = admin.replace(
  `{activeTab === 'database' && 'การตั้งค่าฐานข้อมูล SQL'}`,
  `{activeTab === 'database' && 'การตั้งค่าฐานข้อมูล SQL'}
                    {activeTab === 'seo' && 'ตั้งค่า SEO'}
                    {activeTab === 'payment_settings' && 'ตั้งค่าการชำระเงิน'}`
);

// 3. Remove broken SEO tab from previous patch and replace with proper version
admin = admin.replace(
  /\s*\{\/\* TAB: SEO SETTINGS \*\/\}\s*\{activeTab === 'seo' &&[\s\S]*?\}\s*\}\s*\)\}\s*\n\s*\{\/\* TAB 2: ORDERS TABLE \*\/\}/,
  '\n            {/* TAB 2: ORDERS TABLE */'
);

// 4. Add Top Bar visibility to CONTENT_SECTIONS (the topbar was already in the list with visibilityKey: 'top_bar' - the issue is in index.html)
// Nothing to change in admin.html for this.

// 5. Add color selector field to Product section (inside sizes subtab area or new subtab)
// Add after SUBTAB 5 (sizes) — add a note about color selection for bundle >= 2
// We'll add a new "color options" field to product section

// 6. Add footer fields: products, services, contact, payments to footer subtab
admin = admin.replace(
  `<label className="form-label">ข้อความลิขสิทธิ์ (Copyright)</label>
                        <input
                          type="text"
                          className="form-input"
                          value={siteData.footer?.copyright || ''}
                          onChange={e => setSiteData({ ...siteData, footer: { ...siteData.footer, copyright: e.target.value } })}
                        />
                      </div>
                    </div>
                  </div>
                )}`,
  `<label className="form-label">ข้อความลิขสิทธิ์ (Copyright)</label>
                        <input
                          type="text"
                          className="form-input"
                          value={siteData.footer?.copyright || ''}
                          onChange={e => setSiteData({ ...siteData, footer: { ...siteData.footer, copyright: e.target.value } })}
                        />
                      </div>
                      <div className="form-group full-width">
                        <label className="form-label">ข้อความวิธีชำระเงิน (Payments Text)</label>
                        <input
                          type="text"
                          className="form-input"
                          value={siteData.footer?.payments || ''}
                          onChange={e => setSiteData({ ...siteData, footer: { ...siteData.footer, payments: e.target.value } })}
                        />
                      </div>
                      <div className="form-group full-width">
                        <label className="form-label">แสดงส่วน "เข้าร่วม Club" (Fukupetstore Club Section)</label>
                        <select
                          className="form-select"
                          value={siteData.section_visibility?.club_section !== false ? '1' : '0'}
                          onChange={() => toggleSectionVisibility('club_section')}
                        >
                          <option value="1">แสดง (Show)</option>
                          <option value="0">ซ่อน (Hide)</option>
                        </select>
                      </div>
                    </div>

                    <h5 className="fw-bold mt-4 mb-3 text-dark">รายการสินค้าใน Footer</h5>
                    {(siteData.footer?.products || []).map((p, idx) => (
                      <div key={idx} className="d-flex gap-2 mb-2 align-items-center">
                        <input type="text" className="form-input" placeholder="ชื่อลิงก์" value={p.label}
                          onChange={e => { const a = [...siteData.footer.products]; a[idx].label = e.target.value; setSiteData({ ...siteData, footer: { ...siteData.footer, products: a } }); }} />
                        <input type="text" className="form-input" placeholder="#href" value={p.href}
                          onChange={e => { const a = [...siteData.footer.products]; a[idx].href = e.target.value; setSiteData({ ...siteData, footer: { ...siteData.footer, products: a } }); }} />
                        <button className="btn btn-sm btn-outline-danger px-2" onClick={() => { const a = siteData.footer.products.filter((_,i)=>i!==idx); setSiteData({...siteData,footer:{...siteData.footer,products:a}}); }}>ลบ</button>
                      </div>
                    ))}
                    <button className="btn-fukupet-outline btn-sm mt-1 mb-4" onClick={() => setSiteData({...siteData,footer:{...siteData.footer,products:[...(siteData.footer.products||[]),{label:'',href:'#'}]}})}>+ เพิ่มรายการสินค้า</button>

                    <h5 className="fw-bold mt-2 mb-3 text-dark">การบริการและช่วยเหลือ</h5>
                    {(siteData.footer?.services || []).map((s, idx) => (
                      <div key={idx} className="d-flex gap-2 mb-2 align-items-center">
                        <input type="text" className="form-input" placeholder="ชื่อลิงก์" value={s.label}
                          onChange={e => { const a = [...siteData.footer.services]; a[idx].label = e.target.value; setSiteData({ ...siteData, footer: { ...siteData.footer, services: a } }); }} />
                        <input type="text" className="form-input" placeholder="#href" value={s.href}
                          onChange={e => { const a = [...siteData.footer.services]; a[idx].href = e.target.value; setSiteData({ ...siteData, footer: { ...siteData.footer, services: a } }); }} />
                        <button className="btn btn-sm btn-outline-danger px-2" onClick={() => { const a = siteData.footer.services.filter((_,i)=>i!==idx); setSiteData({...siteData,footer:{...siteData.footer,services:a}}); }}>ลบ</button>
                      </div>
                    ))}
                    <button className="btn-fukupet-outline btn-sm mt-1 mb-4" onClick={() => setSiteData({...siteData,footer:{...siteData.footer,services:[...(siteData.footer.services||[]),{label:'',href:'#'}]}})}>+ เพิ่มรายการบริการ</button>

                    <h5 className="fw-bold mt-2 mb-3 text-dark">ข้อมูลติดต่อ</h5>
                    {(siteData.footer?.contact || []).map((c, idx) => (
                      <div key={idx} className="d-flex gap-2 mb-2 align-items-center">
                        <input type="text" className="form-input" placeholder="ชื่อช่องทางติดต่อ" value={c.label}
                          onChange={e => { const a = [...siteData.footer.contact]; a[idx].label = e.target.value; setSiteData({ ...siteData, footer: { ...siteData.footer, contact: a } }); }} />
                        <input type="text" className="form-input" placeholder="#href" value={c.href}
                          onChange={e => { const a = [...siteData.footer.contact]; a[idx].href = e.target.value; setSiteData({ ...siteData, footer: { ...siteData.footer, contact: a } }); }} />
                        <button className="btn btn-sm btn-outline-danger px-2" onClick={() => { const a = siteData.footer.contact.filter((_,i)=>i!==idx); setSiteData({...siteData,footer:{...siteData.footer,contact:a}}); }}>ลบ</button>
                      </div>
                    ))}
                    <button className="btn-fukupet-outline btn-sm mt-1" onClick={() => setSiteData({...siteData,footer:{...siteData.footer,contact:[...(siteData.footer.contact||[]),{label:'',href:'#'}]}})}>+ เพิ่มช่องทางติดต่อ</button>
                  </div>
                )}

                {/* COLOR OPTIONS - เพิ่มในส่วนสินค้า (เลือกสีเมื่อซื้อ 2+ ชิ้น) */}`
);

// 7. Add Color Options subtab - insert after SUBTAB 6 (bundles)
// Find end of bundles subtab and insert color options tab
admin = admin.replace(
  `{/* SUBTAB 7: UPSELL */}`,
  `{/* SUBTAB 6b: COLOR OPTIONS */}
                {activeContentSubTab === 'colors' && (
                  <div className="fukupet-card">
                    {renderSectionHeader('ตัวเลือกสี (Color Options)', 'bi-palette', 'colors', 'product', 'product')}
                    <div className="alert alert-info small">
                      <i className="bi bi-info-circle-fill me-2"></i>
                      ตัวเลือกสีนี้จะแสดงเมื่อลูกค้าเลือกซื้อ <strong>2 ชิ้นขึ้นไป</strong> (Bundle ≥ 2 ชิ้น)
                    </div>
                    <div className="form-group">
                      <label className="form-label">ชื่อหัวข้อเลือกสี</label>
                      <input type="text" className="form-input"
                        value={siteData.product?.color_label || 'เลือกสีปลอกหมอน:'}
                        onChange={e => setSiteData({ ...siteData, product: { ...siteData.product, color_label: e.target.value } })}
                      />
                    </div>
                    <h5 className="fw-bold mt-4 mb-3 text-dark">รายการสีที่ให้เลือก</h5>
                    {(siteData.product?.color_options || []).map((col, idx) => (
                      <div key={idx} className="d-flex gap-2 mb-2 align-items-center">
                        <input type="text" className="form-input" placeholder="ชื่อสี เช่น ขาว, เทา" value={col.name}
                          onChange={e => { const a = [...siteData.product.color_options]; a[idx].name = e.target.value; setSiteData({ ...siteData, product: { ...siteData.product, color_options: a } }); }} />
                        <input type="color" style={{ width: 48, height: 40, border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer' }} value={col.hex || '#ffffff'}
                          onChange={e => { const a = [...siteData.product.color_options]; a[idx].hex = e.target.value; setSiteData({ ...siteData, product: { ...siteData.product, color_options: a } }); }} />
                        <button className="btn btn-sm btn-outline-danger px-2" onClick={() => { const a = siteData.product.color_options.filter((_,i)=>i!==idx); setSiteData({...siteData,product:{...siteData.product,color_options:a}}); }}>ลบ</button>
                      </div>
                    ))}
                    <button className="btn-fukupet-lime btn-sm mt-2" onClick={() => setSiteData({...siteData,product:{...siteData.product,color_options:[...(siteData.product.color_options||[]),{name:'',hex:'#ffffff'}]}})}>
                      <i className="bi bi-plus-lg"></i> เพิ่มสี
                    </button>
                  </div>
                )}

                {/* SUBTAB 7: UPSELL */}`
);

// 8. Add 'colors' to sidebar CONTENT_SECTIONS after bundles
// The CONTENT_SECTIONS array — we need to add it after 'bundles'
// (This is static JS, not dynamic, so we edit the array directly)
admin = admin.replace(
  `{ id: 'upsell', label: '7. สินค้าซื้อเพิ่ม (Upsell)', icon: 'bi-plus-circle', visibilityKey: 'upsell' },`,
  `{ id: 'colors', label: '6.5 ตัวเลือกสี', icon: 'bi-palette', visibilityKey: 'product' },
      { id: 'upsell', label: '7. สินค้าซื้อเพิ่ม (Upsell)', icon: 'bi-plus-circle', visibilityKey: 'upsell' },`
);

// 9. Add SEO and Payment Settings tabs content (replace old broken SEO tab)
// Remove old broken SEO tab if it exists
admin = admin.replace(
  /\n\s*\{\/\* TAB: SEO SETTINGS \*\/\}\n\s*\{activeTab === 'seo'[\s\S]*?\}\s*\)\}\n\s*\n\s*\{\/\* TAB 2:/,
  '\n            {/* TAB 2:'
);

// Insert SEO + Payment tabs before TAB 2 ORDERS
const seoAndPaymentTabs = `
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
                <div className="alert alert-info small mb-4">
                  <i className="bi bi-info-circle-fill me-2"></i>
                  การตั้งค่า SEO จะช่วยให้ Google และ Search Engine อื่นๆ แสดงผลหน้าเว็บของคุณได้ดียิ่งขึ้น
                </div>
                <div className="form-grid">
                  <div className="form-group full-width">
                    <label className="form-label">Meta Title (ชื่อหน้าเว็บที่แสดงบน Google)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={siteData.seo?.title || ''}
                      onChange={e => setSiteData({ ...siteData, seo: { ...siteData.seo, title: e.target.value } })}                        placeholder="เช่น หมอนโคซี่ Fukupetstore - หมอนสุขภาพที่ดีที่สุด"
                    />
                    <small className="text-muted">แนะนำ: 50-60 ตัวอักษร</small>
                  </div>
                  <div className="form-group full-width">
                    <label className="form-label">Meta Description (คำอธิบายหน้าเว็บ)</label>
                    <textarea
                      className="form-textarea"
                      value={siteData.seo?.description || ''}
                      onChange={e => setSiteData({ ...siteData, seo: { ...siteData.seo, description: e.target.value } })}
                      placeholder="อธิบายเกี่ยวกับหน้าเว็บสั้นๆ เพื่อให้แสดงผลบน Google"
                    ></textarea>
                    <small className="text-muted">แนะนำ: 150-160 ตัวอักษร</small>
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
                  <div className="form-group full-width">
                    <label className="form-label">OG Image URL (รูปตัวอย่างเมื่อแชร์ Social Media)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={siteData.seo?.og_image || ''}
                      onChange={e => setSiteData({ ...siteData, seo: { ...siteData.seo, og_image: e.target.value } })}
                      placeholder="URL รูปภาพสำหรับ Facebook/Line แชร์"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB: PAYMENT SETTINGS */}
            {activeTab === 'payment_settings' && (
              <div className="fukupet-card">
                <div className="fukupet-card-header">
                  <h3 className="fukupet-card-title">
                    <i className="bi bi-credit-card-fill"></i>
                    ตั้งค่าการชำระเงิน
                  </h3>
                  <button className="btn-fukupet-primary btn-sm" onClick={() => saveSection('payment_settings')}>
                    💾 บันทึกส่วนนี้
                  </button>
                </div>

                <h5 className="fw-bold mb-3 text-dark">วิธีชำระเงินที่เปิดใช้</h5>
                <div className="form-grid mb-4">
                  <div className="form-group">
                    <label className="form-label">เก็บเงินปลายทาง (COD)</label>
                    <select className="form-select"
                      value={siteData.payment_settings?.cod_enabled !== false ? '1' : '0'}
                      onChange={e => setSiteData({ ...siteData, payment_settings: { ...siteData.payment_settings, cod_enabled: e.target.value === '1' } })}>
                      <option value="1">เปิดใช้งาน</option>
                      <option value="0">ปิดใช้งาน</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">โอนเงินธนาคาร (Bank Transfer)</label>
                    <select className="form-select"
                      value={siteData.payment_settings?.bank_enabled !== false ? '1' : '0'}
                      onChange={e => setSiteData({ ...siteData, payment_settings: { ...siteData.payment_settings, bank_enabled: e.target.value === '1' } })}>
                      <option value="1">เปิดใช้งาน</option>
                      <option value="0">ปิดใช้งาน</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">พร้อมเพย์ (PromptPay)</label>
                    <select className="form-select"
                      value={siteData.payment_settings?.promptpay_enabled ? '1' : '0'}
                      onChange={e => setSiteData({ ...siteData, payment_settings: { ...siteData.payment_settings, promptpay_enabled: e.target.value === '1' } })}>
                      <option value="1">เปิดใช้งาน</option>
                      <option value="0">ปิดใช้งาน</option>
                    </select>
                  </div>
                </div>

                <h5 className="fw-bold mb-3 text-dark">ตั้งค่าพร้อมเพย์ (PromptPay QR)</h5>
                <div className="form-grid mb-4">
                  <div className="form-group">
                    <label className="form-label">เบอร์โทร / เลขประจำตัว PromptPay</label>
                    <input type="text" className="form-input"
                      value={siteData.payment_settings?.promptpay_number || ''}
                      onChange={e => setSiteData({ ...siteData, payment_settings: { ...siteData.payment_settings, promptpay_number: e.target.value } })}
                      placeholder="เช่น 0812345678 หรือ 1234567890123"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">ชื่อบัญชี PromptPay</label>
                    <input type="text" className="form-input"
                      value={siteData.payment_settings?.promptpay_name || ''}
                      onChange={e => setSiteData({ ...siteData, payment_settings: { ...siteData.payment_settings, promptpay_name: e.target.value } })}
                      placeholder="ชื่อที่แสดงบน QR Code"
                    />
                  </div>
                  <div className="form-group full-width">
                    <label className="form-label">QR Code พร้อมเพย์ (สร้างอัตโนมัติจากเบอร์โทร/เลขประจำตัวด้านบน)</label>
                    <p className="text-muted" style={{ fontSize: 13 }}>QR Code จะถูกสร้างจาก <strong>เบอร์โทร / เลขประจำตัว PromptPay</strong> ที่กรอกด้านบนโดยอัตโนมัติ ไม่ต้องอัปโหลดรูป</p>
                    {siteData.payment_settings?.promptpay_number ? (
                      <div className="mt-2">
                        <img src={\`https://promptpay.io/\${siteData.payment_settings.promptpay_number}.png\`} alt="QR Preview" style={{ width: 150, height: 150, objectFit: 'contain', border: '1px solid #ddd', borderRadius: 8, padding: 8, background: '#fff' }} />
                      </div>
                    ) : (
                      <p className="text-muted" style={{ fontSize: 13 }}>ยังไม่ได้กรอกเบอร์โทร / เลขประจำตัว PromptPay</p>
                    )}
                  </div>
                </div>

                <h5 className="fw-bold mb-3 text-dark">ตั้งค่าโอนเงินธนาคาร</h5>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">ชื่อธนาคาร</label>
                    <input type="text" className="form-input"
                      value={siteData.payment_settings?.bank_name || ''}
                      onChange={e => setSiteData({ ...siteData, payment_settings: { ...siteData.payment_settings, bank_name: e.target.value } })}
                      placeholder="เช่น ธนาคารกสิกรไทย (KBank)"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">เลขบัญชี</label>
                    <input type="text" className="form-input"
                      value={siteData.payment_settings?.bank_account || ''}
                      onChange={e => setSiteData({ ...siteData, payment_settings: { ...siteData.payment_settings, bank_account: e.target.value } })}
                      placeholder="เช่น 123-4-56789-0"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">ชื่อเจ้าของบัญชี</label>
                    <input type="text" className="form-input"
                      value={siteData.payment_settings?.bank_account_name || ''}
                      onChange={e => setSiteData({ ...siteData, payment_settings: { ...siteData.payment_settings, bank_account_name: e.target.value } })}
                      placeholder="เช่น บริษัท ฟุกุเพ็ต จำกัด"
                    />
                  </div>
                </div>
              </div>
            )}

`;

admin = admin.replace(
  '\n            {/* TAB 2: ORDERS TABLE */',
  seoAndPaymentTabs + '\n            {/* TAB 2: ORDERS TABLE */'
);

fs.writeFileSync('admin.html', admin, 'utf-8');
console.log('admin.html patched');

/* ============================================================
   PATCH index.html
   ============================================================ */
let index = fs.readFileSync('index.html', 'utf-8');

// 1. Fix top_bar conditional (section 1 visibility)
// Check if top-bar is already wrapped
if (!index.includes('section_visibility?.top_bar')) {
  index = index.replace(
    '<div className="top-bar">',
    '{siteData.section_visibility?.top_bar !== false && (<div className="top-bar">'
  );
  // Need to close it after the closing </div></div>
  index = index.replace(
    /{siteData\.section_visibility\?\.top_bar !== false && \(<div className="top-bar">[\s\S]*?<\/div>\n          <\/div>}/,
    (m) => m + '\n          )}'
  );
}

// 2. Fix Fukupetstore Club to support visibility
index = index.replace(
  '<section className="chowa-club-sec">',
  '{siteData.section_visibility?.club_section !== false && (<section className="chowa-club-sec">'
);
index = index.replace(
  '</section>\n\n          {siteData.section_visibility?.footer !== false',
  '</section>\n          )}\n\n          {siteData.section_visibility?.footer !== false'
);

// 3. Add color selector when bundle >= 2 selected
// After size selector and before upsell
index = index.replace(
  `{/* Upsell Checkbox */}
                  {siteData.product?.upsell?.enabled && (`,
  `{/* Color Selector - show when bundle >= 2 items */}
                  {(selectedBundleId === 2 || selectedBundleId === 4) && (siteData.product?.color_options || []).length > 0 && (
                    <div className="bundle-section" style={{ paddingTop: 16 }}>
                      <div className="option-group-label">{siteData.product?.color_label || 'เลือกสีปลอกหมอน:'}</div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
                        {(siteData.product.color_options || []).map((col, idx) => (
                          <div
                            key={idx}
                            onClick={() => setSelectedColor(col.name)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
                              border: selectedColor === col.name ? '2px solid var(--primary-color)' : '1.5px solid #ddd',
                              background: selectedColor === col.name ? 'rgba(7,47,31,0.05)' : '#fff',
                              fontWeight: 600, fontSize: 14
                            }}
                          >
                            <span style={{ width: 20, height: 20, borderRadius: '50%', background: col.hex, border: '1px solid #ccc', display: 'inline-block' }}></span>
                            {col.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upsell Checkbox */}
                  {siteData.product?.upsell?.enabled && (`
);

// 4. Add selectedColor state
index = index.replace(
  '// Gallery state\n      const [activeSlide, setActiveSlide] = useState(0);',
  '// Gallery state\n      const [activeSlide, setActiveSlide] = useState(0);\n      const [selectedColor, setSelectedColor] = useState(\'\');'
);

// 5. Include selected color in order payload
index = index.replace(
  'quantity: quantity,\n          upsell_included: upsellAdded,',
  'quantity: quantity,\n          color: selectedColor || null,\n          upsell_included: upsellAdded,'
);

// 6. Add payment method: promptpay
index = index.replace(
  `<div
                        className={\`payment-option \${orderForm.payment_method === 'bank' ? 'active' : ''}\`}
                        onClick={() => setOrderForm({ ...orderForm, payment_method: 'bank' })}
                      >
                        🏦 โอนเงินผ่านธนาคาร
                      </div>
                    </div>`,
  `<div
                        className={\`payment-option \${orderForm.payment_method === 'bank' ? 'active' : ''}\`}
                        onClick={() => setOrderForm({ ...orderForm, payment_method: 'bank' })}
                      >
                        🏦 โอนเงินผ่านธนาคาร
                      </div>
                      {siteData.payment_settings?.promptpay_enabled && (
                        <div
                          className={\`payment-option \${orderForm.payment_method === 'promptpay' ? 'active' : ''}\`}
                          onClick={() => setOrderForm({ ...orderForm, payment_method: 'promptpay' })}
                        >
                          📱 พร้อมเพย์ (PromptPay)
                        </div>
                      )}
                    </div>

                    {/* PromptPay QR Code - show after selecting promptpay */}
                    {orderForm.payment_method === 'promptpay' && siteData.payment_settings?.promptpay_number && (
                      <div style={{ marginTop: 16, padding: '16px', background: '#f8fafb', borderRadius: 12, textAlign: 'center', border: '1px solid #e2e8e4' }}>
                        <div style={{ fontWeight: 700, marginBottom: 8, color: '#072F1F' }}>📱 สแกน QR Code เพื่อชำระเงิน</div>
                        <img src={\`https://promptpay.io/\${siteData.payment_settings.promptpay_number}.png\`} alt="PromptPay QR"
                          style={{ width: 200, height: 200, objectFit: 'contain', borderRadius: 8, background: '#fff', padding: 8, border: '1px solid #ddd' }} />
                        <div style={{ marginTop: 8, fontSize: 14 }}>
                          <strong>{siteData.payment_settings?.promptpay_name}</strong>
                          {siteData.payment_settings?.promptpay_number && (
                            <div style={{ color: '#666', fontSize: 13 }}>{siteData.payment_settings.promptpay_number}</div>
                          )}
                        </div>
                        <div style={{ marginTop: 8, fontSize: 13, color: '#888' }}>ยอดที่ต้องชำระ: <strong style={{ color: '#072F1F' }}>฿{calculatedTotal.toLocaleString()}</strong></div>
                      </div>
                    )}`
);

// 7. Add bank transfer info after selecting bank
index = index.replace(
  `{orderForm.payment_method === 'promptpay' && siteData.payment_settings?.promptpay_number && (`,
  `{orderForm.payment_method === 'bank' && siteData.payment_settings?.bank_name && (
                      <div style={{ marginTop: 16, padding: '16px', background: '#f8fafb', borderRadius: 12, border: '1px solid #e2e8e4' }}>
                        <div style={{ fontWeight: 700, marginBottom: 8, color: '#072F1F' }}>🏦 รายละเอียดบัญชีธนาคาร</div>
                        <div style={{ fontSize: 14 }}><strong>ธนาคาร:</strong> {siteData.payment_settings?.bank_name}</div>
                        <div style={{ fontSize: 14 }}><strong>เลขบัญชี:</strong> {siteData.payment_settings?.bank_account}</div>
                        <div style={{ fontSize: 14 }}><strong>ชื่อบัญชี:</strong> {siteData.payment_settings?.bank_account_name}</div>
                        <div style={{ marginTop: 8, fontSize: 13, color: '#888' }}>ยอดที่ต้องโอน: <strong style={{ color: '#072F1F' }}>฿{calculatedTotal.toLocaleString()}</strong></div>
                      </div>
                    )}
                    {orderForm.payment_method === 'promptpay' && siteData.payment_settings?.promptpay_number && (`
);

// 8. After order is placed, if promptpay - show QR in success screen too
index = index.replace(
  `<div className="order-summary-row">
                       <span>วิธีชำระเงิน:</span>
                       <span>{orderForm.payment_method === 'cod' ? 'เก็บเงินปลายทาง (COD)' : 'โอนเงินผ่านธนาคาร'}</span>
                     </div>`,
  `<div className="order-summary-row">
                       <span>วิธีชำระเงิน:</span>
                       <span>{orderForm.payment_method === 'cod' ? 'เก็บเงินปลายทาง (COD)' : orderForm.payment_method === 'promptpay' ? 'พร้อมเพย์ (PromptPay)' : 'โอนเงินผ่านธนาคาร'}</span>
                     </div>`
);

// 9. Show QR in success screen for promptpay
index = index.replace(
  `<p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
                     เจ้าหน้าที่จะติดต่อเพื่อยืนยันการจัดส่งสินค้าโดยเร็วที่สุด`,
  `{orderForm.payment_method === 'promptpay' && siteData.payment_settings?.promptpay_number && (
                    <div style={{ margin: '16px 0', padding: '16px', background: '#f8fafb', borderRadius: 12, textAlign: 'center', border: '1px solid #e2e8e4' }}>
                      <div style={{ fontWeight: 700, marginBottom: 8, color: '#072F1F' }}>📱 กรุณาชำระเงินผ่านพร้อมเพย์</div>
                      <img src={\`https://promptpay.io/\${siteData.payment_settings.promptpay_number}.png\`} alt="PromptPay QR"
                        style={{ width: 200, height: 200, objectFit: 'contain', borderRadius: 8, background: '#fff', padding: 8, border: '1px solid #ddd' }} />
                      <div style={{ marginTop: 8, fontWeight: 700 }}>{siteData.payment_settings?.promptpay_name}</div>
                      <div style={{ color: '#666', fontSize: 13 }}>{siteData.payment_settings?.promptpay_number}</div>
                      <div style={{ marginTop: 8, fontSize: 13, color: '#888' }}>ยอดชำระ: <strong style={{ color: '#072F1F' }}>฿{orderResult?.total?.toLocaleString()}</strong></div>
                    </div>
                  )}
                  <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
                     เจ้าหน้าที่จะติดต่อเพื่อยืนยันการจัดส่งสินค้าโดยเร็วที่สุด`
);

// 10. Also add OG meta update in useEffect for SEO
index = index.replace(
  `if (metaKeywords && siteData.seo.keywords) {
            metaKeywords.setAttribute("content", siteData.seo.keywords);
          }`,
  `if (metaKeywords && siteData.seo.keywords) {
            metaKeywords.setAttribute("content", siteData.seo.keywords);
          }

          // OG Tags
          if (siteData.seo.og_image) {
            let ogImg = document.querySelector('meta[property="og:image"]');
            if (!ogImg) {
              ogImg = document.createElement('meta');
              ogImg.setAttribute('property', 'og:image');
              document.head.appendChild(ogImg);
            }
            ogImg.setAttribute('content', siteData.seo.og_image);
          }
          if (siteData.seo.description) {
            let ogDesc = document.querySelector('meta[property="og:description"]');
            if (!ogDesc) {
              ogDesc = document.createElement('meta');
              ogDesc.setAttribute('property', 'og:description');
              document.head.appendChild(ogDesc);
            }
            ogDesc.setAttribute('content', siteData.seo.description);
          }`
);

// 11. Add COD/Bank enabled check in payment options
index = index.replace(
  `<div
                        className={\`payment-option \${orderForm.payment_method === 'cod' ? 'active' : ''}\`}
                        onClick={() => setOrderForm({ ...orderForm, payment_method: 'cod' })}
                      >
                        🚚 เก็บเงินปลายทาง (COD)
                      </div>
                      <div
                        className={\`payment-option \${orderForm.payment_method === 'bank' ? 'active' : ''}\`}
                        onClick={() => setOrderForm({ ...orderForm, payment_method: 'bank' })}
                      >
                        🏦 โอนเงินผ่านธนาคาร
                      </div>`,
  `{siteData.payment_settings?.cod_enabled !== false && (
                        <div
                          className={\`payment-option \${orderForm.payment_method === 'cod' ? 'active' : ''}\`}
                          onClick={() => setOrderForm({ ...orderForm, payment_method: 'cod' })}
                        >
                          🚚 เก็บเงินปลายทาง (COD)
                        </div>
                      )}
                      {siteData.payment_settings?.bank_enabled !== false && (
                        <div
                          className={\`payment-option \${orderForm.payment_method === 'bank' ? 'active' : ''}\`}
                          onClick={() => setOrderForm({ ...orderForm, payment_method: 'bank' })}
                        >
                          🏦 โอนเงินผ่านธนาคาร
                        </div>
                      )}`
);

fs.writeFileSync('index.html', index, 'utf-8');
console.log('index.html patched');
console.log('All patches applied successfully!');
