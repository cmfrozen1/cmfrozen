//  **********************************************************************
//  * ######   Title : E-Voting System for Student Leaders       ####### *
//  * ######   Update : 16/02/2022 - 3.45  PM                    ####### *
//  * ######   Developed by : Wichian Phumphuang (PhD)           ####### *
//  * ######   Email : 1210@sts.ac.th                            ####### *
//  * ######   Line ID : semisailom                              ####### *
//  * ######   Github : semicon.github.io || github.com/semicon  ####### *
//  * ######   School : Sripruetta School  || www.sts.ac.th      ####### *
//  **********************************************************************


var studentDataSheet = 'studentData'; // ชื่อชีต รายชื่อนักเรียนทั้งหมด
var leaderDataSheet = 'LeaderData'; // ชื่อชีต รายชื่อผู้สมัครประธานนักเรียน
var chartDataSheet = 'chart'; // ชื่อชีต ข้อมูลที่จะทำกราฟ

function doGet() {
    return HtmlService.createTemplateFromFile('index').evaluate()
      .setTitle('เลือกตั้งคณะกรรมการนักเรียน 2567')
      .addMetaTag('viewport', 'width=device-width , initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
  }
  
/** ***************** Include File *********************** **/
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/** ***************** Get URL *********************** **/
function getURL() {
   return "https://cmfrozen-387fd.web.app/vote/votecm1.html";
}

/** *********** เช็ครายชื่อนักเรียนจากชีตรายชื่อนักเรียนทั้งหมด ******** **/
function checkLogin(student_id, citizen_id) {
  try {
    Logger.log('========== CHECK LOGIN (OPTIMIZED) ==========');
    Logger.log('Student ID: ' + student_id);
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(studentDataSheet);
    
    if (!sheet) {
      Logger.log('ERROR: Sheet not found - ' + studentDataSheet);
      return 'null';
    }
    
    var lastRow = sheet.getLastRow();
    if (lastRow === 0) return 'null';
    
    // ดึงข้อมูลทั้งหมดในครั้งเดียว (โหลดเร็วขึ้น 100 เท่า!)
    var rangeValues = sheet.getRange(1, 1, lastRow, 4).getValues();
    
    // วนลูปค้นหารหัสพนักงานที่ยังไม่ลงคะแนน
    for (var i = 0; i < rangeValues.length; i++) {
      var row = rangeValues[i];
      var stdId = String(row[0]).trim();
      var citizenId = String(row[1]).trim();
      var fullname = row[2];
      var status = row[3];
      
      if (stdId == student_id && citizenId == "") {
        var user_info = [];
        user_info.push(stdId);
        user_info.push(fullname);
        user_info.push(status);
        Logger.log('✅ Login SUCCESS for: ' + fullname);
        return user_info;
      }
    }
    
    // ตรวจสอบว่ามี ID นี้แต่ลงคะแนนแล้วหรือไม่
    for (var j = 0; j < rangeValues.length; j++) {
      var row = rangeValues[j];
      var stdId2 = String(row[0]).trim();
      var citizenId2 = String(row[1]).trim();
      var fullname2 = row[2];
      if (stdId2 == student_id && citizenId2 != "") {
        Logger.log('⚠️ ID found but already voted: ' + student_id);
        return ['already_voted', fullname2, 'voted'];
      }
    }
    
    Logger.log('❌ Login FAILED - No matching ID found: ' + student_id);
    return 'null';
    
  } catch (error) {
    Logger.log('❌ ERROR in checkLogin: ' + error);
    return 'null';
  }
}

/** ******** โหลดข้อมูลจากชีตรายชื่่อผู้สมัคร แล้วส่งไปยังหน้ากาบัตรเลือกตั้ง ******** **/
function getDataLeader() {
  try {
    Logger.log('========== GET DATA LEADER ==========');
    
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(leaderDataSheet);
    if (!sheet) {
      Logger.log('ERROR: Sheet not found - ' + leaderDataSheet);
      return '';
    }
    
    var data = sheet.getDataRange().getDisplayValues();
    Logger.log('Total rows in LeaderData: ' + data.length);
    
    // ตัดหัวข้อและกรองข้อมูลที่ว่าง
    var filteredData = data.slice(1).filter(function(d) {
      return d[0] !== "" && d[1] !== "";
    });
    
    Logger.log('Filtered rows: ' + filteredData.length);
    
    var radioLists = filteredData.map(function(d) {
      var img = "";
      if (d[2] != "") {
        img = '<img class="ballot-image" src="https://lh5.googleusercontent.com/d/' + d[2] + '" alt="' + d[0] + '">';
      } else {
        img = '<div class="ballot-image flex items-center justify-center bg-slate-800 text-slate-500 border border-white/10"><i class="fas fa-user text-3xl"></i></div>';
      }
      
      return '<div class="ballot-card" onclick="handleBallotClick(\'myRadio' + d[1] + '\')">'
        + '<input type="radio" name="myRadio" class="ballot-radio" id="myRadio' + d[1] + '" value="' + d[1] + '">'
        + '<div class="ballot-number">' + d[1] + '</div>'
        + img
        + '<div class="ballot-info">'
        + '<div class="name">' + d[0] + '</div>'
        + '<div class="detail">ผู้สมัครหมายเลข ' + d[1] + '</div>'
        + '</div>'
        + '<div class="ballot-checkbox">'
        + '<span class="check-mark">✗</span>'
        + '</div>'
        + '</div>';
    }).join("");
    
    Logger.log('Generated radio lists length: ' + radioLists.length);
    return radioLists;
    
  } catch (error) {
    Logger.log('❌ ERROR in getDataLeader: ' + error);
    return '';
  }
}

/** **** รับข้อมูลจากหน้าเว็บกาบัตรเลือกตั้ง แล้วส่งไปบันทึกในชีตรายชื่อนักเรียน ****** **/
function recordData(user_id, vote_numb) {
  try {
    Logger.log('========== RECORD DATA ==========');
    Logger.log('User ID: ' + user_id);
    Logger.log('Vote Number: ' + vote_numb);
    
    var now = new Date();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(studentDataSheet);
    
    if (!sheet) {
      Logger.log('ERROR: Sheet not found - ' + studentDataSheet);
      return 'null';
    }
    
    var getLastRow = sheet.getLastRow();
    var use_info = '';
    
    for (var i = 1; i <= getLastRow; i++) {
      var stdId = sheet.getRange(i, 1).getDisplayValue().trim();
      var citizenId = sheet.getRange(i, 2).getDisplayValue().trim();
      
      Logger.log('Row ' + i + ': stdId="' + stdId + '", citizenId="' + citizenId + '"');
      
      if (stdId == user_id && citizenId == "") {
        // บันทึกข้อมูลการลงคะแนน
        sheet.getRange(i, 2).setValue(vote_numb); // เก็บหมายเลขผู้สมัครที่เลือก
        sheet.getRange(i, 4).setValue(vote_numb); // คะแนน
        sheet.getRange(i, 5).setValue(now); // เวลาที่ลงคะแนน
        sheet.getRange(i, 7).setValue('ใช้สิทธิเรียบร้อยแล้ว');
        
        var user_fullname = sheet.getRange(i, 3).getValue();
        use_info = ['success', user_fullname];
        Logger.log('✅ Vote recorded for: ' + user_fullname);
        break;
      }
    }
    
    if (use_info == '') {
      use_info = 'null';
      Logger.log('❌ Vote recording failed: User not found or already voted');
    }
    
    // อัปเดตข้อมูลกราฟอัตโนมัติ
    updateChartData();
    
    return use_info;
    
  } catch (error) {
    Logger.log('❌ ERROR in recordData: ' + error);
    return 'null';
  }
}

/** ****** โหลดข้อมูลจากชีตผลรวมคะแนน แล้วส่งไปยังหน้าเว็บแสดงผลเลือกตั้ง ******* **/
function getDataResult() {
  try {
    Logger.log('========== GET DATA RESULT ==========');
    
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(leaderDataSheet);
    if (!sheet) {
      Logger.log('ERROR: Sheet not found - ' + leaderDataSheet);
      return '';
    }
    
    var data = sheet.getDataRange().getDisplayValues();
    Logger.log('Total rows in LeaderData: ' + data.length);
    
    var filteredData = data.slice(1).filter(function(d) {
      return String(d[0]).trim() !== "";
    });
    
    Logger.log('Filtered rows: ' + filteredData.length);
    
    // คำนวณสถิติผู้มาใช้สิทธิ์แบบเรียลไทม์เพื่อนำมาเติมในแถวสรุปผล
    var studentSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(studentDataSheet);
    var totalVoters = 0;
    var votedVoters = 0;
    var nonVoters = 0;
    if (studentSheet) {
      var studentValues = studentSheet.getDataRange().getValues();
      var headers = studentValues[0];
      var idColIdx = 0;
      var statusColIdx = 6;
      for (var i = 0; i < headers.length; i++) {
        var h = headers[i].toLowerCase();
        if (h.indexOf('รหัส') > -1 || h.indexOf('id') > -1 || h.indexOf('code') > -1) {
          idColIdx = i;
        } else if (h.indexOf('สถานะ') > -1 || h.indexOf('status') > -1 || h.indexOf('การใช้สิทธิ์') > -1) {
          statusColIdx = i;
        }
      }
      for (var j = 1; j < studentValues.length; j++) {
        var row = studentValues[j];
        var id = String(row[idColIdx] || '').trim();
        if (id !== '') {
          totalVoters++;
          var statusVal = String(row[statusColIdx] || '').trim();
          if (statusVal === 'ใช้สิทธิเรียบร้อยแล้ว') {
            votedVoters++;
          } else {
            nonVoters++;
          }
        }
      }
    }
    
    var votedPercent = totalVoters > 0 ? ((votedVoters / totalVoters) * 100).toFixed(2) : '0.00';
    var nonVotedPercent = totalVoters > 0 ? ((nonVoters / totalVoters) * 100).toFixed(2) : '0.00';
    
    var resultsTable = filteredData.map(function(d) {
      var nameStr = String(d[0]).trim();
      
      var isTotalVotersRow = nameStr.indexOf('จำนวนผู้มีสิทธิ์') > -1 || nameStr.indexOf('จำนวนผู้มีสิทธิ') > -1;
      var isNonVotersRow = nameStr.indexOf('เหลือ') > -1;
      var isVotedVotersRow = nameStr.indexOf('รวม') > -1 || nameStr.indexOf('ผู้มาใช้สิทธิ์') > -1 || nameStr.indexOf('ผู้ใช้สิทธิ์') > -1;
      
      var isSummaryRow = isTotalVotersRow || isNonVotersRow || isVotedVotersRow;
      
      var img = "";
      if (d[2] != "" && !isSummaryRow) {
        img = '<img class="candidate-img-table" src="https://lh5.googleusercontent.com/d/' + d[2] + '" alt="' + d[0] + '">';
      }
      
      var rank = d[5] || '';
      var rankClass = '';
      var rankDisplay = '';
      
      if (!isSummaryRow) {
        if (rank == '1') {
          rankClass = 'rank-1-premium';
          rankDisplay = '🥇';
        } else if (rank == '2') {
          rankClass = 'rank-2-premium';
          rankDisplay = '🥈';
        } else if (rank == '3') {
          rankClass = 'rank-3-premium';
          rankDisplay = '🥉';
        } else {
          rankDisplay = rank;
        }
      }
      
      var trClass = isSummaryRow ? 'border-t border-navy-800 text-white font-bold bg-navy-950/60 font-semibold' : '';
      var tdVotesClass = isSummaryRow ? 'text-center text-green-400 font-bold text-lg' : 'text-center font-bold text-gold-400 text-lg';
      var tdPercentClass = isSummaryRow ? 'text-center text-green-400 font-bold' : 'text-center text-navy-300';
      var candidateNum = isSummaryRow ? '' : d[1];
      
      // ดึงค่าจำนวนคนและเปอร์เซ็นต์จริงที่คำนวณได้
      var votesVal = d[3] || '0';
      var percentVal = d[4] || '0';
      
      if (isTotalVotersRow) {
        votesVal = totalVoters;
        percentVal = '100.00';
      } else if (isNonVotersRow) {
        votesVal = nonVoters;
        percentVal = nonVotedPercent;
      } else if (isVotedVotersRow) {
        votesVal = votedVoters;
        percentVal = votedPercent;
      }
      
      // จัดการตัวแสดงผลร้อยละ (%) เพื่อไม่ให้เกิด "คน%"
      var pctValue = String(percentVal).trim();
      var pctDisplay = pctValue;
      if (pctValue === 'คน') {
        pctDisplay = 'คน';
      } else if (pctValue !== '' && pctValue.indexOf('%') === -1) {
        pctDisplay = pctDisplay + '%';
      }
      
      return '<tr class="' + trClass + '">'
        + '<td class="text-center">' + img + '</td>'
        + '<td class="text-center font-bold text-white">' + candidateNum + '</td>'
        + '<td class="name-column text-white font-medium">' + d[0] + '</td>'
        + '<td class="' + tdVotesClass + '">' + votesVal + (isSummaryRow ? ' คน' : '') + '</td>'
        + '<td class="' + tdPercentClass + '">' + pctDisplay + '</td>'
        + '<td class="text-center">' + (isSummaryRow ? '' : '<span class="rank-badge-premium ' + rankClass + '">' + rankDisplay + '</span>') + '</td>'
        + '</tr>';
    }).join("");
    
    return resultsTable;
    
  } catch (error) {
    Logger.log('❌ ERROR in getDataResult: ' + error);
    return '';
  }
}

/** ****** อ่านข้อมูลจาก ชีตข้อมูล Chart ******* **/
function getCases() {
  try {
    Logger.log('========== GET CASES ==========');
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(chartDataSheet);
    
    if (!sheet) {
      Logger.log('ERROR: Sheet not found - ' + chartDataSheet);
      return [];
    }
    
    var getLastrow = sheet.getLastRow();
    Logger.log('Total rows in chart: ' + getLastrow);
    
    if (getLastrow <= 1) {
      return [];
    }
    
    var data = sheet.getRange(2, 1, getLastrow - 1, 2).getValues();
    Logger.log('Chart data rows: ' + data.length);
    
    return data;
    
  } catch (error) {
    Logger.log('❌ ERROR in getCases: ' + error);
    return [];
  }
}

/** ****** อัปเดตข้อมูล Chart ******* **/
function updateChartData() {
  try {
    Logger.log('========== UPDATE CHART DATA ==========');
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var leaderSheet = ss.getSheetByName(leaderDataSheet);
    var chartSheet = ss.getSheetByName(chartDataSheet);
    
    if (!leaderSheet || !chartSheet) {
      Logger.log('ERROR: Sheets not found');
      return false;
    }
    
    var data = leaderSheet.getDataRange().getDisplayValues().slice(1).filter(function(d) {
      var name = String(d[0]).trim();
      return name !== "" && 
             name.indexOf('รวม') === -1 && 
             name.indexOf('ผู้มาใช้สิทธิ์') === -1 && 
             name.indexOf('ผู้ใช้สิทธิ์') === -1;
    });
    
    Logger.log('Data rows to update: ' + data.length);
    
    // ล้างข้อมูลเก่า
    chartSheet.clearContents();
    
    // เขียนหัวข้อ
    chartSheet.getRange(1, 1).setValue('ชื่อผู้สมัคร');
    chartSheet.getRange(1, 2).setValue('คะแนน');
    
    // เขียนข้อมูลใหม่
    for (var i = 0; i < data.length; i++) {
      chartSheet.getRange(i + 2, 1).setValue(data[i][0]); // ชื่อ
      chartSheet.getRange(i + 2, 2).setValue(parseInt(data[i][3]) || 0); // คะแนน
      Logger.log('Updated: ' + data[i][0] + ' = ' + (parseInt(data[i][3]) || 0));
    }
    
    Logger.log('Chart data updated successfully');
    return true;
    
  } catch (error) {
    Logger.log('❌ ERROR in updateChartData: ' + error);
    return false;
  }
}

/** ****** ฟังก์ชันสำหรับรีเฟรชข้อมูลกราฟ ******* **/
function getChartData() {
  try {
    Logger.log('========== GET CHART DATA ==========');
    updateChartData();
    return getCases();
  } catch (error) {
    Logger.log('❌ ERROR in getChartData: ' + error);
    return [];
  }
}

/** ****** ฟังก์ชันรีเซ็ตข้อมูล (สำหรับทดสอบ) ******* **/
function resetVoteData() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(studentDataSheet);
    
    if (!sheet) {
      Logger.log('ERROR: Sheet not found');
      return false;
    }
    
    var getLastRow = sheet.getLastRow();
    for (var i = 1; i <= getLastRow; i++) {
      sheet.getRange(i, 2).setValue(''); // ล้างรหัสบัตร
      sheet.getRange(i, 4).setValue(''); // ล้างคะแนน
      sheet.getRange(i, 5).setValue(''); // ล้างเวลา
      sheet.getRange(i, 7).setValue(''); // ล้างสถานะ
    }
    
    Logger.log('All vote data reset');
    return true;
    
  } catch (error) {
    Logger.log('❌ ERROR in resetVoteData: ' + error);
    return false;
  }
}

/** ****** ฟังก์ชันดึงรายชื่อผู้ที่ยังไม่ได้ลงคะแนนเสียง ****** **/
function getNonVoters() {
  try {
    Logger.log('========== GET NON VOTERS (DYNAMIC) ==========');
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(studentDataSheet);
    
    if (!sheet) {
      Logger.log('ERROR: Sheet not found - ' + studentDataSheet);
      return { error: 'ไม่พบชีตข้อมูลผู้มีสิทธิ์' };
    }
    
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return { nonVoters: [], departments: [] };
    }
    
    var lastColumn = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function(h) {
      return String(h).trim();
    });
    
    Logger.log('Headers: ' + JSON.stringify(headers));
    
    // ค้นหาคอลัมน์จาก Header
    var idColIdx = 0; // default col A
    var nameColIdx = 2; // default col C
    var deptColIdx = -1; // เราจะค้นหาแผนก
    var statusColIdx = 6; // default col G (0-indexed is 6)
    
    for (var i = 0; i < headers.length; i++) {
      var h = headers[i].toLowerCase();
      if (h.indexOf('รหัส') > -1 || h.indexOf('id') > -1 || h.indexOf('code') > -1) {
        idColIdx = i;
      } else if (h.indexOf('ชื่อ') > -1 || h.indexOf('name') > -1) {
        nameColIdx = i;
      } else if (h.indexOf('แผนก') > -1 || h.indexOf('ฝ่าย') > -1 || h.indexOf('หน่วยงาน') > -1 || h.indexOf('dept') > -1 || h.indexOf('department') > -1) {
        deptColIdx = i;
      } else if (h.indexOf('สถานะ') > -1 || h.indexOf('status') > -1 || h.indexOf('การใช้สิทธิ์') > -1) {
        statusColIdx = i;
      }
    }
    
    // ถ้าหากหาหัวตารางแผนกไม่เจอ แต่มีคอลัมน์กว้างพอ ให้ใช้คอลัมน์ F (ดัชนี 5) โดยอัตโนมัติ
    if (deptColIdx === -1 && lastColumn >= 6) {
      deptColIdx = 5;
    }
    
    Logger.log('Column indices - ID: ' + idColIdx + ', Name: ' + nameColIdx + ', Dept: ' + deptColIdx + ', Status: ' + statusColIdx);
    
    var allData = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
    var nonVoters = [];
    var departments = {};
    var totalVoters = 0;
    
    for (var j = 0; j < allData.length; j++) {
      var row = allData[j];
      var id = String(row[idColIdx] || '').trim();
      if (id !== '') {
        totalVoters++;
      }
      
      var statusVal = String(row[statusColIdx] || '').trim();
      var name = String(row[nameColIdx] || '').trim();
      
      // ถ้าสถานะไม่ใช่ "ใช้สิทธิเรียบร้อยแล้ว"
      if (statusVal !== 'ใช้สิทธิเรียบร้อยแล้ว' && id !== '') {
        var dept = deptColIdx > -1 ? String(row[deptColIdx] || 'ไม่ระบุ').trim() : 'ไม่ระบุ';
        
        nonVoters.push({
          id: id,
          name: name,
          dept: dept
        });
        
        if (dept !== '' && dept !== 'ไม่ระบุ') {
          departments[dept] = (departments[dept] || 0) + 1;
        }
      }
    }
    
    Logger.log('Total non-voters: ' + nonVoters.length + ', Total voters: ' + totalVoters);
    
    return {
      nonVoters: nonVoters,
      departments: Object.keys(departments).sort(),
      totalVoters: totalVoters
    };
    
  } catch (error) {
    Logger.log('❌ ERROR in getNonVoters: ' + error);
    return { error: error.toString() };
  }
}

/** ****** ฟังก์ชันคำนวณสถิติการใช้สิทธิ์เลือกตั้ง ****** **/
function getVotingStats() {
  try {
    Logger.log('========== GET VOTING STATS ==========');
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(studentDataSheet);
    
    if (!sheet) {
      Logger.log('ERROR: Sheet not found - ' + studentDataSheet);
      return { error: 'ไม่พบชีตข้อมูลผู้มีสิทธิ์' };
    }
    
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return { totalVoters: 0, votedVoters: 0, nonVoters: 0, votedPercent: '0.00', nonVotedPercent: '0.00' };
    }
    
    var lastColumn = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function(h) {
      return String(h).trim();
    });
    
    // ค้นหาคอลัมน์จาก Header
    var idColIdx = 0; // default col A
    var statusColIdx = 6; // default col G (0-indexed is 6)
    
    for (var i = 0; i < headers.length; i++) {
      var h = headers[i].toLowerCase();
      if (h.indexOf('รหัส') > -1 || h.indexOf('id') > -1 || h.indexOf('code') > -1) {
        idColIdx = i;
      } else if (h.indexOf('สถานะ') > -1 || h.indexOf('status') > -1 || h.indexOf('การใช้สิทธิ์') > -1) {
        statusColIdx = i;
      }
    }
    
    var allData = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
    var totalVoters = 0;
    var votedVoters = 0;
    var nonVoters = 0;
    
    for (var j = 0; j < allData.length; j++) {
      var row = allData[j];
      var id = String(row[idColIdx] || '').trim();
      var statusVal = String(row[statusColIdx] || '').trim();
      
      if (id !== '') {
        totalVoters++;
        if (statusVal === 'ใช้สิทธิเรียบร้อยแล้ว') {
          votedVoters++;
        } else {
          nonVoters++;
        }
      }
    }
    
    var votedPercent = totalVoters > 0 ? ((votedVoters / totalVoters) * 100).toFixed(2) : '0.00';
    var nonVotedPercent = totalVoters > 0 ? ((nonVoters / totalVoters) * 100).toFixed(2) : '0.00';
    
    Logger.log('Voting Stats - Total: ' + totalVoters + ', Voted: ' + votedVoters + ' (' + votedPercent + '%), Remaining: ' + nonVoters + ' (' + nonVotedPercent + '%)');
    
    return {
      totalVoters: totalVoters,
      votedVoters: votedVoters,
      nonVoters: nonVoters,
      votedPercent: votedPercent,
      nonVotedPercent: nonVotedPercent
    };
    
  } catch (error) {
    Logger.log('❌ ERROR in getVotingStats: ' + error);
    return { error: error.toString() };
  }
}