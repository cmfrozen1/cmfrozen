function doGet(e) {
  try {
    var parameter = e.parameter;
    var action = parameter.action || 'default';
    
    switch (action) {
      case 'health':
        return ContentService.createTextOutput(JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString()
        })).setMimeType(ContentService.MimeType.JSON);
        
      case 'status':
        return ContentService.createTextOutput(JSON.stringify({
          status: 'running',
          version: '1.0.0'
        })).setMimeType(ContentService.MimeType.JSON);
        
      default:
        return ContentService.createTextOutput(JSON.stringify({
          message: 'CMFrozen API Gateway',
          endpoints: ['health', 'status']
        })).setMimeType(ContentService.MimeType.JSON);
    }
    
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var parameter = e.parameter;
    var action = parameter.action || 'default';
    
    switch (action) {
      case 'upload':
        return handleFileUpload(e);
        
      case 'register':
        return handleRegister(e);
        
      default:
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: 'Unknown action: ' + action
        })).setMimeType(ContentService.MimeType.JSON);
    }
    
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function handleFileUpload(e) {
  var fileData = e.parameter.fileData;
  var fileName = parameter.fileName || 'uploaded_file';
  var mimeType = parameter.mimeType || 'application/octet-stream';
  var folderId = parameter.folderId;
  
  if (!fileData) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Missing fileData parameter'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  var data = Utilities.base64Decode(fileData);
  var blob = Utilities.newBlob(data, mimeType, fileName);
  
  var folder = DriveApp.getFolderById(folderId);
  var file = folder.createFile(blob);
  
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  var fileId = file.getId();
  var fileUrl = "https://drive.google.com/uc?export=view&id=" + fileId;
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    url: fileUrl,
    id: fileId,
    name: file.getName()
  })).setMimeType(ContentService.MimeType.JSON);
}

function handleRegister(e) {
  var parameter = e.parameter;
  var email = parameter.email;
  var name = parameter.name;
  
  if (!email) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Missing email parameter'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  var ss = SpreadsheetApp.openById('YOUR_SHEET_ID_HERE');
  var sheet = ss.getSheetByName('Register');
  sheet.appendRow([name, email]);
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'Registration successful',
    email: email
  })).setMimeType(ContentService.MimeType.JSON);
}