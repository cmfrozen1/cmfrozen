const fs = require('fs');
let code = fs.readFileSync('worker.js', 'utf8');

// 1. Add SHA-256 hash function
const hashFn = `
async function sha256(text) {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
`;
if (!code.includes('async function sha256')) {
    code = code.replace(/function randomToken/, hashFn + '\nfunction randomToken');
}

// 2. Modify handleLogin to check db and return is_superadmin
code = code.replace(
  /async function handleLogin\(request, env, input\) \{[\s\S]*?return json\(\{ success:true, token, username, message:"เข้าสู่ระบบสำเร็จ" \}, 200, \{[\s\S]*?\}\);\n\}/,
  `async function handleLogin(request, env, input) {
  const username = String(input.username||"").trim();
  const password = String(input.password||"").trim();
  const expectedUser = env.ADMIN_USER || "admin";
  const expectedPass = env.ADMIN_PASS || "fukupet2026";
  
  let ok = false;
  let is_superadmin = false;
  
  if (username===expectedUser && password===expectedPass) {
    ok = true;
    is_superadmin = true;
  } else {
    try {
      const row = await env.DB.prepare("SELECT password_hash FROM admin_users WHERE username = ? LIMIT 1").bind(username).first();
      if (row) {
        const hashed = await sha256(password);
        if (row.password_hash === hashed || row.password_hash === password) { // allow plain for old seed fallback just in case
          ok = true;
        }
      }
    } catch {}
  }
  
  if (!ok) return json({ success:false, error:"ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, 401);
  const token = randomToken(32);
  const expiresAt = new Date(Date.now()+7*24*60*60*1000).toISOString().slice(0,19).replace("T"," ");
  await ensureTables(env);
  await env.DB.prepare("INSERT INTO sessions (token, username, expires_at) VALUES (?, ?, ?)").bind(token, username, expiresAt).run();
  return json({ success:true, token, username, is_superadmin, message:"เข้าสู่ระบบสำเร็จ" }, 200, {
    "Set-Cookie": \`admin_token=\${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800\`
  });
}`
);

// 3. Modify handleCheckAuth to return is_superadmin
code = code.replace(
  /async function handleCheckAuth\(request, env\) \{\s*const auth = await isAdminAuthenticated\(request, env\);\s*return json\(\{ logged_in: auth\.ok, username: auth\.username\|\|null \}\);\s*\}/,
  `async function handleCheckAuth(request, env) {
  const auth = await isAdminAuthenticated(request, env);
  const expectedUser = env.ADMIN_USER || "admin";
  const is_superadmin = auth.username === expectedUser;
  return json({ logged_in: auth.ok, username: auth.username||null, is_superadmin });
}`
);

// 4. Add handlers for get_admin_users, create_admin_user, delete_admin_user
const handlers = `
async function handleGetAdminUsers(request, env) {
  const auth = await isAdminAuthenticated(request, env);
  const expectedUser = env.ADMIN_USER || "admin";
  if (!auth.ok || auth.username !== expectedUser) return json({ success:false, error:"Permission denied" }, 403);
  try {
    const { results } = await env.DB.prepare("SELECT id, username, display_name, created_at FROM admin_users ORDER BY id DESC").all();
    return json({ success:true, data: results });
  } catch(e) { return json({ success:false, error:String(e) }, 500); }
}

async function handleCreateAdminUser(request, env, input) {
  const auth = await isAdminAuthenticated(request, env);
  const expectedUser = env.ADMIN_USER || "admin";
  if (!auth.ok || auth.username !== expectedUser) return json({ success:false, error:"Permission denied" }, 403);
  const username = String(input.username||"").trim();
  const password = String(input.password||"").trim();
  const display_name = String(input.display_name||"").trim();
  if (!username || !password) return json({ success:false, error:"Username and password required" }, 400);
  try {
    const hash = await sha256(password);
    await env.DB.prepare("INSERT INTO admin_users (username, password_hash, display_name) VALUES (?, ?, ?)").bind(username, hash, display_name).run();
    return json({ success:true, message:"สร้างผู้ใช้งานสำเร็จ" });
  } catch(e) { return json({ success:false, error:String(e) }, 500); }
}

async function handleDeleteAdminUser(request, env, input) {
  const auth = await isAdminAuthenticated(request, env);
  const expectedUser = env.ADMIN_USER || "admin";
  if (!auth.ok || auth.username !== expectedUser) return json({ success:false, error:"Permission denied" }, 403);
  const id = input.id;
  if (!id) return json({ success:false, error:"ID required" }, 400);
  try {
    await env.DB.prepare("DELETE FROM admin_users WHERE id = ?").bind(id).run();
    return json({ success:true, message:"ลบผู้ใช้งานสำเร็จ" });
  } catch(e) { return json({ success:false, error:String(e) }, 500); }
}

// Main fetch
`;

code = code.replace(/\/\/ Main fetch/, handlers);

// 5. Add routes to main switch statement
code = code.replace(
  /case "check_auth": return await handleCheckAuth\(request, env\);/,
  `case "check_auth": return await handleCheckAuth(request, env);
            case "get_admin_users": return await handleGetAdminUsers(request, env);
            case "create_admin_user": {
              const input = await getJsonInput();
              return await handleCreateAdminUser(request, env, input);
            }
            case "delete_admin_user": {
              const input = await getJsonInput();
              return await handleDeleteAdminUser(request, env, input);
            }`
);

fs.writeFileSync('worker.js', code);
