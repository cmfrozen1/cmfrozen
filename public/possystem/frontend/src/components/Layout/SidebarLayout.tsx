import React from "react";

interface NavItem {
  key: string;
  path: string;
  title: string;
}

const navItems: NavItem[] = [
  { key: "dashboard", path: "/", title: "หน้าหลัก" },
  { key: "products", path: "/products", title: "จัดการสินค้า" },
  { key: "pos", path: "/pos", title: "ขายสินค้า" },
  { key: "purchase", path: "/purchase", title: "รับสินค้าเข้า" },
  { key: "stock-out", path: "/stock-out", title: "จ่ายสินค้าออก" },
  { key: "stock", path: "/stock", title: "สต๊อกสินค้า" },
  { key: "sales-history", path: "/sales-history", title: "ประวัติการขาย" },
  { key: "reports", path: "/reports", title: "รายงาน" },
  { key: "settings", path: "/settings", title: "ตั้งค่าระบบ" },
];

const SidebarLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white min-h-screen flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center">
            <h1 className="text-xl font-bold mr-2">POS จิหลาด</h1>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto">
          <ul className="space-y-2 px-2">
            {navItems.map((item) => (
              <li
                key={item.key}
                className={`hover:bg-gray-800 rounded-md p-2 transition-colors cursor-pointer ${window.location.pathname === item.path ? "bg-gray-800 text-white" : "text-gray-300"}`}
                onClick={() => {
                  window.location.href = item.path;
                }}
              >
                <span className="block">{item.title}</span>
              </li>
            ))
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

export { navItems };
export default SidebarLayout;