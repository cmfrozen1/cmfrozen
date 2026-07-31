// Admin Side Logic
let shopId = null;
let currentShop = null;

async function initAdmin() {
    const slug = getQueryParam('shop') || 'demo-shop';
    
    // Load Shop
    const { data: shop, error } = await supabase
        .from('shops')
        .select('*')
        .eq('slug', slug)
        .single();

    if (error || !shop) {
        showToast('Shop not found', 'error');
        return;
    }
    
    currentShop = shop;
    shopId = shop.id;
    document.getElementById('current-shop-name').textContent = shop.name;
    document.getElementById('input-shop-name').value = shop.name;

    // Load Queues
    await loadQueues();

    // Subscribe to Realtime
    startRealtimeSubscription();
}

async function loadQueues() {
    const { data: queues, error } = await supabase
        .from('queues')
        .select('*, characters(*)')
        .eq('shop_id', shopId)
        .in('status', ['waiting', 'called'])
        .order('queue_number', { ascending: true });

    if (error) return;

    const tbody = document.getElementById('queue-tbody');
    tbody.innerHTML = '';
    
    let waitingCount = 0;
    let calledCount = 0;

    queues.forEach(q => {
        if (q.status === 'waiting') waitingCount++;
        if (q.status === 'called') calledCount++;

        const tr = document.createElement('tr');
        tr.className = `border-b hover:bg-gray-50 transition-colors ${q.status === 'called' ? 'bg-green-50' : ''}`;
        tr.innerHTML = `
            <td class="p-4 font-mono font-bold">${q.queue_number.toString().padStart(2, '0')}</td>
            <td class="p-4">
                <div class="flex items-center gap-2">
                    <div class="h-8 w-8 bg-gray-200 rounded-full bg-center bg-no-repeat bg-contain" style="background-image: url('${q.characters?.sprite_url || ''}')"></div>
                    <div>
                        <p class="font-bold text-sm">${q.display_name}</p>
                        <p class="text-[10px] text-gray-400">${q.status.toUpperCase()}</p>
                    </div>
                </div>
            </td>
            <td class="p-4 text-xs text-gray-500">${new Date(q.created_at).toLocaleTimeString()}</td>
            <td class="p-4">
                ${q.status === 'waiting' ? 
                    `<button onclick="callQueue('${q.id}')" class="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600">Call</button>` :
                    `<button onclick="completeQueue('${q.id}')" class="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600">Complete</button>`
                }
                <button onclick="skipQueue('${q.id}')" class="ml-1 px-3 py-1 bg-gray-200 text-gray-600 text-xs rounded hover:bg-gray-300">Skip</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('stat-waiting').textContent = waitingCount;
    document.getElementById('stat-called').textContent = calledCount;
}

async function callQueue(id) {
    const { error } = await supabase
        .from('queues')
        .update({ status: 'called', called_at: new Date().toISOString() })
        .eq('id', id);
    
    if (error) showToast('Failed to call queue', 'error');
    else showToast('Queue called!');
}

async function completeQueue(id) {
    const { error } = await supabase
        .from('queues')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', id);
    
    if (error) showToast('Failed to complete queue', 'error');
    else showToast('Queue completed!');
}

async function skipQueue(id) {
    if (!confirm('Skip this queue?')) return;
    const { error } = await supabase
        .from('queues')
        .update({ status: 'cancelled' })
        .eq('id', id);
    
    if (error) showToast('Failed to skip queue', 'error');
}

async function callNext() {
    // Find the first waiting queue
    const { data, error } = await supabase
        .from('queues')
        .select('id')
        .eq('shop_id', shopId)
        .eq('status', 'waiting')
        .order('queue_number', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (data) {
        callQueue(data.id);
    } else {
        showToast('No more queues waiting', 'info');
    }
}

async function updateShopName() {
    const newName = document.getElementById('input-shop-name').value;
    const { error } = await supabase
        .from('shops')
        .update({ name: newName })
        .eq('id', shopId);

    if (error) showToast('Failed to update shop', 'error');
    else {
        showToast('Shop name updated!');
        document.getElementById('current-shop-name').textContent = newName;
    }
}

async function clearAllQueues() {
    if (!confirm('ARE YOU SURE? This will clear all current queues and reset numbers.')) return;
    
    // In a real app, you might want to move these to a history table
    const { error } = await supabase
        .from('queues')
        .delete()
        .eq('shop_id', shopId);

    if (error) showToast('Failed to clear queues', 'error');
    else showToast('All queues cleared!', 'success');
}

function startRealtimeSubscription() {
    supabase
        .channel('admin-updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'queues', filter: `shop_id=eq.${shopId}` }, payload => {
            loadQueues();
        })
        .subscribe();
}

// Event Listeners
document.getElementById('btn-call-next').onclick = callNext;
document.getElementById('btn-update-shop').onclick = updateShopName;
document.getElementById('btn-clear-all').onclick = clearAllQueues;

// Init
initAdmin();
