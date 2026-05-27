function doGet(e){
    return HtmlService.createTemplateFromFile('index').evaluate()
    .setTitle('คำนวณดัชนีมวลกาย BMI')
    .addMetaTag('viewport','width=deviec-width,initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .setFaviconUrl('https://www.pngall.com/wp-content/uploads/2016/07/Cookie-Download-PNG.png')
  }
  //**ดึงไฟล์ */
  function include(filename){
    return HtmlService.createHtmlOutputFromFile(filename).getContent()
  }