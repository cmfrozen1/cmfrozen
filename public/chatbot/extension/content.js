// LINE BOT MCP — content script widget มุมขวาล่าง
(function(){
  if (document.getElementById('lmc-widget-btn')) return;
  // กันกรณี extension context invalidated
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.getURL) return;

  const btn = document.createElement('button');
  btn.id = 'lmc-widget-btn';
  btn.title = 'LINE BOT MCP — เปิดแชท (มุมขวาล่าง)';
  btn.innerHTML = '💬';
  btn.style.fontFamily = 'Inter, sans-serif';

  const frame = document.createElement('iframe');
  frame.id = 'lmc-widget-frame';
  try {
    frame.src = chrome.runtime.getURL('popup.html');
  } catch(e) { return; }
  frame.allow = 'clipboard-write';
  frame.title = 'LINE BOT MCP';

  let open = false;
  function setOpen(v){
    open = v;
    frame.classList.toggle('open', open);
    btn.innerHTML = open ? '✕' : '💬';
    btn.title = open ? 'ปิด' : 'LINE BOT MCP — เปิดแชท';
  }

  btn.addEventListener('click', ()=> setOpen(!open));
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape' && open) setOpen(false); });

  // แจ้ง badge จาก background มาอัปเดตปุ่ม (ถ้ามี unread)
  try {
    chrome.storage.onChanged.addListener((changes, area)=>{
      if (area==='local' && changes.lineBotLastKey) {
        btn.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25), 0 0 0 3px #ff3b30';
        setTimeout(()=> btn.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)', 2000);
      }
    });
  } catch(_){}

  const mount = document.body || document.documentElement;
  mount.appendChild(btn);
  mount.appendChild(frame);
})();
