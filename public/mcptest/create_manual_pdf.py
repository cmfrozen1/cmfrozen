import os
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

FONT_REGULAR_PATH = '/home/it-teerapong/.local/share/fonts/Unknown Vendor/TrueType/TH SarabunPSK/TH_SarabunPSK_Bold.ttf'
pdfmetrics.registerFont(TTFont('THSarabun', FONT_REGULAR_PATH))

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            super().showPage()
        super().save()

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont("THSarabun", 12)
        self.setFillColor(colors.HexColor("#718096"))
        
        # Header
        self.drawString(54, 800, "คู่มือการตั้งค่า LINE MCP Server - ตอบคำถามจาก Google Sheet อัตโนมัติ")
        self.setStrokeColor(colors.HexColor("#CBD5E0"))
        self.setLineWidth(0.5)
        self.line(54, 792, 541, 792)

        # Footer
        self.line(54, 50, 541, 50)
        page_text = f"หน้า {self._pageNumber} จาก {page_count}"
        self.drawRightString(541, 35, page_text)
        self.drawString(54, 35, "เอกสารจัดทำสำหรับ: คุณธีรพงศ์ | ระบบ cmfrozen mcptest")
        self.restoreState()

def create_manual_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=54,
        rightMargin=54,
        topMargin=64,
        bottomMargin=60
    )

    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'TitleStyle',
        fontName='THSarabun',
        fontSize=24,
        leading=26,
        textColor=colors.HexColor("#1A365D"),
        spaceAfter=6
    )

    subtitle_style = ParagraphStyle(
        'SubtitleStyle',
        fontName='THSarabun',
        fontSize=14,
        leading=16,
        textColor=colors.HexColor("#2B6CB0"),
        spaceAfter=10
    )

    h1_style = ParagraphStyle(
        'H1Style',
        fontName='THSarabun',
        fontSize=17,
        leading=20,
        textColor=colors.HexColor("#2C5282"),
        spaceBefore=10,
        spaceAfter=6
    )

    body_style = ParagraphStyle(
        'BodyStyle',
        fontName='THSarabun',
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#2D3748"),
        spaceAfter=5
    )

    code_style = ParagraphStyle(
        'CodeStyle',
        fontName='THSarabun',
        fontSize=12,
        leading=14,
        textColor=colors.HexColor("#742A2A"),
        spaceAfter=4
    )

    story = []

    # Title Banner
    story.append(Paragraph("<b>📘 คู่มือการตั้งค่า LINE MCP Server</b>", title_style))
    story.append(Paragraph("<b>ระบบตอบคำถามและค้นหาข้อมูลจาก Google Sheet อัตโนมัติด้วย Flex Message</b>", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#3182CE"), spaceAfter=10))

    # Section 1
    story.append(Paragraph("<b>1. สรุปภาพรวมการทำงาน (Overview)</b>", h1_style))
    story.append(Paragraph("ระบบ LINE MCP Server ได้รับการอัปเกรดให้เชื่อมต่อกับ <b>Google Sheet</b> (ข้อมูลพนักงาน) แบบ Real-time เมื่อมีผู้ใช้ทักทายเข้ามาทางแชท LINE ตัวบอทจะดึงข้อมูลจาก Sheet มาวิเคราะห์และสร้างเป็น <b>LINE Flex Message</b> สวยงาม ตอบกลับผู้ใช้ทุกคนโดยอัตโนมัติทันที", body_style))
    
    # URL Table
    url_data = [
        [Paragraph("<b>รายการ</b>", body_style), Paragraph("<b>รายละเอียด / ลิงก์</b>", body_style)],
        [Paragraph("Google Sheet URL", body_style), Paragraph("<a href='https://docs.google.com/spreadsheets/d/10Wm5nWoDe_mYSKMAZh8Db1jqLtcvap2mhfOdO1QDMdM'>https://docs.google.com/spreadsheets/d/10Wm5n...</a>", body_style)],
        [Paragraph("Webhook Endpoint", body_style), Paragraph("https://rmhnq-110-164-68-211.run.pinggy-free.link/webhook", body_style)],
        [Paragraph("รูปแบบการตอบกลับ", body_style), Paragraph("LINE Flex Message (การ์ดหรูหรา / Carousel สไลด์)", body_style)]
    ]
    t_url = Table(url_data, colWidths=[130, 357])
    t_url.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#EBF8FF")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor("#2B6CB0")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#BEE3F8")),
        ('PADDING', (0,0), (-1,-1), 4),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_url)
    story.append(Spacer(1, 8))

    # Section 2
    story.append(Paragraph("<b>2. คำสั่งที่ผู้ใช้งานสามารถพิมพ์ถามใน LINE</b>", h1_style))
    
    cmd_data = [
        [Paragraph("<b>คำถาม / คำค้นหา</b>", body_style), Paragraph("<b>ตัวอย่างคำที่พิมพ์</b>", body_style), Paragraph("<b>รูปแบบการตอบกลับของ MCP</b>", body_style)],
        [Paragraph("1. ทักทายทั่วไป", body_style), Paragraph("สวัสดี, หวัดดี, สอบถาม", body_style), Paragraph("แสดง Flex Card ภาพรวมพนักงานทั้งหมด 20 ท่าน และแผนกทั้งหมด", body_style)],
        [Paragraph("2. ค้นหาชื่อ-นามสกุล", body_style), Paragraph("สมชาย, พิมพา, กฤษฎา", body_style), Paragraph("แสดง Flex Card รายละเอียดพนักงาน (รหัส, แผนก, ที่อยู่, เงินเดือน)", body_style)],
        [Paragraph("3. ค้นหาตามแผนก", body_style), Paragraph("IT, HR, Sales, Finance", body_style), Paragraph("แสดง Flex Carousel สไลด์การ์ดพนักงานทุกคนในแผนกนั้น", body_style)],
        [Paragraph("4. ค้นหาตามรหัส/จังหวัด", body_style), Paragraph("EMP001, กรุงเทพฯ, เชียงใหม่", body_style), Paragraph("แสดง Flex Card พนักงานที่อยู่ในจังหวัดหรือรหัสนั้นๆ", body_style)],
        [Paragraph("5. ราคาทอง / ราคาน้ำมัน", body_style), Paragraph("ราคาทอง, ราคาน้ำมัน", body_style), Paragraph("แสดง Flex Card ราคาทองคำแท่ง/รูปพรรณ และน้ำมันบางจาก Real-time", body_style)]
    ]
    t_cmd = Table(cmd_data, colWidths=[110, 130, 247])
    t_cmd.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#EDF2F7")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E0")),
        ('PADDING', (0,0), (-1,-1), 4),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(t_cmd)
    story.append(Spacer(1, 8))

    # Section 3
    story.append(Paragraph("<b>3. ข้อมูลใน Google Sheet ที่ระบบจดจำไว้ (ตัวอย่างข้อมูล 20 รายการ)</b>", h1_style))
    story.append(Paragraph("ระบบดึงข้อมูลโครงสร้าง CSV จาก Google Sheet โดยมีคอลัมน์สำคัญ ได้แก่: <b>แผนก, รหัสพนักงาน, ชื่อ สกุลพนักงาน, ที่อยู่ปัจจุบัน, เงินเดือน, รูปโปรไฟล์</b>", body_style))
    
    emp_sample = [
        [Paragraph("<b>รหัส</b>", body_style), Paragraph("<b>ชื่อ - สกุล</b>", body_style), Paragraph("<b>แผนก</b>", body_style), Paragraph("<b>ที่อยู่ปัจจุบัน</b>", body_style), Paragraph("<b>เงินเดือน</b>", body_style)],
        [Paragraph("EMP001", body_style), Paragraph("สมชาย ใจดี", body_style), Paragraph("IT", body_style), Paragraph("123 ถ.สุขุมวิท กรุงเทพฯ", body_style), Paragraph("35,000 บาท", body_style)],
        [Paragraph("EMP002", body_style), Paragraph("สมหญิง รักเรียน", body_style), Paragraph("HR", body_style), Paragraph("456 ถ.พญาไท กรุงเทพฯ", body_style), Paragraph("28,000 บาท", body_style)],
        [Paragraph("EMP004", body_style), Paragraph("มานะ พากเพียร", body_style), Paragraph("Sales", body_style), Paragraph("12 อ.หาดใหญ่ สงขลา", body_style), Paragraph("45,000 บาท", body_style)],
        [Paragraph("EMP006", body_style), Paragraph("ชูใจ ไพศาล", body_style), Paragraph("Finance", body_style), Paragraph("56 ถ.สีลม กรุงเทพฯ", body_style), Paragraph("42,000 บาท", body_style)]
    ]
    t_emp = Table(emp_sample, colWidths=[60, 110, 60, 167, 90])
    t_emp.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#FEFCBF")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#ECC94B")),
        ('PADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_emp)
    
    # Page Break for Setup Instructions
    story.append(PageBreak())

    # Section 4
    story.append(Paragraph("<b>4. ขั้นตอนการตั้งค่า LINE Developers Console (Webhook Setup)</b>", h1_style))
    story.append(Paragraph("เพื่อให้ LINE ส่งข้อความจากผู้ใช้มาหา MCP Server อัตโนมัติ ให้ตั้งค่าดังนี้:", body_style))
    
    steps = [
        "1. เข้าไปที่เว็บไซต์ <b>LINE Developers Console</b> (https://developers.line.me)",
        "2. เลือก Provider และเลือก <b>Messaging API Channel</b> ของคุณ",
        "3. ไปที่แท็บ <b>Messaging API</b> แล้วค้นหาหัวข้อ <b>Webhook URL</b>",
        "4. ใส่ URL: <code>https://rmhnq-110-164-68-211.run.pinggy-free.link/webhook</code>",
        "5. กดปุ่ม <b>Update</b> แล้วกดปุ่ม <b>Verify</b> เพื่อทดสอบสถานะการเชื่อมต่อ",
        "6. เปิดสวิตช์ <b>Use webhook</b> ให้เป็น <b>On (สีเขียว)</b>"
    ]
    for step in steps:
        story.append(Paragraph(step, body_style))
        story.append(Spacer(1, 2))

    story.append(Spacer(1, 10))

    # Section 5
    story.append(Paragraph("<b>5. การรันเซิร์ฟเวอร์ด้วยตนเอง (Local Server Execution)</b>", h1_style))
    story.append(Paragraph("หากต้องการสั่งรันเซิร์ฟเวอร์ MCP และเปิดพอร์ต Webhook ในเครื่องของคุณ สามารถรันคำสั่ง Terminal ได้ดังนี้:", body_style))

    cmd_box = [
        [Paragraph("<b>คำสั่งรัน MCP Server (Node.js):</b>", body_style)],
        [Paragraph("<code>cd /home/it-teerapong/Desktop/cmfrozen/public/mcptest<br/>node line-mcp-server.js test</code>", code_style)],
        [Paragraph("<b>คำสั่งเปิด HTTPS Tunnel (Pinggy):</b>", body_style)],
        [Paragraph("<code>ssh -p 443 -R0:localhost:3000 a.pinggy.io</code>", code_style)]
    ]
    t_box = Table(cmd_box, colWidths=[487])
    t_box.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F7FAFC")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_box)
    story.append(Spacer(1, 15))

    # Sign-off box
    sign_box = [
        [Paragraph("<b>✅ ระบบพร้อมใช้งานสมบูรณ์</b><br/>หากมีการแก้ไขข้อมูลพนักงานเพิ่มเติมใน Google Sheet บอท MCP จะอัปเดตข้อมูลมาตอบให้โดยอัตโนมัติ ไม่ต้องรีสตาร์ทเซิร์ฟเวอร์", body_style)]
    ]
    t_sign = Table(sign_box, colWidths=[487])
    t_sign.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#C6F6D5")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#38A169")),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_sign)

    doc.build(story, canvasmaker=NumberedCanvas)

if __name__ == '__main__':
    create_manual_pdf('/home/it-teerapong/Desktop/cmfrozen/public/mcptest/MANUAL_LINE_MCP_GOOGLESHEET.pdf')
