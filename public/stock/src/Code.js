/*************************************************
 * WEB APP
 *************************************************/
function doGet(e) {
  if (e && e.parameter && e.parameter.page === 'report') {
    const template = HtmlService.createTemplateFromFile('report');
    /* ส่งวันที่จาก URL (?date=yyyy-MM-dd) เข้า Template */
    template.date = (e.parameter.date && /^\d{4}-\d{2}-\d{2}$/.test(e.parameter.date))
      ? e.parameter.date
      : "";
    /* ส่งคำสั่งพิมพ์อัตโนมัติเข้า Template */
    template.autoPrint = (e.parameter.autoPrint === 'true') ? 'true' : 'false';
    return template.evaluate()
      .setTitle('รายงานประจำวัน')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('ระบบสรุปยอดขายและสต๊อกสินค้า')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/*************************************************
 * GET WEB APP URL
 *************************************************/
function getWebAppUrl() {
  return ScriptApp.getService().getUrl();
}


/*************************************************
 * GET DATABASE / SPREADSHEET
 *************************************************/
function getDatabase_() {
  let ss = null;

  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    console.warn("getActiveSpreadsheet failed: " + e.message);
  }

  if (!ss) {
    const propId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (propId) {
      try {
        ss = SpreadsheetApp.openById(propId);
      } catch (e) {
        console.warn("openById failed: " + e.message);
      }
    }
  }

  if (!ss) {
    throw new Error(
      "ไม่สามารถเชื่อมต่อ Google Spreadsheet ได้\n" +
      "หากเป็น Standalone Script กรุณาตั้งค่า 'SPREADSHEET_ID' ใน Project Settings > Script Properties"
    );
  }

  setupSheets_(ss);
  return ss;
}


/*************************************************
 * SETUP SHEETS & DEFAULT DATA IF NOT EXIST
 *************************************************/
function setupSheets_(ss) {
  if (!ss) return;

  // 1. Products Sheet
  let prodSheet = ss.getSheetByName("Products");
  if (!prodSheet) {
    prodSheet = ss.insertSheet("Products");
    prodSheet.appendRow(["ID", "Name", "Price", "Active", "CreatedAt", "UpdatedAt"]);
    prodSheet.getRange("A1:F1").setFontWeight("bold").setBackground("#eef2ff");
  }

  if (prodSheet.getLastRow() <= 1) {
    const defaultProducts = [
      [1, "เนตกระดาษ", 1.50, true, new Date(), new Date()],
      [2, "เนตผ้าเนื้อนิ่ม", 8.00, true, new Date(), new Date()],
      [3, "ผ้าปิดปาก", 5.00, true, new Date(), new Date()],
      [4, "ถุงมือยาง สีฟ้า No.S", 2.50, true, new Date(), new Date()],
      [5, "ถุงมือยาง สีฟ้า No.M", 2.50, true, new Date(), new Date()],
      [6, "ถุงมือยาง สีฟ้า No.L", 2.50, true, new Date(), new Date()],
      [7, "ถุงมือยาง สีม่วง No.S", 2.50, true, new Date(), new Date()],
      [8, "ถุงมือยาง สีม่วง No.M", 2.50, true, new Date(), new Date()],
      [9, "ถุงมือยาง สีม่วง No.L", 2.50, true, new Date(), new Date()],
      [10, "ถุงมือผ้าถักขอบเขียว", 7.00, true, new Date(), new Date()],
      [11, "ถุงมือผ้าสีขาวไมโครเทค", 12.00, true, new Date(), new Date()],
      [12, "ถุงมือยางสีน้ำเงินNo.L", 25.00, true, new Date(), new Date()],
      [13, "ถุงมือยางสีส้มNO.M", 25.00, true, new Date(), new Date()],
      [14, "ถุงมือยางสีส้มNO.L", 25.00, true, new Date(), new Date()],
      [15, "ถุงมือยางสีเขียว No.L", 30.00, true, new Date(), new Date()],
      [16, "เอี๊ยมพลาสติกสีฟ้า", 40.00, true, new Date(), new Date()],
      [17, "เอี๊ยมผ้ากันเปื้อนสีน้ำเงิน No.L", 65.00, true, new Date(), new Date()],
      [18, "เอี๊ยมผ้ากันเปื้อนสีน้ำเงิน No.XL", 65.00, true, new Date(), new Date()],
      [19, "ฮู้ดคลุมผม สีขาว", 91.00, true, new Date(), new Date()],
      [20, "หมวกคลุมผม สีฟ้า No. S", 145.00, true, new Date(), new Date()],
      [21, "หมวกคลุมผม สีฟ้า No. M", 145.00, true, new Date(), new Date()],
      [22, "หมวกคลุมผม สีฟ้า No. L", 145.00, true, new Date(), new Date()],
      [23, "หมวกคลุมผมสีฟ้า แถบสีน้ำเงิน No.S", 145.00, true, new Date(), new Date()],
      [24, "หมวกคลุมผมสีฟ้า แถบสีน้ำเงิน No.M", 145.00, true, new Date(), new Date()],
      [25, "หมวกคลุมผม สีฟ้าแถบ สีเขียว No.S", 145.00, true, new Date(), new Date()],
      [26, "หมวกคลุมผม สีฟ้าแถบ สีเขียว No. M", 145.00, true, new Date(), new Date()],
      [27, "หมวกคลุมผมสีฟ้าแถบ สีแดง No S", 145.00, true, new Date(), new Date()],
      [28, "หมวกคลุมผมสีฟ้าแถบ สีแดง No M", 145.00, true, new Date(), new Date()],
      [29, "หมวกคลุมผม สีฟ้าแถบ สีเหลือง No. S", 145.00, true, new Date(), new Date()],
      [30, "หมวกคลุมผม สีฟ้าแถบ สีเหลือง No. M", 145.00, true, new Date(), new Date()],
      [31, "หมวกคลุมผม สีฟ้าแถบ สีเหลือง No. L", 145.00, true, new Date(), new Date()],
      [32, "รองเท้าบูต No.10", 130.00, true, new Date(), new Date()],
      [33, "รองเท้าบูต No.10.5", 130.00, true, new Date(), new Date()],
      [34, "รองเท้าบูต No.11", 130.00, true, new Date(), new Date()],
      [35, "รองเท้าบูต No.11.5", 130.00, true, new Date(), new Date()],
      [36, "รองเท้าบูต No.12", 130.00, true, new Date(), new Date()],
      [37, "ชุดฟอร์ม No.S", 350.00, true, new Date(), new Date()],
      [38, "ชุดฟอร์ม No.M", 350.00, true, new Date(), new Date()],
      [39, "ชุดฟอร์ม No.L", 350.00, true, new Date(), new Date()],
      [40, "ชุดฟอร์ม No.XL", 350.00, true, new Date(), new Date()],
      [41, "ชุดฟอร์ม No.XXL", 350.00, true, new Date(), new Date()],
      [42, "ชุดฟอร์ม No.พิเศษ", 350.00, true, new Date(), new Date()]
    ];
    prodSheet.getRange(2, 1, defaultProducts.length, 6).setValues(defaultProducts);
  }

  // 2. Sales Sheet
  let salesSheet = ss.getSheetByName("Sales");
  if (!salesSheet) {
    salesSheet = ss.insertSheet("Sales");
    salesSheet.appendRow(["ID", "Date", "ProductID", "ProductName", "UnitPrice", "Quantity", "Amount", "CreatedAt", "UpdatedAt"]);
    salesSheet.getRange("A1:I1").setFontWeight("bold").setBackground("#eef2ff");
  }

  // 3. Receives Sheet
  let recSheet = ss.getSheetByName("Receives");
  if (!recSheet) {
    recSheet = ss.insertSheet("Receives");
    recSheet.appendRow(["ID", "Date", "ProductID", "ProductName", "UnitPrice", "Quantity", "Amount", "CreatedAt", "UpdatedAt"]);
    recSheet.getRange("A1:I1").setFontWeight("bold").setBackground("#eef2ff");
  }
}


/*************************************************
 * LOAD INITIAL DATA
 *************************************************/
function getInitialData() {
  try {
    return {
      success: true,
      products: getProducts_(),
      sales: getTransactions_("Sales"),
      receives: getTransactions_("Receives")
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}


/*************************************************
 * GET PRODUCTS
 *************************************************/
function getProducts_() {
  const ss = getDatabase_();
  const sheet = ss.getSheetByName("Products");

  if (!sheet || sheet.getLastRow() <= 1) {
    return [];
  }

  const values = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 6)
    .getValues();

  return values
    .filter(function (row) {
      return row[0] !== "" && row[0] !== null && row[0] !== undefined;
    })
    .map(function (row) {
      return {
        id: Number(row[0]),
        name: String(row[1]),
        price: Number(row[2] || 0),
        active: row[3] !== false
      };
    });
}


/*************************************************
 * GET SALES / RECEIVES
 *
 * ข้อมูลใน Sheet:
 * A = ID
 * B = Date
 * C = ProductID
 * D = ProductName
 * E = UnitPrice
 * F = Quantity
 * G = Amount
 * H = CreatedAt
 * I = UpdatedAt
 *************************************************/
function getTransactions_(sheetName) {
  const ss = getDatabase_();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet || sheet.getLastRow() <= 1) {
    return [];
  }

  const rows = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 9)
    .getValues();

  const groups = {};

  rows.forEach(function (row) {
    const transactionId = String(row[0] || "");
    if (!transactionId) {
      return;
    }

    const date = formatDateForClient_(row[1]);
    const productId = String(row[2]);
    const unitPrice = Number(row[4] || 0);
    const quantity = Number(row[5] || 0);
    const amount = Number(row[6] || 0);

    if (!groups[transactionId]) {
      groups[transactionId] = {
        id: transactionId,
        date: date,
        items: {},
        itemDetails: {},
        totalQty: 0,
        totalAmount: 0,
        createdAt: formatDateTimeForClient_(row[7]),
        updatedAt: formatDateTimeForClient_(row[8])
      };
    }

    groups[transactionId].items[productId] = (
      Number(groups[transactionId].items[productId] || 0) + quantity
    );

    groups[transactionId].itemDetails[productId] = {
      productId: Number(productId),
      name: String(row[3] || ""),
      unitPrice: unitPrice,
      quantity: quantity,
      amount: amount
    };

    groups[transactionId].totalQty += quantity;
    groups[transactionId].totalAmount += amount;
  });

  return Object.keys(groups)
    .map(function (id) {
      return groups[id];
    })
    .sort(function (a, b) {
      return a.date.localeCompare(b.date);
    });
}


/*************************************************
 * SAVE / UPDATE DAILY SALE
 *
 * data = {
 *   saleId: "...", // ไม่มี = เพิ่มใหม่
 *   date: "2026-08-25",
 *   items: {
 *      "1": 5,
 *      "2": 10
 *   }
 * }
 *************************************************/
function saveSale(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    if (!data) {
      throw new Error("ไม่พบข้อมูลยอดขาย");
    }

    if (!data.date) {
      throw new Error("กรุณาระบุวันที่ขาย");
    }

    const items = sanitizeItems_(data.items);

    if (Object.keys(items).length === 0) {
      throw new Error("กรุณากรอกจำนวนขายอย่างน้อย 1 รายการ");
    }

    const ss = getDatabase_();
    const sheet = ss.getSheetByName("Sales");

    /*
     * ถ้าวันนี้มียอดขายอยู่แล้ว ให้ถือว่าเป็นการแก้ไขยอดเดิม
     */
    const sameDateIds = findTransactionIdsByDate_(sheet, data.date);

    let saleId = data.saleId ? String(data.saleId) : "";

    if (!saleId && sameDateIds.length) {
      saleId = sameDateIds[0];
    }

    if (!saleId) {
      saleId = "SALE-" + Utilities.getUuid();
    }

    /*
     * เก็บ CreatedAt เดิม
     */
    let createdAt = findCreatedAtById_(sheet, saleId);
    if (!createdAt) {
      createdAt = new Date();
    }

    /*
     * รวมและลบยอดเดิมของวันนั้น
     */
    const idsToDelete = {};
    idsToDelete[saleId] = true;
    sameDateIds.forEach(function (id) {
      idsToDelete[id] = true;
    });

    Object.keys(idsToDelete).forEach(function (id) {
      deleteRowsByTransactionId_(sheet, id);
    });

    /*
     * Product Master
     */
    const productMap = getProductMap_();
    const now = new Date();
    const rows = [];

    Object.keys(items).forEach(function (productId) {
      const product = productMap[String(productId)];
      if (!product) {
        throw new Error("ไม่พบสินค้า ProductID: " + productId);
      }

      const quantity = Number(items[productId]);
      const price = Number(product.price);
      const amount = price * quantity;

      rows.push([
        saleId,
        data.date,
        Number(productId),
        product.name,
        price,
        quantity,
        amount,
        createdAt,
        now
      ]);
    });

    if (rows.length) {
      sheet
        .getRange(sheet.getLastRow() + 1, 1, rows.length, 9)
        .setValues(rows);
    }

    SpreadsheetApp.flush();

    return {
      success: true,
      id: saleId,
      date: data.date,
      message: "บันทึกยอดขายเรียบร้อย"
    };

  } finally {
    lock.releaseLock();
  }
}


/*************************************************
 * DELETE SALE (by ID or Date)
 *************************************************/
function deleteSale(identifier) {
  if (!identifier) {
    throw new Error("ไม่พบข้อมูลสำหรับลบยอดขาย");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = getDatabase_();
    const sheet = ss.getSheetByName("Sales");

    let targetIds = [];
    const idStr = String(identifier).trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(idStr)) {
      targetIds = findTransactionIdsByDate_(sheet, idStr);
    } else {
      targetIds = [idStr];
    }

    let deletedCount = 0;
    targetIds.forEach(function (id) {
      deletedCount += deleteRowsByTransactionId_(sheet, id);
    });

    SpreadsheetApp.flush();

    return {
      success: true,
      deletedRows: deletedCount,
      message: "ลบยอดขายเรียบร้อย"
    };

  } finally {
    lock.releaseLock();
  }
}


/*************************************************
 * SAVE / UPDATE RECEIVE
 *
 * data = {
 *   receiveId: "...",  // ถ้าแก้ไข
 *   date: "2026-08-25",
 *   items: {}
 * }
 *************************************************/
function saveReceive(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    if (!data) {
      throw new Error("ไม่พบข้อมูลการเบิกสินค้า");
    }

    if (!data.date) {
      throw new Error("กรุณาระบุวันที่เบิกสินค้า");
    }

    const items = sanitizeItems_(data.items);

    if (Object.keys(items).length === 0) {
      throw new Error("กรุณากรอกจำนวนสินค้าอย่างน้อย 1 รายการ");
    }

    const ss = getDatabase_();
    const sheet = ss.getSheetByName("Receives");

    let receiveId = data.receiveId ? String(data.receiveId) : "";

    if (!receiveId) {
      receiveId = "REC-" + Utilities.getUuid();
    }

    let createdAt = findCreatedAtById_(sheet, receiveId);
    if (!createdAt) {
      createdAt = new Date();
    }

    /*
     * ลบ Rows ของ Receive เดิม (กรณีแก้ไข)
     */
    deleteRowsByTransactionId_(sheet, receiveId);

    const products = getProductMap_();
    const now = new Date();
    const rows = [];

    Object.keys(items).forEach(function (productId) {
      const product = products[String(productId)];
      if (!product) {
        throw new Error("ไม่พบสินค้า ProductID: " + productId);
      }

      const qty = Number(items[productId]);
      const price = Number(product.price);

      rows.push([
        receiveId,
        data.date,
        Number(productId),
        product.name,
        price,
        qty,
        price * qty,
        createdAt,
        now
      ]);
    });

    sheet
      .getRange(sheet.getLastRow() + 1, 1, rows.length, 9)
      .setValues(rows);

    SpreadsheetApp.flush();

    return {
      success: true,
      id: receiveId,
      date: data.date,
      message: "บันทึกการเบิกสินค้าเรียบร้อย"
    };

  } finally {
    lock.releaseLock();
  }
}


/*************************************************
 * DELETE RECEIVE
 *************************************************/
function deleteReceive(receiveId) {
  if (!receiveId) {
    throw new Error("ไม่พบ Receive ID");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = getDatabase_();
    const sheet = ss.getSheetByName("Receives");

    const deleted = deleteRowsByTransactionId_(sheet, String(receiveId));
    SpreadsheetApp.flush();

    return {
      success: true,
      deletedRows: deleted,
      message: "ลบรายการเบิกสินค้าเรียบร้อย"
    };

  } finally {
    lock.releaseLock();
  }
}


/*************************************************
 * UPDATE PRODUCT PRICE
 *************************************************/
function updateProductPrice(productId, newPrice) {
  productId = Number(productId);
  newPrice = Number(newPrice);

  if (!productId || isNaN(newPrice) || newPrice < 0) {
    throw new Error("ข้อมูลราคาไม่ถูกต้อง");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = getDatabase_();
    const sheet = ss.getSheetByName("Products");
    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) {
      throw new Error("ไม่พบสินค้า");
    }

    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

    for (let i = 0; i < ids.length; i++) {
      if (Number(ids[i][0]) === productId) {
        const row = i + 2;
        sheet.getRange(row, 3).setValue(newPrice);
        sheet.getRange(row, 6).setValue(new Date());

        SpreadsheetApp.flush();

        return {
          success: true,
          productId: productId,
          price: newPrice,
          message: "แก้ไขราคาเรียบร้อย"
        };
      }
    }

    throw new Error("ไม่พบ Product ID " + productId);

  } finally {
    lock.releaseLock();
  }
}


/*************************************************
 * CLEAR ALL TRANSACTIONS (Optional helper)
 *************************************************/
function clearAllTransactions() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = getDatabase_();

    const salesSheet = ss.getSheetByName("Sales");
    if (salesSheet && salesSheet.getLastRow() > 1) {
      salesSheet.deleteRows(2, salesSheet.getLastRow() - 1);
    }

    const recSheet = ss.getSheetByName("Receives");
    if (recSheet && recSheet.getLastRow() > 1) {
      recSheet.deleteRows(2, recSheet.getLastRow() - 1);
    }

    SpreadsheetApp.flush();

    return {
      success: true,
      message: "ล้างข้อมูลยอดขายและสต๊อกใน Sheet เรียบร้อยแล้ว"
    };

  } finally {
    lock.releaseLock();
  }
}


/*************************************************
 * PRODUCT MAP
 *************************************************/
function getProductMap_() {
  const products = getProducts_();
  const map = {};

  products.forEach(function (product) {
    map[String(product.id)] = product;
  });

  return map;
}


/*************************************************
 * CLEAN ITEMS
 *************************************************/
function sanitizeItems_(items) {
  const output = {};

  if (!items) {
    return output;
  }

  Object.keys(items).forEach(function (key) {
    const qty = Number(items[key]);
    if (!isNaN(qty) && qty > 0) {
      output[String(key)] = qty;
    }
  });

  return output;
}


/*************************************************
 * FIND TRANSACTION IDs BY DATE
 *************************************************/
function findTransactionIdsByDate_(sheet, date) {
  if (!sheet || sheet.getLastRow() <= 1) {
    return [];
  }

  const values = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 2)
    .getValues();

  const found = {};

  values.forEach(function (row) {
    const id = String(row[0] || "");
    const rowDate = formatDateForClient_(row[1]);

    if (id && rowDate === date) {
      found[id] = true;
    }
  });

  return Object.keys(found);
}


/*************************************************
 * FIND CREATED AT
 *************************************************/
function findCreatedAtById_(sheet, transactionId) {
  if (!sheet || sheet.getLastRow() <= 1) {
    return null;
  }

  const values = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 8)
    .getValues();

  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(transactionId)) {
      return values[i][7] || null;
    }
  }

  return null;
}


/*************************************************
 * DELETE ROWS BY TRANSACTION ID
 *************************************************/
function deleteRowsByTransactionId_(sheet, transactionId) {
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return 0;
  }

  const ids = sheet
    .getRange(2, 1, lastRow - 1, 1)
    .getValues();

  const rowsToDelete = [];

  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(transactionId)) {
      rowsToDelete.push(i + 2);
    }
  }

  /*
   * ลบจากล่างขึ้นบน
   */
  rowsToDelete
    .sort(function (a, b) {
      return b - a;
    })
    .forEach(function (row) {
      sheet.deleteRow(row);
    });

  return rowsToDelete.length;
}


/*************************************************
 * FORMAT DATE (yyyy-MM-dd)
 *************************************************/
function formatDateForClient_(value) {
  if (!value) {
    return "";
  }

  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, "Asia/Bangkok", "yyyy-MM-dd");
  }

  const text = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.substring(0, 10);
  }

  const d = new Date(text);
  if (!isNaN(d.getTime())) {
    return Utilities.formatDate(d, "Asia/Bangkok", "yyyy-MM-dd");
  }

  return text;
}


/*************************************************
 * FORMAT DATETIME (yyyy-MM-dd HH:mm:ss)
 *************************************************/
function formatDateTimeForClient_(value) {
  if (!value) {
    return "";
  }

  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");
  }

  return String(value);
}
