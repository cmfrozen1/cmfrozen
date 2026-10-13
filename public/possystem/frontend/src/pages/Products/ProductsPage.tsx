import React, { useState, useEffect } from "react";
import axios from "axios";

interface Product {
  id: number;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  categoryId: number | null;
  unit: string;
  costPrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  imageUrl: string | null;
  status: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  categoryName: string;
}

interface Category {
  id: number;
  name: string;
}

const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch products from backend
      const productsResponse = await axios.get("http://localhost:3000/api/products", {
        params: { search: setSearch || undefined }
      });
      setProducts(productsResponse.data.data || []);

      // Fetch categories
      const categoriesResponse = await axios.get("http://localhost:3000/api/categories");
      setCategories(categoriesResponse.data || []);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "Failed to fetch products");
      setLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setProducts([]);
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const categoryId = Number(e.target.value);
    setSelectedCategory(categoryId);
    setProducts([]);
  };

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
          onClick={() => window.location.reload()}
          className="mt-2 bg-blue-500 text-white px-4 py-2 rounded"
        >
          รีเซ็ต
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen p-4">
      <div className="max-w-2xl mx-auto mb-6">
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <h2 className="text-xl font-bold text-gray-800 mb-4">จัดการสินค้า</h2>
          
          {/* Search Bar */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ค้นหาสินค้าโดยใช้ชื่อหรือ SKU
            </label>
            <input
              type="text"
              value={search}
              onChange={handleSearch}
              placeholder="พิมพ์ชื่อสินค้าหรือ SKU..."
              className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Category Filter */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              กรองตามหมวดหมู่
            </label>
            <select
              value={selectedCategory || ""}
              onChange={handleCategoryChange}
              className="w-full px-4 py-2 border rounded"
            >
              <option value="">ทั้งหมด</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="max-w-4xl mx-auto">
        {products.length === 0 ? (
          <p className="text-center text-gray-600 py-8">ไม่พบสินค้าที่แสดงผล</p> :
          (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">
                      SKU
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">
                      รหัสวิเคราะห์
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">
                      ชื่อสินค้า
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">
                      หมวดหมู่
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">
                      คงเหลือ
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">
                      ราคาขาย
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">การกระทำ</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="text-gray-900 px-6 py-4">{product.sku}</td>
                      <td className="text-gray-500 px-6 py-4">{product.barcode || "N/A"}</td>
                      <td className="text-gray-900 px-6 py-4">
                        <div className="flex items-center">
                          <span className="font-medium">{product.name}</span>
                        </div>
                      </div>
                      </td>
                      <td className="text-gray-500 px-6 py-4">{product.categoryName || "ไม่มีหมวดหมู่"}</td>
                      <td className="text-gray-500 px-6 py-4">
                        {product.stock} {product.unit}
                      </td>
                      <td className="text-gray-500 px-6 py-4">
                        {product.salePrice.toLocaleString()} THB
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => window.alert(`เลือกสินค้า: ${product.name}`)}
                          className="text-blue-600 hover underline text-sm"
                        >
                          เลือก
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductsPage;