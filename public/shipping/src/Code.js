// -------------------- ค่าคงที่ (ค่าเริ่มต้น) --------------------
const DEFAULT_ADMIN_IDS = ["Udb77ae3a9c2b66ac096e950dfa6975d0"];
const DEFAULT_DRIVE_FOLDER_ID = "1EeAbpHtFseMeb9zVxDxTdoW5GOKKNPyN";
const DEFAULT_SLIP_FOLDER_ID = "1GTTGi9P5-2dp08Q-ca4y9jKVwyn_UFwF";

// -------------------- DO GET --------------------
function doGet(e) {
  if (e && e.parameter && e.parameter.action === "getProducts") return getProductsAPI();
  if (e && e.parameter && e.parameter.action === "getUserProfile") return handleGetUserProfile(e);
  if (e && e.parameter && e.parameter.action === "getUserOrders") return handleGetUserOrders(e);
  if (e && e.parameter && e.parameter.action === "setupDatabase") return handleSetupDatabase();
  if (e && e.parameter && e.parameter.action === "getAllOrders") return handleGetAllOrders(e);
  if (e && e.parameter && e.parameter.action === "checkAdmin") return handleCheckAdmin(e);
  if (e && e.parameter && e.parameter.action === "getCategories") return handleGetCategories(e);
  if (e && e.parameter && e.parameter.action === "getAllCategories") return handleGetAllCategories(e);
  if (e && e.parameter && e.parameter.action === "getAllUsers") return handleGetAllUsers(e);
  if (e && e.parameter && e.parameter.action === "getSettings") return handleGetSettings();
  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle("E-Shop Thailand")
    .addMetaTag("viewport", "width=device-width, initial-scale=1, viewport-fit=cover")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// -------------------- DO POST --------------------
function doPost(e) {
  try {
    const action = e.parameter ? e.parameter.action : null;
    if (action === "saveUserProfile") return handleSaveUserProfile(e);
    if (action === "updateUserProfile") return handleUpdateUserProfile(e);
    if (action === "updateOrderStatus") return handleUpdateOrderStatus(e);
    if (action === "addProduct") return handleAddProduct(e);
    if (action === "updateProduct") return handleUpdateProduct(e);
    if (action === "deleteProduct") return handleDeleteProduct(e);
    if (action === "uploadImage") return handleUploadImage(e);
    if (action === "addCategory") return handleAddCategory(e);
    if (action === "updateCategory") return handleUpdateCategory(e);
    if (action === "deleteCategory") return handleDeleteCategory(e);
    if (action === "updateUserRole") return handleUpdateUserRole(e);
    if (action === "saveBotToken") return handleSaveBotToken(e);
    if (action === "saveAdminIds") return handleSaveAdminIds(e);
    if (action === "saveStoreName") return handleSaveStoreName(e);
    if (action === "savePromptPay") return handleSavePromptPay(e);
    if (action === "saveBankName") return handleSaveBankName(e);
    if (action === "saveBankAccountName") return handleSaveBankAccountName(e);
    if (action === "saveBankAccountNumber") return handleSaveBankAccountNumber(e);
    if (action === "saveDriveFolder") return handleSaveDriveFolder(e);
    if (action === "saveSlipFolder") return handleSaveSlipFolder(e);
    if (action === "uploadSlip") return handleUploadSlip(e);
    if (action === "sendSlipNotify") return handleSendSlipNotify(e);
    if (action === "testMessagingAPI") return handleTestMessagingAPI(e);
    if (action === "saveOrder") return handleSaveOrder(e);
    return errorResponse("Action not found: " + action);
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// -------------------- SETUP DATABASE --------------------
function handleSetupDatabase() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const results = [];

    let productsSheet = ss.getSheetByName("Products");
    if (!productsSheet) {
      productsSheet = ss.insertSheet("Products");
      productsSheet.appendRow(["ID", "Name", "Category", "Price", "Image", "Status", "Stock"]);
      productsSheet.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#f43f5e").setFontColor("#ffffff");
      const sample = [
        ["P001", "เสื้อเชิ้ตผู้ชายคอปก", "เสื้อผ้า", 399, "https://picsum.photos/id/20/200/200", "active", 10],
        ["P002", "กางเกงยีนส์สลิมฟิต", "เสื้อผ้า", 599, "https://picsum.photos/id/26/200/200", "active", 10],
        ["P003", "รองเท้าผ้าใบสไตล์วินเทจ", "รองเท้า", 899, "https://picsum.photos/id/0/200/200", "active", 10]
      ];
      sample.forEach(p => productsSheet.appendRow(p));
      results.push("✅ สร้าง Products");
    } else {
      ensureProductsSheet_(ss);
    }

    let categoriesSheet = ss.getSheetByName("Categories");
    if (!categoriesSheet) {
      categoriesSheet = ss.insertSheet("Categories");
      categoriesSheet.appendRow(["ID", "Name", "Status"]);
      categoriesSheet.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#f43f5e").setFontColor("#ffffff");
      const sampleCat = [
        ["CAT001", "เสื้อผ้า", "active"],
        ["CAT002", "รองเท้า", "active"],
        ["CAT003", "เครื่องประดับ", "active"],
        ["CAT004", "กระเป๋า", "active"],
        ["CAT005", "ของใช้", "active"],
        ["CAT006", "อิเล็กทรอนิกส์", "active"]
      ];
      sampleCat.forEach(c => categoriesSheet.appendRow(c));
      results.push("✅ สร้าง Categories");
    }

    let ordersSheet = ss.getSheetByName("Orders");
    if (!ordersSheet) {
      ordersSheet = ss.insertSheet("Orders");
      ordersSheet.appendRow([
        "Order ID", "Timestamp", "Name", "Email", "Phone", "Address",
        "LineID", "LineName", "Items", "Total", "Status",
        "StockStatus", "PaymentMethod", "SlipURL", "TrackingLink", "DeliveryNote"
      ]);
      ordersSheet.getRange(1, 1, 1, 16).setFontWeight("bold").setBackground("#f43f5e").setFontColor("#ffffff");
      results.push("✅ สร้าง Orders");
    } else {
      ensureOrdersSheet_(ss);
    }

    let usersSheet = ss.getSheetByName("Users");
    if (!usersSheet) {
      usersSheet = ss.insertSheet("Users");
      usersSheet.appendRow([
        "LineID", "LineName", "DisplayName", "Email", "Phone", "Address",
        "PictureUrl", "TotalSpent", "OrderCount", "LastOrder",
        "CreatedAt", "UpdatedAt", "IsAdmin"
      ]);
      usersSheet.getRange(1, 1, 1, 13).setFontWeight("bold").setBackground("#f43f5e").setFontColor("#ffffff");
      results.push("✅ สร้าง Users");
    }

    let settingsSheet = ss.getSheetByName("Settings");
    if (!settingsSheet) {
      settingsSheet = ss.insertSheet("Settings");
      settingsSheet.appendRow(["Key", "Value", "Description"]);
      settingsSheet.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#f43f5e").setFontColor("#ffffff");
      settingsSheet.appendRow(["BOT_TOKEN", "", "LINE Bot Token"]);
      settingsSheet.appendRow(["ADMIN_IDS", DEFAULT_ADMIN_IDS.join(","), "Admin LINE IDs"]);
      settingsSheet.appendRow(["STORE_NAME", "E-Shop Thailand", "ชื่อร้านค้า"]);
      settingsSheet.appendRow(["PROMPTPAY_PHONE", "", "เบอร์ PromptPay"]);
      settingsSheet.appendRow(["BANK_NAME", "", "ชื่อธนาคาร"]);
      settingsSheet.appendRow(["BANK_ACCOUNT_NAME", "", "ชื่อบัญชี"]);
      settingsSheet.appendRow(["BANK_ACCOUNT_NUMBER", "", "เลขบัญชี"]);
      settingsSheet.appendRow(["DRIVE_FOLDER_ID", DEFAULT_DRIVE_FOLDER_ID, "Folder ID สำหรับรูปสินค้า"]);
      settingsSheet.appendRow(["SLIP_FOLDER_ID", DEFAULT_SLIP_FOLDER_ID, "Folder ID สำหรับสลิป"]);
      results.push("✅ สร้าง Settings");
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: results.join("\n")
    })).setMimeType(ContentService.MimeType.JSON);
  } catch(e) {
    return errorResponse(e.toString());
  }
}

// -------------------- Helper: Products Header --------------------
function getProductHeaders_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return {
    id: headers.indexOf("ID"),
    name: headers.indexOf("Name"),
    category: headers.indexOf("Category"),
    price: headers.indexOf("Price"),
    image: headers.indexOf("Image"),
    status: headers.indexOf("Status"),
    stock: headers.indexOf("Stock")
  };
}

function ensureProductsSheet_(ss) {
  let sheet = ss.getSheetByName("Products");
  if (!sheet) {
    sheet = ss.insertSheet("Products");
    sheet.appendRow(["ID", "Name", "Category", "Price", "Image", "Status", "Stock"]);
    sheet.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#f43f5e").setFontColor("#ffffff");
    return sheet;
  }
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (headers.indexOf("Stock") === -1) {
    const newCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, newCol).setValue("Stock");
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      sheet.getRange(2, newCol, lastRow - 1, 1).setValue(10);
    }
  }
  return sheet;
}

// -------------------- PRODUCTS API --------------------
function getProductsAPI() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ensureProductsSheet_(ss);
    const idx = getProductHeaders_(sheet);
    const data = sheet.getDataRange().getValues();
    const products = [];
    for (let i = 1; i < data.length; i++) {
      const status = data[i][idx.status] || "active";
      if (data[i][idx.id] && status === "active") {
        products.push({
          id: data[i][idx.id],
          name: data[i][idx.name],
          category: data[i][idx.category],
          price: Number(data[i][idx.price]),
          image: data[i][idx.image],
          stock: Number(data[i][idx.stock]) || 0
        });
      }
    }
    return successResponse("", { products: products });
  } catch(e) {
    return errorResponse(e.toString());
  }
}

function handleAddProduct(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ensureProductsSheet_(ss);
    const adminLineId = e.parameter.adminLineId || "";
    if (!isUserAdmin(adminLineId)) return errorResponse("ไม่มีสิทธิ์");
    
    const idx = getProductHeaders_(sheet);
    const newId = e.parameter.id || "P" + new Date().getTime();
    const name = e.parameter.name || "";
    const category = e.parameter.category || "";
    const price = parseFloat(e.parameter.price) || 0;
    const image = e.parameter.image || "";
    const status = e.parameter.status || "active";
    const stock = Math.max(0, parseInt(e.parameter.stock, 10) || 0);
    
    const maxCol = sheet.getLastColumn();
    const newRow = new Array(maxCol).fill("");
    newRow[idx.id] = newId;
    newRow[idx.name] = name;
    newRow[idx.category] = category;
    newRow[idx.price] = price;
    newRow[idx.image] = image;
    newRow[idx.status] = status;
    if (idx.stock !== -1) newRow[idx.stock] = stock;
    
    sheet.appendRow(newRow);
    return successResponse("เพิ่มสินค้าสำเร็จ", { productId: newId });
  } catch(e) {
    return errorResponse(e.toString());
  }
}

function handleUpdateProduct(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ensureProductsSheet_(ss);
    const adminLineId = e.parameter.adminLineId || "";
    if (!isUserAdmin(adminLineId)) return errorResponse("ไม่มีสิทธิ์");
    
    const productId = e.parameter.id || "";
    const name = e.parameter.name || "";
    const category = e.parameter.category || "";
    const price = parseFloat(e.parameter.price) || 0;
    const image = e.parameter.image || "";
    const status = e.parameter.status || "active";
    const stock = Math.max(0, parseInt(e.parameter.stock, 10) || 0);
    
    const idx = getProductHeaders_(sheet);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][idx.id] === productId) {
        const row = i + 1;
        if (idx.name !== -1) sheet.getRange(row, idx.name + 1).setValue(name);
        if (idx.category !== -1) sheet.getRange(row, idx.category + 1).setValue(category);
        if (idx.price !== -1) sheet.getRange(row, idx.price + 1).setValue(price);
        if (idx.image !== -1) sheet.getRange(row, idx.image + 1).setValue(image);
        if (idx.status !== -1) sheet.getRange(row, idx.status + 1).setValue(status);
        if (idx.stock !== -1) sheet.getRange(row, idx.stock + 1).setValue(stock);
        return successResponse("อัพเดทสินค้าสำเร็จ");
      }
    }
    return errorResponse("ไม่พบสินค้า");
  } catch(e) {
    return errorResponse(e.toString());
  }
}

function handleDeleteProduct(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ensureProductsSheet_(ss);
    const adminLineId = e.parameter.adminLineId || "";
    if (!isUserAdmin(adminLineId)) return errorResponse("ไม่มีสิทธิ์");
    const productId = e.parameter.id || "";
    const idx = getProductHeaders_(sheet);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][idx.id] === productId) {
        sheet.deleteRow(i + 1);
        return successResponse("ลบสินค้าสำเร็จ");
      }
    }
    return errorResponse("ไม่พบสินค้า");
  } catch(e) {
    return errorResponse(e.toString());
  }
}

// -------------------- STOCK MANAGEMENT --------------------
function getProductStockMap_(ss) {
  const sheet = ensureProductsSheet_(ss);
  const idx = getProductHeaders_(sheet);
  const data = sheet.getDataRange().getValues();
  const map = {};
  for (let i = 1; i < data.length; i++) {
    const id = data[i][idx.id];
    if (!id) continue;
    map[id] = {
      row: i + 1,
      id: id,
      name: data[i][idx.name],
      status: data[i][idx.status] || "active",
      stock: Number(data[i][idx.stock]) || 0,
      stockCol: idx.stock + 1
    };
  }
  return { sheet: sheet, map: map };
}

function adjustStockForItems_(ss, items, direction) {
  const norm = normalizeOrderItems_(items);
  const stockData = getProductStockMap_(ss);
  norm.forEach(item => {
    const prod = stockData.map[item.id];
    if (!prod) return;
    const nextStock = Math.max(0, prod.stock + (item.quantity * direction));
    stockData.sheet.getRange(prod.row, prod.stockCol).setValue(nextStock);
    prod.stock = nextStock;
  });
}

function normalizeOrderItems_(items) {
  const grouped = {};
  items.forEach(item => {
    const id = item.id;
    const qty = Math.max(0, parseInt(item.quantity, 10) || 0);
    if (!id || !qty) return;
    if (!grouped[id]) grouped[id] = { id: id, name: item.name || id, quantity: 0 };
    grouped[id].quantity += qty;
  });
  return Object.keys(grouped).map(id => grouped[id]);
}

function checkStockAvailability_(ss, items) {
  const norm = normalizeOrderItems_(items);
  const stockData = getProductStockMap_(ss);
  for (let i = 0; i < norm.length; i++) {
    const item = norm[i];
    const prod = stockData.map[item.id];
    if (!prod || prod.status !== "active") {
      return { success: false, error: `สินค้า "${item.name}" ไม่พร้อมจำหน่าย` };
    }
    if (prod.stock < item.quantity) {
      return { success: false, error: `สินค้า "${prod.name}" เหลือ ${prod.stock} ชิ้น` };
    }
  }
  return { success: true };
}

// -------------------- CATEGORIES --------------------
function handleGetCategories(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Categories");
  if (!sheet) return successResponse("", { categories: [] });
  const data = sheet.getDataRange().getValues();
  const cats = [];
  for (let i = 1; i < data.length; i++) {
    if ((data[i][2] || "active") === "active") cats.push(data[i][1]);
  }
  return successResponse("", { categories: cats });
}

function handleGetAllCategories(e) {
  if (!isUserAdmin(e.parameter.lineId)) return errorResponse("ไม่มีสิทธิ์");
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Categories");
  if (!sheet) return successResponse("", { categories: [] });
  const data = sheet.getDataRange().getValues();
  const cats = [];
  for (let i = 1; i < data.length; i++) {
    cats.push({ id: data[i][0], name: data[i][1], status: data[i][2] || "active" });
  }
  return successResponse("", { categories: cats });
}

function handleAddCategory(e) {
  if (!isUserAdmin(e.parameter.adminLineId)) return errorResponse("ไม่มีสิทธิ์");
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Categories");
  const name = (e.parameter.newName || e.parameter.name || "").trim();
  if (!name) return errorResponse("กรุณาระบุชื่อหมวดหมู่");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === name) return errorResponse("มีหมวดหมู่นี้อยู่แล้ว");
  }
  let maxId = 0;
  for (let i = 1; i < data.length; i++) {
    const idNum = parseInt(String(data[i][0]).replace("CAT", ""), 10) || 0;
    if (idNum > maxId) maxId = idNum;
  }
  const newId = "CAT" + String(maxId + 1).padStart(3, "0");
  sheet.appendRow([newId, name, e.parameter.status || "active"]);
  return successResponse("เพิ่มหมวดหมู่สำเร็จ");
}

function handleUpdateCategory(e) {
  if (!isUserAdmin(e.parameter.adminLineId)) return errorResponse("ไม่มีสิทธิ์");
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Categories");
  const data = sheet.getDataRange().getValues();
  const categoryId = e.parameter.categoryId || e.parameter.id || "";
  const newName = e.parameter.newName || e.parameter.name || "";
  const status = e.parameter.status || "active";
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === categoryId || data[i][1] === e.parameter.oldName) {
      const oldName = data[i][1];
      sheet.getRange(i + 1, 2).setValue(newName);
      sheet.getRange(i + 1, 3).setValue(status);
      if (oldName !== newName) updateProductsCategoryName_(ss, oldName, newName);
      return successResponse("อัพเดทหมวดหมู่สำเร็จ");
    }
  }
  return errorResponse("ไม่พบหมวดหมู่");
}

function handleDeleteCategory(e) {
  if (!isUserAdmin(e.parameter.adminLineId)) return errorResponse("ไม่มีสิทธิ์");
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Categories");
  const categoryId = e.parameter.categoryId || e.parameter.id || "";
  const name = e.parameter.name || "";
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if ((categoryId && data[i][0] === categoryId) || (!categoryId && data[i][1] === name)) {
      sheet.getRange(i + 1, 3).setValue("inactive");
      return successResponse("ปิดใช้งานหมวดหมู่สำเร็จ");
    }
  }
  return errorResponse("ไม่พบหมวดหมู่");
}

function updateProductsCategoryName_(ss, oldName, newName) {
  const sheet = ss.getSheetByName("Products");
  if (!sheet) return;
  const idx = getProductHeaders_(sheet);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][idx.category] === oldName) {
      sheet.getRange(i + 1, idx.category + 1).setValue(newName);
    }
  }
}

// -------------------- USER MANAGEMENT --------------------
function handleGetAllUsers(e) {
  if (!isUserAdmin(e.parameter.lineId)) return ContentService.createTextOutput(JSON.stringify([]));
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Users");
  if (!sheet) return ContentService.createTextOutput(JSON.stringify([]));
  const data = sheet.getDataRange().getValues();
  const users = [];
  for (let i = 1; i < data.length; i++) {
    users.push({
      lineId: data[i][0],
      lineName: data[i][1],
      displayName: data[i][2],
      email: data[i][3],
      phone: data[i][4],
      address: data[i][5],
      pictureUrl: data[i][6],
      totalSpent: data[i][7] || 0,
      orderCount: data[i][8] || 0,
      isAdmin: data[i][12] === "true"
    });
  }
  return ContentService.createTextOutput(JSON.stringify({ users: users }));
}

function handleUpdateUserRole(e) {
  if (!isUserAdmin(e.parameter.adminLineId)) return errorResponse("ไม่มีสิทธิ์");
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Users");
  const target = e.parameter.targetLineId;
  const isAdminUser = e.parameter.isAdmin === "true";
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === target) {
      sheet.getRange(i + 1, 13).setValue(isAdminUser ? "true" : "false");
      return successResponse("เปลี่ยนสิทธิ์สำเร็จ");
    }
  }
  return errorResponse("ไม่พบผู้ใช้");
}

function isUserAdmin(lineId) {
  if (!lineId) return false;
  
  const settings = getSettings_();
  const settingsAdmins = String(settings.ADMIN_IDS || "").split(",").map(s => s.trim()).filter(Boolean);
  if (settingsAdmins.includes(lineId)) return true;
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Users");
  if (!sheet) return false;
  
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === lineId && String(data[i][12]) === "true") return true;
  }
  
  if (DEFAULT_ADMIN_IDS.includes(lineId)) return true;

  return false;
}

// -------------------- SETTINGS MANAGEMENT --------------------
let settingsCache_ = null;

function getSettings_() {
  if (settingsCache_) return settingsCache_;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Settings");
  const settings = { 
    STORE_NAME: "E-Shop Thailand", 
    PROMPTPAY_PHONE: "", 
    BOT_TOKEN: "", 
    ADMIN_IDS: DEFAULT_ADMIN_IDS.join(","),
    DRIVE_FOLDER_ID: DEFAULT_DRIVE_FOLDER_ID,
    SLIP_FOLDER_ID: DEFAULT_SLIP_FOLDER_ID,
    BANK_NAME: "",
    BANK_ACCOUNT_NAME: "",
    BANK_ACCOUNT_NUMBER: ""
  };
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) settings[data[i][0]] = data[i][1];
    }
  }
  settingsCache_ = settings;
  return settings;
}

function handleSaveBankName(e) {
  if (!isUserAdmin(e.parameter.adminLineId)) return errorResponse("ไม่มีสิทธิ์");
  const res = updateSetting_("BANK_NAME", e.parameter.bankName, "ชื่อธนาคาร");
  settingsCache_ = null;
  return res;
}

function handleSaveBankAccountName(e) {
  if (!isUserAdmin(e.parameter.adminLineId)) return errorResponse("ไม่มีสิทธิ์");
  const res = updateSetting_("BANK_ACCOUNT_NAME", e.parameter.bankAccountName, "ชื่อบัญชี");
  settingsCache_ = null;
  return res;
}

function handleSaveBankAccountNumber(e) {
  if (!isUserAdmin(e.parameter.adminLineId)) return errorResponse("ไม่มีสิทธิ์");
  const res = updateSetting_("BANK_ACCOUNT_NUMBER", e.parameter.bankAccountNumber, "เลขบัญชี");
  settingsCache_ = null;
  return res;
}

function handleGetSettings() {
  const settings = getSettings_();
  try {
    settings.WEB_APP_URL = getWebAppUrl_();
  } catch(e) {
    settings.WEB_APP_URL = "Not Deployed";
  }
  return ContentService.createTextOutput(JSON.stringify(settings));
}

function handleSaveBotToken(e) {
  if (!isUserAdmin(e.parameter.adminLineId)) return errorResponse("ไม่มีสิทธิ์");
  const res = updateSetting_("BOT_TOKEN", e.parameter.token, "LINE Bot Token");
  settingsCache_ = null;
  return res;
}

function handleSaveAdminIds(e) {
  if (!isUserAdmin(e.parameter.adminLineId)) return errorResponse("ไม่มีสิทธิ์");
  const res = updateSetting_("ADMIN_IDS", e.parameter.ids, "Admin LINE IDs");
  settingsCache_ = null;
  return res;
}

function handleSaveStoreName(e) {
  if (!isUserAdmin(e.parameter.adminLineId)) return errorResponse("ไม่มีสิทธิ์");
  const res = updateSetting_("STORE_NAME", e.parameter.storeName, "ชื่อร้านค้า");
  settingsCache_ = null;
  return res;
}

function handleSavePromptPay(e) {
  if (!isUserAdmin(e.parameter.adminLineId)) return errorResponse("ไม่มีสิทธิ์");
  const res = updateSetting_("PROMPTPAY_PHONE", e.parameter.promptpayPhone, "เบอร์ PromptPay");
  settingsCache_ = null;
  return res;
}

function handleSaveDriveFolder(e) {
  if (!isUserAdmin(e.parameter.adminLineId)) return errorResponse("ไม่มีสิทธิ์");
  const res = updateSetting_("DRIVE_FOLDER_ID", e.parameter.folderId, "Folder ID สำหรับรูปสินค้า");
  settingsCache_ = null;
  return res;
}

function handleSaveSlipFolder(e) {
  if (!isUserAdmin(e.parameter.adminLineId)) return errorResponse("ไม่มีสิทธิ์");
  const res = updateSetting_("SLIP_FOLDER_ID", e.parameter.folderId, "Folder ID สำหรับสลิป");
  settingsCache_ = null;
  return res;
}

function updateSetting_(key, value, description) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Settings");
  if (!sheet) {
    sheet = ss.insertSheet("Settings");
    sheet.appendRow(["Key", "Value", "Description"]);
    sheet.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#f43f5e").setFontColor("#ffffff");
  }
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      const cell = sheet.getRange(i + 1, 2);
      cell.setNumberFormat("@");
      cell.setValue(value);
      return successResponse("บันทึกสำเร็จ");
    }
  }
  sheet.appendRow([key, value, description]);
  sheet.getRange(sheet.getLastRow(), 2).setNumberFormat("@");
  return successResponse("บันทึกสำเร็จ");
}

// -------------------- ORDER MANAGEMENT --------------------
function ensureOrdersSheet_(ss) {
  let sheet = ss.getSheetByName("Orders");
  if (!sheet) {
    sheet = ss.insertSheet("Orders");
    sheet.appendRow([
      "Order ID", "Timestamp", "Name", "Email", "Phone", "Address",
      "LineID", "LineName", "Items", "Total", "Status",
      "StockStatus", "PaymentMethod", "SlipURL", "TrackingLink", "DeliveryNote"
    ]);
    sheet.getRange(1, 1, 1, 16).setFontWeight("bold").setBackground("#f43f5e").setFontColor("#ffffff");
    return sheet;
  }
  
  const range = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  const headers = range.getValues()[0];
  
  const columnsToAdd = [
    { name: "TrackingLink", index: 14 },
    { name: "SlipURL", index: 13 },
    { name: "PaymentMethod", index: 12 },
    { name: "StockStatus", index: 11 },
    { name: "DeliveryNote", index: 15 }
  ];
  
  columnsToAdd.forEach(col => {
    if (headers.indexOf(col.name) === -1) {
      sheet.insertColumnAfter(sheet.getLastColumn());
      sheet.getRange(1, sheet.getLastColumn()).setValue(col.name);
    }
  });
  
  return sheet;
}

function handleSaveOrder(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ensureOrdersSheet_(ss);
    const data = e.parameter;
    let items = [];
    try { items = JSON.parse(data.items || "[]"); } catch(e) { return errorResponse("รายการสินค้าไม่ถูกต้อง"); }
    if (!items.length) return errorResponse("ไม่มีสินค้า");
    const avail = checkStockAvailability_(ss, items);
    if (!avail.success) return errorResponse(avail.error);
    adjustStockForItems_(ss, items, -1);
    const orderId = "ORD" + new Date().getTime();
    const timestamp = new Date().toLocaleString("th-TH");
    const paymentMethod = data.paymentMethod || "cash";
    sheet.appendRow([
      orderId, timestamp, data.name || "", data.email || "", data.phone || "",
      data.address || "", data.lineId || "", data.lineName || "",
      data.items || "", data.total || 0, "Pending", "deducted", paymentMethod, "", "", ""
    ]);
    
    sendOrderNotify(data.lineId || "", orderId, "Ordered");
    
    const settings = getSettings_();
    const token = settings.BOT_TOKEN || "";
    const adminIdsStr = settings.ADMIN_IDS || DEFAULT_ADMIN_IDS.join(",");
    const admins = adminIdsStr.split(",").map(s => s.trim()).filter(id => /^U[0-9a-f]{32}$/i.test(id));
    
    if (admins.length > 0) {
      const adminMsg = {
        type: "text",
        text: `🔔 มีคำสั่งซื้อใหม่!\nออเดอร์: ${orderId}\nลูกค้า: ${data.name}\nยอด: ${data.total} บาท`
      };
      sendLineMessage_(token, admins, adminMsg);
    }
    
    return successResponse("Success", { orderId: orderId });
  } catch(e) {
    return errorResponse(e.toString());
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

function handleGetAllOrders(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ensureOrdersSheet_(ss);
    const lineId = e.parameter.lineId || "";
    if (!isUserAdmin(lineId)) return ContentService.createTextOutput(JSON.stringify([]));
    if (!sheet) return ContentService.createTextOutput(JSON.stringify([]));
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idx = {
      orderId: headers.indexOf("Order ID"),
      timestamp: headers.indexOf("Timestamp"),
      name: headers.indexOf("Name"),
      email: headers.indexOf("Email"),
      phone: headers.indexOf("Phone"),
      address: headers.indexOf("Address"),
      lineId: headers.indexOf("LineID"),
      lineName: headers.indexOf("LineName"),
      items: headers.indexOf("Items"),
      total: headers.indexOf("Total"),
      status: headers.indexOf("Status"),
      paymentMethod: headers.indexOf("PaymentMethod"),
      slipUrl: headers.indexOf("SlipURL"),
      trackingLink: headers.indexOf("TrackingLink"),
      deliveryNote: headers.indexOf("DeliveryNote")
    };

    const orders = [];
    for (let i = 1; i < data.length; i++) {
      let status = data[i][idx.status] || "Pending";
      if (status === "Delivered") continue;
      
      let items = [];
      try { items = JSON.parse(data[i][idx.items] || "[]"); } catch(ex) { items = []; }
      
      orders.push({
        orderId: data[i][idx.orderId], 
        timestamp: data[i][idx.timestamp], 
        name: data[i][idx.name], 
        email: data[i][idx.email],
        phone: data[i][idx.phone], 
        address: data[i][idx.address], 
        lineId: data[i][idx.lineId], 
        lineName: data[i][idx.lineName],
        items: items, 
        total: data[i][idx.total], 
        status: status,
        paymentMethod: idx.paymentMethod !== -1 ? data[i][idx.paymentMethod] : "cash",
        slipUrl: idx.slipUrl !== -1 ? data[i][idx.slipUrl] : null,
        trackingLink: idx.trackingLink !== -1 ? data[i][idx.trackingLink] : null,
        deliveryNote: idx.deliveryNote !== -1 ? data[i][idx.deliveryNote] : ""
      });
    }
    return ContentService.createTextOutput(JSON.stringify(orders.reverse())).setMimeType(ContentService.MimeType.JSON);
  } catch(e) {
    return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
  }
}

function handleUpdateOrderStatus(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ensureOrdersSheet_(ss);
    const adminLineId = e.parameter.adminLineId || "";
    if (!isUserAdmin(adminLineId)) return errorResponse("ไม่มีสิทธิ์");
    
    const orderId = e.parameter.orderId || "";
    const newStatus = (e.parameter.status || "").trim();
    const trackingLink = (e.parameter.trackingLink || "").trim();
    const deliveryNote = (e.parameter.deliveryNote || "").trim();
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idx = {
      orderId: headers.indexOf("Order ID"),
      lineId: headers.indexOf("LineID"),
      status: headers.indexOf("Status"),
      stockStatus: headers.indexOf("StockStatus"),
      items: headers.indexOf("Items"),
      trackingLink: headers.indexOf("TrackingLink"),
      deliveryNote: headers.indexOf("DeliveryNote")
    };
    
    if (idx.orderId === -1 || idx.status === -1) return errorResponse("โครงสร้างตาราง Orders ไม่ถูกต้อง");

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idx.orderId]) === String(orderId)) {
        const row = i + 1;
        const oldStatus = (data[i][idx.status] || "Pending").trim();
        const stockStatus = (data[i][idx.stockStatus] || "").trim();
        
        let items = [];
        try { items = JSON.parse(data[i][idx.items] || "[]"); } catch(ex) { items = []; }

        if (newStatus === "Cancelled" && oldStatus !== "Cancelled" && stockStatus === "deducted") {
          adjustStockForItems_(ss, items, 1);
          if (idx.stockStatus !== -1) sheet.getRange(row, idx.stockStatus + 1).setValue("returned");
        } else if (oldStatus === "Cancelled" && newStatus !== "Cancelled" && stockStatus === "returned") {
          const av = checkStockAvailability_(ss, items);
          if (!av.success) return errorResponse(av.error);
          adjustStockForItems_(ss, items, -1);
          if (idx.stockStatus !== -1) sheet.getRange(row, idx.stockStatus + 1).setValue("deducted");
        }

        sheet.getRange(row, idx.status + 1).setValue(newStatus);
        
        if (trackingLink && idx.trackingLink !== -1) {
          sheet.getRange(row, idx.trackingLink + 1).setValue(trackingLink);
        }
        
        if (idx.deliveryNote !== -1) {
          sheet.getRange(row, idx.deliveryNote + 1).setValue(deliveryNote);
        }

        const customerLineId = String(data[i][idx.lineId] || "").trim();
        const isStatusChanged = newStatus.toLowerCase() !== oldStatus.toLowerCase();
        const isTrackingAdded = trackingLink && (data[i][idx.trackingLink] || "").trim() !== trackingLink;
        
        if (customerLineId && customerLineId !== "web_user" && (isStatusChanged || isTrackingAdded)) {
          sendOrderNotify(customerLineId, orderId, newStatus, trackingLink, deliveryNote);
        }
        
        return successResponse("อัพเดทสถานะสำเร็จ");
      }
    }
    return errorResponse("ไม่พบคำสั่งซื้อ");
  } catch(e) {
    return errorResponse(e.toString());
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

// -------------------- SLIP UPLOAD & NOTIFICATION --------------------
function handleUploadSlip(e) {
  try {
    const orderId = e.parameter.orderId || "";
    const lineId = e.parameter.lineId || "";
    const base64Data = e.parameter.fileData;
    const fileName = "slip_" + orderId + "_" + new Date().getTime() + ".jpg";
    const decoded = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(decoded, 'image/jpeg', fileName);
    
    const settings = getSettings_();
    const folderId = settings.SLIP_FOLDER_ID || DEFAULT_SLIP_FOLDER_ID;
    const folder = DriveApp.getFolderById(folderId);
    
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const directLink = "https://lh5.googleusercontent.com/d/" + file.getId();
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Orders");
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const idx = {
      orderId: headers.indexOf("Order ID"),
      lineId: headers.indexOf("LineID"),
      slipUrl: headers.indexOf("SlipURL")
    };
    
    let row = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idx.orderId]) === String(orderId) && String(data[i][idx.lineId]) === String(lineId)) { 
        row = i + 1; 
        break; 
      }
    }
    
    if (row !== -1 && idx.slipUrl !== -1) {
      sheet.getRange(row, idx.slipUrl + 1).setValue(directLink);
      sendOrderNotify(lineId, orderId, "SlipUploaded");
    }
    return successResponse("อัปโหลดสลิปสำเร็จ", { slipUrl: directLink });
  } catch(e) {
    return errorResponse(e.toString());
  }
}

function handleSendSlipNotify(e) {
  try {
    const orderId = e.parameter.orderId || "";
    const slipUrl = e.parameter.slipUrl || "";
    const customerName = e.parameter.customerName || "";
    const total = e.parameter.total || 0;
    const webAppUrl = getWebAppUrl_();
    
    const settings = getSettings_();
    const token = settings.BOT_TOKEN || "";
    
    const adminIdsStr = settings.ADMIN_IDS || DEFAULT_ADMIN_IDS.join(",");
    const admins = adminIdsStr.split(",").map(s => s.trim()).filter(id => /^U[0-9a-f]{32}$/i.test(id));
    
    if (admins.length === 0) return errorResponse("ไม่พบ Admin ID ที่ถูกต้อง");
    
    const msg = {
      type: "flex", 
      altText: "📌 แจ้งเตือนสลิปใหม่",
      contents: {
        type: "bubble", 
        header: { 
          type: "box", layout: "vertical", contents: [{ type: "text", text: "📎 สลิปใหม่: " + orderId, weight: "bold", color: "#f43f5e", size: "lg" }] 
        },
        body: { 
          type: "box", layout: "vertical", contents: [
            { type: "text", text: "ลูกค้า: " + customerName, wrap: true }, 
            { type: "text", text: "ยอด: " + total + " บาท", margin: "sm" }, 
            { type: "button", action: { type: "uri", label: "ดูสลิปโอนเงิน", uri: slipUrl || "https://line.me" }, style: "primary", color: "#f43f5e", margin: "md" },
            { type: "button", action: { type: "uri", label: "📋 จัดการคำสั่งซื้อ", uri: webAppUrl }, style: "secondary", margin: "sm" }
          ] 
        }
      }
    };
    
    const result = sendLineMessage_(token, admins, msg);
    return result === "OK" ? successResponse("แจ้งเตือนแอดมินแล้ว") : errorResponse("แจ้งเตือนไม่สำเร็จ: " + result);
  } catch(e) {
    return errorResponse(e.toString());
  }
}

function sendOrderNotify(customerLineId, orderId, status, trackingLink, deliveryNote) {
  const settings = getSettings_();
  const token = settings.BOT_TOKEN || "";
  const webAppUrl = getWebAppUrl_();
  
  const uid = String(customerLineId || "").trim();
  if (!uid || uid === "web_user" || uid === "undefined" || uid === "guest") return;
  
  const statusMap = {
    "Ordered": "ได้รับคำสั่งซื้อแล้ว 🛒", 
    "SlipUploaded": "ได้รับสลิปแล้ว 🙏", 
    "Pending": "รอชำระเงิน ⏳",
    "Paid": "ชำระเงินแล้ว ✅", 
    "Processing": "กำลังเตรียมสินค้า 📦", 
    "Shipped": "จัดส่งแล้ว 🚚",
    "Delivered": "ได้รับสินค้าแล้ว ❤️", 
    "Cancelled": "ยกเลิกแล้ว ❌"
  };
  
  let message;

  if (status === "Shipped" && trackingLink) {
    message = {
      type: "flex",
      altText: `📢 ออเดอร์ ${orderId} จัดส่งแล้ว`,
      contents: {
        type: "bubble",
        header: { type: "box", layout: "vertical", contents: [{ type: "text", text: "🚚 จัดส่งสินค้าแล้ว", weight: "bold", color: "#06b6d4", size: "lg" }] },
        body: { type: "box", layout: "vertical", contents: [
          { type: "text", text: `ออเดอร์: ${orderId}`, margin: "sm" },
          { type: "button", action: { type: "uri", label: "📦 ติดตามพัสดุ", uri: trackingLink }, style: "primary", color: "#06b6d4", margin: "md" }
        ]}
      }
    };
  } else if (status === "Delivered") {
    let text = `❤️ แจ้งเตือนออเดอร์ ${orderId}\nสถานะ: ได้รับสินค้าแล้ว`;
    if (deliveryNote) text += `\n\nหมายเหตุจากร้าน: ${deliveryNote}`;
    text += `\n\nตรวจสอบรายละเอียดได้ที่ Web App นะคะ\n${webAppUrl}`;
    message = { type: "text", text: text };
  } else {
    let text = `📢 แจ้งเตือนออเดอร์ ${orderId}\nสถานะ: ${statusMap[status] || status}`;
    text += `\n\nตรวจสอบรายละเอียดได้ที่ Web App นะคะ\n${webAppUrl}`;
    message = { type: "text", text: text };
  }
  
  return sendLineMessage_(token, uid, message);
}

function sendLineMessage_(token, to, message) {
  try {
    const tokenStr = String(token || "").trim();
    if (!tokenStr) return "No Token";
    
    let recipients = [];
    if (Array.isArray(to)) {
      recipients = to.map(id => String(id).trim()).filter(id => /^U[0-9a-f]{32}$/i.test(id));
    } else {
      const id = String(to || "").trim();
      if (/^U[0-9a-f]{32}$/i.test(id)) recipients = [id];
    }

    if (recipients.length === 0) return "Invalid ID";

    const isMulticast = recipients.length > 1;
    const url = isMulticast ? "https://api.line.me/v2/bot/message/multicast" : "https://api.line.me/v2/bot/message/push";
    const messages = Array.isArray(message) ? message.slice(0, 5) : [message];
    
    const payload = { "messages": messages };
    if (isMulticast) payload.to = recipients;
    else payload.to = recipients[0];

    const options = {
      "method": "post",
      "contentType": "application/json",
      "headers": { 
        "Authorization": "Bearer " + tokenStr
      },
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    };

    const res = UrlFetchApp.fetch(url, options);
    const code = res.getResponseCode();
    if (code === 200) return "OK";
    
    return "Error " + code + ": " + res.getContentText();
  } catch (e) { 
    return "System Error: " + e.toString(); 
  }
}

function handleTestMessagingAPI(e) {
  const uid = String(e.parameter.adminLineId || "").trim();
  if (!uid || !/^U[0-9a-f]{32}$/i.test(uid)) return errorResponse("User ID ไม่ถูกต้อง (" + uid + ") กรุณาเปิดแอปผ่าน LINE เพื่อให้ระบบดึง ID จริงของคุณมาทดสอบ");
  
  const settings = getSettings_();
  const token = settings.BOT_TOKEN || "";
  if (!token) return errorResponse("กรุณาตั้งค่า LINE Bot Token ก่อน");
  
  const res = sendLineMessage_(token, uid, { type: 'text', text: "🚀 ทดสอบสำเร็จ! ระบบแจ้งเตือนพร้อมใช้งานแล้ว\nTarget ID: " + uid });
  
  if (res === "OK") return successResponse("ส่งสำเร็จ! กรุณาตรวจสอบในแอป LINE");
  
  if (res.indexOf("400") !== -1) {
    return errorResponse("ส่งไม่สำเร็จ (Error 400): บอทไม่รู้จัก ID นี้\n\nวิธีแก้:\n1. คุณต้องกด 'เพิ่มเพื่อน' บอทตัวนี้ก่อน\n2. ต้องใช้ ID ที่ได้จากบอทตัวนี้เท่านั้น (ID จะเปลี่ยนไปตามบอทแต่ละตัว)");
  }
  
  return errorResponse("ส่งไม่สำเร็จ: " + res);
}

function getWebAppUrl_() {
  const url = ScriptApp.getService().getUrl();
  return (url && url.indexOf("https") !== -1) ? url : "https://line.me";
}

// -------------------- USER PROFILE --------------------
function getUserIndices_(headers) {
  return {
    lineId: headers.indexOf("LineID"),
    lineName: headers.indexOf("LineName"),
    displayName: headers.indexOf("DisplayName"),
    email: headers.indexOf("Email"),
    phone: headers.indexOf("Phone"),
    address: headers.indexOf("Address"),
    pictureUrl: headers.indexOf("PictureUrl"),
    totalSpent: headers.indexOf("TotalSpent"),
    orderCount: headers.indexOf("OrderCount"),
    lastOrder: headers.indexOf("LastOrder"),
    createdAt: headers.indexOf("CreatedAt"),
    updatedAt: headers.indexOf("UpdatedAt"),
    isAdmin: headers.indexOf("IsAdmin")
  };
}

function handleSaveUserProfile(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Users");
    if (!sheet) {
      sheet = ss.insertSheet("Users");
      sheet.appendRow([
        "LineID", "LineName", "DisplayName", "Email", "Phone", "Address",
        "PictureUrl", "TotalSpent", "OrderCount", "LastOrder",
        "CreatedAt", "UpdatedAt", "IsAdmin"
      ]);
      sheet.getRange(1, 1, 1, 13).setFontWeight("bold").setBackground("#f43f5e").setFontColor("#ffffff");
    }
    
    const lineId = e.parameter.lineId || "";
    const lineName = e.parameter.lineName || "";
    const displayName = e.parameter.displayName || "";
    const email = e.parameter.email || "";
    const phone = e.parameter.phone || "";
    const address = e.parameter.address || "";
    const pictureUrl = e.parameter.pictureUrl || "";
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idx = getUserIndices_(headers);

    let row = -1;
    if (idx.lineId !== -1) {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idx.lineId]) === String(lineId)) { row = i + 1; break; }
      }
    }
    
    const now = new Date().toISOString();
    if (row === -1) {
      const newRow = new Array(headers.length).fill("");
      if (idx.lineId !== -1) newRow[idx.lineId] = lineId;
      if (idx.lineName !== -1) newRow[idx.lineName] = lineName;
      if (idx.displayName !== -1) newRow[idx.displayName] = displayName;
      if (idx.email !== -1) newRow[idx.email] = email;
      if (idx.phone !== -1) newRow[idx.phone] = phone;
      if (idx.address !== -1) newRow[idx.address] = address;
      if (idx.pictureUrl !== -1) newRow[idx.pictureUrl] = pictureUrl;
      if (idx.totalSpent !== -1) newRow[idx.totalSpent] = 0;
      if (idx.orderCount !== -1) newRow[idx.orderCount] = 0;
      if (idx.createdAt !== -1) newRow[idx.createdAt] = now;
      if (idx.updatedAt !== -1) newRow[idx.updatedAt] = now;
      if (idx.isAdmin !== -1) newRow[idx.isAdmin] = "false";
      sheet.appendRow(newRow);
    } else {
      if (idx.displayName !== -1 && displayName) sheet.getRange(row, idx.displayName + 1).setValue(displayName);
      if (idx.email !== -1 && email) sheet.getRange(row, idx.email + 1).setValue(email);
      if (idx.phone !== -1 && phone) sheet.getRange(row, idx.phone + 1).setValue(phone);
      if (idx.address !== -1 && address) sheet.getRange(row, idx.address + 1).setValue(address);
      if (idx.pictureUrl !== -1 && pictureUrl) sheet.getRange(row, idx.pictureUrl + 1).setValue(pictureUrl);
      if (idx.updatedAt !== -1) sheet.getRange(row, idx.updatedAt + 1).setValue(now);
    }
    return successResponse("บันทึกโปรไฟล์สำเร็จ");
  } catch(e) {
    return errorResponse(e.toString());
  }
}

function handleUpdateUserProfile(e) {
  return handleSaveUserProfile(e);
}

function handleGetUserProfile(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Users");
    const lineId = e.parameter.lineId || "";
    if (!sheet) return ContentService.createTextOutput(JSON.stringify(null));
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idx = getUserIndices_(headers);
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][idx.lineId] === lineId) {
        return ContentService.createTextOutput(JSON.stringify({
          lineId: data[i][idx.lineId], 
          lineName: data[i][idx.lineName], 
          displayName: data[i][idx.displayName],
          email: data[i][idx.email], 
          phone: data[i][idx.phone], 
          address: data[i][idx.address], 
          pictureUrl: data[i][idx.pictureUrl],
          totalSpent: data[i][idx.totalSpent] || 0, 
          orderCount: data[i][idx.orderCount] || 0,
          isAdmin: data[i][idx.isAdmin] === "true"
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify(null)).setMimeType(ContentService.MimeType.JSON);
  } catch(e) {
    return ContentService.createTextOutput(JSON.stringify(null)).setMimeType(ContentService.MimeType.JSON);
  }
}

// -------------------- GET USER ORDERS (แก้ไขแล้ว) --------------------
function handleGetUserOrders(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Orders");
    const lineId = e.parameter.lineId || "";
    
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify([]))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      return ContentService.createTextOutput(JSON.stringify([]))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const headers = data[0];
    const idx = {
      orderId: headers.indexOf("Order ID"),
      timestamp: headers.indexOf("Timestamp"),
      name: headers.indexOf("Name"),
      email: headers.indexOf("Email"),
      phone: headers.indexOf("Phone"),
      address: headers.indexOf("Address"),
      lineId: headers.indexOf("LineID"),
      items: headers.indexOf("Items"),
      total: headers.indexOf("Total"),
      status: headers.indexOf("Status"),
      slipUrl: headers.indexOf("SlipURL"),
      trackingLink: headers.indexOf("TrackingLink"),
      deliveryNote: headers.indexOf("DeliveryNote")
    };

    const orders = [];
    const targetLineId = String(lineId || "").trim();
    
    for (let i = 1; i < data.length; i++) {
      const rowLineId = data[i][idx.lineId] ? String(data[i][idx.lineId]).trim() : "";
      
      if (rowLineId && rowLineId === targetLineId) {
        let items = [];
        const itemsStr = data[i][idx.items] || "[]";
        try { 
          items = JSON.parse(itemsStr); 
        } catch(ex) { 
          items = []; 
        }
        
        orders.push({
          orderId: String(data[i][idx.orderId] || "").trim(),
          timestamp: data[i][idx.timestamp] || "",
          name: String(data[i][idx.name] || "").trim(),
          email: String(data[i][idx.email] || "").trim(),
          phone: String(data[i][idx.phone] || "").trim(),
          address: String(data[i][idx.address] || "").trim(),
          items: items,
          total: Number(data[i][idx.total]) || 0,
          status: String(data[i][idx.status] || "Pending").trim(),
          slipUrl: idx.slipUrl !== -1 ? (data[i][idx.slipUrl] || "") : null,
          trackingLink: idx.trackingLink !== -1 ? (data[i][idx.trackingLink] || "") : null,
          deliveryNote: idx.deliveryNote !== -1 ? (data[i][idx.deliveryNote] || "") : ""
        });
      }
    }
    
    orders.sort((a, b) => {
      const dateA = a.timestamp ? new Date(a.timestamp) : 0;
      const dateB = b.timestamp ? new Date(b.timestamp) : 0;
      return dateB - dateA;
    });
    
    return ContentService.createTextOutput(JSON.stringify(orders))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch(e) {
    console.error("Error in handleGetUserOrders: " + e.toString());
    return ContentService.createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// -------------------- UPLOAD IMAGE --------------------
function handleUploadImage(e) {
  try {
    if (!isUserAdmin(e.parameter.adminLineId)) return errorResponse("ไม่มีสิทธิ์");
    const base64 = e.parameter.fileData;
    const fileName = e.parameter.fileName || "product_" + new Date().getTime() + ".jpg";
    const blob = Utilities.newBlob(Utilities.base64Decode(base64), 'image/jpeg', fileName);
    
    const settings = getSettings_();
    const folderId = settings.DRIVE_FOLDER_ID || DEFAULT_DRIVE_FOLDER_ID;
    const folder = DriveApp.getFolderById(folderId);
    
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const url = "https://lh5.googleusercontent.com/d/" + file.getId();
    return successResponse("อัปโหลดรูปสำเร็จ", { imageUrl: url });
  } catch(e) {
    return errorResponse(e.toString());
  }
}

// -------------------- CHECK ADMIN --------------------
function handleCheckAdmin(e) {
  return successResponse("", { isAdmin: isUserAdmin(e.parameter.lineId) });
}

// -------------------- HELPER --------------------
function successResponse(message, data = {}) {
  return ContentService.createTextOutput(JSON.stringify({ success: true, message: message, ...data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(message) {
  return ContentService.createTextOutput(JSON.stringify({ success: false, error: message }))
    .setMimeType(ContentService.MimeType.JSON);
}