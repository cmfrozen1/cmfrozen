// Supabase Configuration
const SUPABASE_URL = 'https://dozxxknekdhnvpbfetib.supabase.co';
const SUPABASE_KEY = 'sb_publishable_56uJhm9sp4SbzzwWgO3P6Q_oboIl3Jo';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// State
let members = [];
let isEditing = false;
let pointsChart = null;
let html5QrCode = null;
let currentRedeemMember = null;
let qrcodeInstance = null;

// DOM Elements
const memberList = document.getElementById('member-list');
const emptyState = document.getElementById('empty-state');
const searchInput = document.getElementById('search-input');
const loadingOverlay = document.getElementById('loading-overlay');
const memberModal = document.getElementById('product-modal');
const memberForm = document.getElementById('member-form');
const modalTitle = document.getElementById('modal-title');
const submitBtn = document.getElementById('submit-btn');

// QR & Redeem Modals
const qrModal = document.getElementById('qr-modal');
const redeemModal = document.getElementById('redeem-modal');

// Sections
const sections = {
    home: document.getElementById('section-home'),
    chart: document.getElementById('section-chart'),
    info: document.getElementById('section-info')
};

// Navigation
const navButtons = {
    home: document.getElementById('nav-home'),
    chart: document.getElementById('nav-chart'),
    info: document.getElementById('nav-info')
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    fetchMembers();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('open-add-modal').addEventListener('click', () => showModal(false));
    document.getElementById('close-modal').addEventListener('click', hideModal);
    memberForm.addEventListener('submit', handleFormSubmit);
    searchInput.addEventListener('input', handleSearch);
    
    // QR Scanner
    document.getElementById('start-scan-btn').addEventListener('click', startScanner);

    // Navigation
    navButtons.home.addEventListener('click', () => switchSection('home'));
    navButtons.chart.addEventListener('click', () => switchSection('chart'));
    navButtons.info.addEventListener('click', () => switchSection('info'));

    // Modal close
    memberModal.addEventListener('click', (e) => {
        if (e.target === memberModal) hideModal();
    });
    qrModal.addEventListener('click', (e) => {
        if (e.target === qrModal) hideQRModal();
    });
    redeemModal.addEventListener('click', (e) => {
        if (e.target === redeemModal) hideRedeemModal();
    });
}

// QR Scanner Logic
function startScanner() {
    document.getElementById('scanner-placeholder').classList.add('hidden');
    html5QrCode = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    html5QrCode.start({ facingMode: "environment" }, config, (decodedText) => {
        handleScannedQR(decodedText);
        stopScanner();
    }).catch(err => {
        console.error("Scanner error:", err);
        alert("ไม่สามารถเปิดกล้องได้: " + err);
        stopScanner();
    });
}

function stopScanner() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            document.getElementById('scanner-placeholder').classList.remove('hidden');
        }).catch(err => console.error(err));
    }
}

async function handleScannedQR(phone) {
    showLoading(true);
    try {
        const { data, error } = await _supabase
            .from('members')
            .select('*')
            .eq('phone', phone.trim())
            .single();

        if (error || !data) {
            if (confirm(`ไม่พบสมาชิกเบอร์ ${phone} ต้องการลงทะเบียนใหม่หรือไม่?`)) {
                document.getElementById('member-phone').value = phone;
                showModal(false);
            }
        } else {
            const newPoints = (data.points || 0) + 1;
            const { error: updateError } = await _supabase
                .from('members')
                .update({ points: newPoints })
                .eq('id', data.id);

            if (updateError) throw updateError;
            alert(`เพิ่มแต้มให้คุณ ${data.name} สำเร็จ! (แต้มปัจจุบัน: ${newPoints})`);
            fetchMembers();
        }
    } catch (error) {
        alert("เกิดข้อผิดพลาด: " + error.message);
    } finally {
        showLoading(false);
    }
}

// Database Operations
async function fetchMembers() {
    showLoading(true);
    try {
        const { data, error } = await _supabase
            .from('members')
            .select('*')
            .order('points', { ascending: false });

        if (error) throw error;
        members = data || [];
        renderMembers(members);
        if (!sections.chart.classList.contains('hidden')) updateStats();
    } catch (error) {
        console.error(error);
    } finally {
        showLoading(false);
    }
}

function renderMembers(data) {
    memberList.innerHTML = '';
    if (data.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }
    emptyState.classList.add('hidden');

    data.forEach((m, i) => {
        const card = document.createElement('div');
        card.className = 'product-card bg-gray-800 border border-gray-700 p-5 rounded-3xl flex justify-between items-center shadow-lg';
        card.style.animationDelay = `${i * 0.05}s`;
        card.innerHTML = `
            <div class="flex-1">
                <p class="text-xs text-indigo-400 font-bold mb-1 uppercase tracking-widest">${m.phone}</p>
                <h3 class="font-bold text-white text-lg">${m.name}</h3>
                <div class="flex items-center gap-2 mt-1">
                    <span class="text-yellow-400 font-bold text-xl">${m.points}</span>
                    <span class="text-gray-500 text-xs uppercase tracking-tighter">แต้มสะสม</span>
                </div>
                <div class="flex gap-2 mt-4">
                    <button onclick="showQR('${m.name}', '${m.phone}')" class="text-[10px] bg-gray-700 text-gray-300 px-3 py-1.5 rounded-xl hover:bg-gray-600 transition-all">ดู QR Code</button>
                    <button onclick="showRedeemModal('${m.id}', '${m.name}', ${m.points})" class="text-[10px] bg-red-500/10 text-red-400 px-3 py-1.5 rounded-xl hover:bg-red-500 hover:text-white transition-all">แลกรางวัล</button>
                </div>
            </div>
            <div class="flex flex-col gap-2">
                <button onclick="addPointManual('${m.id}', ${m.points})" class="bg-indigo-600 text-white p-4 rounded-2xl shadow-lg shadow-indigo-500/20 active:scale-90 transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                </button>
            </div>
        `;
        memberList.appendChild(card);
    });
}

// QR Display Logic
function showQR(name, phone) {
    document.getElementById('qr-modal-name').innerText = name;
    document.getElementById('qr-modal-phone').innerText = phone;
    document.getElementById('qrcode-canvas').innerHTML = '';
    
    qrcodeInstance = new QRCode(document.getElementById('qrcode-canvas'), {
        text: phone,
        width: 200,
        height: 200,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });

    qrModal.classList.remove('hidden');
    setTimeout(() => qrModal.classList.add('modal-show'), 10);
}

function hideQRModal() {
    qrModal.classList.remove('modal-show');
    setTimeout(() => qrModal.classList.add('hidden'), 300);
}

// Redemption Logic
function showRedeemModal(id, name, points) {
    currentRedeemMember = { id, name, points };
    document.getElementById('redeem-member-info').innerText = `คุณ ${name} มี ${points} แต้ม`;
    redeemModal.classList.remove('hidden');
    setTimeout(() => redeemModal.classList.add('modal-show'), 10);
}

function hideRedeemModal() {
    redeemModal.classList.remove('modal-show');
    setTimeout(() => redeemModal.classList.add('hidden'), 300);
}

async function redeemPoints(pointsToRedeem) {
    const amount = parseInt(pointsToRedeem);
    if (isNaN(amount) || amount <= 0) {
        alert("กรุณาระบุจำนวนแต้มที่ถูกต้อง");
        return;
    }
    if (amount > currentRedeemMember.points) {
        alert("แต้มไม่เพียงพอสำหรับการแลก");
        return;
    }

    if (!confirm(`ยืนยันการแลก ${amount} แต้ม สำหรับคุณ ${currentRedeemMember.name}?`)) return;

    showLoading(true);
    try {
        const { error } = await _supabase
            .from('members')
            .update({ points: currentRedeemMember.points - amount })
            .eq('id', currentRedeemMember.id);

        if (error) throw error;
        hideRedeemModal();
        fetchMembers();
    } catch (error) {
        alert(error.message);
    } finally {
        showLoading(false);
    }
}

async function addPointManual(id, currentPoints) {
    showLoading(true);
    try {
        const { error } = await _supabase
            .from('members')
            .update({ points: currentPoints + 1 })
            .eq('id', id);
        if (error) throw error;
        fetchMembers();
    } catch (error) {
        alert(error.message);
    } finally {
        showLoading(false);
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('member-id').value;
    const name = document.getElementById('member-name').value;
    const phone = document.getElementById('member-phone').value;
    const points = parseInt(document.getElementById('member-points').value) || 0;

    const payload = { name, phone, points };
    showLoading(true);

    try {
        if (id) {
            await _supabase.from('members').update(payload).eq('id', id);
        } else {
            await _supabase.from('members').insert([payload]);
        }
        hideModal();
        fetchMembers();
    } catch (error) {
        alert(error.message);
    } finally {
        showLoading(false);
    }
}

// UI Helpers
function switchSection(target) {
    Object.values(sections).forEach(s => s.classList.add('hidden'));
    Object.values(navButtons).forEach(b => {
        b.classList.remove('text-indigo-500');
        b.classList.add('text-gray-400');
    });
    sections[target].classList.remove('hidden');
    navButtons[target].classList.remove('text-gray-400');
    navButtons[target].classList.add('text-indigo-500');
    if (target === 'chart') updateStats();
}

function updateStats() {
    const ctx = document.getElementById('pointsChart').getContext('2d');
    const totalMembers = members.length;
    const totalPoints = members.reduce((sum, m) => sum + (m.points || 0), 0);
    
    document.getElementById('total-members').innerText = totalMembers;
    document.getElementById('total-points').innerText = totalPoints;

    if (pointsChart) pointsChart.destroy();
    
    const topMembers = [...members].sort((a,b) => b.points - a.points).slice(0, 5);

    pointsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: topMembers.map(m => m.name),
            datasets: [{
                label: 'แต้มสะสม (Top 5)',
                data: topMembers.map(m => m.points),
                backgroundColor: '#6366f1',
                borderRadius: 10
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#374151' }, ticks: { color: '#9ca3af' } },
                x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
            }
        }
    });
}

function showModal(editMode = false) {
    isEditing = editMode;
    memberModal.classList.remove('hidden');
    setTimeout(() => memberModal.classList.add('modal-show'), 10);
    if (!editMode) memberForm.reset();
}

function hideModal() {
    memberModal.classList.remove('modal-show');
    setTimeout(() => memberModal.classList.add('hidden'), 300);
}

function showLoading(show) {
    loadingOverlay.classList.toggle('hidden', !show);
}

function handleSearch(e) {
    const term = e.target.value.toLowerCase();
    const filtered = members.filter(m => 
        m.name.toLowerCase().includes(term) || m.phone.includes(term)
    );
    renderMembers(filtered);
}
