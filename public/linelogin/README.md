# webapp_Login_line_with-API
Line login
drive เก็บ ไฟล์ทั้งหมด https://drive.google.com/drive/folders/1gt0Mvt0V5wKxKTb8Hq_q18av8oUeM_39?usp=drive_link

#PDF ประกอบการเรียน Line Login : https://drive.google.com/file/d/1OvtRsc0zhP4praQAW0quASk8Ym6Ibd0-/view?usp=drive_link

#PDF ประกอบการเรียน Google Login : https://drive.google.com/file/d/1n9fccq59G4bz1ifkvBmZO3b1q7ooEnHE/view?usp=drive_link

#link ไฟล์ Code google login: 

อยากเร็วและง่าย ทำตามนี้
1. จัดเตรียม clientId  และ clientSecret  โดยการสร้าง chanel login ก่อน ตามคลิปสอนช่วงแรกๆ
2. สร้าง Folder ชื่ออะไรก็ได้
3. ดาวน์โหลดไฟล์มาให้หมดแล้วนำไปใส่ใน folder
4. ไฟล์ ชื่อ scriptLinelogin.js นำ clientId  มาวาง  ตรงบรรทัดที่ 6 แทน xxxxxxxxxxx และ clientSecret ด้วย
8. ไฟล์ ชื่อ scriptPageme.js นำ clientId  มาวาง  ตรงบรรทัดที่ 6 แทน xxxxxxxxxxx และ clientSecret ด้วย
11. ทดสอบโดยถ้าใช้ vs code ให้ทดสอบที่ ไฟล์ index.html ถ้า https://replit.com/~ ให้ คลิก open a new tab
12 เมื่อรันแล้วระบบจะเริ่มให้ลงทะเบียนครั้งแรกก่อน ด้วยการเติมข้อความแล้วกด submit ระบบจะกลับให้ login อีกครั้ง
13. เมื่อ login อีกครั้ง จะถามหา otp passcode ลองเช็คเมลล์ดู นำมาใส่
14. ระบบจะรันเข้าสู่หน้า Dashboard
15. success

#อยากทำทีละขั้นตามขึ้นตอน นี้นะครับ
1. จัดเตรียม clientId  และ clientSecret  โดยการสร้าง chanel login ก่อน ตามคลิปสอนช่วงแรกๆ
2. สร้าง Folder ชื่ออะไรก็ได้
3. นำไฟล์ภาพ ปุ่ม ชื่อว่า ไฟล์ btn_login_base.png มาใส่ใน Folder
4. สร้างไฟล์ที่ 1 ชื่อ index.html 
5. สร้างไฟล์ที่ 2 ชื่อ scriptLinelogin.js นำ clientId  มาวาง  ตรงบรรทัดที่ 6 แทน xxxxxxxxxxx และ clientSecret ด้วย
6. สร้างไฟล์ที่ 3 ชื่อ style.css
7. สร้างไฟล์ที่ 4 ชื่อ pageme.html
8. สร้างไฟล์ที่ 5 ชื่อ scriptPageme.js นำ clientId  มาวาง  ตรงบรรทัดที่ 6 แทน xxxxxxxxxxx และ clientSecret ด้วย
9. สร้างไฟล์ที่ 6 (สุดท้าย) ชื่อ styledashboard.css
10. สำเนาไฟล์ google sheet ที่ เป็น api และเปลี่ยนไอดีชีต ในสคริปต์ บรรทัดที่ 2 
    ลิงค์ สำเนา sheet https://docs.google.com/spreadsheets/d/1nH56OQCUPrlcgBB0xwpma40Zu0HnjSK-N04mDNJNjI8/edit#gid=1284909975
11. ทดสอบโดยถ้าใช้ vs code ให้ทดสอบที่ ไฟล์ index.html ถ้า https://replit.com/~ ให้ คลิก open a new tab
12 เมื่อรันแล้วระบบจะเริ่มให้ลงทะเบียนครั้งแรกก่อน ด้วยการเติมข้อความแล้วกด submit ระบบจะกลับให้ login อีกครั้ง
13. เมื่อ login อีกครั้ง จะถามหา otp passcode ลองเช็คเมลล์ดู นำมาใส่
14. ระบบจะรันเข้าสู่หน้า Dashboard
15. success

ข้อพึงระวัง 
1. ขณะทดสอบก่อนทำเสร็จ หากติดขัด eroror ให้ลองเช็คที่ console เนื่องจากระบบนี้ จะมีการบันทึกลง local storage ด้วย และ จะลบเครียร์เองเมื่อ logout
2. แนะนำทำตามขั้นตอนตั้งแต่ต้น อย่าพยายามข้ามขั้นตอนนะครับ



 

