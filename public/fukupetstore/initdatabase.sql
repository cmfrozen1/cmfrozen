-- ====================================================================
-- FUKUPET STORE - DATABASE INITIALIZATION SCRIPT (initdatabase.sql)
-- Host: localhost:3306
-- Database: fukupet_dbwebsite
-- User: fukupet_yok
--
-- SAFE RE-RUN (ADDITIVE ONLY):
--   ตารางถูกสร้างด้วย CREATE TABLE IF NOT EXISTS
--   ข้อมูลเริ่มต้นใช้ INSERT ... ON DUPLICATE KEY UPDATE `id` = `id`
--   ซึ่งจะเติมเฉพาะแถวที่ยังไม่มีในระบบเท่านั้น
--   ข้อมูลที่มีอยู่แล้ว (เนื้อหาเว็บ, ออเดอร์, รูปภาพ) จะไม่ถูกเขียนทับหรือลบ
-- ====================================================================

CREATE DATABASE IF NOT EXISTS `fukupet_dbwebsite` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `fukupet_dbwebsite`;

-- --------------------------------------------------------------------
-- 1. Table: site_sections (Flexible JSON store for all CMS sections)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `site_sections` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `section_key` VARCHAR(64) NOT NULL UNIQUE,
  `section_name` VARCHAR(128) NOT NULL,
  `data_json` LONGTEXT NOT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 2. Table: site_settings (General configs, SEO, contacts)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `site_settings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `setting_key` VARCHAR(64) NOT NULL UNIQUE,
  `setting_value` TEXT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 3. Table: orders (Customer order submissions from storefront)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `orders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_no` VARCHAR(32) NOT NULL UNIQUE,
  `customer_name` VARCHAR(128) NOT NULL,
  `customer_phone` VARCHAR(32) NOT NULL,
  `customer_address` TEXT NOT NULL,
  `product_title` VARCHAR(255) NOT NULL,
  `size_name` VARCHAR(128) NOT NULL,
  `bundle_name` VARCHAR(128) NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `upsell_included` TINYINT(1) NOT NULL DEFAULT 0,
  `total_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `payment_method` VARCHAR(32) NOT NULL DEFAULT 'cod',
  `status` ENUM('pending', 'confirmed', 'shipping', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  `tracking_number` VARCHAR(128) NULL,
  `notes` TEXT NULL,
  `slip_path` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 4. Table: media_files (Uploaded images catalog in /images)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `media_files` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `filename` VARCHAR(255) NOT NULL,
  `original_name` VARCHAR(255) NOT NULL,
  `file_path` VARCHAR(255) NOT NULL,
  `file_size` INT NOT NULL,
  `mime_type` VARCHAR(64) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 5. Table: admin_users (CMS Administrators)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(64) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `display_name` VARCHAR(128) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- INITIAL SEED DATA
-- Default Admin: admin / fukupet2026 (or password_verify)
-- --------------------------------------------------------------------
INSERT INTO `admin_users` (`username`, `password_hash`, `display_name`)
VALUES ('admin', '$2y$10$wK1mJ7vF6F03uXy5X0yAte1ZcZ7UjT9e1s4bX3rE.9oQpC1n9cZre', 'Administrator')
ON DUPLICATE KEY UPDATE `id` = `id`;

-- Default Site Settings
INSERT INTO `site_settings` (`setting_key`, `setting_value`) VALUES
('site_title', 'หมอนโคซี่ – Fukupetstore'),
('site_description', 'หมอนโคซี่ Fukupetstore หมอนสุขภาพใบใหญ่ที่ปรับความสูงได้เอง ไส้ไฮเปอร์เมมโมรี่โฟมนุ่มฟูเหมือนนอนบนปุยเมฆ'),
('site_favicon', 'https://www.chowa.in.th/cdn/shop/files/Favicon_chowa_new_f8d6d5a3-43e0-4c92-a69e-f581dd6fb9d9_32x32.png?v=1643772777'),
('currency_symbol', '฿'),
('free_shipping_enabled', '1')
ON DUPLICATE KEY UPDATE `id` = `id`;

-- Default Site Sections (Exact 100% clone of design.html)
INSERT INTO `site_sections` (`section_key`, `section_name`, `data_json`) VALUES
('top_bar', 'แถบประกาศด้านบน', '{
  "items": [
    "🚚 ส่งฟรีทั่วไทย เก็บเงินปลายทางได้",
    "💳 ผ่อน 0% นานสูงสุด 4 เดือน",
    "⭐ ลูกค้ากว่า 100,000 คนไว้วางใจ",
    "🔥 โปรโมชั่นพิเศษหมดเวลาใน:"
  ],
  "timer_seconds": 31335
}'),

('header', 'ส่วนหัวและเมนูนำทาง', '{
  "logo_url": "https://www.chowa.in.th/cdn/shop/files/Chowa_logo_CMYK_Logo_Blue_croped.png?v=1781661303&width=400",
  "nav_links": [
    { "label": "หมอนสุขภาพ", "href": "#product" },
    { "label": "จุดเด่น", "href": "#benefits" },
    { "label": "โครงสร้าง 4 ชั้น", "href": "#hotspots" },
    { "label": "เปรียบเทียบ", "href": "#comparison" },
    { "label": "รีวิวจากลูกค้า", "href": "#reviews" },
    { "label": "คำถามที่พบบ่อย", "href": "#faq" }
  ]
}'),

('product', 'ข้อมูลสินค้าหลักและแกลเลอรี', '{
  "title": "หมอนโคซี่",
  "brand": "Fukupetstore",
  "rating": "5.0",
  "reviews_text": "(1,955+ รีวิว)",
  "sold_text": "🔥 ขายแล้วกว่า 10,000+ ใบ",
  "urgency_text": "⚡ มีสินค้า พร้อมส่งทันที จัดส่งฟรีทั่วไทย",
  "guarantee_text": "🛡️ รับประกันความพึงพอใจ คืนเงินเต็มจำนวนใน 7 วัน",
  "gallery": [
    { "url": "https://www.chowa.in.th/cdn/shop/files/product-699926_1400x.png?v=1738616200", "thumb": "https://www.chowa.in.th/cdn/shop/files/product-699926_400x.png?v=1738616200", "alt": "หมอนโคซี่" },
    { "url": "https://www.chowa.in.th/cdn/shop/files/product-496375_1400x.jpg?v=1738616200", "thumb": "https://www.chowa.in.th/cdn/shop/files/product-496375_400x.jpg?v=1738616200", "alt": "หมอนโคซี่บนเตียง" },
    { "url": "https://www.chowa.in.th/cdn/shop/files/product-123819_1400x.jpg?v=1738616200", "thumb": "https://www.chowa.in.th/cdn/shop/files/product-123819_400x.jpg?v=1738616200", "alt": "โครงสร้างหมอน" },
    { "url": "https://www.chowa.in.th/cdn/shop/files/product-655523_1400x.jpg?v=1738616200", "thumb": "https://www.chowa.in.th/cdn/shop/files/product-655523_400x.jpg?v=1738616200", "alt": "เทไส้ปรับความสูง" },
    { "url": "https://www.chowa.in.th/cdn/shop/files/product-447802_1400x.jpg?v=1738616200", "thumb": "https://www.chowa.in.th/cdn/shop/files/product-447802_400x.jpg?v=1738616200", "alt": "คู่มือความสูง" },
    { "url": "https://www.chowa.in.th/cdn/shop/files/product-594772_1400x.jpg?v=1738616200", "thumb": "https://www.chowa.in.th/cdn/shop/files/product-594772_400x.jpg?v=1738616200", "alt": "แนวคอเวลานอน" },
    { "url": "https://www.chowa.in.th/cdn/shop/files/product-597736_1400x.jpg?v=1738616200", "thumb": "https://www.chowa.in.th/cdn/shop/files/product-597736_400x.jpg?v=1738616200", "alt": "ทดสอบความนุ่ม" },
    { "url": "https://www.chowa.in.th/cdn/shop/files/product-408032_1400x.jpg?v=1738616200", "thumb": "https://www.chowa.in.th/cdn/shop/files/product-408032_400x.jpg?v=1738616200", "alt": "มาตรฐาน CertiPUR-US" },
    { "url": "https://www.chowa.in.th/cdn/shop/files/product-997234_1400x.jpg?v=1738616200", "thumb": "https://www.chowa.in.th/cdn/shop/files/product-997234_400x.jpg?v=1738616200", "alt": "ปลอก SnowMax" },
    { "url": "https://www.chowa.in.th/cdn/shop/files/product-983423_1400x.png?v=1738616200", "thumb": "https://www.chowa.in.th/cdn/shop/files/product-983423_400x.png?v=1738616200", "alt": "คอลลาจรีวิว" },
    { "url": "https://www.chowa.in.th/cdn/shop/files/product-144433_1400x.jpg?v=1738616200", "thumb": "https://www.chowa.in.th/cdn/shop/files/product-144433_400x.jpg?v=1738616200", "alt": "ขนาดหมอน 2 ขนาด" }
  ],
  "trust_badges": [
    { "icon": "https://ucarecdn.com/3c9e7ad4-72cd-4778-9d52-e200ff0c8606/-/format/auto/-/preview/240x240/-/quality/lighter/Artboard%201.png", "text": "ทดลองนอนฟรี<br>7 วัน" },
    { "icon": "https://ucarecdn.com/eb4711a8-4f97-4b60-be98-eac7f004d304/-/format/auto/-/preview/240x240/-/quality/lighter/Artboard%205.png", "text": "รับประกันสินค้า<br>แท้ 100%" },
    { "icon": "https://ucarecdn.com/fb814f37-d63a-4598-ae3f-3b444f3a56af/-/format/auto/-/preview/240x240/-/quality/lighter/Artboard%203.png", "text": "ผ่อน 0% นาน<br>สูงสุด 4 เดือน" }
  ],
  "sizes": [
    { "id": "standard", "title": "มาตรฐาน (Standard)", "subtitle": "ขนาด 18 x 26 นิ้ว", "price": 2690, "compare_price": 4400 },
    { "id": "king", "title": "ใหญ่พิเศษ (King)", "subtitle": "ขนาด 18 x 35 นิ้ว", "price": 2990, "compare_price": 4890 }
  ],
  "bundles": [
    { "id": 1, "badge": "", "name": "1 ใบ (เซ็ตทดลอง)", "desc": "หมอนโคซี่ + ถุงรีฟิลไส้เมมโมรี่โฟม", "multiplier": 1, "discount_percent": 0, "savings_text": "ลด 39% จากราคาเต็ม" },
    { "id": 2, "badge": "Best Seller 10% OFF", "name": "2 ใบ (สำหรับคนรู้ใจ)", "desc": "หมอน 2 ใบ + ถุงรีฟิล 2 ถุง", "multiplier": 2, "discount_percent": 10, "savings_text": "ประหยัดเพิ่ม 10%" },
    { "id": 4, "badge": "แถมฟรี 1 ใบ คุ้มที่สุด", "name": "ซื้อ 3 แถม 1 (ได้ 4 ใบ)", "desc": "แถมฟรีอีก 1 ใบ สำหรับครอบครัว", "multiplier": 3, "actual_items": 4, "discount_type": "free_one", "savings_text": "แถมฟรี 1 ใบ คุ้มที่สุด" }
  ],
  "upsell": {
    "enabled": true,
    "title": "+ เพิ่ม ปลอกหมอน Tencel Lyocell",
    "meta": "สัมผัสเย็น นุ่มลื่นดุจผ้าไหม อ่อนโยนต่อผิว",
    "price": 790,
    "compare_price": 1290,
    "image": "https://www.chowa.in.th/cdn/shop/files/tencel-lyocell-631776.png?height=200&v=1738616201"
  },
  "accordions": [
    {
      "title": "ทำไมต้องใช้หมอนโคซี่?",
      "content": "• <strong>ลดอาการปวดคอ:</strong> ปรับความสูงและต่ำได้ตามสรีระของผู้ใช้ ช่วยให้กระดูกสันหลังอยู่ในแนวที่ถูกต้อง ลดอาการตึงและปวดคอได้จริง<br>• <strong>หลับลึกสบายตลอดคืน:</strong> วัสดุไฮเปอร์เมมโมรี่โฟมมีความนุ่มฟู ช่วยกระจายน้ำหนักกดทับ ลดการตื่นกลางดึก<br>• <strong>นอนสบายทุกท่า:</strong> หมอนใบใหญ่ช่วยโอบอุ้มต้นคอและศีรษะอย่างพอดี ตอบโจทย์ทั้งท่านอนตะแคง หงาย และคว่ำ<br>• <strong>นอนแล้วเย็นสบาย ไม่ร้อน:</strong> ปลอกหมอน SnowMax วัสดุให้สัมผัสเย็นเป็นพิเศษ ระบายอากาศได้ดี นุ่มนวลอ่อนโยนต่อผิว<br>• <strong>ปลอดภัยต่อการใช้งาน:</strong> วัสดุเป็นมิตรต่อสิ่งแวดล้อม ผ่านการรับรองมาตรฐานความปลอดภัย ไร้สารพิษ CertiPUR-US"
    },
    {
      "title": "ขนาดและวัสดุ",
      "content": "<strong>ขนาด:</strong><br>• Standard: 18 x 26 นิ้ว (เหมาะกับเตียงเดี่ยวและเตียงควีนไซส์)<br>• King: 18 x 35 นิ้ว (ขนาดใหญ่พิเศษ เหมาะกับเตียงคิงไซส์และคนที่ชอบพลิกตัว)<br><br><strong>วัสดุ:</strong><br>• แกนหมอน: Shredded Hyper Memory Foam เกรดพรีเมียม นุ่มฟู คืนตัวช้า<br>• ปลอกด้านใน: ผ้า Air Mesh ถ่ายเทอากาศได้ดีเยี่ยม<br>• ปลอกหุ้มด้านนอก: ผ้า SnowMax สัมผัสเย็น ปรับสมดุลอุณหภูมิร่างกาย"
    },
    {
      "title": "คำแนะนำในการดูแลรักษา",
      "content": "• <strong>ปลอกหมอนด้านนอก:</strong> สามารถถอดซักเครื่องได้ในโหมดถนอมผ้า ใช้น้ำเย็น ไม่ใส่น้ำยาปรับผ้านุ่ม และอบแห้งอุณหภูมิต่ำหรือผึ่งลมในที่ร่ม<br>• <strong>แกนหมอนและปลอกด้านใน:</strong> แนะนำให้ผึ่งลมในที่ร่มเท่านั้น ห้ามซัก และหลีกเลี่ยงไม่ให้แกนเมมโมรี่โฟมโดนน้ำหรือแดดจัด"
    },
    {
      "title": "การจัดส่งสินค้า",
      "content": "สินค้าทุกชิ้น <strong>จัดส่งฟรีและมีบริการเก็บเงินปลายทางฟรีทั่วประเทศ</strong> ผ่านทาง EMS บริษัทไปรษณีย์ไทย<br>• กรุงเทพและปริมณฑล: 2-3 วันทำการ<br>• ต่างจังหวัด: 3-5 วันทำการ (มีรหัส Tracking ตรวจสอบสถานะได้ 24 ชั่วโมง)"
    },
    {
      "title": "นโยบายการรับประกันสินค้า",
      "content": "หากคุณได้รับสินค้าแล้ว รู้สึกว่าไม่ตอบโจทย์หรือไม่พอใจสินค้าในกรณีใดก็ตาม ทางบริษัทยินดี <strong>คืนเงินเต็มจำนวนภายใน 7 วัน</strong> นับตั้งแต่วันที่ได้รับสินค้าตามเงื่อนไขที่กำหนด พร้อมการรับประกันคุณภาพวัสดุ 1 ปีเต็ม"
    }
  ]
}'),

('features', 'จุดเด่น 4 ไอคอน', '[
  { "icon": "https://ucarecdn.com/af853f1d-a2fd-4b6e-a6d0-3613c76f0d8f/-/format/auto/-/preview/240x240/-/quality/lighter/Pressure.png", "title": "กระจายน้ำหนักกดทับ" },
  { "icon": "https://ucarecdn.com/ea22384d-0934-47fd-9434-d4cbf05af369/-/format/auto/-/preview/240x240/-/quality/lighter/Bacteria.png", "title": "ป้องกันแบคทีเรีย" },
  { "icon": "https://ucarecdn.com/3313a9e9-5c8c-4178-9de9-e5436ff3cb10/-/format/auto/-/preview/240x240/-/quality/lighter/Airflow.png", "title": "ระบายอากาศยอดเยี่ยม" },
  { "icon": "https://ucarecdn.com/2f09d6de-fba4-4901-85d8-3ff2d53ad3bd/-/format/auto/-/preview/240x240/-/quality/lighter/Alignment.png", "title": "รองรับสรีระตามหลักกายภาพ" }
]'),

('benefits_section', 'การ์ดคุณประโยชน์ 3 ประการ', '{
  "title": "ตื่นมาคอไม่ปวด หลับลึกได้ทั้งคืน",
  "subtitle": "หมอนสุขภาพที่ออกแบบมาเพื่อแก้ปัญหาการนอนอย่างแท้จริง โอบรับสรีระของคุณในทุกมิติ",
  "cards": [
    {
      "image": "https://www.chowa.in.th/cdn/shop/files/Benefit_cp_1.jpg?v=1787284838&width=630",
      "title": "นุ่มฟูไม่แฟบ คอไม่ตึงตอนเช้า",
      "text": "หมอนเก่าที่แฟบจนหัวจมลงไป ทำให้คอตึงและพลิกไปมาทั้งคืน ไส้ไฮเปอร์เมมโมรี่โฟมคืนตัวได้ดี รับหัวและคอไว้เท่าเดิมทุกคืน",
      "bullets": [
        "คงรูปไม่แฟบ ไม่ยุบเป็นก้อน",
        "รับหัวและคอไว้ในแนวระนาบทั้งคืน",
        "ตื่นมาคอไม่ตึง ไม่ปวดเมื่อยเหมือนเคย"
      ]
    },
    {
      "image": "https://www.chowa.in.th/cdn/shop/files/Benefit_cp_2.jpg?v=1787284838&width=630",
      "title": "ปรับความสูงให้พอดีตัวคุณได้เอง",
      "text": "หมอนสูงไปหรือต่ำไปคือต้นเหตุที่ทำให้คอตึงตอนเช้า เติมหรือลดไส้ไฮเปอร์เมมโมรี่โฟมได้เองจนได้ความสูงที่พอดีกับสรีระคุณ",
      "bullets": [
        "เติมหรือลดไส้ได้เองตามสรีระและความชอบ",
        "ปรับระดับสูงต่ำได้จนพอดีแนวกระดูกคอ",
        "จบปัญหาซื้อหมอนมาแล้วนอนไม่พอดี"
      ]
    },
    {
      "image": "https://www.chowa.in.th/cdn/shop/files/Benefit_cp_3.jpg?v=1787284838&width=630",
      "title": "นอนเย็นสบาย หลับลึกตลอดคืน",
      "text": "ปลอก SnowMax ช่วยระบายอากาศและปรับสมดุลอุณหภูมิ ไม่ร้อนไม่อับ หมดกังวลเรื่องเหงื่อสะสม หลับสบายยาวตลอดคืน",
      "bullets": [
        "ระบายความร้อนได้ดีเยี่ยม ไม่อบศีรษะ",
        "สัมผัสเย็นสบายผ่อนคลายตลอดทั้งคืน",
        "ลดความอับชื้น ป้องกันไรฝุ่นและเหงื่อสะสม"
      ]
    }
  ],
  "cta_text": "สั่งซื้อหมอนโคซี่เลย",
  "cta_link": "#product",
  "guarantee": "🛡️ รับประกันความพึงพอใจ ยินดีคืนเงินภายใน 7 วัน"
}'),

('hotspots_section', 'โครงสร้าง 4 ชั้น 3D Hotspots', '{
  "title": "4 ชั้นที่ทำให้คุณหลับลึกทั้งคืน",
  "subtitle": "นวัตกรรมการออกแบบหมอนสุขภาพจากเกาหลี รวม 4 องค์ประกอบสำคัญเพื่อการพักผ่อนระดับพรีเมียม",
  "image": "https://www.chowa.in.th/cdn/shop/files/CP_3D_realistic_image_png.png?v=1787284641&width=1200",
  "pins": [
    {
      "id": 1,
      "title": "1. ไส้ Hyper Memory Foam",
      "pin_title": "ไส้ Hyper Memory Foam",
      "top": "58%",
      "left": "28%",
      "feature": "วัสดุนุ่มนิ่ม คืนตัวได้ดีเยี่ยม เติมหรือลดไส้หมอนได้เองตามชอบ",
      "benefit": "ปรับความสูงพอดีตัวคุณ นุ่มสบายรองรับสรีระ ไม่ยุบตัวเป็นหลุม"
    },
    {
      "id": 2,
      "title": "2. ปลอกใน Air Mesh",
      "pin_title": "ปลอกใน Air Mesh",
      "top": "44%",
      "left": "53%",
      "feature": "ผ้าโครงข่ายเนื้อบางเบา ระบายอากาศและการไหลเวียนของลมได้ดี",
      "benefit": "ลดการสะสมของความร้อนและความอับชื้นตลอดทั้งคืน"
    },
    {
      "id": 3,
      "title": "3. ปลอกนอก SnowMax",
      "pin_title": "ปลอกนอก SnowMax",
      "top": "34%",
      "left": "74%",
      "feature": "เนื้อผ้าเทคโนโลยี SnowMax ให้สัมผัสเย็นเฉียบ นุ่มนวล อ่อนโยนต่อผิวหน้า",
      "benefit": "เย็นสบายตั้งแต่วินาทีแรกที่หนุน ช่วยให้ผ่อนคลายและเข้าสู่สภาวะหลับลึกเร็วขึ้น"
    },
    {
      "id": 4,
      "title": "4. แถบ Gusset ด้านข้าง",
      "pin_title": "แถบ Gusset",
      "top": "76%",
      "left": "83%",
      "feature": "แถบขอบรอบหมอนเสริมโครงสร้างช่วยยึดทรงหมอนให้อยู่รูป",
      "benefit": "คงรูปทรงได้ยาวนานหลายปี ไม่ยวบแบนแม้ใช้งานทุกคืน"
    }
  ]
}'),

('comparison_section', 'ตารางเปรียบเทียบกับหมอนทั่วไป', '{
  "title": "ทำไมต้องหมอนโคซี่",
  "subtitle": "เทียบให้เห็นชัดเจนว่าหมอนโคซี่เหนือกว่าหมอนทั่วไปอย่างไร",
  "chowa_name": "หมอนโคซี่ Fukupetstore",
  "chowa_img": "https://www.chowa.in.th/cdn/shop/files/Chowa_15_Rendering.3_copy.png?v=1787128546&width=300",
  "other_name": "หมอนทั่วไป",
  "other_img": "https://www.chowa.in.th/cdn/shop/files/pillow-other-brand.png?v=1785146409&width=300",
  "rows": [
    { "feature": "ปรับความสูงได้เองตามสรีระ", "chowa": true, "other": false },
    { "feature": "รองรับสรีระคอในแนวระนาบ", "chowa": true, "other": false },
    { "feature": "ปลอกผ้าเย็น SnowMax ไม่อับร้อน", "chowa": true, "other": false },
    { "feature": "โฟมแท้ คืนตัวดี ไม่ยุบยวบเป็นหลุม", "chowa": true, "other": false },
    { "feature": "มาตรฐานความปลอดภัย CertiPUR-US", "chowa": true, "other": false },
    { "feature": "การรับประกันทดลองนอน 7 วัน คืนเงินได้", "chowa": true, "other": false }
  ],
  "cta_text": "สั่งซื้อและรับสิทธิ์ทดลองนอน 7 วัน",
  "cta_link": "#product"
}'),

('reviews_section', 'รีวิวจากลูกค้าจริง', '{
  "title": "รีวิวจากลูกค้าจริง",
  "subtitle": "ประสบการณ์จริงจากผู้ใช้งานหมอนโคซี่ Fukupetstore ทั่วประเทศ",
  "score": "4.9",
  "total_reviews": "1,955+",
  "bars": [
    { "stars": 5, "percent": 91, "count": "1,778 (91%)" },
    { "stars": 4, "percent": 7, "count": "140 (7%)" },
    { "stars": 3, "percent": 2, "count": "30 (2%)" },
    { "stars": 2, "percent": 0.5, "count": "1 (0%)" },
    { "stars": 1, "percent": 0.5, "count": "6 (0%)" }
  ],
  "reviews": [
    {
      "id": 1,
      "avatar": "C",
      "avatar_bg": "#1E306E",
      "author": "Chomcheun Sudsataya",
      "verified": true,
      "stars": 5,
      "title": "เปลี่ยนมาใช้หมอนโคซี่กันทั้งครอบครัว 6 ใบ",
      "body": "เปลี่ยนมาใช้หมอนโคซี่กันทั้งครอบครัว 6 ใบ ทุกคนชอบมาก หลับสบายขึ้น ตื่นมาแล้วสดชื่น ดีจริงๆค่ะ ปรับเอาไส้ออกนิดหน่อยนอนพอดีมาก ไม่ปวดคอเลย แนะนำเลยค่ะ",
      "photo": "https://www.chowa.in.th/cdn/shop/files/product-983423_400x.png?v=1738616200"
    },
    {
      "id": 2,
      "avatar": "อ",
      "avatar_bg": "#2563eb",
      "author": "อัมพร รักเกียรตินักรบ",
      "verified": true,
      "stars": 5,
      "title": "คุณภาพการนอนหลับดี คุ้มค่าสมราคา จัดส่งรวดเร็วครับ",
      "body": "ให้ความรู้สึกเกี่ยวกับสุขภาพของการนอนหลับที่ดีมากๆ หลับได้นานขึ้นและตื่นมารู้สึกกระปรี้กระเปร่า มีความสุขกับการนอนมากขึ้น ไม่ตื่นกลางดึกเหมือนเมื่อก่อน",
      "photo": ""
    },
    {
      "id": 3,
      "avatar": "ส",
      "avatar_bg": "#059669",
      "author": "สมศักดิ์ เศวตรัตนเสถียร",
      "verified": true,
      "stars": 5,
      "title": "นอนหลับสบาย ปลอกหมอนเย็นจริง",
      "body": "ตอนแรกกังวลว่าจะสูงไป แต่พอแกะตักโฟมออกใส่ถุงรีฟิลตามที่แนะนำ ได้ระดับที่พอดีมาก นอนตะแคงก็ไม่กดทับหัวไหล่ ปลอกหมอนเย็นสัมผัสดีมาก คุ้มค่าเงินครับ",
      "photo": "https://www.chowa.in.th/cdn/shop/files/product-655523_400x.jpg?v=1738616200"
    },
    {
      "id": 4,
      "avatar": "ว",
      "avatar_bg": "#d97706",
      "author": "วิศิษฎ์ กิจเจริญ",
      "verified": true,
      "stars": 5,
      "title": "แก้ปัญหาคอเคล็ดได้จริงครับ",
      "body": "เคยซื้อหมอนมาหลายแบรนด์ทั้งแพงและถูก นอนไม่เคยจบ มาจบที่หมอนโคซี่ใบนี้ โฟมนุ่มแน่นกำลังดี คืนตัวเนียนมาก ไม่ยวบแฟบ สั่งเพิ่มให้คุณแม่เรียบร้อยครับ",
      "photo": ""
    }
  ]
}'),

('faq_section', 'คำถามที่พบบ่อย', '{
  "title": "คำถามที่พบบ่อย",
  "subtitle": "ข้อสงสัยยอดนิยมเกี่ยวกับหมอนโคซี่ Fukupetstore",
  "faqs": [
    {
      "id": 1,
      "question": "หมอนโคซี่เหมาะกับใคร?",
      "answer": "เหมาะกับคนที่ต้องการหลับลึกและหลับสบายขึ้น ชอบสัมผัสนุ่มฟูสบายตัวแบบโรงแรมระดับ 5 ดาว และต้องการหมอนที่ปรับความสูงได้เองให้เข้ากับแนวกระดูกคอและสรีระส่วนบุคคลอย่างสมบูรณ์แบบ"
    },
    {
      "id": 2,
      "question": "ปรับความสูงของหมอนอย่างไร?",
      "answer": "คุณสามารถรูดซิปเปิดปลอกหมอนแล้วเติมหรือตักไส้ไฮเปอร์เมมโมรี่โฟมออกได้เองตามความชอบ โดยในกล่องจะมีถุงซิปล็อกสำหรับเก็บไส้ที่นำออกมาให้อย่างสะดวก ปรับระดับความสูงและความนุ่มให้พอดีกับตัวเองได้อย่างง่ายดาย"
    },
    {
      "id": 3,
      "question": "ใช้ไปนานๆ หมอนจะยุบหรือเสียทรงไหม?",
      "answer": "ไส้ไฮเปอร์เมมโมรี่โฟมแท้ 100% ไม่ใช่ใยสังเคราะห์ จึงไม่ยุบยวบแบนเป็นหลุม ออกแบบโครงสร้างให้คงรูปทรง คืนตัวช้าๆ อย่างนุ่มนวล และทนทานต่อการใช้งานทุกคืนได้ยาวนานหลายปี"
    },
    {
      "id": 4,
      "question": "มีกลิ่นสารเคมีไหม ปลอดภัยหรือเปล่า?",
      "answer": "อาจมีกลิ่นธรรมชาติของเมมโมรี่โฟมใหม่อ่อนๆ ในช่วงแรกที่เปิดกล่อง ซึ่งจะจางหายไปเองหลังจากผึ่งลม 1-2 วัน และวัสดุทั้งหมดผ่านการรับรองมาตรฐานสากล CertiPUR-US และ OEKO-TEX Standard 100 ปลอดจากสารเคมีอันตราย วางใจได้ 100%"
    },
    {
      "id": 5,
      "question": "ใช้กี่คืนถึงจะเริ่มรู้สึกสบายขึ้น?",
      "answer": "ผู้ใช้ส่วนใหญ่รู้สึกสบายและหลับลึกขึ้นตั้งแต่คืนแรกที่ใช้ บางท่านอาจใช้เวลาปรับตัวประมาณ 3-5 คืน โดยแนะนำให้ทดลองปรับปริมาณไส้โฟมให้เข้ากับท่านอนประจำ (นอนหงาย ตะแคง หรือคว่ำ) เพื่อให้ได้ความสูงที่สมบูรณ์แบบที่สุด"
    },
    {
      "id": 6,
      "question": "จำเป็นต้องซื้อปลอกหมอนแยกไหม?",
      "answer": "ไม่จำเป็นครับ ตัวหมอนมาพร้อมปลอก SnowMax สัมผัสเย็นคุณภาพสูงที่ถอดซักได้ หรือหากต้องการใช้ปลอกหมอนมาตรฐานทั่วไปที่คุณมีอยู่ที่บ้านก็สามารถสวมทับได้ทันที"
    },
    {
      "id": 7,
      "question": "ทำความสะอาดหมอนอย่างไร?",
      "answer": "• <strong>ปลอกหมอน:</strong> ถอดซักเครื่องได้ในโหมดถนอมผ้า ใช้น้ำเย็น ไม่ใส่น้ำยาปรับผ้านุ่ม อบแห้งอุณหภูมิต่ำหรือผึ่งลมในที่ร่ม<br>• <strong>แกนหมอนและปลอกด้านใน:</strong> แนะนำให้ผึ่งลมในที่ร่มเท่านั้น ห้ามนำไปซักน้ำ และหลีกเลี่ยงแสงแดดจัด"
    },
    {
      "id": 8,
      "question": "หากนอนแล้วไม่พอใจ คืนสินค้าได้ไหม?",
      "answer": "สามารถคืนได้ครับ เรามีนโยบายรับประกันความพึงพอใจ <strong>ให้คุณทดลองนอนฟรี 7 วัน</strong> หากรู้สึกว่าหมอนไม่ตอบโจทย์ สามารถส่งคืนเพื่อขอรับเงินคืนเต็มจำนวนได้ทันที พร้อมรับประกันคุณภาพวัสดุยาวนาน 1 ปีเต็ม"
    }
  ]
}'),

('footer', 'ส่วนท้ายและลิงก์ติดต่อ', '{
  "about": "Fukupetstore แบรนด์นวัตกรรมการนอนเพื่อสุขภาพชั้นนำ มุ่งมั่นพัฒนาหมอน ท็อปเปอร์ และเครื่องนอนที่ตอบโจทย์หลักสรีรศาสตร์ เพื่อยกระดับคุณภาพการนอนและชีวิตที่ดีขึ้นในทุกๆ วัน",
  "club_title": "เข้าร่วม Fukupetstore Club",
  "club_desc": "รับส่วนลดพิเศษ 10% สำหรับการสั่งซื้อครั้งแรก พร้อมสาระความรู้เรื่องการนอนหลับ",
  "products": [
    { "label": "หมอนโคซี่ (Cozy Pillow)", "href": "#product" },
    { "label": "หมอนลูน่า (Luna Pillow)", "href": "#product" },
    { "label": "หมอน NeckFit", "href": "#product" },
    { "label": "ท็อปเปอร์ยางพาราไฮบริด", "href": "#product" },
    { "label": "ปลอกหมอน Tencel Lyocell", "href": "#product" }
  ],
  "services": [
    { "label": "คำถามที่พบบ่อย", "href": "#faq" },
    { "label": "นโยบายทดลองนอน 7 วัน", "href": "#product" },
    { "label": "การรับประกันสินค้า", "href": "#product" },
    { "label": "ตรวจสอบสถานะพัสดุ", "href": "#product" },
    { "label": "นโยบายความเป็นส่วนตัว", "href": "#product" }
  ],
  "contact": [
    { "label": "LINE: @fukupetstore", "href": "#" },
    { "label": "Facebook: Fukupetstore", "href": "#" },
    { "label": "Instagram: @fukupetstore", "href": "#" },
    { "label": "TikTok: @fukupetstore", "href": "#" },
    { "label": "โทร: 02-XXX-XXXX (09:00 - 18:00)", "href": "#" }
  ],
  "copyright": "© 2026 Fukupetstore Copyright. All rights reserved.",
  "payments": "การชำระเงินที่ปลอดภัย: Visa, Mastercard, PromptPay, ShopeePay, TrueMoney, เก็บเงินปลายทาง (COD)"
}')
ON DUPLICATE KEY UPDATE `id` = `id`;
