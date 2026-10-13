// Central API client for D1 Worker — ใช้ได้ทั้ง Landing + Accounting
// ตั้งค่า URL ผ่าน NEXT_PUBLIC_API_BASE หรือ localStorage cmfacc_api_base
export function getApiBase(): string {
  if (typeof window !== "undefined") {
    const ls = localStorage.getItem("cmfacc_api_base");
    if (ls) return ls.replace(/\/$/, "");
  }
  return (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/$/, "");
}
export function apiUrl(path: string): string {
  const base = getApiBase();
  return base ? `${base}${path}` : path; // ถ้าเว้นว่าง → /api (Pages Functions / proxy)
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T | null> {
  try {
    const r = await fetch(apiUrl(path), {
      ...opts,
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return (await r.json()) as T;
  } catch (e) {
    console.warn("[api] fallback/mock", path, (e as Error).message);
    return null;
  }
}

// Types
export type InquiryPayload = {
  name: string; phone: string; email?: string; company?: string;
  product_slug?: string; weight_tons?: number; destination?: string; message?: string;
};

export const api = {
  health: () => req<{success:boolean}>("/api/health"),
  login: (username:string,password:string) => req<{success:boolean,token:string,user:any}>("/api/auth/login",{method:"POST",body:JSON.stringify({username,password})}),
  upload: async (file: File, module="GEN", ref_id?: string) => {
    const fd = new FormData();
    fd.append("file", file); fd.append("module", module);
    if (ref_id) fd.append("ref_id", ref_id);
    const r = await fetch(apiUrl("/api/upload"), { method:"POST", body: fd });
    if (!r.ok) throw new Error("อัปโหลดล้มเหลว");
    return r.json();
  },
  listDocuments: (module:string, q?:string) => req<{success:boolean,data:any[]}>(`/api/documents?module=${module}${q?`&q=${encodeURIComponent(q)}`:""}`),
  createDocument: (body:any) => req<{success:boolean,data:any}>("/api/documents",{method:"POST",body:JSON.stringify(body)}),
  listCustomers: (q?:string) => req<{success:boolean,data:any[]}>(`/api/customers${q?`?q=${encodeURIComponent(q)}`:""}`),
  listVendors: (q?:string) => req<{success:boolean,data:any[]}>(`/api/vendors${q?`?q=${encodeURIComponent(q)}`:""}`),
  listInventory: () => req<{success:boolean,data:any[]}>("/api/inventory"),
  createInventory: (body:any) => req<{success:boolean,data:any}>("/api/inventory",{method:"POST",body:JSON.stringify(body)}),
  listProducts: () => req<{success:boolean,data:any[]}>("/api/cms/products"),
  createInquiry: (body: InquiryPayload) => req<{success:boolean,message:string}>("/api/inquiries",{method:"POST",body:JSON.stringify(body)}),
  listInquiries: () => req<{success:boolean,data:any[]}>("/api/inquiries"),
  dashboard: () => req<{success:boolean,data:any}>("/api/dashboard/summary"),
  attachments: (module?:string) => req<{success:boolean,data:any[]}>(`/api/attachments${module?`?module=${module}`:""}`),
  chartAccounts: () => req<{success:boolean,data:any[]}>("/api/chart-accounts"),
  systemParams: () => req<{success:boolean,data:any[]}>("/api/system-params"),
};
