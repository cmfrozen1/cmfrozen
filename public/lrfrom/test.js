    const $ = id => document.getElementById(id);
    let currentUser = null;
    let allLeaves = [];
    let activeFilter = 'pending';
    let approvalDepts = [];
    let deptLoadTimer = null;
    let pdfMakeLoadPromise = null;
    let pdfMakeLib_ = null;
    const pads = {};
    const cardRole = {};

    function swalReady() { return typeof Swal !== 'undefined' }
    function alertMsg(title, text, icon) {
      if (swalReady()) return Swal.fire({ title: title, text: text || '', icon: icon || 'error', confirmButtonText: 'รับทราบ' });
      return window.alert(text ? title + '\n' + text : title);
    }
    function okMsg(title, text, extra) {
      if (swalReady()) return Swal.fire({ title: title, text: text || '', icon: 'success', confirmButtonText: 'ตกลง', timer: 2600, timerProgressBar: true, ...(extra || {}) });
      return window.alert(title + (text ? '\n' + text : ''));
    }

    /** หน้าล็อกอิน = SweetAlert popup เท่านั้น (ใช้ตอนเปิดหน้าและตอนออกจากระบบ) */
    function showLoginScreen_() {
      if (swalReady()) {
        const fallback = $('loginFallback'); if (fallback) fallback.style.display = 'none';
        showLoginSwal();
      } else {
        const fallback = $('loginFallback'); if (fallback) fallback.style.display = 'block';
      }
    }
    function requireLogin_() {
      if (currentUser) return true;
      showLoginScreen_();
      return false;
    }

    function doLogout() {
      currentUser = null;
      allLeaves = [];
      Object.keys(pads).forEach(function (k) { delete pads[k]; });
      Object.keys(cardRole).forEach(function (k) { delete cardRole[k]; });
      $('appView').style.display = 'none';
      $('loginView').style.display = 'none';
      showLoginScreen_();
    }


    /* ===== เข้าสู่ระบบอนุมัติ: เลือกบทบาท + แผนก + รหัสพนักงาน ===== */
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) }
    /* escape สำหรับ id ที่ฝังใน onclick="...('...')" */
    function jsStr(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/[\r\n]/g, ' ') }

    /* ข้อความ error แสดงลงในกล่อง SweetAlert ที่กำลังเปิดอยู่ */
    function hMsg(m) { const el = document.getElementById('swalMsg'); if (el) el.textContent = m || '' }

    function loadDepts() {
      if (deptLoadTimer) clearTimeout(deptLoadTimer);
      const swalSel = document.getElementById('swalDept');
      if (swalSel && !approvalDepts.length) {
        swalSel.disabled = true;
        swalSel.innerHTML = '<option value="">กำลังโหลดรายชื่อแผนก...</option>';
      }

      if (typeof google === 'undefined' || !google.script || !google.script.run) {
        if (swalSel) { swalSel.disabled = true; swalSel.innerHTML = '<option value="">เปิดผ่านลิงก์ Web App เพื่อโหลดแผนก</option>'; }
        return;
      }
      let completed = false;
      deptLoadTimer = setTimeout(() => {
        if (completed) return;
        const sel = document.getElementById('swalDept');
        if (sel) { sel.disabled = true; sel.innerHTML = '<option value="">โหลดรายชื่อแผนกใช้เวลานานเกินไป</option>'; }
        hMsg('โหลดรายชื่อแผนกไม่สำเร็จหรือใช้เวลานานเกินไป กรุณาลองใหม่');
      }, 15000);
      google.script.run
        .withSuccessHandler(res => {
          completed = true;
          clearTimeout(deptLoadTimer);
          hMsg('');
          approvalDepts = (res && res.ok && Array.isArray(res.data)) ? res.data : [];
          fillDeptSelect();
          if (!approvalDepts.length) hMsg((res && res.message) || 'ไม่พบรายชื่อแผนกในระบบ');
        })
        .withFailureHandler(err => {
          completed = true;
          clearTimeout(deptLoadTimer);
          const sel = document.getElementById('swalDept');
          if (sel) { sel.disabled = true; sel.innerHTML = '<option value="">โหลดรายชื่อแผนกไม่สำเร็จ</option>'; }
          hMsg('โหลดข้อมูลแผนกไม่สำเร็จ: ' + ((err && err.message) || err));
        })
        .getApprovalDepartments();
    }

    function fillDeptSelect() {
      const depts = approvalDepts;
      const swalSel = document.getElementById('swalDept');
      if (swalSel) {
        const curSwal = swalSel.value;
        if (!depts.length) {
          swalSel.innerHTML = '<option value="">— ไม่พบข้อมูลแผนก —</option>';
          swalSel.disabled = true;
        } else {
          swalSel.disabled = false;
          swalSel.innerHTML = '<option value="">— เลือกแผนก —</option>' + depts.map(d => '<option value="' + esc(d) + '">' + esc(d) + '</option>').join('');
          if (depts.indexOf(curSwal) !== -1) swalSel.value = curSwal;
        }
      }
    }
    const ROLE_META = {
      foreman: { label: 'หัวหน้างาน', icon: '🛠', sigLabel: 'หัวหน้างาน' },
      head: { label: 'หัวหน้าแผนก', icon: '🔓', sigLabel: 'หัวหน้าแผนก' },
      mgr: { label: 'ผู้ช่วย / รอง / ผู้จัดการ', icon: '👤', sigLabel: 'ผู้จัดการ' },
      admin: { label: 'ผู้ดูแลระบบ (Admin)', icon: '👑', sigLabel: 'Admin' }
    };
    const ROLE_ORDER = ['foreman', 'head', 'mgr'];
    const ROLE_LABEL_ADMIN = 'ผู้ดูแลระบบ (Admin)';

    let headModalRole = 'foreman';

    /** แสดง SweetAlert2 Login Popup */
    function showLoginSwal() {
      if (!swalReady()) {
        return;
      }

      let deptOptions = '<option value="">— เลือกแผนก —</option>';
      if (approvalDepts && approvalDepts.length > 0) {
        deptOptions = '<option value="">— เลือกแผนก —</option>' + approvalDepts.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');
      } else {
        deptOptions = '<option value="">— กำลังโหลดแผนก... —</option>';
      }

      Swal.fire({
        title: '🔐 เข้าสู่ระบบอนุมัติใบลา',
        html: `
      <div style="text-align:left; font-family:'Sarabun',sans-serif;">
        <p style="font-size:13px; color:var(--muted,#666); margin:-5px 0 15px; text-align:center;">
          เลือกบทบาท แผนก และกรอกรหัสพนักงานผู้อนุมัติ
        </p>

        <label style="display:block; font-size:14px; font-weight:600; margin-bottom:4px;">บทบาทผู้อนุมัติ</label>
        <select id="swalRole" class="swal2-input" style="width:100%; margin:0 0 12px 0; height:44px; font-size:15px; border-radius:8px; box-sizing:border-box;" onchange="onSwalRoleChange()">
          <option value="foreman" ${headModalRole === 'foreman' ? 'selected' : ''}>🛠️ หัวหน้างาน</option>
          <option value="head" ${headModalRole === 'head' ? 'selected' : ''}>🔓 หัวหน้าแผนก</option>
          <option value="mgr" ${headModalRole === 'mgr' ? 'selected' : ''}>👤 ผู้ช่วย / รอง / ผู้จัดการ</option>
          <option value="admin" ${headModalRole === 'admin' ? 'selected' : ''}>👑 ผู้ดูแลระบบ (Admin)</option>
        </select>

        <div id="swalDeptRow">
        <label style="display:block; font-size:14px; font-weight:600; margin-bottom:4px;">แผนก</label>
        <select id="swalDept" class="swal2-input" style="width:100%; margin:0 0 12px 0; height:44px; font-size:15px; border-radius:8px; box-sizing:border-box;">
          ${deptOptions}
        </select>
        </div>

        <label style="display:block; font-size:14px; font-weight:600; margin-bottom:4px;">รหัสพนักงานผู้อนุมัติ</label>
        <input type="password" id="swalCode" inputmode="numeric" placeholder="เช่น 001" autocomplete="current-password" class="swal2-input" style="width:100%; margin:0 0 8px 0; height:44px; font-size:15px; border-radius:8px; box-sizing:border-box;">

        <div id="swalMsg" style="min-height:20px; font-size:13px; color:#b42318; margin-top:6px; text-align:center;"></div>
      </div>
    `,
        focusConfirm: false,
        allowOutsideClick: false,
        allowEscapeKey: false,
        confirmButtonText: 'เข้าสู่ระบบ',
        confirmButtonColor: '#1f5fbf',
        customClass: {
          popup: 'swal-login-popup'
        },
        didOpen: () => {
          if (!approvalDepts || !approvalDepts.length) {
            loadDepts();
          }
          const codeInput = document.getElementById('swalCode');
          if (codeInput) {
            codeInput.focus();
            codeInput.addEventListener('keypress', (e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                Swal.clickConfirm();
              }
            });
          }
        },
        preConfirm: () => {
          const role = document.getElementById('swalRole').value;
          const dept = document.getElementById('swalDept') ? document.getElementById('swalDept').value.trim() : '';
          const code = document.getElementById('swalCode').value.trim();
          const msgEl = document.getElementById('swalMsg');

          /* admin ไม่จำเป็นต้องเลือกแผนก */
          if (role !== 'admin' && !dept) {
            if (msgEl) msgEl.textContent = 'กรุณาเลือกแผนก';
            Swal.showValidationMessage('กรุณาเลือกแผนก');
            return false;
          }
          if (!code) {
            if (msgEl) msgEl.textContent = 'กรุณากรอกรหัสพนักงาน';
            Swal.showValidationMessage('กรุณากรอกรหัสพนักงาน');
            return false;
          }

          headModalRole = role;
          Swal.showLoading();

          return new Promise((resolve) => {
            if (typeof google === 'undefined' || !google.script || !google.script.run) {
              Swal.hideLoading();
              /* offline / dev: admin fallback */
              if (role === 'admin') {
                currentUser = { code, name: 'Admin ' + code, dept: '', role: 'admin', roleName: 'ผู้ดูแลระบบ (Admin)', isAdmin: true, isForeman: false, isHead: false, isMgr: false, filterDept: '' };
                Swal.fire({ title: 'เข้าสู่ระบบสำเร็จ!', text: 'ยินดีต้อนรับ Admin (ออฟไลน์)', icon: 'success', timer: 1400, showConfirmButton: false }).then(() => showAppView());
                resolve(true); return;
              }
              const emsg = 'ต้องเปิดผ่านลิงก์ Web App ของ Apps Script จึงจะตรวจสอบได้';
              if (msgEl) msgEl.textContent = emsg;
              Swal.showValidationMessage(emsg);
              resolve(false);
              return;
            }

            google.script.run
              .withSuccessHandler(res => {
                if (res && res.ok) {
                  const r = (res.approver && res.approver.role) || role;
                  const roleMeta = ROLE_META[r] || { label: ROLE_LABEL_ADMIN };
                  currentUser = {
                    code: code,
                    name: (res.approver && res.approver.name) || (roleMeta.label + (dept ? ' ' + dept : '')),
                    dept: (res.approver && res.approver.dept) || dept,
                    role: r,
                    roleName: (res.approver && res.approver.roleName) || roleMeta.label || r,
                    isAdmin: r === 'admin',
                    isForeman: r === 'foreman',
                    isHead: r === 'head',
                    isMgr: r === 'mgr',
                    filterDept: r === 'admin' ? '' : ((res.approver && res.approver.dept) || dept)
                  };
                  if (res.warn) {
                    Swal.fire({
                      title: 'เข้าสู่ระบบสำเร็จ',
                      text: res.warn,
                      icon: 'warning',
                      confirmButtonText: 'ตกลง'
                    }).then(() => {
                      showAppView();
                    });
                  } else {
                    Swal.fire({
                      title: 'เข้าสู่ระบบสำเร็จ!',
                      text: `ยินดีต้อนรับ ${currentUser.name}`,
                      icon: 'success',
                      timer: 1500,
                      showConfirmButton: false
                    }).then(() => {
                      showAppView();
                    });
                  }
                  resolve(true);
                } else {
                  Swal.hideLoading();
                  const errMsg = (res && res.message) || 'ไม่พบข้อมูลผู้อนุมัตินี้';
                  if (msgEl) msgEl.textContent = errMsg;
                  Swal.showValidationMessage(errMsg);
                  const codeIn = document.getElementById('swalCode');
                  if (codeIn) { codeIn.value = ''; codeIn.focus(); }
                  resolve(false);
                }
              })
              .withFailureHandler(err => {
                Swal.hideLoading();
                const errMsg = 'เกิดข้อผิดพลาด: ' + ((err && err.message) || err);
                if (msgEl) msgEl.textContent = errMsg;
                Swal.showValidationMessage(errMsg);
                resolve(false);
              })
              .loginDeptHead(role === 'admin' ? '' : dept, code, role);
          });
        }
      });
    }





    /** เรียกเมื่อ swalRole เปลี่ยนค่า — ซ่อน/แสดงช่องแผนกตาม role */
    function onSwalRoleChange() {
      const roleEl = document.getElementById('swalRole');
      const deptRow = document.getElementById('swalDeptRow');
      if (!roleEl || !deptRow) return;
      deptRow.style.display = roleEl.value === 'admin' ? 'none' : 'block';
    }

    function showAppView() {
      $('loginView').style.display = 'none';
      $('appView').style.display = 'block';
      $('userName').textContent = currentUser.name;
      $('userDeptRole').textContent = `แผนก: ${currentUser.dept || 'ทั้งหมด'} | บทบาท: ${currentUser.roleName || 'ผู้อนุมัติ'}`;

      const wrap = document.querySelector('.wrap');
      if (currentUser.isAdmin) {
        if (wrap) wrap.classList.add('wide');
        $('adminView').style.display = 'block';
        $('normalView').style.display = 'none';
        $('roTagLabel').textContent = '👑 โหมด Admin — ดูข้อมูลใบลาทุกแผนก';
        $('roTagLabel').style.background = '#fff8e1';
        $('roTagLabel').style.color = '#7c5c00';
        $('roTagLabel').style.borderColor = '#ffe082';
      } else {
        if (wrap) wrap.classList.remove('wide');
        $('adminView').style.display = 'none';
        $('normalView').style.display = 'block';
        $('roTagLabel').textContent = 'โหมดอ่านอย่างเดียว — ดูข้อมูลได้ แก้ไขข้อมูลผู้ลาไม่ได้';
        $('roTagLabel').style.background = '';
        $('roTagLabel').style.color = '';
        $('roTagLabel').style.borderColor = '';
      }
      loadLeaves();
    }

    function loadLeaves() {
      if (currentUser && currentUser.isAdmin) {
        $('dtBody').innerHTML = '<tr><td colspan="7" class="dt-empty">⏳ กำลังดึงข้อมูลใบลาทั้งหมด...</td></tr>';
      } else {
        const ll = $('leavesList');
        if (ll) ll.innerHTML = '<p style="text-align:center;color:var(--muted)">กำลังดึงรายการใบลา...</p>';
      }

      if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run
          .withSuccessHandler(res => {
            if (res && res.ok && Array.isArray(res.data)) {
              allLeaves = res.data;
              if (currentUser && currentUser.isAdmin) {
                initAdminDataTable();
              } else {
                renderLeaves();
              }
            } else {
              if (currentUser && currentUser.isAdmin) {
                $('dtBody').innerHTML = '<tr><td colspan="7" class="dt-empty">' + esc(res.message || 'ไม่พบรายการใบลา') + '</td></tr>';
              } else {
                const ll = $('leavesList');
                if (ll) ll.innerHTML = '<p style="text-align:center;color:var(--muted)">' + esc(res.message || 'ไม่พบรายการใบลา') + '</p>';
              }
            }
          })
          .withFailureHandler(err => {
            if (currentUser && currentUser.isAdmin) {
              $('dtBody').innerHTML = '<tr><td colspan="7" class="dt-empty" style="color:red">เกิดข้อผิดพลาด: ' + esc(err.message || err) + '</td></tr>';
            } else {
              const ll = $('leavesList');
              if (ll) ll.innerHTML = '<p style="text-align:center;color:red">เกิดข้อผิดพลาด: ' + esc(err.message || err) + '</p>';
            }
          })
          .getLeavesForApproval(currentUser.code, currentUser.filterDept || '', currentUser.role || 'head');
      } else {
        // Offline test data
        allLeaves = [
          { id: 'LV-20261001-1001', name: 'สมชาย ใจดี', pre: 'นาย', code: '001', dept: 'บุคคลธุรการ', type: 'ลากิจ', d1: '2026-10-01', d2: '2026-10-02', qty: '2', unit: 'วัน', why: 'ติดภารกิจครอบครัว', foremanApproval: 'อนุมัติ', headApproval: 'อนุมัติ', mgrApproval: 'อนุมัติ', status: 'อนุมัติ', now: '2026-10-01' },
          { id: 'LV-20261001-1002', name: 'สมหญิง รักดี', pre: 'นาง', code: '002', dept: 'ผลิต', type: 'ลาป่วยมีใบรับรองแพทย์', d1: '2026-10-03', d2: '2026-10-03', qty: '1', unit: 'วัน', why: 'ป่วย', foremanApproval: '', headApproval: '', mgrApproval: '', status: 'รออนุมัติ', now: '2026-10-02' },
          { id: 'LV-20261001-1003', name: 'วิชัย มั่นคง', pre: 'นาย', code: '003', dept: 'บุคคลธุรการ', type: 'ลาพักร้อน', d1: '2026-10-05', d2: '2026-10-07', qty: '3', unit: 'วัน', why: 'พักผ่อน', foremanApproval: '', headApproval: '', mgrApproval: 'ไม่อนุมัติ', status: 'ไม่อนุมัติ', now: '2026-10-02' }
        ];
        if (currentUser && currentUser.isAdmin) {
          initAdminDataTable();
        } else {
          renderLeaves();
        }
      }
    }

    /* ================================================================
       ===== Admin DataTable Engine =====
       ================================================================ */

    let dtFiltered = [];
    let dtPage = 1;
    let dtSortKey = 'id';
    let dtSortDir = 'desc'; // 'asc' | 'desc'
    let dtAdminFilter = 'all'; // 'all' | 'pending' | 'approved' | 'rejected'

    function initAdminDataTable() {
      /* ตั้ง dept filter options จากข้อมูลจริง */
      const deptSel = $('dtDeptFilter');
      if (deptSel) {
        const depts = Array.from(new Set(allLeaves.map(x => String(x.dept || '').trim()).filter(Boolean))).sort();
        deptSel.innerHTML = '<option value="">— ทุกแผนก —</option>' + depts.map(d => '<option value="' + esc(d) + '">' + esc(d) + '</option>').join('');
      }
      dtPage = 1;
      dtAdminFilter = 'all';
      dtApplyFilters();
    }

    /** กด Summary Card เพื่อ filter */
    function adminFilter(f) {
      dtAdminFilter = f;
      /* อัปเดต active card */
      document.querySelectorAll('.sum-card').forEach(el => el.classList.remove('active'));
      const map = { all: 'c-all', pending: 'c-pending', approved: 'c-approved', rejected: 'c-rejected' };
      const target = document.querySelector('.sum-card.' + (map[f] || 'c-all'));
      if (target) target.classList.add('active');
      dtPage = 1;
      dtApplyFilters();
    }

    /** ฟังก์ชันจัดสถานะเป็น pending/approved/rejected */
    function normalizeStatus(item) {
      const s = String(item.status || '').trim();
      if (s === 'อนุมัติ') return 'approved';
      if (s === 'ไม่อนุมัติ') return 'rejected';
      return 'pending';
    }

    /** Apply all filters, sort, pagination and render */
    function dtApplyFilters() {
      const q = ($('dtSearch') ? $('dtSearch').value.toLowerCase() : '');
      const deptF = ($('dtDeptFilter') ? $('dtDeptFilter').value : '');
      const typeF = ($('dtTypeFilter') ? $('dtTypeFilter').value : '');

      /* อัปเดต summary counts */
      const total = allLeaves.length;
      const pending = allLeaves.filter(x => normalizeStatus(x) === 'pending').length;
      const approved = allLeaves.filter(x => normalizeStatus(x) === 'approved').length;
      const rejected = allLeaves.filter(x => normalizeStatus(x) === 'rejected').length;
      if ($('sc-total')) $('sc-total').textContent = total;
      if ($('sc-pending')) $('sc-pending').textContent = pending;
      if ($('sc-approved')) $('sc-approved').textContent = approved;
      if ($('sc-rejected')) $('sc-rejected').textContent = rejected;

      dtFiltered = allLeaves.filter(item => {
        /* status filter */
        const ns = normalizeStatus(item);
        if (dtAdminFilter !== 'all' && ns !== dtAdminFilter) return false;
        /* dept filter */
        if (deptF && String(item.dept || '').trim() !== deptF) return false;
        /* type filter */
        if (typeF && String(item.type || '').trim() !== typeF) return false;
        /* search */
        if (q) {
          const haystack = [item.name, item.code, item.dept, item.type, item.id, item.status].join(' ').toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      });

      /* sort */
      dtFiltered.sort((a, b) => {
        let va = String(a[dtSortKey] || '');
        let vb = String(b[dtSortKey] || '');
        if (dtSortKey === 'qty') { va = parseFloat(va) || 0; vb = parseFloat(vb) || 0; return dtSortDir === 'asc' ? va - vb : vb - va; }
        return dtSortDir === 'asc' ? va.localeCompare(vb, 'th') : vb.localeCompare(va, 'th');
      });

      /* update sort icons */
      document.querySelectorAll('.dt-table th').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        const onclick = th.getAttribute('onclick') || '';
        const m = onclick.match(/dtSort\('(\w+)'\)/);
        if (m && m[1] === dtSortKey) th.classList.add(dtSortDir === 'asc' ? 'sort-asc' : 'sort-desc');
      });

      dtPage = Math.max(1, Math.min(dtPage, dtTotalPages()));
      dtRenderPage();
    }

    function dtTotalPages() {
      const per = parseInt(($('dtRowsPer') ? $('dtRowsPer').value : 10)) || 10;
      return Math.max(1, Math.ceil(dtFiltered.length / per));
    }

    function dtSort(key) {
      if (dtSortKey === key) {
        dtSortDir = dtSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        dtSortKey = key;
        dtSortDir = 'asc';
      }
      dtApplyFilters();
    }

    function dtRenderPage() {
      const per = parseInt(($('dtRowsPer') ? $('dtRowsPer').value : 10)) || 10;
      const start = (dtPage - 1) * per;
      const pageItems = dtFiltered.slice(start, start + per);
      const total = dtFiltered.length;

      /* info */
      if ($('dtPagerInfo')) {
        $('dtPagerInfo').textContent = total === 0
          ? 'ไม่พบรายการ'
          : `แสดง ${start + 1}–${Math.min(start + per, total)} จาก ${total} รายการ`;
      }

      /* rows */
      const tbody = $('dtBody');
      if (!tbody) return;
      if (!pageItems.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="dt-empty">ไม่พบรายการที่ตรงกับเงื่อนไข</td></tr>';
      } else {
        tbody.innerHTML = pageItems.map((item, i) => {
          const ns = normalizeStatus(item);
          const badgeCls = ns === 'approved' ? 'approved' : (ns === 'rejected' ? 'rejected' : 'pending');
          const statusLabel = ns === 'approved' ? 'อนุมัติแล้ว' : (ns === 'rejected' ? 'ไม่อนุมัติ' : 'รออนุมัติ');
          const jsId = jsStr(item.id);

          const actionBtns = ns === 'approved'
            ? `<button class="btn-print" onclick="printLeave('${jsId}')">🖨️ พิมพ์ใบลา</button>
               <button class="btn-preview" style="margin-top:4px" onclick="previewLeavePdf('${jsId}', this)">📄 ดู PDF</button>`
            : `<span class="badge ${badgeCls}" style="font-size:12px;padding:4px 10px">${statusLabel}</span>`;

          const pendingWho = !item.foremanApproval ? 'รอหัวหน้างาน' : (!item.headApproval ? 'รอหัวหน้าแผนก' : (!item.mgrApproval ? 'รอผู้จัดการ' : ''));

          return `<tr>
            <td style="font-size:12px;color:var(--muted);white-space:nowrap">${esc(item.id || '')}<br><span style="font-size:11px">${esc(item.now || '')}</span></td>
            <td>
              <div class="emp-name">${esc((item.pre || '') + ' ' + (item.name || ''))}</div>
              <div class="emp-meta">รหัส: ${esc(item.code || '-')} | แผนก: ${esc(item.dept || '-')}</div>
            </td>
            <td style="white-space:nowrap">${esc(item.type || '-')}</td>
            <td style="white-space:nowrap;font-size:13px">${esc(item.d1 || '-')}<br>ถึง ${esc(item.d2 || '-')}</td>
            <td style="text-align:center;font-weight:700">${esc(item.qty || '-')} <span style="font-weight:400;font-size:12px">${esc(item.unit || '')}</span></td>
            <td>
              <span class="badge ${badgeCls}">${esc(item.status || statusLabel)}</span>
              ${ns === 'pending' && pendingWho ? '<br><span style="font-size:11px;color:var(--muted)">' + esc(pendingWho) + '</span>' : ''}
            </td>
            <td style="white-space:nowrap;display:flex;flex-direction:column;gap:4px">${actionBtns}</td>
          </tr>`;
        }).join('');
      }

      /* pager buttons */
      const totalPages = dtTotalPages();
      const pagerEl = $('dtPagerBtns');
      if (pagerEl) {
        let html = '';
        html += `<button ${dtPage <= 1 ? 'disabled' : ''} onclick="dtGoPage(${dtPage - 1})">‹</button>`;
        for (let p = 1; p <= totalPages; p++) {
          if (totalPages > 7 && Math.abs(p - dtPage) > 2 && p !== 1 && p !== totalPages) {
            if (p === 2 || p === totalPages - 1) html += '<button disabled style="border:none;background:none">…</button>';
            continue;
          }
          html += `<button class="${p === dtPage ? 'active' : ''}" onclick="dtGoPage(${p})">${p}</button>`;
        }
        html += `<button ${dtPage >= totalPages ? 'disabled' : ''} onclick="dtGoPage(${dtPage + 1})">›</button>`;
        pagerEl.innerHTML = html;
      }
    }

    function dtGoPage(p) {
      dtPage = p;
      dtRenderPage();
    }

    /** เปิดหน้าพิมพ์ใบลา (report.html) */
    function printLeave(id) {
      if (!requireLogin_()) return;
      const item = allLeaves.find(x => x.id === id);
      if (!item || normalizeStatus(item) !== 'approved') {
        alertMsg('ไม่สามารถพิมพ์ได้', 'รายการนี้ยังไม่อนุมัติครบ', 'warning');
        return;
      }
      /* เปิด report ใน window ใหม่ โดยส่ง query params เหมือน Apps Script doGet */
      if (typeof google !== 'undefined' && google.script && google.script.run) {
        /* ดึง URL ของ Web App แล้วเปิดหน้า report */
        const baseUrl = window.location.href.split('?')[0];
        const reportUrl = baseUrl + '?page=report&id=' + encodeURIComponent(id);
        window.open(reportUrl, '_blank');
      } else {
        /* dev fallback */
        alertMsg('ข้อมูลพร้อม', 'จะเปิดใบลา ID: ' + id + ' (ต้องเปิดผ่าน Web App)', 'info');
      }
    }


    function filterLeaves(f) {
      activeFilter = f;
      $('filterPending').className = f === 'pending' ? 'btn pri' : 'btn';
      $('filterAll').className = f === 'all' ? 'btn pri' : 'btn';
      renderLeaves();
    }

    function renderLeaves() {
      const container = $('leavesList');
      const list = allLeaves.filter(item => {
        if (activeFilter === 'pending') {
          if (canRole('foreman') && !item.foremanApproval) return true;
          if (canRole('head') && !item.headApproval) return true;
          if (canRole('mgr') && !item.mgrApproval) return true;
          return false;
        }
        return true;
      });

      if (!list.length) {
        const emptyMessage = currentUser.role === 'mgr'
          ? 'ยังไม่มีใบลาที่หัวหน้าแผนกอนุมัติแล้วสำหรับแผนกนี้'
          : `ไม่มีรายการใบลา${activeFilter === 'pending' ? 'ที่รออนุมัติ' : ''}${currentUser.filterDept ? 'ของแผนก ' + esc(currentUser.filterDept) : ''}`;
        container.innerHTML = `<section style="text-align:center;padding:30px 14px">
    <p style="color:var(--muted);margin:0 0 6px">${esc(emptyMessage)}</p>
    <p style="color:var(--muted);margin:0;font-size:13px">ถ้าไม่พบ แสดงว่ายังไม่มีใบลาของแผนกนี้ หรือผู้ลายังไม่ได้บันทึกใบลา (ตรวจว่าผู้ลากรอกรหัสพนักงานและแผนกถูกต้อง)</p>
    </section>`;
        return;
      }


      const roles = roles_();

      container.innerHTML = list.map((item, idx) => {
        const currentRole = pickDefaultRole_(item);
        const roleReviewed = Boolean(item[currentRole + 'Approval']);
        const approvalComplete = item.status === 'อนุมัติ' || item.status === 'ไม่อนุมัติ';
        cardRole[item.id] = currentRole;
        const timeFrom = String(item.t1 || '').trim();
        const timeTo = String(item.t2 || '').trim();
        const safeId = esc(item.id);
        const jsId = jsStr(item.id);
        const sig = link => link ? `<img src="${esc(link)}" alt="ลายเซ็น" loading="lazy">` : '';
        const res = (val, link) => {
          const cls = val === 'อนุมัติ' ? 'approved' : (val === 'ไม่อนุมัติ' ? 'rejected' : 'pending');
          return `<span class="badge ${cls}">${esc(val || 'รออนุมัติ')}</span>${link ? '<span class="sigview">' + sig(link) + '</span>' : ''}`;
        };


        return `
  <section class="leave-card" id="card-${safeId}">
   <div class="leave-card-head">
    <div>
     <div class="leave-title">${esc(item.name || '-')} (${esc(item.code || '-')})</div>
     <div style="font-size:13px;color:var(--muted)">เลขที่ใบลา: ${esc(item.id)} | ยื่นเมื่อ: ${esc(item.now || '-')}</div>
    </div>
    <span class="badge ${item.status === 'อนุมัติ' ? 'approved' : (item.status === 'ไม่อนุมัติ' ? 'rejected' : 'pending')}">${esc(item.status || 'รออนุมัติ')}</span>
   </div>

   <div class="applicant">
    <div class="who">${esc(item.pre || '')} ${esc(item.name || '-')}</div>
    <div class="meta">รหัสพนักงาน: ${esc(item.code || '-')} | แผนก: ${esc(item.dept || '-')} | ประเภทพนักงาน: ${esc(item.emp || '-')}</div>
    <dl>
     <dt>เรียน</dt><dd>${esc(item.to || '-')}</dd>
     <dt>ขอลา</dt><dd>${esc(item.type || '-')}</dd>
     <dt>เนื่องจาก</dt><dd>${esc(item.why || '-')}</dd>
     <dt>ตั้งแต่วันที่</dt><dd>${esc(item.d1 || '-')} ถึงวันที่ ${esc(item.d2 || '-')}</dd>
     <dt>รวมจำนวน</dt><dd><b>${esc(item.qty || '-')} ${esc(item.unit || '')}</b> (คำนวณโดยระบบ ไม่นับวันอาทิตย์)</dd>
     ${timeFrom ? `<dt>ตั้งแต่เวลา</dt><dd>${esc(timeFrom)}</dd>` : ''}
     ${timeTo ? `<dt>ถึงเวลา</dt><dd>${esc(timeTo)}</dd>` : ''}
    </dl>
    ${item.sigApp ? `<div class="sigview"><span style="font-size:13px;color:var(--muted)">ลายมือชื่อผู้ลา:</span>${sig(item.sigApp)}</div>` : ''}
   </div>

    <div class="results">
     ${ROLE_ORDER.map(k => `<div class="rrow"><b>${ROLE_META[k].label}</b>${res(item[k + 'Approval'], item['sig' + k.charAt(0).toUpperCase() + k.slice(1)])}</div>`).join('')}
    </div>

   ${roleReviewed || approvalComplete ? `<p style="margin:14px 0 0;padding-top:12px;border-top:1px dashed var(--line);color:var(--ok);font-weight:700">${roleReviewed ? 'บทบาทนี้พิจารณาแล้ว' : 'การพิจารณาเสร็จสิ้นแล้ว'}</p>` : `
   <div style="margin-top:14px;padding-top:12px;border-top:1px dashed var(--line)">
    <div style="font-weight:700;font-size:15px;margin-bottom:8px">พิจารณาอนุมัติ</div>
     ${roles.length > 1 ? `<div class="rolepick">
      ${roles.map(k => `<button type="button" class="btn ${currentRole === k ? 'on' : ''}" onclick="pickRole('${jsId}','${k}')">${ROLE_META[k].icon} ${ROLE_META[k].label}</button>`).join('')}
     </div>` : ''}
     <div style="font-size:14px;margin-bottom:8px">กำลังพิจารณาในฐานะ <b>${ROLE_META[currentRole].label}</b></div>
    <div class="approval-action">
     <label class="ok"><input type="radio" name="app-${safeId}-${currentRole}" value="อนุมัติ" ${item[currentRole + 'Approval'] === 'อนุมัติ' ? 'checked' : ''}><span>✓ อนุมัติ</span></label>
     <label class="no"><input type="radio" name="app-${safeId}-${currentRole}" value="ไม่อนุมัติ" ${item[currentRole + 'Approval'] === 'ไม่อนุมัติ' ? 'checked' : ''}><span>✕ ไม่อนุมัติ</span></label>
    </div>

    <label style="margin-top:10px">ลายมือชื่อ${ROLE_META[currentRole].sigLabel}</label>
    <div class="pd-box" data-id="${safeId}">
     <canvas id="canvas-${safeId}"></canvas>
     <div style="margin-top:6px;display:flex;justify-content:space-between">
      <button class="btn" type="button" style="min-height:36px;padding:0 12px;font-size:13px" onclick="clearSig('${jsId}')">ล้างลายเซ็น</button>
      <button class="btn pri" type="button" style="min-height:36px;padding:0 16px;font-size:14px" onclick="submitApproval('${jsId}', '${currentRole}')">บันทึกผลการอนุมัติ</button>
     </div>
    </div>
   </div>
   `}
    <button type="button" class="btn pri" style="margin-top:12px" onclick="previewLeavePdf('${jsId}', this)">📄 ดูใบลา PDF</button>
  </section>`;
      }).join('');

      setTimeout(() => {
        list.forEach(item => initCanvas(item.id));
      }, 50);
    }

    const PDF_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const PDF_PAGE_W = 595.28;
    const PDF_PAGE_H = 420.94;
    const PDF_MARGIN_X = 34;
    const PDF_MARGIN_Y = 17;
    const PDF_SIG_H = 18;
    /* ฟอนต์เสริมสำหรับเครื่องหมาย ✓ — ฟอนต์ Sarabun ไม่มี U+2713 จึงต้องแยกฟอนต์ */
    const PDF_SYMBOL_FONT = 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssymbols2/NotoSansSymbols2-Regular.ttf';
    /* pdfmake วาดเส้นได้เฉพาะ "ตาราง" เท่านั้น (border ของ text/column ถูกละเลย) จึงต้องทำทุกช่องกรอกเป็นตาราง 1 ช่อง */
    const PDF_LINE_LAYOUT = {
      hLineWidth: i => (i === 1 ? 0.4 : 0),
      vLineWidth: () => 0,
      hLineColor: () => '#000',
      vLineColor: () => '#000',
      paddingLeft: () => 0, paddingRight: () => 0,
      paddingTop: () => 0, paddingBottom: () => 0
    };
    const PDF_BOX_LAYOUT = {
      hLineWidth: () => 0.9,
      vLineWidth: () => 0.9,
      hLineColor: () => '#000',
      vLineColor: () => '#000',
      paddingLeft: () => 7.5, paddingRight: () => 7.5,
      paddingTop: () => 0.75, paddingBottom: () => 0.75
    };

    function pdfTrim(v, n) {
      const s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
      return s.length > n ? s.slice(0, n - 1) + '…' : s;
    }

    function pdfDateParts(v) {
      const raw = String(v == null ? '' : v).trim();
      const m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (m) return { dd: m[3], mm: PDF_MONTHS[+m[2] - 1] || m[2], yy: String(+m[1] + 543) };
      const dt = new Date(raw);
      if (Number.isNaN(dt.getTime())) return { dd: '', mm: '', yy: '' };
      return { dd: String(dt.getDate()), mm: PDF_MONTHS[dt.getMonth()], yy: String(dt.getFullYear() + 543) };
    }

    function pdfText(t, extra) {
      return Object.assign({ text: t == null ? '' : t, margin: [0, 0.1, 0, 0.1] }, extra || {});
    }

    /* ช่องกรอกเส้นประ — ทำเป็นตาราง 1 ช่อง เส้นล่างอย่างเดียว (pdfmake ไม่วาด border ของ text) */
    function pdfLine(t, extra) {
      const e = extra || {};
      const w = e.width === undefined ? '*' : e.width;
      return {
        /* width ต้องใส่ทั้งข้างนอก (ให้คอลัมน์รู้ความกว้าง) และ table.widths ด้านใน (ไม่งั้นตารางจะยืดพื้นที่ที่เหลือทั้งหมด) */
        width: w,
        table: { widths: ['*'], body: [[pdfText(String(t == null ? '' : t) || ' ', { alignment: e.alignment || 'left' })]] },
        layout: PDF_LINE_LAYOUT,
        margin: [0, 0, 0, 0]
      };
    }

    /* ช่องวันที่ — ความกว้างเท่ากับหน้าดูตัวอย่างใบลา (ส่ง w มาได้ ไม่ส่งใช้ค่า default) */
    function pdfDateCells(p, w) {
      const wd = w || { dd: 26, mm: 60, yy: 33 };
      return [
        pdfLine(p.dd, { width: wd.dd, alignment: 'center' }),
        pdfText('เดือน', { width: 26, alignment: 'right' }),
        pdfLine(p.mm, { width: wd.mm, alignment: 'center' }),
        pdfText('พ.ศ.', { width: 20, alignment: 'right' }),
        pdfLine(p.yy, { width: wd.yy, alignment: 'center' })
      ];
    }

    /* เครื่องหมาย ✓ ในช่องเช็ค — ใช้ฟอนต์ Symbols (ตรงกับหน้าดูตัวอย่างใบลา) */
    function pdfCheck(on) {
      return on ? { text: '✓', font: 'Symbols', fontSize: 9 } : { text: '\u00a0\u00a0\u00a0' };
    }

    function pdfFillRow(label) {
      return { columns: [pdfText(label, { width: 'auto' }), pdfLine('', { width: '*' })], columnGap: 2, margin: [0, 0, 0, 0.4] };
    }

    function pdfNameRow(name) {
      return { columns: [pdfText('(', { width: 8 }), pdfLine(name, { width: '*', alignment: 'center' }), pdfText(')', { width: 8 })], columnGap: 2, margin: [0, 0, 0, 0.4] };
    }

    /* แถวลงชื่อ — เส้นล่างวาดด้วยตาราง รูปเซ็นวางในเซลล์เดียวกัน */
    function pdfSigLine(before, data, after) {
      const inner = data
        ? { image: data, width: 74, height: PDF_SIG_H, fit: [74, PDF_SIG_H], alignment: 'center' }
        : { text: ' ', height: PDF_SIG_H };
      return {
        columns: [
          pdfText(before, { width: 'auto' }),
          { width: '*', table: { widths: ['*'], body: [[{ stack: [inner] }]] }, layout: PDF_LINE_LAYOUT },
          pdfText(after, { width: 'auto' })
        ], columnGap: 2, margin: [0, 0, 0, 0.4]
      };
    }

    function makeLeavePdfDefinition(d) {
      d = d || {};
      const stats = Array.isArray(d.stats) ? d.stats : [];
      const submitted = pdfDateParts(d.submitted);
      const fromDate = pdfDateParts(d.fromDate);
      const toDate = pdfDateParts(d.toDate);
      const an = d.approverNames || {};
      /* ผลพิจารณา — เครื่องหมาย ✓ เหมือนหน้าดูตัวอย่างใบลา (ยังไม่อนุมัติ = ช่องว่าง) */
      const approveOn = d.mgrApproval === 'อนุมัติ' || d.headApproval === 'อนุมัติ' || d.foremanApproval === 'อนุมัติ';
      const rejectOn = !approveOn && (d.mgrApproval === 'ไม่อนุมัติ' || d.headApproval === 'ไม่อนุมัติ' || d.foremanApproval === 'ไม่อนุมัติ');
      /* ชื่อผู้ลา = คำนำหน้า + ชื่อ-นามสกุล ในช่องเดียวกัน ตรงกับหน้าดูตัวอย่าง */
      const full = (((d.prefix || '') + ' ' + (d.name || '')).replace(/\s+/g, ' ')).trim();
      const qty = String(d.qty == null ? '' : d.qty).trim();
      const unit = qty ? String(d.unit == null ? '' : d.unit).trim() : 'วัน / ชั่วโมง / นาที';

      const statLabels = ['ลากิจ', 'ลาพักร้อน', 'ลาป่วยมีใบรับรองแพทย์', 'ลาคลอด', 'ลาป่วยไม่มีใบรับรองแพทย์', 'ลาทำหมัน', 'ขาดงาน', 'ลืมบัตร / ลืมรูดบัตร', 'มาสาย / กลับก่อน', 'อุบัติเหตุ / เจ็บป่วยในงาน'];
      const statBody = [];
      for (let i = 0; i < statLabels.length; i += 2) {
        statBody.push([
          pdfText(statLabels[i], { lineHeight: 1.1 }),
          pdfText(pdfTrim(stats[i], 12), { alignment: 'center', lineHeight: 1.1 }),
          pdfText(statLabels[i + 1], { lineHeight: 1.1 }),
          pdfText(pdfTrim(stats[i + 1], 12), { alignment: 'center', lineHeight: 1.1 })
        ]);
      }

      return {
        pageSize: { width: PDF_PAGE_W, height: PDF_PAGE_H },
        pageMargins: [PDF_MARGIN_X, PDF_MARGIN_Y, PDF_MARGIN_X, PDF_MARGIN_Y],
        defaultStyle: { font: 'Sarabun', fontSize: 9, lineHeight: 1.1, color: '#000' },
        content: [
          /* หัวกระดาษ — ช่องซ้าย/ขวาชิดสองขอบแบบ .top ของหน้าดูตัวอย่างใบลา */
          /* หัวกระดาษ — ช่องซ้าย/ขวาเป็นตารางมีกรอบ ชิดสองขอบแบบ .top ของหน้าดูตัวอย่างใบลา */
          {
            columns: [
              { width: 96, table: { widths: [96], body: [[pdfText('แผนกบุคคลธุรการ', { bold: true, fontSize: 9 })]] }, layout: PDF_BOX_LAYOUT },
              { width: '*', text: '', margin: 0 },
              { width: 40, table: { widths: [40], body: [[pdfText('CM 2', { bold: true, fontSize: 9, alignment: 'center' })]] }, layout: PDF_BOX_LAYOUT }
            ], columnGap: 0, margin: [0, 0, 0, 0.1]
          },

          pdfText('ใบลา', { fontSize: 14.4, bold: true, alignment: 'center', lineHeight: 1.0, margin: [0, 0, 0, 1] }),

          {
            columns: [
              pdfText([{ text: 'เรื่อง  ', bold: true }, { text: 'ขอลาหยุดงาน' }], { width: '*' }),
              pdfText('วันที่', { width: 34, alignment: 'right' })
            ].concat(pdfDateCells(submitted, { dd: 34, mm: 68, yy: 41 })), columnGap: 2, margin: [0, 0, 0, 0.1]
          },

          pdfText(['(', pdfCheck(d.employeeType === 'รายเดือน'), ') รายเดือน', '\u00a0'.repeat(13),
            '(', pdfCheck(d.employeeType === 'รายวัน'), ') รายวัน', '\u00a0'.repeat(13),
            '(', pdfCheck(d.employeeType === 'ต่างด้าว'), ') ต่างด้าว'],
            { alignment: 'center', fontSize: 9, margin: [0.5, 0, 0.5, 0] }),

          {
            columns: [
              pdfText('เรียน', { width: 34, bold: true }),
              pdfLine(pdfTrim(d.to, 30), { width: '*' })
            ], columnGap: 2, margin: [0, 0, 0, 0.1]
          },

          {
            columns: [
              pdfText('', { width: 24 }),
              pdfText('ข้าพเจ้า', { width: 46, bold: true }),
              pdfLine(pdfTrim(full, 36), { width: '*' }),
              pdfText('รหัส', { width: 26 }),
              pdfLine(pdfTrim(d.code, 10), { width: 60 }),
              pdfText('แผนก', { width: 26 }),
              pdfLine(pdfTrim(d.dept, 16), { width: '18%' })
            ], columnGap: 2, margin: [0, 0, 0, 0.1]
          },

          {
            columns: [
              pdfText('มีความประสงค์ขอลา', { width: 96 }),
              pdfLine(pdfTrim(d.leaveType, 20), { width: '*' }),
              pdfText('เนื่องจาก', { width: 52 }),
              pdfLine(pdfTrim(d.reason, 42), { width: '47%' })
            ], columnGap: 2, margin: [0, 0, 0, 0.1]
          },

          {
            columns: [pdfText('จึงขอลาตั้งแต่วันที่', { width: 96 })]
              .concat(pdfDateCells(fromDate, { dd: 26, mm: 60, yy: 33 }))
              .concat([pdfText('ถึงวันที่', { width: 46 })])
              .concat(pdfDateCells(toDate, { dd: 26, mm: 60, yy: 33 })), columnGap: 2, margin: [0, 0, 0, 0.1]
          },

          {
            columns: [
              pdfText('รวม', { width: 26 }),
              pdfLine(pdfTrim(qty, 8), { width: 45, alignment: 'center' }),
              pdfText(unit, { width: 'auto' }),
              pdfText('( ตั้งแต่เวลา', { width: 'auto' }),
              pdfLine(pdfTrim(d.fromTime, 8), { width: 41, alignment: 'center' }),
              pdfText('น. ถึงเวลา', { width: 44 }),
              pdfLine(pdfTrim(d.toTime, 8), { width: 41, alignment: 'center' }),
              pdfText('น. )', { width: 24 })
            ], columnGap: 2, margin: [0, 0, 0, 0.1]
          },

          pdfText('ก่อนการลาครั้งนี้ มีสถิติการลาดังนี้', { bold: true, margin: [1.5, 0, 0, 0] }),

          {
            unbreakable: true, margin: [0.5, 0, 1, 0], fontSize: 8.6, lineHeight: 1.1,
            table: {
              widths: ['32%', '18%', '32%', '18%'],
              body: [[
                pdfText('ประเภทการลา', { bold: true, alignment: 'center', fontSize: 7.4, lineHeight: 1.1 }),
                pdfText('จำนวนวัน : ชั่วโมง : นาที', { bold: true, alignment: 'center', fontSize: 7.4, lineHeight: 1.1 }),
                pdfText('ประเภทการลา', { bold: true, alignment: 'center', fontSize: 7.4, lineHeight: 1.1 }),
                pdfText('จำนวนวัน : ชั่วโมง : นาที', { bold: true, alignment: 'center', fontSize: 7.4, lineHeight: 1.1 })
              ]].concat(statBody)
            },
            layout: {
              hLineWidth: () => 0.4, vLineWidth: () => 0.4,
              hLineColor: () => '#000', vLineColor: () => '#000',
              paddingTop: () => 0.2, paddingBottom: () => 0.2, paddingLeft: () => 4.5, paddingRight: () => 4.5
            }
          },

          /* เว้นบรรทัดแรก 2.5em เท่ากับ text-indent ของหน้าดูตัวอย่างใบลา */
          pdfText('\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0' + 'ข้าพเจ้าขอรับรองว่าข้อความข้างต้นนี้เป็นความจริง หากเป็นเท็จข้าพเจ้ายินดีให้บริษัท พิจารณาโทษตามระเบียบบริษัท', { margin: [1, 1, 0, 1] }),

          {
            columns: [{
              width: '48%', stack: [
                pdfText('จึงเรียนมาเพื่อทราบและโปรดพิจารณา', { alignment: 'center', margin: [0.5, 0, 1, 2] })
              ]
            }]
          },

          {
            unbreakable: true, columnGap: 20, columns: [
              {
                width: '*', stack: [
                  pdfSigLine('ลงชื่อ', d.sigApplicant || d.sigApp, 'ผู้ลา'),
                  pdfFillRow('แผนกบุคคลฯรับเอกสารวันที่'),
                  pdfFillRow('ลงชื่อ'),
                  pdfNameRow(''),
                  pdfText('แผนกบุคคลธุรการ', { alignment: 'center', bold: true, fontSize: 8.6 })
                ]
              },
              {
                width: '*', stack: [
                  pdfText(['(', pdfCheck(approveOn), ') อนุมัติ\u00a0\u00a0\u00a0\u00a0', '(', pdfCheck(rejectOn), ') ไม่อนุมัติ'], { alignment: 'center', margin: [0, 0, 0, 1] }),
                  pdfSigLine('ลงชื่อ', d.sigForeman, 'หัวหน้างาน'),
                  pdfSigLine('ลงชื่อ', d.sigHead, 'หัวหน้าแผนก'),
                  pdfSigLine('ลงชื่อ', d.sigManager || d.sigMgr, ''),
                  pdfNameRow(pdfTrim(an.mgr || d.approverName || '', 30)),
                  pdfText('ผู้ช่วย/รอง/ผู้จัดการฝ่าย/ผู้จัดการทั่วไป', { alignment: 'center', bold: true, fontSize: 8.6 })
                ]
              }
            ]
          }
        ]
      };
    }

    function pdfFileName_(d) {
      const id = String((d && d.id) || 'leave').replace(/[^\w\u0E00-\u0E7F-]/g, '_');
      return 'ใบลา-' + id + '.pdf';
    }
    function previewLeavePdf(id, button) {
      if (!requireLogin_()) return;
      if (button && button.disabled) return;
      const label = button ? button.textContent : '';
      if (button) { button.disabled = true; button.textContent = 'กำลังสร้าง PDF (pdfMake)...'; }

      buildLeavePdf_(id).then(res => {
        if (button) { button.disabled = false; button.textContent = label; }
        showPdfModal_(res.blob, res.name, res.doc);
      }).catch(err => {
        if (button) { button.disabled = false; button.textContent = label; }
        alertMsg('เกิดข้อผิดพลาดในการสร้าง PDF', String((err && err.message) || err));
      });
    }

    /* แสดง PDF ใน modal พร้อมดาวน์โหลด/เปิดแท็บใหม่
       หมายเหตุ: หน้านี้ถูกรันใน iframe แบบ sandbox ของ Apps Script ซึ่งเบราว์เซอร์จะไม่แสดง PDF
       ผ่าน native viewer (iframe/embed ขึ้นกล่องว่างเปล่า) จึงเรนเดอร์ PDF ลง <canvas> ด้วย PDF.js */
    function showPdfModal_(blob, name, doc) {
      const url = URL.createObjectURL(blob);
      keepPdfUrl(url);
      const fileName = name || 'ใบลา.pdf';
      const downloadPdf = () => {
        const a = document.createElement('a'); a.href = url; a.download = fileName;
        document.body.appendChild(a); a.click(); a.remove();
      };
      if (!swalReady()) { downloadPdf(); return; }

      Swal.fire({
        title: '📄 ตัวอย่างใบลา (PDF)',
        html: '<div id="pdfViewer"><p class="pdf-note">⏳ กำลังเปิดไฟล์ PDF...</p></div>',
        width: 'min(1000px,96vw)', padding: '10px', customClass: { popup: 'swal-pdf-popup', htmlContainer: 'swal-pdf-box' },
        showConfirmButton: true, confirmButtonText: '⬇️ ดาวน์โหลด', confirmButtonColor: '#1f5fbf',
        showDenyButton: true, denyButtonText: '🔗 เปิดแท็บใหม่',
        showCancelButton: true, cancelButtonText: 'ปิด', reverseButtons: true,
        didOpen: () => renderPdfInto_(document.getElementById('pdfViewer'), blob, url)
      }).then(r => {
        if (r && r.isConfirmed) downloadPdf();
        else if (r && r.isDenied) {
          const win = window.open(url, '_blank');
          if (!win) alertMsg('เปิดแท็บใหม่ไม่ได้', 'เบราว์เซอร์บล็อก pop-up — กด "ดาวน์โหลด" แล้วเปิดไฟล์แทน', 'warning');
        }
      });
    }

    /* เรนเดอร์ PDF ลง canvas ด้วย PDF.js (ถ้าใช้ไม่ได้ค่อย fallback เป็น iframe) */
    function renderPdfInto_(host, blob, url) {
      if (!host) return;
      host.innerHTML = '<p class="pdf-note">⏳ กำลังเปิดไฟล์ PDF...</p>';
      loadPdfJs_()
        .then(lib => ensurePdfWorker_(lib).then(() => lib))
        .then(lib => blob.arrayBuffer().then(buf => lib.getDocument({ data: buf }).promise))
        .then(pdf => {
          host.innerHTML = '';
          let chain = Promise.resolve();
          for (let i = 1; i <= pdf.numPages; i++) {
            chain = chain.then(() => pdf.getPage(i)).then(page => {
              const base = page.getViewport({ scale: 1 });
              const avail = host.clientWidth || 720;
              const dpr = Math.min(window.devicePixelRatio || 1, 2);
              const viewport = page.getViewport({ scale: (avail / base.width) * dpr });
              const canvas = document.createElement('canvas');
              canvas.width = Math.floor(viewport.width);
              canvas.height = Math.floor(viewport.height);
              host.appendChild(canvas);
              return page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
            });
          }
          return chain;
        })
        .catch(() => {
          // Fallback: ใช้ native viewer (ใช้ได้เฉพาะ browser ที่ไม่ sandbox) + ปุ่มดาวน์โหลดด้านล่าง
          host.innerHTML = '<iframe src="' + url + '"></iframe>' +
            '<p class="pdf-note">ถ้ากล่องด้านบนว่างเปล่า กด “⬇️ ดาวน์โหลด” แล้วเปิดไฟล์ หรือกด “🔗 เปิดแท็บใหม่”</p>';
        });
    }

    let pdfJsPromise_ = null;
    function loadPdfJs_() {
      if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
      if (!pdfJsPromise_) {
        pdfJsPromise_ = new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
          s.onload = () => {
            const lib = window.pdfjsLib;
            if (!lib) { reject(new Error('ไม่พบไลบรารี PDF.js')); return; }
            resolve(lib);
          };
          s.onerror = () => { pdfJsPromise_ = null; reject(new Error('โหลดไลบรารี PDF.js ไม่สำเร็จ')); };
          document.head.appendChild(s);
        });
      }
      return pdfJsPromise_;
    }

    /* Worker ของ PDF.js ต้องเป็น same-origin — โหลดสคริปต์มาทำเป็น Blob URL กันถูกบล็อก */
    function ensurePdfWorker_(lib) {
      if (lib.__workerReady__) return Promise.resolve();
      lib.__workerReady__ = true;
      const remote = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
      return fetch(remote)
        .then(r => { if (!r.ok) throw new Error('โหลด PDF worker ไม่สำเร็จ'); return r.text(); })
        .then(text => { lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([text], { type: 'application/javascript' })); })
        .catch(() => { lib.GlobalWorkerOptions.workerSrc = remote; });
    }

    /* เก็บ URL ของ blob ไว้ยกเลิกตอนปิดหน้า ไม่ให้รั่วในหน่วยความจำ */
    const pdfUrls_ = [];
    function keepPdfUrl(url) { pdfUrls_.push(url); if (pdfUrls_.length > 5) URL.revokeObjectURL(pdfUrls_.shift()); }
    window.addEventListener('beforeunload', () => { while (pdfUrls_.length) URL.revokeObjectURL(pdfUrls_.pop()); });

    function buildLeavePdf_(id, timeoutMs) {
      return new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => finish(reject, new Error('สร้าง PDF ไม่ทันเวลา (60 วินาที) กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่')), timeoutMs || 60000);
        function finish(fn, arg) { if (settled) return; settled = true; clearTimeout(timer); fn(arg); }
        try {
          if (typeof google === 'undefined' || !google.script || !google.script.run) {
            const item = (typeof allLeaves !== 'undefined' && Array.isArray(allLeaves)) ? (allLeaves.find(x => x.id === id) || {}) : {};
            const testData = Object.assign({
              id: id, submitted: new Date(), employeeType: 'รายเดือน', name: item.name || 'ทดสอบ', code: item.code || '001', dept: item.dept || 'บุคคลธุรการ', leaveType: item.type || 'ลากิจ', reason: item.why || 'ทดสอบระบบ', fromDate: item.d1 || '2026-10-01', toDate: item.d2 || '2026-10-02', qty: item.qty || '2', unit: item.unit || 'วัน', stats: item.stats || ['1', '', '2', '', '', '', '', '', '', ''], sigApplicant: item.sigApp || '', sigHead: item.sigHead || '', sigManager: item.sigMgr || ''
            }, item);
            loadPdfMake_().then(lib => {
              const doc = lib.createPdf(makeLeavePdfDefinition(testData));
              return doc.getBlob().then(blob => finish(resolve, { blob: blob, name: pdfFileName_(testData), doc: doc }));
            }).catch(e => finish(reject, e));
            return;
          }

          google.script.run.withSuccessHandler(d => {
            loadPdfMake_().then(lib => {
              const doc = lib.createPdf(makeLeavePdfDefinition(d));
              if (!doc || typeof doc.getBlob !== 'function') { finish(reject, new Error('ไลบรารี pdfmake ไม่รองรับการแสดงตัวอย่าง')); return }
              return doc.getBlob().then(blob => finish(resolve, { blob: blob, name: pdfFileName_(d), doc: doc }));
            }).catch(e => finish(reject, (e && e.message) ? new Error(e.message) : e));
          }).withFailureHandler(err => finish(reject, new Error((err && err.message) || err)))
            .getApprovedLeavePdfData(id, currentUser ? currentUser.code : '', currentUser ? currentUser.filterDept || '' : '', currentUser ? currentUser.role || 'head' : 'head');
        } catch (e) { finish(reject, (e && e.message) ? new Error(e.message) : e) }
      });
    }

    function loadPdfMake_() {
      if (pdfMakeLib_) return Promise.resolve(pdfMakeLib_);
      if (!pdfMakeLoadPromise) {
        pdfMakeLoadPromise = new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/pdfmake@0.3.11/build/pdfmake.min.js';
          script.onload = () => {
            const lib = window.pdfMake;
            if (!lib) { reject(new Error('ไม่พบไลบรารี pdfmake')); return }
            try {
              lib.fonts = {
                Sarabun: {
                  normal: 'https://raw.githubusercontent.com/google/fonts/main/ofl/sarabun/Sarabun-Regular.ttf',
                  bold: 'https://raw.githubusercontent.com/google/fonts/main/ofl/sarabun/Sarabun-Bold.ttf',
                  italics: 'https://raw.githubusercontent.com/google/fonts/main/ofl/sarabun/Sarabun-Italic.ttf',
                  bolditalics: 'https://raw.githubusercontent.com/google/fonts/main/ofl/sarabun/Sarabun-BoldItalic.ttf'
                },
                Symbols: {
                  normal: PDF_SYMBOL_FONT,
                  bold: PDF_SYMBOL_FONT,
                  italics: PDF_SYMBOL_FONT,
                  bolditalics: PDF_SYMBOL_FONT
                },
                Roboto: {
                  normal: 'Roboto-Regular.ttf',
                  bold: 'Roboto-Medium.ttf',
                  italics: 'Roboto-Italic.ttf',
                  bolditalics: 'Roboto-MediumItalic.ttf'
                }
              };
              pdfMakeLib_ = lib;
              resolve(lib);
            } catch (e) { reject(new Error((e && e.message) || e)) }
          };
          script.onerror = () => { pdfMakeLoadPromise = null; reject(new Error('โหลดไลบรารี pdfmake ไม่สำเร็จ')) };
          document.head.appendChild(script);
        });
      }
      return pdfMakeLoadPromise;
    }

    /** บทบาทที่ผู้ใช้คนนี้อนุมัติได้ */
    function roles_() {
      if (!currentUser) return [];
      if (currentUser.filterDept) return [currentUser.role || 'foreman'];
      return ROLE_ORDER.filter(k =>
        (k === 'foreman' && currentUser.isForeman) ||
        (k === 'head' && currentUser.isHead) ||
        (k === 'mgr' && currentUser.isMgr)
      );
    }

    function canRole(k) { return roles_().indexOf(k) !== -1 }

    function pickDefaultRole_(item) {
      const roles = roles_();
      if (!roles.length) return 'head';
      const keep = cardRole[item.id];
      if (keep && roles.indexOf(keep) !== -1) return keep;
      return roles.find(k => !item[k + 'Approval']) || roles[roles.length - 1];
    }

    function pickRole(id, role) {
      if (!canRole(role)) { alertMsg('ไม่มีสิทธิ์', 'บทบาทนี้ไม่ตรงกับที่คุณเข้าสู่ระบบ', 'error'); return }
      cardRole[id] = role;
      clearSig(id);
      renderLeaves();
    }


    function initCanvas(id) {
      const cv = $(`canvas-${id}`);
      if (!cv) return;
      const cx = cv.getContext('2d');
      let on = false;
      const r = cv.getBoundingClientRect(), q = window.devicePixelRatio || 1;
      cv.width = r.width * q;
      cv.height = r.height * q;
      cx.setTransform(q, 0, 0, q, 0, 0);
      cx.lineWidth = 2.2; cx.lineCap = 'round'; cx.lineJoin = 'round'; cx.strokeStyle = '#111';

      const p = { signed: false };
      const pt = e => { const rect = cv.getBoundingClientRect(); return [e.clientX - rect.left, e.clientY - rect.top]; };
      cv.addEventListener('pointerdown', e => { on = true; cv.setPointerCapture(e.pointerId); const [x, y] = pt(e); cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x + .1, y); cx.stroke(); p.signed = true; });
      cv.addEventListener('pointermove', e => { if (!on) return; const [x, y] = pt(e); cx.lineTo(x, y); cx.stroke(); });
      ['pointerup', 'pointercancel'].forEach(t => cv.addEventListener(t, () => on = false));

      pads[id] = { cv, cx, p, data: () => cv.toDataURL('image/png') };
    }

    function clearSig(id) {
      if (pads[id]) {
        const { cv, cx, p } = pads[id];
        cx.save(); cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, cv.width, cv.height); cx.restore();
        p.signed = false;
      }
    }

    function submitApproval(id, role) {
      if (!requireLogin_()) return;
      if (!canRole(role)) { alertMsg('ไม่มีสิทธิ์', 'คุณไม่มีสิทธิ์อนุมัติในฐานะ' + ROLE_META[role].label, 'error'); return }

      const chosen = document.querySelector(`input[name="app-${id}-${role}"]:checked`);
      if (!chosen) {
        alertMsg('ยังไม่ได้เลือกผลการพิจารณา', 'กรุณาเลือก "อนุมัติ" หรือ "ไม่อนุมัติ" ก่อนบันทึก', 'warning');
        return;
      }

      const statusVal = chosen.value;
      const sigData = (pads[id] && pads[id].p.signed) ? pads[id].data() : '';

      setBusyCard(id, true);
      const payload = {
        id: id,
        approverCode: currentUser.code,
        role: role,
        dept: currentUser.filterDept || '',
        approvalStatus: statusVal,
        sigData: sigData
      };

      if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run
          .withSuccessHandler(res => {
            setBusyCard(id, false);
            if (res && res.ok) {
              okMsg('บันทึกผลการอนุมัติเรียบร้อยแล้ว', 'สถานะปัจจุบัน: ' + (res.status || '-'));
              loadLeaves();
            } else {
              alertMsg('บันทึกผลการอนุมัติไม่สำเร็จ', (res && res.message) || 'เกิดข้อผิดพลาด');
            }
          })
          .withFailureHandler(err => {
            setBusyCard(id, false);
            alertMsg('เกิดข้อผิดพลาด', (err && err.message) || err);
          })
          .updateLeaveApproval(payload);
      } else {
        setBusyCard(id, false);
        okMsg('บันทึกผลการอนุมัติสำเร็จ (จำลอง)', 'ยังไม่ได้เชื่อมต่อ Apps Script');
        const item = allLeaves.find(x => x.id === id);
        if (item) {
          item[role + 'Approval'] = statusVal;
          renderLeaves();
        }
      }
    }

    function setBusyCard(id, b) {
      const btn = document.querySelector(`#card-${id} button.pri`);
      if (btn) { btn.disabled = b; btn.textContent = b ? 'กำลังบันทึก...' : 'บันทึกผลการอนุมัติ'; }
    }

    loadDepts();
    /* หน้า login = SweetAlert popup เท่านั้น → เด้งทันทีที่เปิดหน้า */
    showLoginScreen_();
