// Supabase Configuration
const SUPABASE_URL = 'https://dozxxknekdhnvpbfetib.supabase.co';
const SUPABASE_KEY = 'sb_publishable_56uJhm9sp4SbzzwWgO3P6Q_oboIl3Jo';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// State
let products = [];
let isEditing = false;

// DOM Elements
const productList = document.getElementById('product-list');
const emptyState = document.getElementById('empty-state');
const searchInput = document.getElementById('search-input');
const loadingOverlay = document.getElementById('loading-overlay');
const productModal = document.getElementById('product-modal');
const modalContent = document.getElementById('modal-content');
const productForm = document.getElementById('product-form');
const modalTitle = document.getElementById('modal-title');
const submitBtn = document.getElementById('submit-btn');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    fetchProducts();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    document.getElementById('open-add-modal').addEventListener('click', () => showModal(false));
    document.getElementById('close-modal').addEventListener('click', hideModal);
    productForm.addEventListener('submit', handleFormSubmit);
    searchInput.addEventListener('input', handleSearch);
    
    // Close modal on outside click
    productModal.addEventListener('click', (e) => {
        if (e.target === productModal) hideModal();
    });
}

// CRUD Operations
async function fetchProducts() {
    showLoading(true);
    try {
        const { data, error } = await _supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        products = data || [];
        renderProducts(products);
    } catch (error) {
        console.error('Error fetching products:', error.message);
        alert('เกิดข้อผิดพลาดในการดึงข้อมูล: ' + error.message);
    } finally {
        showLoading(false);
    }
}

function renderProducts(data) {
    productList.innerHTML = '';
    
    if (data.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    
    data.forEach((product, index) => {
        const card = document.createElement('div');
        card.className = 'product-card bg-gray-800 border border-gray-700 p-4 rounded-2xl flex justify-between items-center shadow-sm';
        card.style.animationDelay = `${index * 0.05}s`;
        
        card.innerHTML = `
            <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                    <span class="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-[10px] font-bold rounded-full uppercase tracking-wider">${product.category}</span>
                </div>
                <h3 class="font-medium text-white text-lg">${product.name}</h3>
                <p class="text-indigo-400 font-semibold">฿${parseFloat(product.price).toLocaleString()}</p>
            </div>
            <div class="flex gap-2">
                <button onclick="editProduct('${product.id}')" class="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </button>
                <button onclick="deleteProduct('${product.id}')" class="p-2 text-red-400/70 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </div>
        `;
        productList.appendChild(card);
    });
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('product-id').value;
    const name = document.getElementById('product-name').value;
    const price = parseFloat(document.getElementById('product-price').value);
    const category = document.getElementById('product-category').value;

    const payload = { name, price, category };

    showLoading(true);
    try {
        if (isEditing) {
            const { error } = await _supabase
                .from('products')
                .update(payload)
                .eq('id', id);
            if (error) throw error;
        } else {
            const { error } = await _supabase
                .from('products')
                .insert([payload]);
            if (error) throw error;
        }

        hideModal();
        fetchProducts();
    } catch (error) {
        console.error('Error saving product:', error.message);
        alert('เกิดข้อผิดพลาดในการบันทึก: ' + error.message);
    } finally {
        showLoading(false);
    }
}

async function deleteProduct(id) {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบสินค้านี้?')) return;

    showLoading(true);
    try {
        const { error } = await _supabase
            .from('products')
            .delete()
            .eq('id', id);

        if (error) throw error;
        fetchProducts();
    } catch (error) {
        console.error('Error deleting product:', error.message);
        alert('เกิดข้อผิดพลาดในการลบ: ' + error.message);
    } finally {
        showLoading(false);
    }
}

function editProduct(id) {
    const product = products.find(p => p.id == id); // id might be string or number
    if (!product) return;

    document.getElementById('product-id').value = product.id;
    document.getElementById('product-name').value = product.name;
    document.getElementById('product-price').value = product.price;
    document.getElementById('product-category').value = product.category;

    showModal(true);
}

// UI Helpers
function showModal(editMode = false) {
    isEditing = editMode;
    modalTitle.innerText = isEditing ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่';
    submitBtn.innerText = isEditing ? 'บันทึกการแก้ไข' : 'บันทึกสินค้า';
    
    if (!isEditing) {
        productForm.reset();
        document.getElementById('product-id').value = '';
    }

    productModal.classList.remove('hidden');
    setTimeout(() => {
        productModal.classList.add('modal-show');
    }, 10);
}

function hideModal() {
    productModal.classList.remove('modal-show');
    setTimeout(() => {
        productModal.classList.add('hidden');
    }, 300);
}

function showLoading(show) {
    if (show) {
        loadingOverlay.classList.remove('hidden');
    } else {
        loadingOverlay.classList.add('hidden');
    }
}

function handleSearch(e) {
    const term = e.target.value.toLowerCase();
    const filtered = products.filter(p => 
        p.name.toLowerCase().includes(term) || 
        p.category.toLowerCase().includes(term)
    );
    renderProducts(filtered);
}
