const SHEET_NAME = 'AssetData';
const HEADERS = ['รอบที่', 'ปี', 'ลำดับ', 'รายการทรัพย์สิน', 'รหัสทรัพย์สิน', 'S/N', 'หมายเหตุ', 'รูปที่1', 'รูปที่2', 'วันที่บันทึก', 'timestamp', 'fileIds'];
const FOLDER_ID = '1e7U7l0G8e08SqtephTnCPODJtMLV80pY'; // Google Drive Folder ID

// ================================================================
// doGet() - ใช้สำหรับเปิด Web App
// ================================================================
function doGet(e) {
    return HtmlService.createHtmlOutputFromFile('Index')
        .setTitle('📋 รายการอุปกรณ์คอมพิวเตอร์ที่ชำรุด/เสีย')
        .setFaviconUrl('https://www.google.com/favicon.ico')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ================================================================
// doPost() - ใช้สำหรับส่งข้อมูลแบบ POST
// ================================================================
function doPost(e) {
    try {
        const data = JSON.parse(e.postData.contents);
        
        if (data.action === 'upload') {
            return uploadImageToDrive(data.fileData, data.fileName, data.round, data.year);
        } else if (data.action === 'deleteImages') {
            return deleteImagesFromDrive(data.fileIds);
        } else {
            return saveDataToSheet(data);
        }
    } catch (error) {
        return ContentService
            .createTextOutput(JSON.stringify({
                status: 'error',
                message: error.toString()
            }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

// ================================================================
// ฟังก์ชัน initDatabase() - สร้างหรือตรวจสอบฐานข้อมูล
// ================================================================
function initDatabase() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        let sheet = ss.getSheetByName(SHEET_NAME);
        
        if (!sheet) {
            sheet = ss.insertSheet(SHEET_NAME);
            
            const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
            headerRange.setValues([HEADERS]);
            headerRange.setFontWeight('bold');
            headerRange.setBackground('#f0f3f8');
            headerRange.setHorizontalAlignment('center');
            sheet.setFrozenRows(1);
            
            sheet.setColumnWidth(1, 80);  // รอบที่
            sheet.setColumnWidth(2, 80);  // ปี
            sheet.setColumnWidth(3, 60);  // ลำดับ
            sheet.setColumnWidth(4, 250); // รายการทรัพย์สิน
            sheet.setColumnWidth(5, 150); // รหัสทรัพย์สิน
            sheet.setColumnWidth(6, 180); // S/N
            sheet.setColumnWidth(7, 180); // หมายเหตุ
            sheet.setColumnWidth(8, 200); // รูป 1
            sheet.setColumnWidth(9, 200); // รูป 2
            sheet.setColumnWidth(10, 150); // วันที่บันทึก
            sheet.setColumnWidth(11, 180); // timestamp
            sheet.setColumnWidth(12, 300); // fileIds
            
            Logger.log('✅ สร้างชีทใหม่: ' + SHEET_NAME);
        }
        return sheet;
    } catch (error) {
        Logger.log('❌ initDatabase Error: ' + error.toString());
        throw error;
    }
}
// ================================================================
// ฟังก์ชันสำหรับ google.script.run - บันทึกข้อมูล
// ================================================================
function saveDataToSheet(data) {
    let lock = null;
    try {
        lock = LockService.getDocumentLock();
        lock.waitLock(30000);

        const sheet = initDatabase();
        const round = normalizeValue(data.round);
        const year = normalizeValue(data.year);
        const rows = data.rows || [];
        const images = data.images || [];
        const fileIds = data.fileIds || [];
        
        if (!round || !year) {
            return { status: 'error', message: 'กรุณาระบุรอบที่และปี' };
        }
        
        // ลบข้อมูลเก่าและรูปภาพที่ถูกแทนที่ออกจาก Google Drive
        const deletedCount = deleteOldData(sheet, round, year, fileIds);
        
        // บันทึกข้อมูลใหม่
        const timestamp = new Date();
        const dateThai = formatThaiDate(timestamp);
        const isoString = timestamp.toISOString();
        const rowData = [];
        
        rows.forEach((row, index) => {
            if (!row.desc && !row.assetCode && !row.sn && !row.note) return;
            
            // เตรียมข้อมูลรูป (สูงสุด 2 รูป)
            let imageUrls = [];
            let imageFileIds = [];
            
            if (row.images && row.fileIds) {
                // ดึงจากแถวของมันเองโดยตรง
                imageUrls = [row.images[0] || '', row.images[1] || ''];
                imageFileIds = [row.fileIds[0] || '', row.fileIds[1] || ''];
            } else {
                // แบบเก่า: ดึงจาก flat arrays
                const startIdx = index * 2;
                for (let i = 0; i < 2; i++) {
                    const imgIdx = startIdx + i;
                    if (imgIdx < images.length) {
                        imageUrls.push(images[imgIdx] || '');
                        imageFileIds.push(fileIds[imgIdx] || '');
                    } else {
                        imageUrls.push('');
                        imageFileIds.push('');
                    }
                }
            }
            
            rowData.push([
                round,
                year,
                index + 1,
                row.desc || '',
                row.assetCode || '',
                row.sn || '',
                row.note || '',
                imageUrls[0], imageUrls[1],
                dateThai,
                isoString,
                imageFileIds.join(',')
            ]);
        });
        
        if (rowData.length > 0) {
            const lastRow = sheet.getLastRow();
            sheet.getRange(lastRow + 1, 1, rowData.length, HEADERS.length).setValues(rowData);
            formatDataRows(sheet, lastRow + 1, rowData.length);
        }

        SpreadsheetApp.flush();
        
        return { 
            status: 'success', 
            message: 'บันทึกข้อมูลสำเร็จ', 
            count: rowData.length,
            deletedCount: deletedCount
        };
        
    } catch (error) {
        Logger.log('❌ saveDataToSheet Error: ' + error.toString());
        return { status: 'error', message: error.toString() };
    } finally {
        if (lock) {
            try {
                lock.releaseLock();
            } catch (e) {}
        }
    }
}

// ================================================================
// ฟังก์ชันสำหรับ google.script.run - โหลดข้อมูล
// ================================================================
function loadDataFromSheet(round, year) {
    try {
        const sheet = initDatabase();
        const roundStr = normalizeValue(round);
        const yearStr = normalizeValue(year);
        
        const data = getDataByRound(sheet, roundStr, yearStr);
        
        if (data) {
            return {
                status: 'success',
                data: data,
                message: 'โหลดข้อมูลสำเร็จ'
            };
        } else {
            const sampleRows = [];
            try {
                const values = sheet.getDataRange().getDisplayValues();
                for (let i = 1; i < Math.min(values.length, 5); i++) {
                    sampleRows.push({
                        round: values[i][0],
                        year: values[i][1],
                        roundType: typeof values[i][0],
                        yearType: typeof values[i][1]
                    });
                }
            } catch (e) {}
            return {
                status: 'success',
                data: null,
                message: 'ไม่พบข้อมูล (เป้าหมาย: round=' + roundStr + ' [' + (typeof round) + '], year=' + yearStr + ' [' + (typeof year) + '])',
                debugInfo: sampleRows
            };
        }
    } catch (error) {
        Logger.log('❌ loadDataFromSheet Error: ' + error.toString());
        return { status: 'error', message: error.toString() };
    }
}

// ================================================================
// ฟังก์ชันสำหรับ google.script.run - โหลดรอบทั้งหมด
// ================================================================
function loadAllRounds() {
    try {
        const sheet = initDatabase();
        const data = sheet.getDataRange().getDisplayValues();
        if (data.length < 2) return { status: 'success', data: [] };
        
        const rounds = [];
        const seen = new Set();
        
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            const round = normalizeValue(row[0]);
            const year = normalizeValue(row[1]);
            const key = round + '|' + year;
            
            if (round && year && !seen.has(key)) {
                seen.add(key);
                rounds.push({ round: round, year: year });
            }
        }
        
        rounds.sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            return b.round - a.round;
        });
        
        return { status: 'success', data: rounds };
    } catch (error) {
        return { status: 'error', message: error.toString() };
    }
}

// ================================================================
// ฟังก์ชันสำหรับ google.script.run - อัปโหลดรูปภาพ
// ================================================================
function uploadImageToDrive(fileData, fileName, round, year) {
    try {
        const base64Data = fileData.split(',')[1] || fileData;
        const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), 'image/jpeg', fileName);
        
        let folder;
        try {
            folder = DriveApp.getFolderById(FOLDER_ID);
        } catch (e) {
            folder = DriveApp.createFolder('AssetImages');
        }
        
        const file = folder.createFile(blob);
        const fileId = file.getId();
        const directLink = 'https://lh5.googleusercontent.com/d/' + fileId + '=w800-h800';
        
        return {
            status: 'success',
            fileId: fileId,
            fileName: file.getName(),
            fileUrl: directLink,
            message: 'อัปโหลดรูปสำเร็จ'
        };
        
    } catch (error) {
        return { status: 'error', message: error.toString() };
    }
}

// ================================================================
// ฟังก์ชันสำหรับลบรูปจาก Google Drive
// ================================================================
function deleteImagesFromDrive(fileIds) {
    try {
        if (!fileIds || fileIds.length === 0) {
            return { status: 'success', message: 'ไม่มีรูปให้ลบ' };
        }
        
        fileIds.forEach(function(fileId) {
            if (!fileId) return;
            try {
                const file = DriveApp.getFileById(fileId);
                file.setTrashed(true);
            } catch (e) {}
        });
        
        return { status: 'success', message: 'ลบรูปสำเร็จ' };
    } catch (error) {
        return { status: 'error', message: error.toString() };
    }
}

// ================================================================
// ฟังก์ชันช่วยเหลือ
// ================================================================

function deleteRowFromSheet(round, year, seq) {
    let lock = null;
    try {
        lock = LockService.getDocumentLock();
        lock.waitLock(30000);

        const sheet = initDatabase();
        const targetRound = normalizeValue(round);
        const targetYear = normalizeValue(year);
        const targetSeq = normalizeValue(seq);

        if (!targetRound || !targetYear || !targetSeq) {
            return { status: 'error', message: 'ข้อมูลรอบ/ปี/ลำดับไม่ครบ' };
        }

        const data = sheet.getDataRange().getDisplayValues();
        let sheetRowToDelete = 0;
        let fileIdsVal = '';

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            const rowRound = normalizeValue(row[0]);
            const rowYear = normalizeValue(row[1]);
            const rowSeq = normalizeValue(row[2]);

            if (rowRound === targetRound && rowYear === targetYear && rowSeq === targetSeq) {
                sheetRowToDelete = i + 1;
                if (row.length >= 15) {
                    fileIdsVal = row[14] || '';
                } else if (row.length >= 12) {
                    fileIdsVal = row[11] || '';
                } else {
                    fileIdsVal = row[row.length - 1] || '';
                }
                break;
            }
        }

        if (!sheetRowToDelete) {
            throw new Error('ไม่พบแถวที่ต้องการลบใน Google Sheet: รอบที่ ' + targetRound + ' ปี ' + targetYear + ' ลำดับ ' + targetSeq);
        }

        sheet.deleteRow(sheetRowToDelete);
        renumberSheetRows(sheet, targetRound, targetYear);
        SpreadsheetApp.flush();

        if (fileIdsVal) {
            const ids = String(fileIdsVal).split(',').map(id => id.trim()).filter(Boolean);
            if (ids.length > 0) deleteImagesFromDrive(ids);
        }

        return {
            status: 'success',
            message: 'ลบแถวจาก Google Sheet สำเร็จ',
            deletedRow: sheetRowToDelete
        };
    } catch (error) {
        Logger.log('❌ deleteRowFromSheet Error: ' + error.toString());
        return { status: 'error', message: error.toString() };
    } finally {
        if (lock) {
            try {
                lock.releaseLock();
            } catch (e) {}
        }
    }
}

function renumberSheetRows(sheet, targetRound, targetYear) {
    const data = sheet.getDataRange().getDisplayValues();
    let seq = 1;

    for (let i = 1; i < data.length; i++) {
        const rowRound = normalizeValue(data[i][0]);
        const rowYear = normalizeValue(data[i][1]);
        if (rowRound === targetRound && rowYear === targetYear) {
            sheet.getRange(i + 1, 3).setValue(seq);
            seq++;
        }
    }
}

function formatThaiDate(date) {
    const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 
                       'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const day = date.getDate().toString().padStart(2, '0');
    const month = thaiMonths[date.getMonth()];
    const year = date.getFullYear() + 543;
    return day + ' ' + month + ' ' + year;
}

function getDataByRound(sheet, round, year) {
    try {
        const data = sheet.getDataRange().getDisplayValues();
        if (data.length < 2) return null;
        
        const rows = [];
        const images = [];
        const fileIds = [];
        let recordDate = '';
        
        const targetRound = normalizeValue(round);
        const targetYear = normalizeValue(year);
        
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            const rowRound = normalizeValue(row[0]);
            const rowYear = normalizeValue(row[1]);
            
            if (rowRound === targetRound && rowYear === targetYear) {
                // รูปภาพ: ดึงสูงสุด 2 รูปสำหรับแถวนี้
                const img1 = row[7] || '';
                const img2 = row[8] || '';
                const rowImgs = [];
                if (img1) {
                    images.push(img1);
                    rowImgs.push(img1);
                }
                if (img2) {
                    images.push(img2);
                    rowImgs.push(img2);
                }
                
                // ดึงข้อมูลอื่นตามโครงสร้างเก่า (15 คอลัมน์) หรือใหม่ (12 คอลัมน์) เพื่อความ backward compatible
                let recordDateVal = '';
                let fileIdsVal = '';
                
                if (row.length >= 15) {
                    recordDateVal = row[12] || '';
                    fileIdsVal = row[14] || '';
                } else if (row.length >= 12) {
                    recordDateVal = row[9] || '';
                    fileIdsVal = row[11] || '';
                } else {
                    recordDateVal = row[row.length - 3] || '';
                    fileIdsVal = row[row.length - 1] || '';
                }
                
                if (!recordDate && recordDateVal) recordDate = recordDateVal;
                
                const rowIds = [];
                if (fileIdsVal) {
                    const ids = String(fileIdsVal).split(',').filter(id => id.trim());
                    ids.slice(0, 2).forEach(id => {
                        const trimmedId = id.trim();
                        fileIds.push(trimmedId);
                        rowIds.push(trimmedId);
                    });
                }

                // ดึงข้อมูลพื้นฐาน (ดัชนี 0 ถึง 6 เหมือนกันทั้งข้อมูลเก่าและใหม่ โดยเลขบัญชีเก่าจะถูกแมปเข้า assetCode)
                rows.push({
                    seq: row[2] || '',
                    desc: row[3] || '',
                    assetCode: row[4] || '', // รหัสทรัพย์สิน (แทนที่ เลขบัญชี เดิม)
                    sn: row[5] || '',
                    note: row[6] || '',
                    images: rowImgs,
                    fileIds: rowIds
                });
            }
        }
        
        return rows.length > 0 ? { round: targetRound, year: targetYear, rows, images, fileIds, recordDate } : null;
    } catch (error) {
        throw error;
    }
}

function deleteOldData(sheet, round, year, newFileIds) {
    try {
        const data = sheet.getDataRange().getDisplayValues();
        const targetRound = normalizeValue(round);
        const targetYear = normalizeValue(year);
        
        // 1. ค้นหารูปภาพเก่าทั้งหมดในรอบ/ปีนี้
        const oldFileIds = [];
        const newFileIdsSet = new Set((newFileIds || []).map(id => String(id || '').trim()));
        const rowsToDelete = [];
        
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            const rowRound = normalizeValue(row[0]);
            const rowYear = normalizeValue(row[1]);
            
            if (rowRound === targetRound && rowYear === targetYear) {
                rowsToDelete.push(i + 1);

                let fileIdsVal = '';
                if (row.length >= 15) {
                    fileIdsVal = row[14] || '';
                } else if (row.length >= 12) {
                    fileIdsVal = row[11] || '';
                } else {
                    fileIdsVal = row[row.length - 1] || '';
                }
                
                if (fileIdsVal) {
                    const ids = String(fileIdsVal).split(',').filter(id => id.trim());
                    ids.forEach(id => {
                        const trimmedId = id.trim();
                        // ถ้าไฟล์เก่าไม่อยู่ในไฟล์ใหม่ (แสดงว่าโดนลบหรือเปลี่ยนออก) ให้เตรียมลบออกจาก Drive
                        if (trimmedId && !newFileIdsSet.has(trimmedId) && oldFileIds.indexOf(trimmedId) === -1) {
                            oldFileIds.push(trimmedId);
                        }
                    });
                }
            }
        }
        
        // 2. ทำการลบไฟล์รูปภาพออกจาก Google Drive
        if (oldFileIds.length > 0) {
            deleteImagesFromDrive(oldFileIds);
        }
        
        // 3. ลบแถวข้อมูลเก่าออกจาก Sheet
        for (let i = rowsToDelete.length - 1; i >= 0; i--) {
            sheet.deleteRow(rowsToDelete[i]);
        }

        SpreadsheetApp.flush();

        const remainingData = sheet.getDataRange().getDisplayValues();
        const remainingRows = [];
        for (let i = 1; i < remainingData.length; i++) {
            const rowRound = normalizeValue(remainingData[i][0]);
            const rowYear = normalizeValue(remainingData[i][1]);
            if (rowRound === targetRound && rowYear === targetYear) {
                remainingRows.push(i + 1);
            }
        }
        if (remainingRows.length > 0) {
            throw new Error('ลบข้อมูลเก่าจาก Google Sheet ไม่สำเร็จ เหลือแถว: ' + remainingRows.join(', '));
        }

        return rowsToDelete.length;
    } catch (error) {
        Logger.log('❌ deleteOldData Error: ' + error.toString());
        throw error;
    }
}

function formatDataRows(sheet, startRow, rowCount) {
    try {
        if (rowCount === 0) return;
        sheet.getRange(startRow, 1, rowCount, HEADERS.length)
            .setFontFamily('Sarabun')
            .setFontSize(12);
        sheet.getRange(startRow, 11, rowCount, 1)
            .setNumberFormat('dd/mm/yyyy HH:mm:ss');
    } catch (error) {}
}

function normalizeValue(val) {
    if (val === undefined || val === null) return '';
    let str = String(val).trim();
    if (str.indexOf('.') !== -1 && !isNaN(str)) {
        const num = Number(str);
        if (!isNaN(num) && num === Math.floor(num)) {
            str = String(Math.floor(num));
        }
    }
    return str;
}
