/* ──────────────── CONFIG ──────────────── */
        const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzeKGBmX3uQh_4Q1xO_Y7udZGj6tbfipoCjxrytst43QK-dAb3hNKKHloVUbCfyR5fn/exec';
        const VALID_PASSWORD = '654321';
        const GOOGLE_DRIVE_FOLDER_ID = '10ycPVa0Z5M7T-Lrg7HDN63hijhtOth7r';
        const DEFAULT_AVATAR = 'https://ui-avatars.com/api/?name=Inbox&background=00b900&color=fff&size=80&bold=true';

        /* ──────────────── DOM REFS ──────────────── */
        const chatMessages = document.getElementById('chatMessages');
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const aiModeBtn = document.getElementById('aiModeBtn');
        const modelSelect = document.getElementById('modelSelect');
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        const toast = document.getElementById('toast');

        let aiMode = false;
        let isAuthenticated = false;
        let currentUser = null;
        let threadImageBase64 = null;
        let threadImageFile = null;
        let isSleeping = false;
        try { isSleeping = localStorage.getItem('lineBotSleep') === 'true'; } catch(_) {}

        /* ──────────────── SWEETALERT LOGIN (เทาะ สะอาด ไม่โชว์รหัส) ──────────────── */
        async function showLogin() {
            const { value: password } = await Swal.fire({
                title: 'เข้าสู่ระบบ',
                html: `
                    <div style="padding:6px 0 0;">
                        <div class="password-wrapper" style="max-width:280px;margin:0 auto;">
                            <input id="swal-password" class="swal2-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="รหัสผ่าน (ตัวเลข 6 หลัก)" autocomplete="current-password" autofocus
                                style="margin:0;width:100%;text-align:center;font-size:16px;letter-spacing:6px;padding:12px 44px 12px 16px !important;">
                            <button type="button" class="toggle-password" id="togglePasswordBtn" tabindex="-1" aria-label="แสดง/ซ่อนรหัสผ่าน">
                                <i class="fas fa-eye" id="passwordToggleIcon"></i>
                            </button>
                        </div>
                        <div style="font-size:11px;color:#aaa;margin-top:8px;">กรอกได้เฉพาะตัวเลข 6 หลัก • กด Enter เพื่อเข้าสู่ระบบ</div>
                    </div>
                `,
                didOpen: () => {
                    const inp = document.getElementById('swal-password');
                    if (inp) {
                        inp.addEventListener('input', () => { inp.value = inp.value.replace(/[^0-9]/g,'').slice(0,6); });
                        inp.addEventListener('keypress', (e) => { if (e.key === 'Enter') Swal.clickConfirm(); });
                        // บังคับเปิดแป้นตัวเลขบนมือถือ
                        inp.focus();
                    }
                },
                confirmButtonText: 'เข้าสู่ระบบ',
                cancelButtonText: 'ยกเลิก',
                showCancelButton: true,
                focusConfirm: false,
                customClass: { popup: 'login-popup' },
                width: '360px',
                padding: '20px',
                preConfirm: () => {
                    const el = document.getElementById('swal-password');
                    const pwd = (el ? el.value : '').trim();
                    if (!pwd) {
                        Swal.showValidationMessage('กรุณากรอกรหัสผ่าน');
                        return false;
                    }
                    if (!/^[0-9]+$/.test(pwd)) {
                        Swal.showValidationMessage('รหัสผ่านต้องเป็นตัวเลขเท่านั้น');
                        return false;
                    }
                    if (pwd.length !== 6) {
                        Swal.showValidationMessage('กรุณากรอกรหัสผ่าน 6 หลัก');
                        return false;
                    }
                    return pwd;
                }
            });

            if (password) {
                await handleLogin(password);
            } else {
                await Swal.fire({
                    icon: 'info',
                    title: 'กรุณาเข้าสู่ระบบ',
                    text: 'คุณต้องกรอกรหัสผ่านเพื่อใช้งาน LINE BOT MCP',
                    confirmButtonText: 'ตกลง'
                });
                showLogin();
            }
        }

        window.togglePasswordVisibility = function() {
            const input = document.getElementById('swal-password');
            const icon = document.getElementById('passwordToggleIcon');
            if (input.type === 'password') {
                input.type = 'text';
                icon.className = 'fas fa-eye-slash';
            } else {
                input.type = 'password';
                icon.className = 'fas fa-eye';
            }
        };

        async function handleLogin(password) {
            if (password === VALID_PASSWORD) {
                isAuthenticated = true;
                currentUser = 'admin';
                await Swal.fire({
                    icon: 'success',
                    title: '🎉 เข้าสู่ระบบสำเร็จ!',
                    text: 'ยินดีต้อนรับ',
                    timer: 1500,
                    showConfirmButton: false
                });
                initializeApp();
                return;
            }

            try {
                const response = await fetch(GAS_WEB_APP_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ action: 'login', payload: { password } })
                });
                const data = await response.json();
                if (data.success) {
                    isAuthenticated = true;
                    currentUser = data.user || 'user';
                    await Swal.fire({
                        icon: 'success',
                        title: '🎉 เข้าสู่ระบบสำเร็จ!',
                        text: `ยินดีต้อนรับ ${currentUser}`,
                        timer: 1500,
                        showConfirmButton: false
                    });
                    initializeApp();
                    return;
                }
            } catch (error) {}

            await Swal.fire({
                icon: 'error',
                title: '❌ รหัสผ่านไม่ถูกต้อง',
                text: 'กรุณากรอกรหัสผ่านให้ถูกต้อง (ต้องเป็นตัวเลข 6 หลัก)',
                confirmButtonText: 'ลองใหม่'
            });
            showLogin();
        }

        /* ──────────────── SLEEP MODE (โหมดหลับ - พักการแจ้งเตือน) ──────────────── */
        function applySleepUI() {
            const btn = document.getElementById('sleepBtn');
            const app = document.getElementById('appContainer');
            if (btn) {
                btn.classList.toggle('active-sleep', isSleeping);
                btn.innerHTML = isSleeping ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
                btn.title = isSleeping ? 'โหมดหลับอยู่ - คลิกเพื่อตื่น' : 'โหมดหลับ - พักการแจ้งเตือน';
            }
            if (app) app.classList.toggle('sleeping', isSleeping);
            try { localStorage.setItem('lineBotSleep', isSleeping ? 'true' : 'false'); } catch(_){}
        }
        function toggleSleep() {
            isSleeping = !isSleeping;
            applySleepUI();
            if (isSleeping) {
                showToast('💤 เข้าสู่โหมดหลับ - พักเสียงและการแจ้งเตือน', 'info');
                addSystemMessage('💤 <strong>โหมดหลับ</strong> — พักการแจ้งเตือนและเสียงไว้ชั่วคราว');
            } else {
                showToast('☀️ ตื่นแล้ว - กลับมาแจ้งเตือนปกติ', 'success');
                addSystemMessage('☀️ <strong>ตื่นแล้ว</strong> — กลับมาแจ้งเตือนปกติ');
                pollGlobalInbox();
            }
        }
        // เรียกตอนโหลดเพื่อซิงค์สถานะ
        setTimeout(applySleepUI, 100);

        /* ──────────────── HELPERS ──────────────── */
        function getTimestamp() {
            return new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        }

        function escapeHtml(str) {
            const d = document.createElement('div');
            d.textContent = str || '';
            return d.innerHTML;
        }

        function escapeAttr(str) {
            return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function showToast(msg, type = 'info') {
            toast.textContent = msg;
            toast.className = 'toast';
            if (type === 'error') toast.classList.add('error');
            else if (type === 'success') toast.classList.add('success');
            toast.classList.add('show');
            clearTimeout(toast._hide);
            toast._hide = setTimeout(() => toast.classList.remove('show'), 2800);
        }

        function lineStatusLabel(data) {
            return data.lineSent ? '📲 ส่งเข้า LINE แล้ว' : `⚠️ ไม่ได้ส่งเข้า LINE${data.lineError ? ' (' + data.lineError + ')' : ''}`;
        }

        function fileToBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }

        function dataURLtoFile(dataurl, filename) {
            const arr = dataurl.split(',');
            const mime = arr[0].match(/:(.*?);/)[1];
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            return new File([u8arr], filename, { type: mime });
        }

        /* ──────────────── CHAT UI ──────────────── */
        function addMessage(text, type = 'received', meta = '', imageUrl = null) {
            const div = document.createElement('div');
            div.className = `msg ${type}`;
            let imageHtml = '';
            if (imageUrl) {
                imageHtml = `<img src="${escapeAttr(imageUrl)}" class="msg-image clickable-image" data-url="${escapeAttr(imageUrl)}" />`;
            }
            div.innerHTML = `
                <div class="msg-bubble">
                    ${text}
                    ${imageHtml}
                    ${meta ? `<div class="meta">${meta}</div>` : ''}
                    <div class="timestamp">${getTimestamp()}</div>
                </div>
            `;
            chatMessages.appendChild(div);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            return div;
        }

        function addSystemMessage(text) {
            const div = document.createElement('div');
            div.className = 'msg system';
            div.innerHTML = `<div class="msg-bubble">${text}</div>`;
            chatMessages.appendChild(div);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        function addTyping() {
            const div = document.createElement('div');
            div.className = 'msg received';
            div.id = 'typingIndicator';
            div.innerHTML = `
                <div class="typing-indicator">
                    <span style="color:#999;font-size:12px;">กำลังพิมพ์</span>
                    <div class="typing-dots"><span></span><span></span><span></span></div>
                </div>
            `;
            chatMessages.appendChild(div);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        function removeTyping() {
            const el = document.getElementById('typingIndicator');
            if (el) el.remove();
        }

        function clearChat() {
            chatMessages.innerHTML = `
                <div class="msg received">
                    <div class="msg-bubble">
                        👋 สวัสดี! ระบบพร้อมใช้งานแล้ว<br>
                        <span style="color: #999; font-size: 12px;">พิมพ์ข้อความเพื่อส่ง หรือใช้เครื่องมือด้านล่าง</span>
                    </div>
                </div>
            `;
            showToast('🗑️ ล้างแชทแล้ว', 'success');
        }

        /* ──────────────── IMAGE COMPRESS (ลดขนาดไฟล์ก่อนอัปโหลด) ──────────────── */
        /**
         * บีบอัดรูปด้วย canvas ให้ขนาดไม่ใหญ่เกินไปสำหรับ LINE/Drive
         * - ย่อด้านยาวสุดไม่เกิน maxSize (default 1280px)
         * - แปลงเป็น JPEG quality 0.72 เพื่อลดไฟล์ (ถ้าต้นทางเป็น PNG โปร่งใสจะได้ JPEG พื้นขาว)
         * - ถ้ารูปเล็กอยู่แล้ว (< 400KB) จะคืนไฟล์เดิมเพื่อรักษาคุณภาพ
         */
        async function compressImageFile(file, maxSize = 1280, quality = 0.72) {
            if (!file.type.startsWith('image/')) return file;
            // ไฟล์เล็กอยู่แล้ว ไม่ต้องบีบอัด
            if (file.size < 400 * 1024) return file;
            // gif ไม่บีบอัด (จะเสีย animation)
            if (file.type === 'image/gif') return file;
            try {
                const dataUrl = await new Promise((res, rej) => {
                    const r = new FileReader();
                    r.onload = () => res(r.result);
                    r.onerror = rej;
                    r.readAsDataURL(file);
                });
                const img = await new Promise((res, rej) => {
                    const i = new Image();
                    i.onload = () => res(i);
                    i.onerror = rej;
                    i.src = dataUrl;
                });
                let { width, height } = img;
                // คำนวณขนาดใหม่ให้ด้านยาวสุด = maxSize
                if (width > maxSize || height > maxSize) {
                    const ratio = Math.min(maxSize / width, maxSize / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                } else {
                    // ถึงขนาดไม่เกินแต่ไฟล์ใหญ่ อาจลด quality อย่างเดียว
                    // ถ้าไม่ย่อขนาดและไฟล์ < 900KB ให้คืนไฟล์เดิม
                    if (file.size < 900 * 1024) return file;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                // พื้นหลังขาวสำหรับกรณี PNG โปร่งใส -> JPEG
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                // เลือก mime: ถ้าต้นทางเป็น png แต่มีโปร่งใส เราก็แปลงเป็น jpeg เพื่อลดขนาด
                const outMime = 'image/jpeg';
                const outDataUrl = canvas.toDataURL(outMime, quality);
                const compressed = dataURLtoFile(outDataUrl, (file.name.replace(/\.[^.]+$/, '') || 'image') + '.jpg');
                console.log(`🗜️ compress: ${(file.size/1024).toFixed(0)}KB -> ${(compressed.size/1024).toFixed(0)}KB (${width}x${height} q=${quality})`);
                // ถ้าบีบอัดแล้วใหญ่กว่าเดิม ให้ใช้ไฟล์เดิม
                return compressed.size < file.size ? compressed : file;
            } catch (e) {
                console.warn('compress failed, use original', e);
                return file;
            }
        }

        /* ──────────────── IMAGE UPLOAD TO GOOGLE DRIVE ──────────────── */
        async function uploadImageToDrive(file) {
            try {
                // บีบอัดก่อนอัปโหลดเพื่อลดขนาดไฟล์ (ไฟล์ไม่ต้องใหญ่มาก)
                const compressed = await compressImageFile(file, 1280, 0.72);
                const base64 = await fileToBase64(compressed);
                const data = await callGas('uploadToDrive', {
                    folderId: GOOGLE_DRIVE_FOLDER_ID,
                    image: base64,
                    filename: compressed.name || file.name || 'image.jpg',
                    mimeType: compressed.type || 'image/jpeg'
                });
                return data;
            } catch (error) {
                console.error('Upload error:', error);
                throw error;
            }
        }

        /* ──────────────── IMAGE UPLOAD (Main Chat) ──────────────── */
        function openImageUpload() {
            document.getElementById('imageInput').click();
        }

        async function handleImageUpload(event) {
            const origFile = event.target.files[0];
            if (!origFile) return;

            if (!origFile.type.startsWith('image/')) {
                showToast('⚠️ กรุณาเลือกไฟล์รูปภาพเท่านั้น', 'error');
                event.target.value = '';
                return;
            }
            // บีบอัดก่อนพรีวิว เพื่อให้เห็นขนาดจริงที่จะส่ง
            const file = await compressImageFile(origFile, 1280, 0.72);
            if (file.size > 5 * 1024 * 1024) {
                showToast('⚠️ รูปภาพมีขนาดใหญ่เกินไป (สูงสุด 5MB หลังบีบอัด)', 'error');
                event.target.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                const previewUrl = e.target.result;
                addMessage('📷 กำลังอัปโหลดรูป...', 'sent', '', previewUrl);
                uploadImageToServer(file);
            };
            reader.readAsDataURL(file);
            event.target.value = '';
        }

        async function uploadImageToServer(file) {
            addTyping();
            try {
                const data = await uploadImageToDrive(file);
                removeTyping();

                if (data.success && (data.lh3Url || data.imageUrl)) {
                    const lh3 = data.lh3Url || data.imageUrl;
                    // ส่งรูปเป็น type image ผ่าน LINE (lh3)
                    const sendData = await callGas('sendImage', {
                        imageUrl: lh3,
                        message: ''
                    });
                    if (sendData.success) {
                        addSystemMessage('✅ ส่งรูปภาพสำเร็จ! (lh3)');
                        showToast('✅ ส่งรูปภาพสำเร็จ', 'success');
                    } else {
                        addMessage(`❌ ${sendData.error || 'ส่งรูปไม่สำเร็จ'}`, 'received');
                        showToast('❌ ส่งรูปไม่สำเร็จ', 'error');
                    }
                } else {
                    addMessage(`❌ ${data.error || 'อัปโหลดไม่สำเร็จ'}`, 'received');
                    showToast('❌ อัปโหลดรูปไม่สำเร็จ', 'error');
                }
            } catch (e) {
                removeTyping();
                addMessage(`❌ Connection error: ${e.message}`, 'received');
                showToast('❌ Connection error', 'error');
            }
        }

        /* ──────────────── THREAD IMAGE UPLOAD ──────────────── */
        function openThreadImageUpload() {
            document.getElementById('threadImageInput').click();
        }

        async function handleThreadImageUpload(event) {
            const origFile = event.target.files[0];
            if (!origFile) return;

            if (!origFile.type.startsWith('image/')) {
                showToast('⚠️ กรุณาเลือกไฟล์รูปภาพเท่านั้น', 'error');
                event.target.value = '';
                return;
            }
            // บีบอัดก่อนแสดงพรีวิวและเก็บไว้ส่งจริง (ไฟล์ไม่ต้องใหญ่มาก)
            const file = await compressImageFile(origFile, 1280, 0.72);
            if (file.size > 5 * 1024 * 1024) {
                showToast('⚠️ รูปภาพมีขนาดใหญ่เกินไป (สูงสุด 5MB หลังบีบอัด)', 'error');
                event.target.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                threadImageBase64 = e.target.result.split(',')[1];
                threadImageFile = file;
                const preview = document.getElementById('threadImagePreview');
                const img = document.getElementById('threadPreviewImg');
                img.src = e.target.result;
                preview.style.display = 'flex';
                showToast(`🗜️ บีบอัดแล้ว ${(file.size/1024).toFixed(0)}KB พร้อมส่ง`, 'success');
            };
            reader.readAsDataURL(file);
            event.target.value = '';
        }

        function clearThreadImage() {
            threadImageBase64 = null;
            threadImageFile = null;
            document.getElementById('threadImagePreview').style.display = 'none';
            document.getElementById('threadPreviewImg').src = '';
        }

        /* ──────────────── AI MODE ──────────────── */
        function toggleAiMode() {
            aiMode = !aiMode;
            aiModeBtn.textContent = aiMode ? '🤖 AI ON' : '🤖 AI OFF';
            aiModeBtn.classList.toggle('active', aiMode);
            messageInput.placeholder = aiMode ? 'ถามอะไรก็ได้กับ AI...' : 'พิมพ์ข้อความ...';
        }

        function getSelectedProviderModel() {
            const val = modelSelect.value || '';
            const sep = val.indexOf('::');
            if (sep === -1) return { provider: undefined, model: val || undefined };
            return { provider: val.slice(0, sep), model: val.slice(sep + 2) };
        }

        /* ──────────────── LOAD AI PROVIDERS ──────────────── */
        async function loadAiProviders() {
            try {
                const data = await callGas('getAIProviders');
                if (!data.success) {
                    modelSelect.innerHTML = `<option value="">❌ โหลดไม่สำเร็จ</option>`;
                    return;
                }
                const providers = data.providers;
                const current = data.current || {};
                modelSelect.innerHTML = '';
                Object.keys(providers).forEach(pk => {
                    const cfg = providers[pk];
                    const group = document.createElement('optgroup');
                    group.label = cfg.label;
                    cfg.models.forEach(m => {
                        const opt = document.createElement('option');
                        opt.value = pk + '::' + m;
                        opt.textContent = m;
                        if (pk === current.provider && m === current.model) opt.selected = true;
                        group.appendChild(opt);
                    });
                    modelSelect.appendChild(group);
                });
                const hasSelected = Array.from(modelSelect.options).some(o => o.selected);
                if (!hasSelected && current.provider && current.model) {
                    const opt = document.createElement('option');
                    opt.value = current.provider + '::' + current.model;
                    opt.textContent = `${current.model} (กำหนดเอง)`;
                    opt.selected = true;
                    modelSelect.appendChild(opt);
                }
            } catch (e) {
                modelSelect.innerHTML = `<option value="">❌ เชื่อมต่อไม่ได้</option>`;
            }
        }

        /* ──────────────── GAS CALL ──────────────── */
        async function callGas(action, payload = {}) {
            const resp = await fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action, payload })
            });
            const raw = await resp.text();
            try { return JSON.parse(raw); } catch (_) {
                throw new Error(`Server error (${resp.status}): ${raw.slice(0, 150)}`);
            }
        }

        /* ──────────────── SEND MESSAGE ──────────────── */
        async function sendMessage() {
            const text = messageInput.value.trim();
            if (!text) return;
            addMessage(text, 'sent');
            messageInput.value = '';
            sendBtn.disabled = true;
            addTyping();

            if (aiMode) {
                try {
                    const { provider, model } = getSelectedProviderModel();
                    const data = await callGas('askAI', { question: text, provider, model });
                    removeTyping();
                    if (data.success) {
                        if (data.imageUrl) {
                            addMessage(data.answer || '📷 รูปภาพจาก AI', 'ai', `🤖 ${data.provider}/${data.model} · ${lineStatusLabel(data)}`, data.imageUrl);
                        } else {
                            addMessage(data.answer, 'ai', `🤖 ${data.provider}/${data.model} · ${lineStatusLabel(data)}`);
                        }
                        showToast(data.lineSent ? '✅ ตอบแล้วและส่งเข้า LINE' : '⚠️ ตอบแล้ว แต่ส่ง LINE ไม่สำเร็จ', data.lineSent ?
                            'success' : 'error');
                    } else {
                        addMessage(`❌ ${data.error || 'เกิดข้อผิดพลาด'}`, 'received');
                        showToast('❌ AI ตอบไม่สำเร็จ', 'error');
                    }
                } catch (e) {
                    removeTyping();
                    addMessage(`❌ Connection error: ${e.message}`, 'received');
                    showToast('❌ Connection error', 'error');
                } finally {
                    sendBtn.disabled = false;
                }
                return;
            }

            try {
                const data = await callGas('sendText', { message: text });
                removeTyping();
                if (data.success) {
                    addSystemMessage('✅ ส่งข้อความสำเร็จ!');
                    showToast('✅ ส่งข้อความสำเร็จ', 'success');
                } else {
                    addMessage(`❌ ${data.error || 'เกิดข้อผิดพลาด'}`, 'received');
                    showToast('❌ ส่งข้อความไม่สำเร็จ', 'error');
                }
            } catch (e) {
                removeTyping();
                addMessage(`❌ Connection error: ${e.message}`, 'received');
                showToast('❌ Connection error', 'error');
            } finally {
                sendBtn.disabled = false;
            }
        }

        /* ──────────────── TOOLS ──────────────── */
        async function getProfile() {
            addSystemMessage('🔍 กำลังดึงข้อมูลโปรไฟล์...');
            addTyping();
            try {
                const data = await callGas('getProfile');
                removeTyping();
                if (data.success && data.profile) {
                    const p = data.profile;
                    let text = `
                        👤 <strong>${escapeHtml(p.displayName || 'N/A')}</strong><br>
                        📱 ID: ${escapeHtml(p.userId || 'N/A')}<br>
                        🌐 Language: ${escapeHtml(p.language || 'N/A')}<br>
                        💬 Status: ${escapeHtml(p.statusMessage || 'No status')}
                    `;
                    let imageUrl = null;
                    if (p.pictureUrl) {
                        imageUrl = p.pictureUrl;
                    }
                    addMessage(text, 'received', `👤 PROFILE · ${lineStatusLabel(data)}`, imageUrl);
                    showToast(data.lineSent ? '✅ ดึงโปรไฟล์และส่งเข้า LINE แล้ว' : '⚠️ ดึงโปรไฟล์สำเร็จ แต่ส่ง LINE ไม่สำเร็จ',
                        data.lineSent ? 'success' : 'error');
                } else {
                    addMessage(`❌ ${data.error || 'ไม่พบข้อมูล'}`, 'received');
                }
            } catch (e) {
                removeTyping();
                addMessage(`❌ Error: ${e.message}`, 'received');
                showToast('❌ Error fetching profile', 'error');
            }
        }

        async function getFollowers() {
            addSystemMessage('👥 กำลังดึงรายชื่อผู้ติดตาม...');
            addTyping();
            try {
                const data = await callGas('getFollowers', { limit: 20 });
                removeTyping();
                if (data.success && data.data) {
                    const ids = data.data.userIds || [];
                    const next = data.data.next || 'ไม่มีต่อ';
                    addMessage(`
                        📊 พบผู้ติดตาม <strong>${ids.length}</strong> คน<br>
                        🔄 Next token: ${next}<br>
                        ${ids.slice(0, 5).map(id => `📱 ${escapeHtml(id)}`).join('<br>')}
                        ${ids.length > 5 ? `<br>...และอีก ${ids.length - 5} คน` : ''}
                    `, 'received', `👥 FOLLOWERS · ${lineStatusLabel(data)}`);
                    showToast(data.lineSent ? `✅ พบ ${ids.length} คน และส่งเข้า LINE แล้ว` :
                        `⚠️ พบ ${ids.length} คน แต่ส่ง LINE ไม่สำเร็จ`, data.lineSent ? 'success' : 'error');
                } else {
                    addMessage(`❌ ${data.error || 'ไม่พบข้อมูล'}`, 'received');
                }
            } catch (e) {
                removeTyping();
                addMessage(`❌ Error: ${e.message}`, 'received');
                showToast('❌ Error fetching followers', 'error');
            }
        }

        async function getQuota() {
            addSystemMessage('📊 กำลังตรวจสอบ Quota...');
            addTyping();
            try {
                const data = await callGas('getQuota');
                removeTyping();
                if (data.success && data.quota) {
                    const q = data.quota;
                    const remaining = (q.limit != null && q.used != null) ? q.limit - q.used : 'N/A';
                    addMessage(`
                        📊 <strong>Message Quota</strong><br>
                        📈 Limit: ${q.limit ?? 'N/A'}<br>
                        📉 Used: ${q.used ?? 'N/A'}<br>
                        📊 Remaining: ${remaining}
                    `, 'received', `📊 QUOTA · ${lineStatusLabel(data)}`);
                    showToast(data.lineSent ? '✅ Quota checked และส่งเข้า LINE แล้ว' : '⚠️ Quota checked แต่ส่ง LINE ไม่สำเร็จ',
                        data.lineSent ? 'success' : 'error');
                } else {
                    addMessage(`❌ ${data.error || 'ไม่สามารถดึงข้อมูล'}`, 'received');
                }
            } catch (e) {
                removeTyping();
                addMessage(`❌ Error: ${e.message}`, 'received');
                showToast('❌ Quota error', 'error');
            }
        }

        /* ──────────────── INBOX (Global Poll + Modal) ──────────────── */
        const NOTIFY_STORAGE_KEY = 'lineBotMcp_lastSeenIn_v4';
        let lastSeenIn = {};
        try { lastSeenIn = JSON.parse(localStorage.getItem(NOTIFY_STORAGE_KEY) || '{}'); } catch (_) {}
        const notifiedKeys = new Set();
        let currentThreadUserId = null;
        let currentQuoteToken = null;
        let currentQuotePreviewText = '';

        function saveLastSeenIn() {
            try { localStorage.setItem(NOTIFY_STORAGE_KEY, JSON.stringify(lastSeenIn)); } catch (_) {}
        }

        function isConversationUnread(c) {
            // ใช้ค่าจาก server (Sheet!I) เป็นหลัก — persistent ข้ามเครื่อง
            if (typeof c.unreadCount === 'number') return c.unreadCount > 0;
            if (typeof c.isUnread === 'boolean') return c.isUnread;
            if (c.lastDirection !== 'in') return false;
            const seen = lastSeenIn[c.userId];
            return !seen || new Date(c.lastTimestamp) > new Date(seen);
        }

        async function markThreadAsRead(userId) {
            lastSeenIn[userId] = new Date().toISOString();
            saveLastSeenIn();
            // optimistic: ลด badge ทันที ก่อนรอ server
            try { await callGas('markAsRead', { userId }); } catch (_) {}
            // ให้ server flush แล้วค่อย poll เพื่อให้ badge ตรง (สมบูรณ์)
            setTimeout(pollGlobalInbox, 400);
        }

        function updateInboxBadge(count) {
            const badge = document.getElementById('inboxBadge');
            if (!badge) return;
            if (count > 0) {
                badge.textContent = count > 9 ? '9+' : String(count);
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }

        function playNotifySound() {
            if (isSleeping) return;
            try {
                const ctx = new(window.AudioContext || window.webkitAudioContext)();
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.type = 'square';
                o.frequency.value = 880;
                g.gain.value = 0.04;
                o.connect(g);
                g.connect(ctx.destination);
                o.start();
                setTimeout(() => { o.stop();
                    ctx.close(); }, 150);
            } catch (_) {}
        }

        async function pollGlobalInbox() {
            try {
                const data = await callGas('getConversations');
                if (!data.success) return;
                const convs = data.conversations || [];
                // สมบูรณ์: ใช้ totalUnread จาก server ถ้ามี (ผลรวมข้อความยังไม่อ่าน), fallback นับห้อง
                let totalUnread = typeof data.totalUnread === 'number' ? data.totalUnread : 0;
                let unreadConversations = 0;
                if (typeof data.totalUnread !== 'number') {
                    convs.forEach(c => { if (isConversationUnread(c)) unreadConversations++; });
                    totalUnread = unreadConversations;
                } else {
                    convs.forEach(c => { if (isConversationUnread(c)) unreadConversations++; });
                }
                // แจ้งเตือนเฉพาะเมื่อมีห้องที่ยังไม่อ่านใหม่ หรือข้อความใหม่ — ข้ามถ้าอยู่โหมดหลับ
                if (!isSleeping) {
                    convs.forEach(c => {
                        const unreadFlag = isConversationUnread(c);
                        // key เปลี่ยนเมื่อ unreadCount หรือ timestamp เปลี่ยน เพื่อไม่พลาดกรณีมีข้อความใหม่ในห้องเดิม
                        const key = c.userId + '|' + c.lastTimestamp + '|' + (c.unreadCount || 0);
                        if (unreadFlag && !notifiedKeys.has(key)) {
                            notifiedKeys.add(key);
                            const preview = (c.lastText || '').slice(0, 40);
                            const cnt = c.unreadCount > 1 ? ` (+${c.unreadCount} ข้อความ)` : '';
                            showToast(`💬 ข้อความใหม่จาก ${c.displayName}${cnt}: ${preview}`);
                            playNotifySound();
                        }
                    });
                }
                // badge แสดงจำนวนข้อความยังไม่อ่านทั้งหมด (สมบูรณ์กว่าแค่นับห้อง)
                updateInboxBadge(totalUnread);
                // เก็บไว้ให้ loadInboxList ใช้ถ้าต้องการ
                window._lastConversations = convs;
            } catch (_) {}
        }

        setInterval(pollGlobalInbox, 6000);
        pollGlobalInbox();

        /* ─── Open Inbox / Back ─── */
        function backToInbox() {
            if (window._threadPoll) { clearInterval(window._threadPoll); window._threadPoll = null; }
            currentThreadUserId = null;
            clearQuoteReply();
            clearThreadImage();
            document.getElementById('threadBackBtn').style.display = 'none';
            document.getElementById('modalFooter').style.display = 'none';
            loadInboxList();
        }
        function openInbox() {
            document.getElementById('threadModal').classList.add('show');
            document.getElementById('threadBackBtn').style.display = 'none';
            document.getElementById('modalFooter').style.display = 'none';
            loadInboxList();
        }

        async function loadInboxList() {
            // inbox list โหมด: ซ่อนปุ่มย้อนกลับและซ่อน footer ตอบกลับ (แสดงเฉพาะตอนดู thread)
            const backBtn = document.getElementById('threadBackBtn');
            const footer = document.getElementById('modalFooter');
            if (backBtn) backBtn.style.display = 'none';
            if (footer) footer.style.display = 'none';
            try {
                const data = await callGas('getConversations');
                if (!data.success || !data.conversations.length) {
                    document.getElementById('threadName').textContent = 'กล่องข้อความ';
                    document.getElementById('threadAvatar').src = DEFAULT_AVATAR;
                    document.getElementById('threadMessages').innerHTML = `
                        <div class="msg system"><div class="msg-bubble">📭 ไม่มีข้อความ</div></div>
                    `;
                    return;
                }
                const container = document.getElementById('threadMessages');
                container.innerHTML = data.conversations.map(c => {
                    const isUnread = isConversationUnread(c);
                    const avatar = c.pictureUrl || '';
                    const prefix = c.lastDirection === 'out' ? '↩ ' : '';
                    let statusHtml = '';
                    if (c.lastDirection === 'out') {
                        // ปลายทางอ่าน = มี in ตอบกลับหลัง out แล้ว (อ้างอิง LINE API)
                        if (c.lastOutStatus === 'read') {
                            statusHtml = '<span style="color:#00b900;font-size:10px;font-weight:600;" title="LINE: ปลายทางตอบกลับแล้ว"><i class="fas fa-check-double"></i> ปลายทางอ่านแล้ว</span>';
                        } else {
                            statusHtml = '<span style="color:#999;font-size:10px;" title="LINE: รอปลายทางเปิดอ่าน"><i class="fas fa-check"></i> ส่งแล้ว</span>';
                        }
                    } else if (isUnread) {
                        const cnt = c.unreadCount > 1 ? ` (${c.unreadCount})` : '';
                        statusHtml = '<span style="color:#ff3b30;font-size:10px;font-weight:700;"><i class="fas fa-circle" style="font-size:6px;"></i> ยังไม่ได้อ่าน' + cnt + '</span>';
                    } else {
                        statusHtml = '<span style="color:#4caf50;font-size:10px;"><i class="fas fa-eye"></i> อ่านแล้ว</span>';
                    }
                    const unreadBadge = isUnread && c.unreadCount > 1
                        ? `<span style="background:#ff3b30;color:#fff;font-size:11px;font-weight:700;min-width:20px;height:20px;line-height:20px;text-align:center;border-radius:10px;padding:0 6px;flex-shrink:0;">${c.unreadCount}</span>`
                        : (isUnread ? `<span style="background:#00b900;color:#fff;font-size:10px;font-weight:700;min-width:18px;height:18px;line-height:18px;text-align:center;border-radius:9px;padding:0 5px;flex-shrink:0;">●</span>` : '');
                    return `
                        <div class="msg received conv-item" style="cursor:pointer;max-width:100%;"
                             data-userid="${escapeAttr(c.userId)}" data-display="${escapeAttr(c.displayName)}" data-avatar="${escapeAttr(avatar)}">
                            <div class="msg-bubble" style="border-radius:12px;width:100%;display:flex;align-items:center;gap:12px;padding:10px 14px;border:${isUnread ? '2px solid #00b900' : '1px solid #e0e0e0'};background:${isUnread ? '#f0fff0' : '#ffffff'};">
                                ${avatar ? `<img src="${escapeAttr(avatar)}" style="width:40px;height:40px;border-radius:50%;border:2px solid ${isUnread ? '#00b900' : '#e0e0e0'};flex-shrink:0;">` : `<div style="width:40px;height:40px;border-radius:50%;background:${isUnread ? '#00b900' : '#e0e0e0'};flex-shrink:0;"></div>`}
                                <div style="flex:1;min-width:0;">
                                    <div style="font-weight:600;font-size:14px;display:flex;align-items:center;gap:6px;">${escapeHtml(c.displayName)} ${isUnread ? '<span style="color:#00b900;font-size:11px;">● ใหม่</span>' : ''}</div>
                                    <div style="color:#999;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${prefix}${escapeHtml((c.lastText || '').slice(0, 50))}</div>
                                    <div style="display:flex;align-items:center;gap:8px;margin-top:2px;"><span style="color:#bbb;font-size:10px;">${new Date(c.lastTimestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>${statusHtml}</div>
                                </div>
                                ${unreadBadge}
                                <i class="fas fa-chevron-right" style="color:#ccc;"></i>
                            </div>
                        </div>
                    `;
                }).join('');
                document.getElementById('threadName').textContent = '📥 กล่องข้อความ';
                document.getElementById('threadAvatar').src = DEFAULT_AVATAR;
                document.getElementById('threadMessages').scrollTop = 0;
                document.getElementById('quotePreviewBar').style.display = 'none';
            } catch (e) {
                document.getElementById('threadMessages').innerHTML = `
                    <div class="msg system"><div class="msg-bubble">❌ โหลดไม่สำเร็จ</div></div>
                `;
            }
        }

        /* ─── Thread ─── */
        async function openThread(userId, displayName, pictureUrl) {
            currentThreadUserId = userId;
            clearQuoteReply();
            clearThreadImage();
            document.getElementById('threadName').textContent = displayName;
            document.getElementById('threadAvatar').src = pictureUrl || DEFAULT_AVATAR;
            document.getElementById('threadBackBtn').style.display = 'flex';
            document.getElementById('modalFooter').style.display = 'flex';
            document.getElementById('threadModal').classList.add('show');
            // มาร์คว่าอ่านแล้วทันที (persistent บน Sheet) ก่อนโหลดข้อความ — สำหรับ in เท่านั้น, out รอปลายทางตอบกลับ
            await markThreadAsRead(userId);
            await refreshThread();
            // เผื่อ Sheets ยังไม่ flush ให้รีเฟรชซ้ำอีกครั้งหลัง 1 วิ เพื่อให้เห็น อ่านแล้ว ทันที
            setTimeout(() => { if (currentThreadUserId === userId) refreshThread(); }, 900);
            if (window._threadPoll) clearInterval(window._threadPoll);
            window._threadPoll = setInterval(refreshThread, 4000);
        }

        function closeThread() {
            document.getElementById('threadModal').classList.remove('show');
            currentThreadUserId = null;
            clearQuoteReply();
            clearThreadImage();
            document.getElementById('threadBackBtn').style.display = 'none';
            document.getElementById('modalFooter').style.display = 'none';
            if (window._threadPoll) { clearInterval(window._threadPoll);
                window._threadPoll = null; }
        }

        let _autoMarkPending = false;
        async function refreshThread() {
            if (!currentThreadUserId) return;
            try {
                const data = await callGas('getMessages', { userId: currentThreadUserId });
                if (!data.success) return;
                const container = document.getElementById('threadMessages');
                container.innerHTML = data.messages.map(m => {
                    let statusHtml = '';
                    if (m.direction === 'out') {
                        // out = ส่งจาก inbox ไปปลายทาง — อ่านแล้วต้องมี in ตอบกลับหลัง out (อ้างอิง LINE webhook) เท่านั้น
                        if (m.readStatus === 'read') {
                            statusHtml = '<div class="read-status read" title="อ้างอิง LINE: มีข้อความตอบกลับหลังส่ง"><i class="fas fa-check-double"></i> ปลายทางอ่านแล้ว</div>';
                        } else {
                            statusHtml = '<div class="read-status sent" title="รอปลายทางเปิดอ่าน/ตอบกลับ (อ้างอิง LINE webhook)"><i class="fas fa-check"></i> ส่งแล้ว</div>';
                        }
                    } else {
                        // in = ข้อความจากผู้ใช้ — อ่านแล้วต่อเมื่อแอดมินเปิด thread (Sheet!I=TRUE ผ่าน markAsRead) — สมบูรณ์
                        if (m.isRead || m.readStatus === 'read') {
                            statusHtml = '<div class="read-status read" style="justify-content:flex-start;color:#4caf50;"><i class="fas fa-eye"></i> อ่านแล้ว</div>';
                        } else {
                            statusHtml = '<div class="read-status" style="justify-content:flex-start;color:#ff3b30;font-weight:700;"><i class="fas fa-circle" style="font-size:6px;"></i> ยังไม่ได้อ่าน</div>';
                        }
                    }
                    return `
                    <div class="msg ${m.direction === 'out' ? 'sent' : 'received'}">
                        <div class="msg-bubble">
                            ${escapeHtml(m.text)}
                            ${m.imageUrl ? `<img src="${escapeAttr(m.imageUrl)}" class="msg-image clickable-image" style="max-width:150px;max-height:200px;border-radius:8px;margin-top:4px;cursor:pointer;" data-url="${escapeAttr(m.imageUrl)}" />` : ''}
                            <div class="timestamp">${new Date(m.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</div>
                            ${statusHtml}
                            ${m.direction === 'in' && m.quoteToken ? `<button class="quote-reply-btn" data-quote-token="${escapeAttr(m.quoteToken)}" data-quote-text="${escapeAttr((m.text || '').slice(0, 60))}">↩ ตอบกลับข้อความนี้</button>` : ''}
                        </div>
                    </div>
                `;
                }).join('');
                container.scrollTop = container.scrollHeight;
                // สมบูรณ์: ถ้ามีข้อความ in ยังไม่อ่านค้างอยู่ขณะที่เปิด thread อยู่ ให้ auto-mark ทันที (ไม่ต้องปิดเปิดใหม่)
                const hasUnreadIn = data.messages.some(m => m.direction === 'in' && !m.isRead);
                const unreadCnt = data.unreadCount || data.messages.filter(m=>m.direction==='in' && !m.isRead).length;
                if (hasUnreadIn && !_autoMarkPending) {
                    _autoMarkPending = true;
                    try { await callGas('markAsRead', { userId: currentThreadUserId }); } catch(_){}
                    setTimeout(() => { _autoMarkPending = false; pollGlobalInbox(); }, 500);
                }
                // อัปเดต badge ทันทีหลัง render thread เพื่อให้ตัวเลขตรง (กรณีมาจาก totalUnread)
                if (typeof data.unreadCount === 'number') {
                    // จะซิงค์ผ่าน pollGlobalInbox ครั้งถัดไป
                }
            } catch (_) {}
        }

        /* ─── Quote Reply ─── */
        function setQuoteReply(token, preview) {
            if (!token) return;
            currentQuoteToken = token;
            currentQuotePreviewText = preview;
            renderQuotePreviewBar();
            document.getElementById('threadReplyInput').focus();
        }

        function clearQuoteReply() {
            currentQuoteToken = null;
            currentQuotePreviewText = '';
            renderQuotePreviewBar();
        }

        function renderQuotePreviewBar() {
            const bar = document.getElementById('quotePreviewBar');
            if (!bar) return;
            if (currentQuoteToken) {
                bar.style.display = 'flex';
                bar.querySelector('.quote-text').textContent = '↩ ตอบกลับ: ' + currentQuotePreviewText;
            } else {
                bar.style.display = 'none';
            }
        }

        function handleQuoteClick(btn) {
            setQuoteReply(btn.getAttribute('data-quote-token'), btn.getAttribute('data-quote-text'));
        }

        /* ─── Suggest AI Reply ─── */
        async function suggestAiReply() {
            if (!currentThreadUserId) return;
            const input = document.getElementById('threadReplyInput');
            const btn = document.getElementById('aiSuggestBtn');
            let question = input.value.trim();

            if (!question) {
                try {
                    const msgs = await callGas('getMessages', { userId: currentThreadUserId });
                    if (msgs.success && msgs.messages.length) {
                        const lastIn = [...msgs.messages].reverse().find(m => m.direction === 'in');
                        question = lastIn ? lastIn.text : '';
                    }
                } catch (_) {}
            }

            if (!question) {
                showToast('⚠️ ไม่มีข้อความให้ AI ช่วยร่างคำตอบ', 'error');
                return;
            }

            btn.disabled = true;
            const origLabel = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            try {
                const { provider, model } = getSelectedProviderModel();
                const data = await callGas('suggestAI', { question, provider, model });
                if (data.success) {
                    input.value = data.answer;
                    input.focus();
                } else {
                    showToast(`❌ ${data.error || 'AI ร่างคำตอบไม่สำเร็จ'}`, 'error');
                }
            } catch (_) {
                showToast('❌ Connection error', 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = origLabel;
            }
        }

        /* ─── Send Thread Reply (with image) ─── */
        async function sendThreadReply() {
            const input = document.getElementById('threadReplyInput');
            const text = input.value.trim();
            if (!text && !threadImageBase64) {
                showToast('⚠️ กรุณาพิมพ์ข้อความหรือแนบรูปภาพ', 'error');
                return;
            }
            if (!currentThreadUserId) return;

            input.value = '';
            const quoteToken = currentQuoteToken;
            const imageBase64 = threadImageBase64;
            const imageFile = threadImageFile;

            clearQuoteReply();
            clearThreadImage();

            // Show sending status
            addSystemMessage('📤 กำลังส่ง...');

            try {
                let lh3Url = null;

                // ถ้ามีรูป ให้อัปโหลดไป Google Drive ก่อน
                if (imageBase64 && imageFile) {
                    const uploadData = await uploadImageToDrive(imageFile);
                    if (uploadData.success && uploadData.lh3Url) {
                        lh3Url = uploadData.lh3Url;
                    } else {
                        showToast(`⚠️ อัปโหลดรูปไม่สำเร็จ: ${uploadData.error || ''}`, 'error');
                        // ส่งเฉพาะข้อความต่อไป
                    }
                }

                // ส่งข้อความ + รูป (ถ้ามี)
                const data = await callGas('replyToUser', {
                    userId: currentThreadUserId,
                    message: text || '📷 รูปภาพ',
                    quoteToken: quoteToken,
                    imageUrl: lh3Url
                });

                if (data.success) {
                    await refreshThread();
                    showToast('✅ ส่งสำเร็จ', 'success');
                } else {
                    showToast(`❌ ${data.error || 'ส่งไม่สำเร็จ'}`, 'error');
                }
            } catch (e) {
                showToast(`❌ Connection error: ${e.message}`, 'error');
            }
        }

        /* ──────────────── STATUS ──────────────── */
        async function checkStatus() {
            try {
                const data = await callGas('status');
                if (data.status === 'online') {
                    statusDot.className = 'dot';
                    statusText.textContent = 'ONLINE';
                } else {
                    statusDot.className = 'dot offline';
                    statusText.textContent = 'OFFLINE';
                }
                if (!data.channelTokenConfigured) {
                    showToast('⚠️ Channel Token ไม่ได้ตั้งค่า', 'error');
                }
            } catch (_) {
                statusDot.className = 'dot offline';
                statusText.textContent = 'OFFLINE';
            }
        }

        /* ──────────────── INIT ──────────────── */
        async function initializeApp() {
            document.getElementById('appContainer').style.display = 'flex';
            applySleepUI();
            await loadAiProviders();
            await checkStatus();
            setInterval(checkStatus, 30000);
            console.log('💬 LINE BOT MCP · Ready with Drive image upload');
        }

        document.getElementById('appContainer').style.display = 'none';
        showLogin();

        // Expose functions
        window.sendMessage = sendMessage;
        window.toggleAiMode = toggleAiMode;
        window.getProfile = getProfile;
        window.getFollowers = getFollowers;
        window.getQuota = getQuota;
        window.openInbox = openInbox;
        window.clearChat = clearChat;
        window.openImageUpload = openImageUpload;
        window.handleImageUpload = handleImageUpload;
        window.closeThread = closeThread;
        window.sendThreadReply = sendThreadReply;
        window.suggestAiReply = suggestAiReply;
        window.handleQuoteClick = handleQuoteClick;
        window.clearQuoteReply = clearQuoteReply;
        window.openThread = openThread;
        window.togglePasswordVisibility = togglePasswordVisibility;
        window.openThreadImageUpload = openThreadImageUpload;
        window.handleThreadImageUpload = handleThreadImageUpload;
        window.clearThreadImage = clearThreadImage;
        window.toggleSleep = toggleSleep;
        window.backToInbox = backToInbox;
    

// ── CSP-safe event listeners (MV3: no inline onclick) ──
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('sleepBtn')?.addEventListener('click', toggleSleep);
  document.getElementById('modalSleepBtn')?.addEventListener('click', toggleSleep);
  document.getElementById('clearChatBtn')?.addEventListener('click', clearChat);
  document.getElementById('aiModeBtn')?.addEventListener('click', toggleAiMode);
  document.getElementById('btnProfile')?.addEventListener('click', getProfile);
  document.getElementById('btnFollowers')?.addEventListener('click', getFollowers);
  document.getElementById('btnQuota')?.addEventListener('click', getQuota);
  document.getElementById('btnInbox')?.addEventListener('click', openInbox);
  document.getElementById('threadBackBtn')?.addEventListener('click', backToInbox);
  document.getElementById('closeThreadBtn')?.addEventListener('click', closeThread);
  document.getElementById('imageUploadBtn')?.addEventListener('click', openImageUpload);
  document.getElementById('threadImageUploadBtn')?.addEventListener('click', openThreadImageUpload);
  document.getElementById('clearThreadImageBtn')?.addEventListener('click', clearThreadImage);
  document.getElementById('clearQuoteBtn')?.addEventListener('click', clearQuoteReply);
  document.getElementById('aiSuggestBtn')?.addEventListener('click', suggestAiReply);
  document.getElementById('threadSendBtn')?.addEventListener('click', sendThreadReply);
  document.getElementById('sendBtn')?.addEventListener('click', sendMessage);
  // Enter key handling
  document.getElementById('messageInput')?.addEventListener('keypress', (e)=>{ if(e.key==='Enter') sendMessage(); });
  document.getElementById('threadReplyInput')?.addEventListener('keypress', (e)=>{ if(e.key==='Enter') sendThreadReply(); });
  // File inputs
  document.getElementById('imageInput')?.addEventListener('change', handleImageUpload);
  document.getElementById('threadImageInput')?.addEventListener('change', handleThreadImageUpload);
  // Delegated clicks for dynamically generated content
  document.getElementById('threadMessages')?.addEventListener('click', (e)=>{
    const conv = e.target.closest('.conv-item');
    if (conv) {
      const uid = conv.getAttribute('data-userid');
      const dname = conv.getAttribute('data-display');
      const av = conv.getAttribute('data-avatar');
      if (uid) openThread(uid, dname, av);
      return;
    }
    const img = e.target.closest('.clickable-image');
    if (img && img.dataset.url) {
      window.open(img.dataset.url, '_blank');
      return;
    }
    const qbtn = e.target.closest('.quote-reply-btn');
    if (qbtn) {
      handleQuoteClick(qbtn);
      return;
    }
  });
  // Also for chatMessages images (main chat)
  document.getElementById('chatMessages')?.addEventListener('click', (e)=>{
    const img = e.target.closest('.clickable-image');
    if (img && img.dataset.url) window.open(img.dataset.url, '_blank');
  });
});
// SweetAlert password toggle: delegated via didOpen plus fallback
document.addEventListener('click', (e)=>{
  const t = e.target.closest('#togglePasswordBtn');
  if (t) togglePasswordVisibility();
});

// ── Extension bridge: sync โหมดหลับกับ chrome.storage.local ──
try {
  chrome.storage.local.get(['lineBotSleep'], (v)=>{
    if (typeof v.lineBotSleep === 'boolean') { isSleeping = v.lineBotSleep; applySleepUI(); }
  });
  // เมื่อ toggleSleep จะ sync ไป storage ด้วย (applySleepUI ทำแล้ว) + แจ้ง background
  // ต้อง wrap ตัวจริงและอัปเดตทั้ง local variable และ window.toggleSleep
  const _origToggle = toggleSleep;
  const wrappedToggle = function(){
    _origToggle();
    try { chrome.storage.local.set({lineBotSleep: isSleeping}); chrome.runtime.sendMessage({type:'pollNow'}); } catch(_){}
  };
  toggleSleep = wrappedToggle;
  window.toggleSleep = wrappedToggle;
  // sync กลับเมื่อ background เปลี่ยน
  chrome.storage.onChanged.addListener((changes, area)=>{
    if (area==='local' && 'lineBotSleep' in changes) { isSleeping = changes.lineBotSleep.newValue; applySleepUI(); }
  });
} catch(_){}
// แจ้ง background ให้ poll ทันทีเมื่อเปิด popup
try { chrome.runtime.sendMessage({type:'pollNow'}); } catch(_){}
