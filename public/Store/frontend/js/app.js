let products = [];
let movements = [];
let currentPage = 'products';

function doLogout() {
  try {
    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
      google.accounts.id.disableAutoSelect();
    }
  } catch(e) {}
  Token.clear();
  window.location.href = 'index.html';
}

function getCurrentRole() {
  try { return localStorage.getItem('store_user_role') || (Token.get() === '1234' ? 'admin' : 'user'); } catch(e) { return 'user'; }
}
function isAdmin() { return getCurrentRole() === 'admin'; }

function showUserBadge() {
  const el = document.getElementById('userBadge');
  if (!el) return;
  const email = (localStorage.getItem('store_user_email') || '').trim();
  const role = (localStorage.getItem('store_user_role') || '').trim();
  const name = (localStorage.getItem('store_user_name') || '').trim();
  const display = name ? name : (email || 'ผู้ใช้');
  const roleLabel = role === 'admin' ? 'ผู้ดูแล' : 'ผู้ใช้ทั่วไป';
  const roleColor = role === 'admin' ? '#DCFCE7' : '#FEF3C7';
  const roleTextColor = role === 'admin' ? '#166534' : '#92400E';
  if (display) {
    el.style.display = 'block';
    el.innerHTML = '<i class="fa-solid fa-user"></i> ' + escapeHtml(display) + ' <span style="background:' + roleColor + ';color:' + roleTextColor + ';padding:2px 7px;border-radius:99px;font-weight:700;margin-left:6px">' + roleLabel + '</span>';
    if (role !== 'admin') {
      // แสดง toast เตือนครั้งเดียว
      if (!sessionStorage.getItem('warn_readonly')) {
        sessionStorage.setItem('warn_readonly', '1');
        setTimeout(() => {
          Swal.fire({ icon: 'info', title: 'โหมดอ่านอย่างเดียว', text: 'บัญชี ' + display + ' มีสิทธิ์ดูข้อมูลได้อย่างเดียว (admin เท่านั้นที่แก้ไขได้)', confirmButtonColor: '#15803D' });
        }, 600);
      }
    }
  }
}

function requireAdmin(actionName) {
  if (isAdmin()) return true;
  Swal.fire({ icon: 'warning', title: 'ไม่มีสิทธิ์', text: 'เฉพาะผู้ดูแลระบบ (teesoftwareai@gmail.com หรือรหัสผ่าน 1234) เท่านั้นที่' + (actionName || 'แก้ไขได้'), confirmButtonColor: '#15803D' });
  return false;
}

/* ---------- Navigation ---------- */
function showPage(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('.top-nav a, .bottom-nav a').forEach((a) => {
    a.classList.toggle('active', a.dataset.page === page);
  });

  if (page === 'products') renderProducts();
  if (page === 'receive') renderReceive();
  if (page === 'issue') renderIssue();
  if (page === 'moves') renderDailyMoves();
  if (page === 'report') renderReport();
}

window.addEventListener('hashchange', () => {
  const page = location.hash.replace('#', '') || 'products';
  if (['products', 'receive', 'issue', 'moves', 'report'].includes(page)) showPage(page);
});

/* ---------- Data loading ---------- */
async function loadAll() {
  showLoading(true);
  try {
    const [pRes, mRes] = await Promise.all([StoreAPI.listProducts(), StoreAPI.listMovements()]);
    products = pRes.products || [];
    movements = mRes.movements || [];
    refreshSelects();
    renderProducts();
    renderReceive();
    renderIssue();
    renderDailyMoves();
    renderReport();
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: err.message, confirmButtonColor: '#15803D' });
  } finally {
    showLoading(false);
  }
}

function refreshSelects() {
  const opts = products.map((p) => `<option value="${p.id}">${escapeHtml(p.name)} (${p.price} บาท)</option>`).join('');
  ['recProduct', 'outProduct'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
}

/* ================== PRODUCTS ================== */

/* คำนวณยอดคงเหลือของสินค้า (จาก movements) */
function getStockBalance(productId) {
  let totalIn = 0, totalOut = 0;
  movements.forEach((m) => {
    if (String(m.productId) === String(productId)) {
      if (m.type === 'in') totalIn += m.quantity;
      else if (m.type === 'out') totalOut += m.quantity;
    }
  });
  return { totalIn, totalOut, balance: totalIn - totalOut };
}

/* สถานะสินค้าตามยอดคงเหลือ
   - ยังไม่เคยรับ/จ่าย = ไม่ระบุ (badge เทา)
   - balance <= 0 = หมดสต๊อก (แดง)
   - balance < 5 = คงเหลือน้อย (ส้ม)
   - อื่น ๆ = มีสต๊อก (เขียว) */
function stockStatusHtml(productId) {
  const { balance } = getStockBalance(productId);
  if (balance <= 0) return '<span class="badge badge-out">หมดสต๊อก</span>';
  if (balance < 5) return '<span class="badge" style="background:#ffedd5;color:#c2410c">ใกล้หมด (' + balance + ')</span>';
  return '<span class="badge badge-in">มีสต๊อก (' + balance + ')</span>';
}

async function addProduct() {
  if (!requireAdmin('เพิ่มสินค้า')) return;
  const name = document.getElementById('newProductName').value.trim();
  const price = parseFloat(document.getElementById('newProductPrice').value);
  if (!name) { Swal.fire({ icon: 'warning', title: 'กรุณากรอกชื่อสินค้า', confirmButtonColor: '#15803D' }); return; }
  if (isNaN(price) || price < 0) { Swal.fire({ icon: 'warning', title: 'กรุณากรอกราคาให้ถูกต้อง', confirmButtonColor: '#15803D' }); return; }
  try {
    await StoreAPI.createProduct(name, price);
    document.getElementById('newProductName').value = '';
    document.getElementById('newProductPrice').value = '';
    await loadAll();
    Swal.fire({ icon: 'success', title: 'เพิ่มสินค้าสำเร็จ', timer: 1200, showConfirmButton: false, background: '#F0FDF4' });
  } catch (err) { Swal.fire({ icon: 'error', title: 'เพิ่มสินค้าไม่สำเร็จ', text: err.message, confirmButtonColor: '#15803D' }); }
}

function renderProducts() {
  const body = document.getElementById('productBody');
  const q = (document.getElementById('productSearch').value || '').toLowerCase();
  const list = products.filter((p) => p.name.toLowerCase().includes(q));

  if (!list.length) {
    body.innerHTML = '<tr><td colspan="4" class="empty">ไม่พบสินค้า</td></tr>';
    return;
  }
  const admin = isAdmin();
  body.innerHTML = list.map((p) => `
    <tr>
      <td>${escapeHtml(p.name)}</td>
      <td class="money">${p.price} บาท</td>
      <td>${stockStatusHtml(p.id)}</td>
      <td>
        ${admin ? `<button class="btn btn-gray" style="padding:6px 10px;font-size:12px" onclick="editProduct(${p.id})">
          <i class="fa-solid fa-pen"></i> แก้ไข
        </button>
        <button class="btn btn-red" style="padding:6px 10px;font-size:12px" onclick="deleteProduct(${p.id})">
          <i class="fa-solid fa-trash"></i> ลบ
        </button>` : '<span style="font-size:12px;color:var(--muted)"><i class="fa-solid fa-lock"></i> อ่านอย่างเดียว</span>'}
      </td>
    </tr>
  `).join('');
}

async function editProduct(id) {
  if (!requireAdmin('แก้ไขสินค้า')) return;
  const p = products.find((x) => x.id === id);
  if (!p) return;
  const { value: name } = await Swal.fire({
    title: 'ชื่อสินค้า',
    input: 'text',
    inputValue: p.name,
    showCancelButton: true,
    confirmButtonColor: '#15803D',
    inputValidator: (v) => (v && v.trim() ? null : 'กรุณากรอกชื่อ')
  });
  if (name === undefined) return;
  const { value: price } = await Swal.fire({
    title: 'ราคา (บาท)',
    input: 'number',
    inputValue: p.price,
    inputAttributes: { min: 0, step: '0.5' },
    showCancelButton: true,
    confirmButtonColor: '#15803D',
    inputValidator: (v) => (v !== '' && Number(v) >= 0 ? null : 'กรุณากรอกราคาให้ถูกต้อง')
  });
  if (price === undefined) return;
  try {
    await StoreAPI.updateProduct(id, { name: name.trim(), price: Number(price) });
    await loadAll();
    Swal.fire({ icon: 'success', title: 'แก้ไขสินค้าสำเร็จ', timer: 1200, showConfirmButton: false });
  } catch (err) { Swal.fire({ icon: 'error', title: 'แก้ไขไม่สำเร็จ', text: err.message, confirmButtonColor: '#15803D' }); }
}

async function deleteProduct(id) {
  if (!requireAdmin('ลบสินค้า')) return;
  const p = products.find((x) => x.id === id);
  if (!p) return;
  const { isConfirmed } = await Swal.fire({
    title: 'ลบสินค้า "' + p.name + '"',
    text: 'จะลบสินค้าและประวัติทั้งหมด ต้องการดำเนินการ?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#DC2626',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก'
  });
  if (!isConfirmed) return;
  try {
    await StoreAPI.deleteProduct(id);
    await loadAll();
    Swal.fire({ icon: 'success', title: 'ลบสินค้าสำเร็จ', timer: 1200, showConfirmButton: false });
  } catch (e) { Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: e.message, confirmButtonColor: '#15803D' }); }
}

/* ================== RECEIVE ================== */
async function doReceive() {
  if (!requireAdmin('รับเข้าสินค้า')) return;
  const productId = Number(document.getElementById('recProduct').value);
  const quantity = parseInt(document.getElementById('recQty').value, 10);
  const note = document.getElementById('recNote').value.trim();
  if (!productId) { Swal.fire({ icon: 'warning', title: 'กรุณาเลือกสินค้า', confirmButtonColor: '#15803D' }); return; }
  if (!quantity || quantity <= 0) { Swal.fire({ icon: 'warning', title: 'กรุณากรอกจำนวน', confirmButtonColor: '#15803D' }); return; }
  try {
    await StoreAPI.addMovement({ type: 'in', productId, quantity, note });
    document.getElementById('recQty').value = 1;
    document.getElementById('recNote').value = '';
    await loadAll();
    Swal.fire({ icon: 'success', title: 'บันทึกรับเข้าสำเร็จ', timer: 1200, showConfirmButton: false });
  } catch (err) { Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: err.message, confirmButtonColor: '#15803D' }); }
}

function renderReceive() {
  const body = document.getElementById('recBody');
  const list = movements.filter((m) => m.type === 'in');
  const admin = isAdmin();
  if (!list.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty">ยังไม่มีรายการรับเข้า</td></tr>';
    return;
  }
  body.innerHTML = list.map((m) => `
    <tr>
      <td>${fmtDate(m.createdAt)}</td>
      <td>${escapeHtml(m.productName)}</td>
      <td>+${fmtNumber(m.quantity)}</td>
      <td>${escapeHtml(m.note || '-')}</td>
      <td>
        ${admin ? `<button class="btn btn-red" style="padding:6px 10px;font-size:12px" onclick="deleteMovement(${m.id},'รับเข้า')">
          <i class="fa-solid fa-trash"></i>
        </button>` : '-'}
      </td>
    </tr>
  `).join('');
}

/* ================== ISSUE ================== */
async function doIssue() {
  if (!requireAdmin('จ่ายสินค้าออก')) return;
  const productId = Number(document.getElementById('outProduct').value);
  const quantity = parseInt(document.getElementById('outQty').value, 10);
  const note = document.getElementById('outNote').value.trim();
  if (!productId) { Swal.fire({ icon: 'warning', title: 'กรุณาเลือกสินค้า', confirmButtonColor: '#15803D' }); return; }
  if (!quantity || quantity <= 0) { Swal.fire({ icon: 'warning', title: 'กรุณากรอกจำนวน', confirmButtonColor: '#15803D' }); return; }

  const p = products.find((x) => x.id === productId);
  /* เช็คสต๊อกคงเหลือ */
  const inQty = movements.filter((m) => m.productId === productId && m.type === 'in').reduce((a, b) => a + b.quantity, 0);
  const outQty = movements.filter((m) => m.productId === productId && m.type === 'out').reduce((a, b) => a + b.quantity, 0);
  const balance = inQty - outQty;

  if (balance < quantity) {
    const { isConfirmed } = await Swal.fire({
      title: 'สต๊อกไม่เพียงพอ!',
      text: `คงเหลือเพียง ${balance} ชิ้น จะจ่ายออก ${quantity} ชิ้น (ติดลบ) ต้องการดำเนินการต่อหรือไม่?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EA580C',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'ดำเนินการต่อ',
      cancelButtonText: 'ยกเลิก'
    });
    if (!isConfirmed) return;
  }
  try {
    await StoreAPI.addMovement({ type: 'out', productId, quantity, price: p.price, note });
    document.getElementById('outQty').value = 1;
    document.getElementById('outNote').value = '';
    await loadAll();
    Swal.fire({ icon: 'success', title: 'บันทึกจ่ายออกสำเร็จ', timer: 1200, showConfirmButton: false });
  } catch (err) { Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: err.message, confirmButtonColor: '#15803D' }); }
}

function renderIssue() {
  const body = document.getElementById('outBody');
  const list = movements.filter((m) => m.type === 'out');
  const admin = isAdmin();
  if (!list.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty">ยังไม่มีรายการจ่ายออก</td></tr>';
    return;
  }
  body.innerHTML = list.map((m) => `
    <tr>
      <td>${fmtDate(m.createdAt)}</td>
      <td>${escapeHtml(m.productName)}</td>
      <td>-${fmtNumber(m.quantity)}</td>
      <td class="money">${fmtMoney(m.quantity * m.price)}</td>
      <td>${escapeHtml(m.note || '-')}</td>
      <td>
        ${admin ? `<button class="btn btn-red" style="padding:6px 10px;font-size:12px" onclick="deleteMovement(${m.id},'จ่ายออก')">
          <i class="fa-solid fa-trash"></i>
        </button>` : '-'}
      </td>
    </tr>
  `).join('');
}

/* ================== MOVEMENTS DELETE ================== */
async function deleteMovement(id, label) {
  if (!requireAdmin('ลบรายการ')) return;
  const { isConfirmed } = await Swal.fire({
    title: 'ลบรายการ' + label,
    text: 'ต้องการลบรายการนี้?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#DC2626',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก'
  });
  if (!isConfirmed) return;
  try {
    await StoreAPI.deleteMovement(id);
    await loadAll();
    Swal.fire({ icon: 'success', title: 'ลบรายการสำเร็จ', timer: 1200, showConfirmButton: false });
  } catch (e) { Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: e.message, confirmButtonColor: '#15803D' }); }
}

/* ================== REPORT ================== */
function renderReport() {
  // balance คำนวณจาก movements
  const map = {};
  products.forEach((p) => {
    map[String(p.id)] = { id: p.id, name: p.name, price: p.price, in: 0, out: 0 };
  });
  movements.forEach((m) => {
    const key = String(m.productId);
    if (map[key]) {
      if (m.type === 'in') map[key].in += m.quantity;
      else if (m.type === 'out') map[key].out += m.quantity;
    }
  });

  const q = (document.getElementById('reportSearch').value || '').toLowerCase();
  const rows = Object.values(map).filter((r) => r.name.toLowerCase().includes(q));

  // Summary
  const totalQty = rows.reduce((a, r) => a + (r.in - r.out), 0);
  const totalValue = rows.reduce((a, r) => a + ((r.in - r.out) * r.price), 0);
  const lowStock = rows.filter((r) => (r.in - r.out) <= 0);
  document.getElementById('reportSummary').innerHTML = `
    <div class="stat"><small>รายการสินค้า</small><strong>${fmtNumber(rows.length)}</strong></div>
    <div class="stat green"><small>คงเหลือรวม (ชิ้น)</small><strong>${fmtNumber(totalQty)}</strong></div>
    <div class="stat orange"><small>มูลค่าคงเหลือรวม</small><strong>${fmtMoney(totalValue)}</strong></div>
    <div class="stat red"><small>สินค้าหมดสต๊อก</small><strong>${fmtNumber(lowStock.length)}</strong></div>
  `;

  if (!rows.length) {
    document.getElementById('reportBody').innerHTML = '<tr><td colspan="7" class="empty">ไม่พบสินค้า</td></tr>';
    return;
  }

  document.getElementById('reportBody').innerHTML = rows.map((r) => {
    const bal = r.in - r.out;
    const status = bal <= 0
      ? '<span class="badge badge-out">หมดสต๊อก</span>'
      : (bal < 5 ? '<span class="badge" style="background:#ffedd5;color:#c2410c">ใกล้หมด</span>' : '<span class="badge badge-in">มีสต๊อก</span>');
    return `
      <tr>
        <td>${escapeHtml(r.name)}</td>
        <td class="money">${r.price} บาท</td>
        <td>+${fmtNumber(r.in)}</td>
        <td>-${fmtNumber(r.out)}</td>
        <td class="${bal >= 0 ? 'stock-pos' : 'stock-neg'}">${fmtNumber(bal)}</td>
        <td class="money">${fmtMoney(bal * r.price)}</td>
        <td>${status}</td>
      </tr>
    `;
  }).join('');
}

/* ================== MOVEMENTS (รายงานรายวัน) ================== */
/* แปลง timestamp (ms) เป็น key วันที่ YYYY-MM-DD ในเขตเวลาท้องถิ่น */
function dateKey(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function setMoveDateToday() {
  const el = document.getElementById('moveDate');
  const now = new Date();
  el.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  renderDailyMoves();
}

/* แสดงรายการรับเข้า/จ่ายออกของวันที่เลือก */
function renderDailyMoves() {
  const el = document.getElementById('moveDate');
  if (!el.value) setMoveDateToday();
  const day = el.value;
  const dayMoves = movements.filter((m) => dateKey(m.createdAt) === day);

  const inList = dayMoves.filter((m) => m.type === 'in').sort((a, b) => a.createdAt - b.createdAt);
  const outList = dayMoves.filter((m) => m.type === 'out').sort((a, b) => a.createdAt - b.createdAt);

  const totalIn = inList.reduce((a, m) => a + m.quantity, 0);
  const totalOut = outList.reduce((a, m) => a + m.quantity, 0);
  const totalAmount = outList.reduce((a, m) => a + (m.quantity * m.price), 0);

  document.getElementById('moveSummary').innerHTML = `
    <div class="stat"><small>วันที่</small><strong>${day}</strong></div>
    <div class="stat green"><small>รับเข้าทั้งหมด</small><strong>${fmtNumber(totalIn)} ชิ้น</strong></div>
    <div class="stat orange"><small>จ่ายออกทั้งหมด</small><strong>${fmtNumber(totalOut)} ชิ้น</strong></div>
    <div class="stat red"><small>ยอดขาย/จ่ายออก (บาท)</small><strong>${fmtMoney(totalAmount)}</strong></div>
  `;

  document.getElementById('moveInBody').innerHTML = inList.length
    ? inList.map((m) => `
        <tr>
          <td>${fmtTime(m.createdAt)}</td>
          <td>${escapeHtml(m.productName)}</td>
          <td>+${fmtNumber(m.quantity)}</td>
          <td>${escapeHtml(m.note || '-')}</td>
        </tr>`).join('')
    : '<tr><td colspan="4" class="empty">ไม่มีรายการรับเข้าในวันนี้</td></tr>';

  document.getElementById('moveOutBody').innerHTML = outList.length
    ? outList.map((m) => `
        <tr>
          <td>${fmtTime(m.createdAt)}</td>
          <td>${escapeHtml(m.productName)}</td>
          <td>-${fmtNumber(m.quantity)}</td>
          <td class="money">${fmtMoney(m.quantity * m.price)}</td>
          <td>${escapeHtml(m.note || '-')}</td>
        </tr>`).join('')
    : '<tr><td colspan="5" class="empty">ไม่มีรายการจ่ายออกในวันนี้</td></tr>';
}

/* ================== EXPORT ================== */

/* ---- helper : สร้างชื่อไฟล์จากวัน/เวลา ---- */
function exportStamp(prefix) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return prefix + '-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes());
}

/* ---- Report: สร้าง rows จาก products + movements ---- */
function buildReportRows() {
  const map = {};
  products.forEach((p) => { map[String(p.id)] = { id: p.id, name: p.name, price: p.price, in: 0, out: 0 }; });
  movements.forEach((m) => {
    const key = String(m.productId);
    if (map[key]) {
      if (m.type === 'in') map[key].in += m.quantity;
      else if (m.type === 'out') map[key].out += m.quantity;
    }
  });
  return Object.values(map).map((r) => {
    const bal = r.in - r.out;
    const status = bal <= 0 ? 'หมดสต๊อก' : (bal < 5 ? 'ใกล้หมด' : 'มีสต๊อก');
    return { สินค้า: r.name, 'ราคา/หน่วย': r.price, รับเข้า: r.in, 'จ่ายออก': r.out, คงเหลือ: bal, 'มูลค่าคงเหลือ': bal * r.price, สถานะ: status };
  });
}

/* ---- Export Report -> Excel ---- */
function exportReportExcel() {
  const rows = buildReportRows();
  if (!rows.length) { Swal.fire({ icon: 'info', title: 'ไม่มีข้อมูล', confirmButtonColor: '#15803D' }); return; }
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'รายงานคงเหลือ');
  XLSX.writeFile(wb, exportStamp('รายงานคงเหลือ') + '.xlsx');
  Swal.fire({ icon: 'success', title: 'Export Excel สำเร็จ', timer: 1200, showConfirmButton: false });
}

/* ---- Export Report -> PDF ---- */
function exportReportPDF() {
  const rows = buildReportRows();
  if (!rows.length) { Swal.fire({ icon: 'info', title: 'ไม่มีข้อมูล', confirmButtonColor: '#15803D' }); return; }
  const html = `
    <h2 style="font-family:Prompt,Sarabun;text-align:center;color:#14532d">รายงานสินค้าคงเหลือ</h2>
    <table style="width:100%;border-collapse:collapse;font-family:Prompt,Sarabun;font-size:12px">
      <thead><tr style="background:#bbf7d0">
        <th style="border:1px solid #999;padding:6px;text-align:left">สินค้า</th>
        <th style="border:1px solid #999;padding:6px">ราคา/หน่วย</th>
        <th style="border:1px solid #999;padding:6px">รับเข้า</th>
        <th style="border:1px solid #999;padding:6px">จ่ายออก</th>
        <th style="border:1px solid #999;padding:6px">คงเหลือ</th>
        <th style="border:1px solid #999;padding:6px">มูลค่า</th>
        <th style="border:1px solid #999;padding:6px">สถานะ</th>
      </tr></thead>
      <tbody>${rows.map((r) => `<tr>
        <td style="border:1px solid #ddd;padding:6px;text-align:left">${escapeHtml(r['สินค้า'])}</td>
        <td style="border:1px solid #ddd;padding:6px">${r['ราคา/หน่วย']}</td>
        <td style="border:1px solid #ddd;padding:6px">${r['รับเข้า']}</td>
        <td style="border:1px solid #ddd;padding:6px">${r['จ่ายออก']}</td>
        <td style="border:1px solid #ddd;padding:6px">${r['คงเหลือ']}</td>
        <td style="border:1px solid #ddd;padding:6px">${r['มูลค่าคงเหลือ']}</td>
        <td style="border:1px solid #ddd;padding:6px">${escapeHtml(r['สถานะ'])}</td>
      </tr>`).join('')}
      </tbody>
    </table>`;
  html2pdf().set({ margin: 10, filename: exportStamp('รายงานคงเหลือ') + '.pdf', html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } }).from(html).save()
    .then(() => Swal.fire({ icon: 'success', title: 'Export PDF สำเร็จ', timer: 1200, showConfirmButton: false }))
    .catch(() => Swal.fire({ icon: 'error', title: 'Export PDF ไม่สำเร็จ', confirmButtonColor: '#15803D' }));
}

/* ---- Moves รายวัน: rows ---- */
function buildMoveRows() {
  const el = document.getElementById('moveDate');
  const day = el ? el.value : '';
  const all = movements.filter((m) => dateKey(m.createdAt) === day);
  return {
    day,
    inList: all.filter((m) => m.type === 'in'),
    outList: all.filter((m) => m.type === 'out')
  };
}

/* ---- Export Moves -> Excel ---- */
function exportMovesExcel() {
  const { day, inList, outList } = buildMoveRows();
  const wb = XLSX.utils.book_new();
  const inRows = inList.map((m) => ({ วันที่: fmtDate(m.createdAt), สินค้า: m.productName, 'รับเข้า': m.quantity, หมายเหตุ: m.note || '' }));
  const outRows = outList.map((m) => ({ วันที่: fmtDate(m.createdAt), สินค้า: m.productName, 'จ่ายออก': m.quantity, 'ยอดเงิน': m.quantity * m.price, หมายเหตุ: m.note || '' }));
  if (inRows.length) { XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(inRows), 'รับเข้า'); }
  if (outRows.length) { XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(outRows), 'จ่ายออก'); }
  XLSX.writeFile(wb, exportStamp('รายวัน_' + (day || 'date')) + '.xlsx');
  Swal.fire({ icon: 'success', title: 'Export Excel สำเร็จ', timer: 1200, showConfirmButton: false });
}

/* ---- Export Moves -> PDF ---- */
function exportMovesPDF() {
  const { day, inList, outList } = buildMoveRows();
  const thead = (h) => `<thead><tr style="background:#bbf7d0">${h.map((x) => `<th style="border:1px solid #999;padding:5px;${x==='สินค้า'?'text-align:left':''}">${x}</th>`).join('')}</tr></thead>`;
  const trow = (c, firstLeft) => `<tr>${c.map((x, i) => `<td style="border:1px solid #ddd;padding:5px;${(i===0&&firstLeft)?'text-align:left':''}">${x}</td>`).join('')}</tr>`;
  const inHtml = inList.map((m) => trow([fmtTime(m.createdAt), escapeHtml(m.productName), '+' + m.quantity, escapeHtml(m.note||'-')], true)).join('');
  const outHtml = outList.map((m) => trow([fmtTime(m.createdAt), escapeHtml(m.productName), '-' + m.quantity, m.quantity*m.price, escapeHtml(m.note||'-')], true)).join('');
  const html = `
    <h2 style="font-family:Prompt,Sarabun;text-align:center;color:#14532d">รายงานการเคลื่อนไหวรายวัน ${day}</h2>
    <h3 style="font-family:Prompt,Sarabun;color:#14532d">รับเข้า</h3>
    <table style="width:100%;border-collapse:collapse;font-family:Prompt,Sarabun;font-size:11px">${thead(['เวลา','สินค้า','รับเข้า','หมายเหตุ'])}<tbody>${inHtml || '<tr><td colspan="4" style="border:1px solid #ddd;padding:5px">ไม่มีรายการ</td></tr>'}</tbody></table>
    <h3 style="font-family:Prompt,Sarabun;color:#14532d">จ่ายออก</h3>
    <table style="width:100%;border-collapse:collapse;font-family:Prompt,Sarabun;font-size:11px">${thead(['เวลา','สินค้า','จ่ายออก','ยอดเงิน','หมายเหตุ'])}<tbody>${outHtml || '<tr><td colspan="5" style="border:1px solid #ddd;padding:5px">ไม่มีรายการ</td></tr>'}</tbody></table>`;
  html2pdf().set({ margin: 10, filename: exportStamp('รายวัน_' + (day || 'date')) + '.pdf', html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } }).from(html).save()
    .then(() => Swal.fire({ icon: 'success', title: 'Export PDF สำเร็จ', timer: 1200, showConfirmButton: false }))
    .catch(() => Swal.fire({ icon: 'error', title: 'Export PDF ไม่สำเร็จ', confirmButtonColor: '#15803D' }));
}

/* ---------- Init ---------- */
if (!Token.get()) {
  window.location.href = 'index.html';
} else {
  showUserBadge();
  const page = location.hash.replace('#', '') || 'products';
  showPage(page);
  loadAll();
  // ถ้าเป็น user ทั่วไป ปิดการใช้งานฟอร์มเพิ่ม/แก้ไขให้เห็นชัด
  if (!isAdmin()) {
    setTimeout(() => {
      const hint = document.createElement('div');
      hint.style.cssText = 'background:#FEF3C7;border:1px solid #F59E0B;color:#92400E;padding:10px 14px;border-radius:12px;margin-bottom:12px;font-size:13px';
      hint.innerHTML = '<i class="fa-solid fa-circle-info"></i> คุณเข้าสู่ระบบด้วย Google ในโหมด <strong>อ่านอย่างเดียว</strong> — ดูรายงานได้ แต่แก้ไขต้องใช้บัญชีผู้ดูแล (teesoftwareai@gmail.com)';
      const main = document.querySelector('main');
      if (main) main.prepend(hint);
    }, 400);
  }
}
