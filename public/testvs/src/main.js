const SHEET_NAME = 'data';

function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('GAS CRUD Debug Mode')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("getActiveSpreadsheet() returned null. Are you using a standalone script? If so, use SpreadsheetApp.openById('ID')");
  
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['id', 'name', 'email', 'timestamp']);
    SpreadsheetApp.flush();
  }
  return sheet;
}

function getData() {
  try {
    const sheet = getSheet();
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    
    if (lastRow <= 1) return [];
    
    const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    const headers = values[0].map(h => h.toString().toLowerCase().trim());
    
    const results = values.slice(1).map((row, index) => {
      let obj = {};
      headers.forEach((h, i) => {
        let val = row[i];
        if (val instanceof Date) {
          obj[h] = Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
        } else {
          obj[h] = val !== undefined && val !== null ? val.toString() : "";
        }
      });
      // Ensure ID exists
      if (!obj.id || obj.id === "") obj.id = "AUTO-" + (index + 2);
      return obj;
    }).filter(item => item.name !== "" || item.email !== ""); // Filter out empty-looking rows
    
    return results;
  } catch (e) {
    throw new Error('Server Error (getData): ' + e.message);
  }
}

function createData(item) {
  try {
    const sheet = getSheet();
    const id = "ID-" + new Date().getTime();
    sheet.appendRow([id, item.name, item.email, new Date()]);
    SpreadsheetApp.flush();
    return true;
  } catch (e) {
    throw new Error('Server Error (createData): ' + e.message);
  }
}

function updateData(id, item) {
  try {
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => h.toString().toLowerCase().trim());
    const idIdx = headers.indexOf('id');
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx].toString() === id.toString()) {
        sheet.getRange(i + 1, 2).setValue(item.name);
        sheet.getRange(i + 1, 3).setValue(item.email);
        SpreadsheetApp.flush();
        return true;
      }
    }
    return false;
  } catch (e) {
    throw new Error('Server Error (updateData): ' + e.message);
  }
}

function deleteData(id) {
  try {
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => h.toString().toLowerCase().trim());
    const idIdx = headers.indexOf('id');
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx].toString() === id.toString()) {
        sheet.deleteRow(i + 1);
        SpreadsheetApp.flush();
        return true;
      }
    }
    return false;
  } catch (e) {
    throw new Error('Server Error (deleteData): ' + e.message);
  }
}
