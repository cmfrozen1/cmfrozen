import React, { useEffect, useState } from "react";
import axios from "axios";

interface DashboardData {
  todaySales: number;
  todayBills: number;
  totalProducts: number;
  totalStockValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  bestSellingProducts: BestSellingProduct[];
  salesLast7Days: SalesHistory[];
  categories: Category[];
}

interface BestSellingProduct {
  id: number;
  name: string;
  sku: string;
  totalSold: number;
  revenue: number;
}

interface SalesHistory {
  date: string;
  sales: number;
  bills: number;
}

interface Category {
  id: number;
  name: string;
}

const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch from backend API
        const response = await axios.get("http://localhost:3000/api/dashboard", {
          timeout: 10000
        });
        setData(response.data);
      } catch (err: any) {
        setError(err.message || "Failed to fetch dashboard data");
        // Try with mock data if backend not available
        setData(mockDashboardData());
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-200 mx-auto mb-4"></div>
        <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <p className="text-red-600 text-sm mb-4">เกิดข้อผิดพลาด: {error}</p>
        <button
          onClick={() => {
            window.location.reload();
          }}
          className="mt-2 bg-blue-500 text-white px-4 py-2 rounded"
        >
          รีเซ็ต
        </button>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Today's Sales Card */}
          <div className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">ยอดขายวันนี้</p>
                <p className="text-2xl font-bold text-blue-600">{data.todaySales.toLocaleString()} THB</p>
              </div>
              <div className="text-blue-500">
                <svg
                  className="w-6 h-6"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M3 12l2-2m0 0l7-7 2 2M5 10l7-7 2 2M1 6l2-2m0 0l7-7 2 2M19 14l2-2m0 0l-2-2m0 0l7 7 2-2M21 18l-2-2m0 0l-7 7-2-2M9 19l2-2m0 0l2 2m-2-2l2 2" />
                </svg>
              </div>
            </div>
          </div>

          {/* Today's Bills Card */}
          <div className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">จำนวนบิลวันนี้</p>
                <p className="text-2xl font-bold text-green-600">{data.todayBills}</p>
              </div>
              <div className="text-green-500">
                <svg
                  className="w-6 h-6"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 7v6l4 2-4 2v6H5V5zm0 4h6v6H11v-6zm6 0v6h2v-6h-2v-6h2v-6h-2v6zm4-16l2.286 6.857L32 31l6-18L24 3l-6 18L8 3z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Total Products Card */}
          <div className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">จำนวนสินค้าทั้งหมด</p>
                <p className="text-2xl font-bold text-purple-600">{data.totalProducts}</p>
              </div>
              <div className="text-purple-500">
                <svg
                  className="w-6 h-6"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2L2 7l10 5 5-10L12 2zm5.06 6L17 6h2v4h-2V6zm-4.94 6L7 6H5v4h2V6zm4.4 4L14 14h6v4h-6V14zM14 4h6v4h-6V4zm4 8V12h2v8h-2V12zm-2-4h2v4h-2V8z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Total Stock Value Card */}
          <div className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">มูลค่าสินค้าคงเหลือ</p>
                <p className="text-2xl font-bold text-orange-600">{data.totalStockValue.toLocaleString()} THB</p>
              </div>
              <div className="text-orange-500">
                <svg
                  className="w-6 h-6"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v3.5l4.85 4.85a2 2 0 0 0 1.42 0L20 9.5V4a2 2 0 0 0-2-2zM4 18.5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4.5l-1.018 5.76a2 2 0 0 1-1.73 1.017l-4.5-1.255a8 8 0 0 0-5.988 7.977L4 18.5z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <p className="text-sm text-gray-500">สินค้าใกล้หมด</p>
            <p className="text-3xl font-bold text-red-600">{data.lowStockItems}</p>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <p className="text-sm text-gray-500">สินค้าหมด</p>
            <p className="text-3xl font-bold text-gray-800">{data.outOfStockItems}</p>
          </div>
        </div>

        {/* Best Selling Products */}
        <div className="bg-white rounded-lg p-6 shadow-sm mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">สินค้าขายดี</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">สินค้า</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">จำนวนที่ขาย</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">ยอดขาย</th>
                </tr>
              </thead>
              <tbody>
                {data.bestSellingProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="text-gray-900 px-6 py-4">
                      <div className="flex items-center">
                        <span className="font-medium">{product.name}</span>
                      </div>
                    </td>
                    <td className="text-gray-500 px-6 py-4">{product.totalSold}</td>
                    <td className="text-gray-500 px-6 py-4">
                      {product.revenue.toLocaleString()} THB
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 7-Day Sales History */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-800 mb-4">ยอดขายย้อนหลัง 7 วัน</h2>
          <div className="h-64 overflow-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">วัน</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">ยอดขาย</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">จำนวนบิล</th>
                </tr>
              </thead>
              <tbody>
                {data.salesLast7Days.map((sale) => (
                  <tr key={sale.date} className="hover:bg-gray-50">
                    <td className="text-gray-900 px-6 py-4">{sale.date}</td>
                    <td className="text-gray-500 px-6 py-4">
                      {sale.sales.toLocaleString()} THB
                    </td>
                    <td className="text-gray-500 px-6 py-4">{sale.bills}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// Mock data function when backend is not available
const mockDashboardData = (): DashboardData => ({
  todaySales: 15450,
  todayBills: 28,
  totalProducts: 156,
  totalStockValue: 85420,
  lowStockItems: 12,
  outOfStockItems: 5,
  bestSellingProducts: [
    { id: 1, name: "ชาเขียวเย็น", sku: "CHA-001", totalSold: 150, revenue: 4500 },
    { id: 2, name: "กาแฟร้อน", sku: "KAF-003", totalSold: 120, revenue: 3600 },
    { id: 3, name: "เครื่องดื่มลูกท้อ", sku: "DRK-005", totalSold: 98, revenue: 2940 },
  ],
  salesLast7Days: [
    { date: "เมื่อวาน", sales: 8500, bills: 15 },
    { date: "2 วันก่อน", sales: 6200, bills: 12 },
    { date: "3 วันก่อน", sales: 7100, bills: 13 },
    { date: "4 วันก่อน", sales: 5800, bills: 11 },
    { date: "5 วันก่อน", sales: 6700, bills: 14 },
    { date: "6 วันก่อน", sales: 7500, bills: 16 },
    { date: "สัปดาห์ที่แล้ว", sales: 45000, bills: 82 },
  ],
  categories: [
    { id: 1, name: "ชา" },
    { id: 2, name: "กาแฟ" },
    { id: 3, name: "เครื่องดื่ม" },
    { id: 4, name: "ขนม" },
    { id: 5, name: "วัตถุดิบ" },
    { id: 6, name: "อุปกรณ์" },
  ],
});

export default Dashboard;
export { mockDashboardData };