
var IDSHEET = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" // replace id sheets
const Logger = BetterLog.useSpreadsheet(IDSHEET); 

function doGet(e){
const data = output(e);
  console.log(JSON.stringify(e))

  return ContentService.createTextOutput(JSON.stringify(data.students)).setMimeType(ContentService.MimeType.JSON);
}



function doPost(e){
const data = output(e);
  return ContentService.createTextOutput(JSON.stringify(data.students)).setMimeType(ContentService.MimeType.JSON);
}

function output(e){
  var Logger = BetterLog.useSpreadsheet(IDSHEET); 
  var data = {}
  if('type' in e.parameter){
    let valID = e.parameter['type']
    if(valID === "create"){
          const showobjs = e.parameter['objs']
          const newobjs = JSON.parse(showobjs)
          Logger.log(newobjs.pictureUser)
          const ss = SpreadsheetApp.openById(IDSHEET)
          const sheet = ss.getSheetByName('History Login')

          sheet.appendRow([newobjs.expUser,
                           newobjs.uidUser,
                           newobjs.nameUser,
                           newobjs.emailUser,
                           newobjs.pictureUser])
          let Otp = generateOTP()
          sendOTP(newobjs.nameUser,newobjs.emailUser,Otp)


          data.students = {status:'Good JOB' , otp: ""+Otp}
            
    }else if(valID === "check"){
          const showobjs = e.parameter['objs']
          const newobjs = JSON.parse(showobjs)
          // Logger.log(newobjs.emailUser)
          const check = checkLogin(newobjs.emailUser)   
          // Logger.log(check)      
          let statusCheck = "400"
          if(check === true){
            statusCheck = "200"
          }

          data.students = {status: statusCheck}
    }else if(valID === "regis"){  
          const showobjs = e.parameter['objs']
          const newobjs = JSON.parse(showobjs)
          // Logger.log(newobjs.emailuser)
          // Logger.log(newobjs.passcode)
          const ss = SpreadsheetApp.openById(IDSHEET)
          const sheetRegis = ss.getSheetByName('Register')   
          sheetRegis.appendRow([newobjs.emailuser,newobjs.passcode])
          data.students = {status: "success"}          
            
    }else{
      data.students = {status:'Nothing found'}
    }
  }
return data


}


function checkLogin(email){
  const ss = SpreadsheetApp.openById(IDSHEET)
  const sheet = ss.getSheetByName('Register')

  const emailCol = sheet.getRange(1,1,sheet.getLastRow(),1).getDisplayValues()
  const emailColmap = emailCol.map(r=>r[0])

  const indexEmail = emailColmap.indexOf(email)
  Logger.log(indexEmail)
  
  let resault = false
  if(indexEmail>=0){
    resault = true
  }
  return resault

}

function generateOTP() {

    var digits = '0123456789';
    let OTP = '';
    for (let i = 0; i < 6; i++ ) {
        OTP += digits[Math.floor(Math.random() * 10)];
    }
    Logger.log(OTP)
    return OTP;
}

function sendOTP(fname,email,OTP) {
  const subject = "แจ้งรหัส OTP"
  const message = "เรียน คุณ"+fname+
                  "\n  Passcode ของคุณ คือ"+
                  "\n  "+OTP+
                  "\n  ขอบคุณที่ใช้บริการของเรา"
        MailApp.sendEmail(email, subject, message)
  return email
}

