// Client Side Logic (LINE LIFF)
let currentUser = null;
let currentQueue = null;
let selectedCharacterId = null;
let shopId = null;

async function initClient() {
    try {
        // 1. Initialize LIFF
        // await liff.init({ liffId: "YOUR_LIFF_ID" });
        // if (!liff.isLoggedIn()) {
        //     liff.login();
        //     return;
        // }
        // const profile = await liff.getProfile();
        // currentUser = profile;
        
        // Mocking for development
        currentUser = { userId: 'line-user-123', displayName: 'Mock User', pictureUrl: '' };

        // 2. Load Shop Info
        const slug = getQueryParam('shop') || 'demo-shop';
        const { data: shop, error: shopError } = await supabase
            .from('shops')
            .select('*')
            .eq('slug', slug)
            .single();

        if (shopError || !shop) {
            showToast('Shop not found', 'error');
            return;
        }
        shopId = shop.id;
        document.getElementById('shop-name').textContent = shop.name;

        // 3. Check for existing queue
        await checkExistingQueue();

        // 4. Load Characters
        await loadCharacters();

        document.getElementById('loading').classList.add('hidden');
        if (currentQueue) {
            showView('ticket-view');
            startRealtimeSubscription();
        } else {
            showView('login-view');
        }

    } catch (err) {
        console.error(err);
        showToast('Initialization failed', 'error');
    }
}

async function checkExistingQueue() {
    const { data, error } = await supabase
        .from('queues')
        .select('*')
        .eq('line_user_id', currentUser.userId)
        .eq('shop_id', shopId)
        .in('status', ['waiting', 'called'])
        .maybeSingle();

    if (data) {
        currentQueue = data;
        updateTicketUI();
    }
}

async function loadCharacters() {
    const { data: characters } = await supabase.from('characters').select('*');
    const list = document.getElementById('character-list');
    list.innerHTML = '';
    
    characters.forEach(char => {
        const div = document.createElement('div');
        div.className = `cursor-pointer p-1 rounded border-2 border-transparent hover:border-yellow-400 transition-all ${selectedCharacterId === char.id ? 'border-yellow-400 bg-gray-700' : ''}`;
        div.onclick = () => selectCharacter(char.id);
        
        // Character Sprite Preview (Placeholder logic)
        div.innerHTML = `
            <div class="h-12 w-12 mx-auto bg-center bg-no-repeat bg-contain" style="background-image: url('${char.sprite_url}'); filter: ${char.config.filter_css}"></div>
            <p class="text-[8px] text-center mt-1 truncate">${char.name}</p>
        `;
        list.appendChild(div);
    });
}

function selectCharacter(id) {
    selectedCharacterId = id;
    loadCharacters(); // Re-render to show selection
}

async function joinQueue() {
    const nickname = document.getElementById('nickname').value;
    if (!nickname) {
        showToast('Please enter a nickname', 'error');
        return;
    }
    if (!selectedCharacterId) {
        showToast('Please select a character', 'error');
        return;
    }

    const { data, error } = await supabase
        .from('queues')
        .insert({
            shop_id: shopId,
            line_user_id: currentUser.userId,
            display_name: nickname,
            character_id: selectedCharacterId,
            status: 'waiting'
        })
        .select()
        .single();

    if (error) {
        showToast('Registration failed', 'error');
    } else {
        currentQueue = data;
        showToast('Successfully joined!', 'success');
        showView('ticket-view');
        updateTicketUI();
        startRealtimeSubscription();
    }
}

function updateTicketUI() {
    if (!currentQueue) return;
    document.getElementById('queue-number').textContent = currentQueue.queue_number.toString().padStart(2, '0');
    document.getElementById('queue-status').textContent = currentQueue.status.toUpperCase();
    
    if (currentQueue.status === 'called') {
        document.getElementById('queue-status').className = 'bg-green-500 text-white px-2 py-1 inline-block text-xs font-bold rounded animate-pulse';
        showToast('It is your turn!', 'success');
    } else {
        document.getElementById('queue-status').className = 'bg-black text-white px-2 py-1 inline-block text-xs font-bold rounded';
    }
    
    updateAwaitingCount();
}

async function updateAwaitingCount() {
    const { count } = await supabase
        .from('queues')
        .select('*', { count: 'exact', head: true })
        .eq('shop_id', shopId)
        .eq('status', 'waiting')
        .lt('queue_number', currentQueue.queue_number);
    
    document.getElementById('ahead-count').textContent = count;
    document.getElementById('est-wait').textContent = (count * 5) + ' MIN'; // Assuming 5 mins per person
}

function startRealtimeSubscription() {
    supabase
        .channel('queue-updates')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'queues', filter: `id=eq.${currentQueue.id}` }, payload => {
            currentQueue = payload.new;
            updateTicketUI();
        })
        .subscribe();
}

async function cancelQueue() {
    if (!confirm('Cancel your queue?')) return;
    
    const { error } = await supabase
        .from('queues')
        .update({ status: 'cancelled' })
        .eq('id', currentQueue.id);

    if (!error) {
        currentQueue = null;
        showView('login-view');
        showToast('Queue cancelled');
    }
}

function showView(viewId) {
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('ticket-view').classList.add('hidden');
    document.getElementById(viewId).classList.remove('hidden');
}

// Event Listeners
document.getElementById('btn-join').onclick = joinQueue;
document.getElementById('btn-cancel').onclick = cancelQueue;

// Init
initClient();
