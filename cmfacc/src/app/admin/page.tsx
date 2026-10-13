"use client";
import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { api, apiUrl, getApiBase } from "@/lib/api";

type Tab = "inquiries"|"products"|"inventory"|"documents"|"uploads"|"settings";
export default function AdminPage(){
  const [tab,setTab]=useState<Tab>("inquiries");
  const [apiBase,setApiBase]=useState("");
  const [health,setHealth]=useState<string>("ตรวจ...");
  const [inquiries,setInquiries]=useState<any[]>([]);
  const [products,setProducts]=useState<any[]>([]);
  const [inventory,setInventory]=useState<any[]>([]);
  const [docs,setDocs]=useState<any[]>([]);
  const [atts,setAtts]=useState<any[]>([]);
  const [q,setQ]=useState("");

  useEffect(()=>{
    setApiBase(getApiBase());
    api.health().then(r=> setHealth(r?.success? "D1 พร้อม":"Mock (ยังไม่ต่อ D1)"));
    loadAll();
  },[]);
  async function loadAll(){
    const [inq,prod,inv,d,at]=await Promise.all([api.listInquiries(), api.listProducts(), api.listInventory(), api.listDocuments("AR"), api.attachments()]);
    if(inq?.data) setInquiries(inq.data);
    if(prod?.data) setProducts(prod.data);
    if(inv?.data) setInventory(inv.data);
    if(d?.data) setDocs(d.data);
    if(at?.data) setAtts(at.data);
  }
  function saveBase(){
    localStorage.setItem("cmfacc_api_base", apiBase.trim());
    location.reload();
  }
  async function handleUpload(e:React.ChangeEvent<HTMLInputElement>, module:string){
    const f=e.target.files?.[0]; if(!f) return;
    try{ const r=await api.upload(f,module); Swal.fire({icon:'success', title:'อัปโหลดสำเร็จ', text:r.url, confirmButtonColor:'#0f1e3a', confirmButtonText:'ตกลง', timer:1800, timerProgressBar:true}); loadAll(); }catch(err:any){ Swal.fire({icon:'error', title:'อัปโหลดไม่สำเร็จ', text:err.message, confirmButtonColor:'#0f1e3a', confirmButtonText:'ตกลง'}); }
  }

  return (
    <div className="min-h-screen bg-[#f8f9fb] dark:bg-[#0a1430] p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white dark:bg-[#0f1e3a] rounded-xl border p-5 flex flex-wrap gap-4 items-center">
          <h1 className="text-xl font-bold flex-1">Admin — จัดการเมนู + อัปโหลด + D1</h1>
          <span className={`text-xs px-2 py-1 rounded ${health.includes("พร้อม")?"bg-emerald-100 text-emerald-700":"bg-amber-100 text-amber-700"}`}>{health}</span>
          <a href="/" className="text-sm text-[#0f1e3a] underline">← กลับหน้าเว็บ</a>
          <a href="/cmfacc/main.html" className="text-sm bg-[#0f1e3a] text-white px-3 py-1.5 rounded">เปิดระบบบัญชี</a>
        </div>

        <div className="bg-white dark:bg-[#0f1e3a] rounded-xl border p-4 flex flex-wrap gap-2 items-center">
          <span className="text-sm">API Base (Worker URL)</span>
          <input value={apiBase} onChange={e=>setApiBase(e.target.value)} placeholder="https://cmfacc-api.workers.dev หรือเว้นว่างใช้ /api" className="flex-1 min-w-[280px] px-3 py-2 border rounded text-sm"/>
          <button onClick={saveBase} className="px-4 py-2 bg-[#0f1e3a] text-white rounded text-sm">บันทึก</button>
          <span className="text-xs text-gray-500">ปัจจุบัน: {apiUrl("/api/health")||"/api/health"}</span>
        </div>

        <div className="flex gap-2 flex-wrap">
          {[
            ["inquiries","คำขอ (Inquiries)"],
            ["products","สินค้า (CMS)"],
            ["inventory","คลังเย็น"],
            ["documents","เอกสารบัญชี"],
            ["uploads","คลังอัปโหลด"],
            ["settings","ตั้งค่า"],
          ].map(([k,label])=>(
            <button key={k} onClick={()=>setTab(k as Tab)} className={`px-4 py-2 rounded-lg text-sm font-medium border ${tab===k?"bg-[#0f1e3a] text-white":"bg-white"}`}>{label}</button>
          ))}
        </div>

        {tab==="inquiries" && (
          <div className="bg-white dark:bg-[#0f1e3a] rounded-xl border p-5">
            <h3 className="font-bold mb-3">คำขอจากหน้าเว็บ (inquiries → D1)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 dark:bg-white/5"><th className="p-2 text-left">วันที่</th><th className="p-2 text-left">ชื่อ</th><th className="p-2">เบอร์</th><th className="p-2">สินค้า/ตัน</th><th className="p-2">ข้อความ</th></tr></thead>
                <tbody>{inquiries.length? inquiries.map((r:any)=><tr key={r.id} className="border-t"><td className="p-2">{r.created_at?.slice(0,16)}</td><td className="p-2">{r.name}</td><td className="p-2">{r.phone}</td><td className="p-2">{r.product_slug} {r.weight_tons&&`(${r.weight_tons} ตัน)`}</td><td className="p-2 max-w-[320px] truncate">{r.message}</td></tr>): <tr><td colSpan={5} className="p-6 text-center text-gray-400">ยังไม่มีคำขอ — ทดสอบส่งฟอร์มหน้าเว็บ</td></tr>}</tbody>
              </table>
            </div>
          </div>
        )}

        {tab==="products" && (
          <div className="bg-white dark:bg-[#0f1e3a] rounded-xl border p-5 space-y-4">
            <div className="flex items-center gap-2"><h3 className="font-bold flex-1">สินค้า CMS (cms_products)</h3><label className="px-3 py-1.5 bg-amber-100 rounded text-sm cursor-pointer">อัปโหลดรูป <input type="file" className="hidden" onChange={e=>handleUpload(e,"CMS")}/></label></div>
            <div className="grid md:grid-cols-2 gap-4">
              {products.map((p:any)=><div key={p.id} className="border rounded p-3"><div className="font-semibold">{p.name_th} — {p.name_en}</div><div className="text-xs text-gray-500">{p.temp} | {p.humidity}</div><div className="text-xs mt-1">{p.description_th?.slice(0,120)}</div>{p.image_url&&<img src={p.image_url} alt="" className="mt-2 w-full h-28 object-cover rounded"/>}</div>)}
            </div>
            {products.length===0 && <div className="text-center text-gray-400 py-6">ยังไม่มีสินค้า (seed 4 รายการจะขึ้นหลังต่อ D1)</div>}
          </div>
        )}

        {tab==="inventory" && (
          <div className="bg-white dark:bg-[#0f1e3a] rounded-xl border p-5">
            <div className="flex gap-2 mb-3"><h3 className="font-bold flex-1">สินค้าคงคลัง (inventory_items)</h3><label className="px-3 py-1.5 bg-brand-700 text-white rounded text-sm cursor-pointer">+ อัปโหลดรูป <input type="file" className="hidden" onChange={e=>handleUpload(e,"INV")}/></label></div>
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-gray-50"><th className="p-2 text-left">SKU</th><th className="p-2 text-left">ชื่อ</th><th className="p-2">คงเหลือ</th><th className="p-2">ต้นทุน</th></tr></thead><tbody>{inventory.map((r:any)=><tr key={r.sku} className="border-t"><td className="p-2 font-mono">{r.sku}</td><td className="p-2">{r.name_th}</td><td className="p-2 text-center">{r.qty_on_hand}</td><td className="p-2 text-center">{r.cost_per_unit}</td></tr>)} </tbody></table></div>
          </div>
        )}

        {tab==="documents" && (
          <div className="bg-white dark:bg-[#0f1e3a] rounded-xl border p-5">
            <div className="flex gap-2 mb-3"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="ค้นหาเลขที่/คู่ค้า" className="flex-1 px-3 py-2 border rounded text-sm"/><button onClick={async()=>{const r=await api.listDocuments("AR",q); if(r?.data) setDocs(r.data)}} className="px-4 py-2 bg-gray-100 rounded text-sm">ค้นหา AR</button><button onClick={async()=>{const r=await api.listDocuments("AP"); if(r?.data) setDocs(r.data)}} className="px-4 py-2 bg-gray-100 rounded text-sm">ดู AP</button><label className="px-3 py-2 bg-amber-100 rounded text-sm cursor-pointer">อัปโหลด <input type="file" className="hidden" onChange={e=>handleUpload(e,"DOC")}/></label></div>
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-gray-50"><th className="p-2 text-left">เลขที่</th><th className="p-2">วันที่</th><th className="p-2 text-left">คู่ค้า</th><th className="p-2 text-right">ยอดรวม</th><th className="p-2">สถานะ</th></tr></thead><tbody>{docs.map((d:any)=><tr key={d.id} className="border-t"><td className="p-2 font-mono">{d.doc_no}</td><td className="p-2">{d.doc_date}</td><td className="p-2">{d.partner_name} <span className="text-gray-400">{d.description}</span></td><td className="p-2 text-right">{Number(d.total_amount||0).toLocaleString()}</td><td className="p-2 text-center">{d.status}</td></tr>)} </tbody></table></div>
          </div>
        )}

        {tab==="uploads" && (
          <div className="bg-white dark:bg-[#0f1e3a] rounded-xl border p-5">
            <div className="flex gap-2 mb-3"><h3 className="font-bold flex-1">คลังไฟล์ (attachments → R2 + D1)</h3><label className="px-4 py-2 bg-[#0f1e3a] text-white rounded text-sm cursor-pointer">+ อัปโหลด <input type="file" className="hidden" onChange={e=>handleUpload(e,"GEN")}/></label></div>
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-gray-50"><th className="p-2 text-left">ไฟล์</th><th className="p-2">หมวด</th><th className="p-2">ขนาด</th><th className="p-2">วันที่</th></tr></thead><tbody>{atts.map((a:any)=><tr key={a.id} className="border-t"><td className="p-2"><a href={a.file_url} target="_blank" className="text-blue-600 underline">{a.file_name}</a></td><td className="p-2 text-center">{a.module}</td><td className="p-2 text-center">{(a.size_bytes/1024).toFixed(1)} KB</td><td className="p-2">{a.created_at?.slice(0,16)}</td></tr>)} </tbody></table></div>
            {atts.length===0 && <div className="text-center text-gray-400 py-8">ยังไม่มีไฟล์ — อัปโหลดเพื่อทดสอบ R2</div>}
          </div>
        )}

        {tab==="settings" && (
          <div className="bg-white dark:bg-[#0f1e3a] rounded-xl border p-5 space-y-3 text-sm">
            <h3 className="font-bold">วิธี Deploy ให้พร้อมใช้งานจริง (D1 Live)</h3>
            <ol className="list-decimal ml-5 space-y-1">
              <li>ติดตั้ง wrangler: <code className="bg-gray-100 px-1 rounded">npm i -g wrangler</code></li>
              <li>Login: <code className="bg-gray-100 px-1 rounded">npx wrangler login</code></li>
              <li>สร้าง D1: <code className="bg-gray-100 px-1 rounded">npx wrangler d1 create cmfacc_db</code> → ก๊อป database_id ไปใส่ wrangler.toml</li>
              <li>สร้าง R2: <code className="bg-gray-100 px-1 rounded">npx wrangler r2 bucket create cmfacc-uploads</code></li>
              <li>รันสคีมา: <code className="bg-gray-100 px-1 rounded">npx wrangler d1 execute cmfacc_db --file=./schema.sql</code></li>
              <li>Deploy Worker: <code className="bg-gray-100 px-1 rounded">cd worker && npx wrangler deploy</code> จะได้ URL เช่น https://cmfacc-api.xxx.workers.dev</li>
              <li>นำ URL ไปใส่ในกล่อง API Base ด้านบน และใน .env: <code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_API_BASE=https://...workers.dev</code> แล้ว build ใหม่</li>
              <li>ทดสอบ: อัปโหลดไฟล์ / สร้างเอกสาร / ส่งฟอร์มหน้าแรก → ข้อมูลจะเข้า D1 ทันที</li>
            </ol>
            <div className="p-3 bg-amber-50 rounded mt-3">ไฟล์สคีมา: <code>schema.sql</code> (14 ตาราง) ครอบคลุม 9 หมวดบัญชี + CMS + อัปโหลด</div>
          </div>
        )}
      </div>
    </div>
  );
}
