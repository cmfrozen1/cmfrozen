"use client";

import React, { useState, useEffect } from "react";
import {
  Snowflake,
  Thermometer,
  Truck,
  Calculator,
  ShieldCheck,
  Clock,
  Phone,
  Mail,
  MapPin,
  Menu,
  X,
  ChevronRight,
  Sun,
  Moon,
  ArrowRight,
  Activity,
  Gauge,
  Database,
  Check,
  TrendingDown,
  Building,
  Award,
  Zap,
  Globe,
  Package,
  Layers,
  Sparkles,
  ChevronDown,
  Leaf
} from "lucide-react";

// Types
interface ProductSpec {
  nameTh: string;
  nameEn: string;
  temp: string;
  humidity: string;
  palletFactor: number; // Tons per pallet
  cartonWeight: number; // kg per carton
  tipsTh: string;
  tipsEn: string;
}

const PRODUCT_SPECS: Record<string, ProductSpec> = {
  edamame: {
    nameTh: "ถั่วแระญี่ปุ่นแช่แข็ง",
    nameEn: "Frozen Edamame",
    temp: "-18°C ถึง -22°C",
    humidity: "85% - 90%",
    palletFactor: 0.95, 
    cartonWeight: 10,
    tipsTh: "ควรจัดเก็บในอุณหภูมิคงที่เพื่อป้องกันการตกผลึกของเกล็ดน้ำแข็ง และรักษาความหวานธรรมชาติรวมถึงสีเขียวสดของถั่วฝักสด",
    tipsEn: "Store at a constant temperature to prevent ice recrystallization and preserve the natural sweetness and vibrant green color of the pods."
  },
  sweetcorn: {
    nameTh: "ข้าวโพดหวานแช่แข็ง",
    nameEn: "Frozen Sweet Corn",
    temp: "-18°C ถึง -20°C",
    humidity: "85%",
    palletFactor: 1.1,
    cartonWeight: 12,
    tipsTh: "ข้าวโพดหวานแกะเมล็ดต้องคัดแยกเศษฝอยอย่างสะอาดและรักษาระดับความเย็นคงที่ เพื่อป้องกันโครงสร้างเมล็ดฝ่อและแห้งเมื่อละลาย",
    tipsEn: "Sweet corn kernels must be thoroughly cleaned of silk and kept at a stable deep freeze to prevent kernel shriveling upon thawing."
  },
  greenbeans: {
    nameTh: "ถั่วแขกแช่แข็ง",
    nameEn: "Frozen Green Beans",
    temp: "-18°C ถึง -20°C",
    humidity: "90%",
    palletFactor: 0.85,
    cartonWeight: 8,
    tipsTh: "ถั่วแขกแช่แข็งต้องการการบรรจุหีบห่อที่ป้องกันแรงกระแทกเพื่อหลีกเลี่ยงการหักงอของฝักเมื่อเย็นจัดจนเปราะบาง",
    tipsEn: "Frozen green beans require protective packaging to prevent pod breakage, as they become brittle under deep-freeze temperatures."
  },
  mixedveg: {
    nameTh: "ผักรวมหั่นเต๋าแช่แข็ง",
    nameEn: "Frozen Mixed Veggies",
    temp: "-18°C ถึง -22°C",
    humidity: "85%",
    palletFactor: 1.0,
    cartonWeight: 10,
    tipsTh: "การกระจายตัวของผักรวมหั่นเต๋าต้องคงความสม่ำเสมอ ป้องกันการแยกชั้นตามระดับน้ำหนักและขนาดของผักหลากชนิดระหว่างการเคลื่อนย้าย",
    tipsEn: "Ensure uniform distribution of mixed diced vegetables to prevent separation of weight and sizes during shipment and handling."
  }
};

export default function Home() {
  // Navigation & UI States
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [lang, setLang] = useState<"th" | "en">("th");
  
  // Products Section Active state
  const [activeProductTab, setActiveProductTab] = useState("edamame");

  // Calculator State
  const [calcProduct, setCalcProduct] = useState("edamame");
  const [calcWeight, setCalcWeight] = useState(50); // tons
  const [calcDest, setCalcDest] = useState("japan");

  // Contact Form State
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formCompany, setFormCompany] = useState("");
  const [formProduct, setFormProduct] = useState("edamame");
  const [formWeight, setFormWeight] = useState("50");
  const [formMessage, setFormMessage] = useState("");
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formError, setFormError] = useState("");

  // Theme & Scroll Handler
  useEffect(() => {
    const isDarkSaved = localStorage.getItem("theme") === "dark" || 
      (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setIsDark(isDarkSaved);
    if (isDarkSaved) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    const handleScroll = () => {
      if (window.scrollY > 20) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setIsDark(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setIsDark(true);
    }
  };

  // Copy Calculator info to Contact Form
  const handleApplyCalcToForm = () => {
    setFormProduct(calcProduct);
    setFormWeight(calcWeight.toString());
    const spec = PRODUCT_SPECS[calcProduct];
    const destinationTh = calcDest === "japan" ? "ญี่ปุ่น" : calcDest === "usa_eu" ? "สหรัฐอเมริกา/ยุโรป" : calcDest === "asia" ? "เอเชียตะวันออก" : "ในประเทศ";
    const destinationEn = calcDest === "japan" ? "Japan" : calcDest === "usa_eu" ? "USA/Europe" : calcDest === "asia" ? "East Asia" : "Domestic";
    
    if (lang === "th") {
      setFormMessage(`สนใจติดต่อสอบถามข้อมูลการส่งออก/สั่งซื้อ "${spec.nameTh}" ปริมาณประมาณ ${calcWeight} ตัน ปลายทางส่งออก: ประเทศ${destinationTh}`);
    } else {
      setFormMessage(`Inquiry about exporting/purchasing "${spec.nameEn}" with estimate quantity of ${calcWeight} Tons. Target destination: ${destinationEn}`);
    }
    
    // Smooth scroll to contact section
    const contactSection = document.getElementById("contact");
    if (contactSection) {
      contactSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Handle Form Submit
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formPhone) {
      setFormError(lang === "th" ? "กรุณากรอกชื่อผู้ติดต่อและเบอร์โทรศัพท์" : "Please fill in contact name and phone number");
      return;
    }
    
    // Simple email validation if filled
    if (formEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail)) {
      setFormError(lang === "th" ? "กรุณากรอกอีเมลในรูปแบบที่ถูกต้อง" : "Please enter a valid email format");
      return;
    }

    setFormError("");
    setFormSubmitted(true);
  };

  // Live Calculations
  const currentSpec = PRODUCT_SPECS[calcProduct];
  const calculatedPallets = Math.ceil(calcWeight / currentSpec.palletFactor);
  const calculatedCartons = Math.ceil((calcWeight * 1000) / currentSpec.cartonWeight);
  
  // Reefer Container logic (20ft holds ~12 tons, 40ft holds ~24 tons)
  let containerEstimation = "";
  if (calcWeight <= 12) {
    containerEstimation = lang === "th" ? "ตู้เย็น 20 ฟุต (20ft Reefer Container) จำนวน 1 ตู้" : "1 x 20ft Reefer Container";
  } else if (calcWeight <= 24) {
    containerEstimation = lang === "th" ? "ตู้เย็น 40 ฟุต (40ft Reefer Container) จำนวน 1 ตู้" : "1 x 40ft Reefer Container";
  } else {
    const qty40ft = Math.floor(calcWeight / 24);
    const remainder = calcWeight % 24;
    if (remainder === 0) {
      containerEstimation = lang === "th" ? `ตู้เย็น 40 ฟุต (40ft Reefer Container) จำนวน ${qty40ft} ตู้` : `${qty40ft} x 40ft Reefer Containers`;
    } else if (remainder <= 12) {
      containerEstimation = lang === "th" ? `ตู้เย็น 40 ฟุต จำนวน ${qty40ft} ตู้ + ตู้เย็น 20 ฟุต จำนวน 1 ตู้` : `${qty40ft} x 40ft Reefer + 1 x 20ft Reefer`;
    } else {
      containerEstimation = lang === "th" ? `ตู้เย็น 40 ฟุต (40ft Reefer Container) จำนวน ${qty40ft + 1} ตู้` : `${qty40ft + 1} x 40ft Reefer Containers`;
    }
  }

  // Dictionary for Bilingual support
  const text = {
    th: {
      metaTitle: "บริษัท เชียงใหม่โฟรเซ่นฟู้ดส์ จำกัด (มหาชน)",
      ticker: "SET: CM",
      standardText: "มาตรฐานอาหารปลอดภัยระดับสากล",
      heroBadge: "ผู้ผลิตและส่งออกผักผลไม้แช่แข็งระดับโลก • SET: CM",
      heroTitle: "คุณค่าความสดใหม่",
      heroTitleColor: "ส่งตรงจากไร่ภาคเหนือสู่สากล",
      heroDesc: "บริษัท เชียงใหม่โฟรเซ่นฟู้ดส์ จำกัด (มหาชน) ผู้นำธุรกิจแปรรูปและส่งออกผักแช่แข็งด้วยเทคโนโลยีแช่แข็งฉับพลัน IQF ชั้นนำกว่า 30 ปี ร่วมขับเคลื่อนเกษตรกรรมอย่างยั่งยืนผ่านระบบเกษตรพันธสัญญา",
      btnCalc: "คำนวณการบรรจุส่งออก",
      btnContact: "ติดต่อฝ่ายขาย/ส่งออก",
      statExp: "30+ ปี",
      statExpDesc: "แห่งความเชื่อมั่นในเวทีโลก",
      statCap: "2 โรงงาน",
      statCapDesc: "กำลังการผลิตในเชียงใหม่",
      statFarmers: "10,000+ ไร่",
      statFarmersDesc: "เกษตรพันธสัญญารับรองผล",
      statTon: "25k+ ตัน",
      statTonDesc: "ผลผลิตส่งออกต่อปี",
      secAboutTitle: "เกี่ยวกับเรา",
      secAboutHeading: "คุณภาพที่เป็นที่ยอมรับในระดับสากล จากแหล่งเพาะปลูกธรรมชาติ",
      secAboutDesc1: "บริษัท เชียงใหม่โฟรเซ่นฟู้ดส์ จำกัด (มหาชน) หรือย่อย่อว่า 'CM' เป็นบริษัทจดทะเบียนในตลาดหลักทรัพย์แห่งประเทศไทย ดำเนินธุรกิจผลิตและจัดจำหน่ายผักแช่เยือกแข็ง โดยมีฐานการผลิตหลักตั้งอยู่ในจังหวัดเชียงใหม่ แหล่งเกษตรกรรมที่อุดมสมบูรณ์ที่สุดของภาคเหนือ",
      secAboutDesc2: "เราทำงานร่วมกับเกษตรกรท้องถิ่นหลายพันครัวเรือนภายใต้โครงการเกษตรพันธสัญญา (Contract Farming) เพื่อให้มั่นใจได้ว่า วัตถุดิบทุกชนิดจะได้รับการเพาะปลูก ปลอดสารเคมีต้องห้าม และเก็บเกี่ยวในช่วงเวลาที่สมบูรณ์ที่สุด ก่อนเข้าสู่กระบวนการแปรรูปแช่เยือกแข็งฉับพลัน IQF (Individual Quick Freezing) ทันทีเพื่อล็อกความสด รสหวาน และวิตามินไว้อย่างครบถ้วน",
      point1Title: "ระบบตรวจสอบย้อนกลับ (Traceability)",
      point1Desc: "สินค้าทุกถุงสามารถระบุย้อนกลับไปได้ถึงแปลงเพาะปลูกและวันเก็บเกี่ยวอย่างละเอียด",
      point2Title: "โรงงานแปรรูปเทคโนโลยีสูง",
      point2Desc: "เครื่องจักรคัดแยกสี ลอกเปลือก และแช่เยือกแข็งจากต่างประเทศ รองรับความสะอาดขั้นสูงสุด",
      point3Title: "พันธมิตรร่วมพัฒนาสังคม",
      point3Desc: "สนับสนุนการกระจายรายได้สู่เกษตรกรทางภาคเหนือ เสริมสร้างความมั่นคงและยั่งยืนร่วมกัน",
      secProdTitle: "ผลิตภัณฑ์หลักของเรา",
      secProdDesc: "ผักสดคัดเกรดพิเศษ ผ่านกระบวนการล้าง ตัดแต่ง และแช่แข็งฉับพลัน รักษาคุณภาพเสมือนเพิ่งเก็บเกี่ยวจากไร่",
      prodSpecTitle: "ข้อมูลจำเพาะเชิงเทคนิค",
      prodSpecTemp: "อุณหภูมิเก็บรักษาที่แนะนำ",
      prodSpecHum: "ความชื้นสัมพัทธ์ในห้องเย็น",
      prodSpecCarton: "น้ำหนักบรรจุมาตรฐานต่อกล่อง",
      prodSpecMarket: "ตลาดส่งออกหลัก",
      prodMarketText: "ญี่ปุ่น, สหรัฐอเมริกา, สหภาพยุโรป, ไต้หวัน และตลาดในประเทศ",
      secFarmingTitle: "เกษตรพันธสัญญา (Contract Farming)",
      secFarmingHeading: "เติบโตเคียงคู่กับชุมชนเกษตรกรอย่างยั่งยืน",
      secFarmingDesc: "เราจัดตั้งทีมงานนักเกษตรศาสตร์ผู้เชี่ยวชาญ เข้าไปส่งเสริมให้คำแนะนำ แนะนำการเพาะปลูก เมล็ดพันธุ์ และการใช้ปุ๋ยเคมีอย่างถูกวิธีตามกรณฑ์ความปลอดภัยสากลแก่เกษตรกรในจังหวัดเชียงใหม่และใกล้เคียง พร้อมทั้งรับประกันการรับซื้อผลผลิตทั้งหมดในราคาที่เป็นธรรมเพื่อความยั่งยืนของเกษตรกร",
      timelineTitle: "เส้นทางสร้างคุณภาพจากแปลงเพาะปลูกสู่สากล",
      tlStep1: "1. คัดเลือกแปลงและเมล็ดพันธุ์",
      tlStep1Desc: "คัดสรรแปลงเพาะปลูกที่อุดมสมบูรณ์ จ่ายเมล็ดพันธุ์คุณภาพสูงที่ได้รับการตรวจสอบอัตราการงอก",
      tlStep2: "2. ควบคุมดูแลโดยเกษตรกรและนักวิชาการ",
      tlStep2Desc: "ทีมงานนักวิชาการเกษตรลงพื้นที่ตรวจสอบความปลอดภัย การใช้ปุ๋ย และตรวจวิเคราะห์สารตกค้างก่อนเก็บเกี่ยว",
      tlStep3: "3. เก็บเกี่ยวและขนส่งควบคุมอุณหภูมิ",
      tlStep3Desc: "เก็บเกี่ยวในช่วงเช้ามืดที่แดดไม่จัด และรีบขนส่งเข้าสู่โรงงานภายในเวลาไม่กี่ชั่วโมงเพื่อเลี่ยงการเน่าเสีย",
      tlStep4: "4. แปรรูปแช่เยือกแข็งฉับพลัน IQF",
      tlStep4Desc: "ล้าง คัดขนาด และผ่านตู้แช่แข็งลมแรงเยือกแข็งฉับพลัน -40°C ล็อกความสดในระดับเซลล์",
      tlStep5: "5. ตรวจสอบสิ่งแปลกปลอมขั้นสูง",
      tlStep5Desc: "ผ่านเครื่องคัดแยกสี (Color Sorter) เครื่องตรวจจับโลหะ (Metal Detector) และตรวจสอบสากลทางแล็บ",
      tlStep6: "6. จัดส่งและกระจายสินค้าสู่ลูกค้าทั่วโลก",
      tlStep6Desc: "บรรจุกล่องกระดาษป้องกันความชื้น จัดเก็บในคลังสินค้าควบคุมอุณหภูมิ และโหลดส่งออกตู้ Reefer",
      secCalcTitle: "เครื่องคำนวณการบรรจุและตู้ขนส่งส่งออก",
      secCalcDesc: "ระบบคำนวณประมาณการพื้นที่จัดเก็บ พาเลท จำนวนกล่องบรรจุ และตู้คอนเทนเนอร์เย็นที่เหมาะสมเบื้องต้นสำหรับผักแช่เยือกแข็งแต่ละประเภท",
      calcProductLabel: "เลือกประเภทผักแช่เยือกแข็ง",
      calcWeightLabel: "น้ำหนักวัตถุดิบที่ต้องการสั่งซื้อ/บรรจุ (ตัน)",
      calcDestLabel: "ปลายทางส่งออกสินค้า",
      destJapan: "ญี่ปุ่น (Japan)",
      destUsaEu: "สหรัฐอเมริกา/ยุโรป (USA/Europe)",
      destAsia: "เอเชียตะวันออก (East Asia)",
      destDomestic: "ภายในประเทศ (Domestic)",
      calcResultTitle: "ผลประเมินหีบห่อและโลจิสติกส์การส่งออก",
      calcResultLive: "คำนวณแบบสด",
      calcResultTemp: "อุณหภูมิควบคุมแช่แข็ง",
      calcResultHum: "ความชื้นสัมพัทธ์แนะนำ",
      calcResultCarton: "จำนวนกล่องสินค้าโดยประมาณ",
      calcResultPallet: "จำนวนพาเลทที่ใช้จัดวาง",
      calcResultReefer: "ประมาณการตู้ Reefer ที่ต้องใช้",
      calcResultTip: "ข้อแนะนำทางเทคนิคสำหรับการจัดส่ง:",
      calcBtnApply: "ส่งผลลัพธ์ข้อมูลคำนวณเข้าสู่แบบฟอร์มติดต่อ",
      calcDisclaimer: "* ค่าคำนวณเป็นค่าประมาณการเบื้องต้น ทีมวิศวกรขนส่งและส่งออกของ CM Frozen จะยืนยันการจัดวางและขนาดตู้จริงอีกครั้งตามขนาดหีบห่อเฉพาะเจาะจง",
      secCertTitle: "มาตรฐานและใบรับรองคุณภาพ",
      secCertDesc: "ความไว้วางใจจากผู้บริโภคทั่วโลกด้วยใบรับรองมาตรฐานอุตสาหกรรมสูงสุด",
      secContactTitle: "ติดต่อเรา",
      secContactHeading: "ร่วมเป็นพันธมิตรกับผู้ผลิตผักแช่แข็งชั้นนำ",
      secContactDesc: "ฝ่ายขายและฝ่ายส่งออกยินดีให้ข้อมูลรายละเอียดราคาสินค้า เงื่อนไขการจัดส่ง และเอกสารใบรับรองผลแล็บต่างๆ ส่งคำถามถึงเราได้ผ่านแบบฟอร์ม",
      contactHq: "สำนักงานใหญ่ (กรุงเทพฯ)",
      contactHqAddr: "149/34 ซอยแองโกลพลาซ่า ถนนสุรวงศ์ แขวงสุริยวงศ์ เขตบางรัก กรุงเทพฯ 10500",
      contactHqTel: "โทรศัพท์: 02-634-0061 ถึง 4 | แฟกซ์: 02-238-4090",
      contactFactory1: "โรงงานสันทราย 1 (เชียงใหม่)",
      contactFactory1Addr: "92 หมู่ที่ 3 ต.หนองจ๊อม อ.สันทราย จ.เชียงใหม่ 50210",
      contactFactory1Tel: "โทรศัพท์: 053-844-961 ถึง 4 | แฟกซ์: 053-498-199",
      contactFactory2: "โรงงานสันทราย 2 (เชียงใหม่)",
      contactFactory2Addr: "299 หมู่ที่ 14 ต.แม่แฝกใหม่ อ.สันทราย จ.เชียงใหม่ 50290",
      contactFactory2Tel: "โทรศัพท์: 053-848-088 ถึง 94 | แฟกซ์: 053-848-097",
      formTitle: "แบบฟอร์มติดต่อสอบถามและขอใบเสนอราคา",
      formName: "ชื่อผู้ติดต่อ *",
      formNamePl: "เช่น คุณกฤษดา รักความเย็น",
      formPhone: "เบอร์โทรศัพท์ *",
      formPhonePl: "เช่น 081-234-5678",
      formEmail: "อีเมลติดต่อ",
      formEmailPl: "เช่น customer@company.com",
      formCompany: "ชื่อบริษัท / ห้างร้าน",
      formCompanyPl: "เช่น บริษัท ค้าส่งผัก จำกัด",
      formProductLabel: "ผลิตภัณฑ์ที่สนใจ",
      formWeightLabel: "ปริมาณที่ต้องการ (ตัน)",
      formMessage: "ข้อความ/รายละเอียดเพิ่มเติม",
      formMessagePl: "กรุณาระบุรายละเอียด เช่น กำหนดส่งมอบ ปลายทาง หรือสเปกพิเศษที่ต้องการ",
      formBtnSubmit: "ส่งข้อมูลติดต่อขอข้อมูลการส่งออก",
      formSuccessTitle: "ส่งข้อมูลเรียบร้อยแล้ว!",
      formSuccessDesc: "ขอบคุณที่สนใจผลิตภัณฑ์ของบริษัท เชียงใหม่โฟรเซ่นฟู้ดส์ จำกัด (มหาชน) เจ้าหน้าที่ฝ่ายส่งออกและบริการลูกค้าจะตรวจสอบและติดต่อกลับท่านภายใน 24 ชั่วโมง",
      formBtnBack: "ส่งข้อมูลติดต่อใหม่",
      footerDesc: "บริษัท เชียงใหม่โฟรเซ่นฟู้ดส์ จำกัด (มหาชน) ผู้ผลิตและส่งออกผักผลไม้แช่เยือกแข็งมาตรฐานสากล คัดสรรความสดจากไร่ แปรรูปด้วยเทคโนโลยีทันสมัยเพื่อคุณภาพชีวิตที่ดีกว่า",
      footerWorkingHours: "เวลาทำการสำนักงานและโรงงาน",
      footerOfficeHours: "สำนักงานใหญ่: จันทร์ - ศุกร์ (08:30 - 17:30 น.)",
      footerFactoryHours: "ส่วนงานโรงงาน (เชียงใหม่): จันทร์ - เสาร์ (08:00 - 17:00 น.)",
      footerCopyright: "© 2026 Chiangmai Frozen Foods Public Company Limited. สงวนลิขสิทธิ์",
      footerLinks: "นโยบายและข้อตกลง",
      privacy: "นโยบายความเป็นส่วนตัว",
      terms: "ข้อตกลงและเงื่อนไข"
    },
    en: {
      metaTitle: "Chiangmai Frozen Foods Public Company Limited",
      ticker: "SET: CM",
      standardText: "Global Food Safety Standards",
      heroBadge: "World-Class Frozen Vegetables Manufacturer • SET: CM",
      heroTitle: "Premium Freshness",
      heroTitleColor: "From Northern Fields to the Global Market",
      heroDesc: "Chiangmai Frozen Foods Public Company Limited (CM) is a leader in manufacturing and exporting frozen agricultural products. Leveraging over 30 years of IQF technology and promoting sustainability via Contract Farming.",
      btnCalc: "Calculate Export Pack",
      btnContact: "Contact Export Sales",
      statExp: "30+ Years",
      statExpDesc: "of Trust in the Global Arena",
      statCap: "2 Plants",
      statCapDesc: "Processing Plants in Chiang Mai",
      statFarmers: "10,000+ Rai",
      statFarmersDesc: "Certified Contracted Farming",
      statTon: "25k+ Tons",
      statTonDesc: "Annual Export Production",
      secAboutTitle: "About Us",
      secAboutHeading: "Internationally Recognized Quality Sourced from Fertile Fields",
      secAboutDesc1: "Chiangmai Frozen Foods Public Company Limited (commonly known as 'CM') is a public company listed on the Stock Exchange of Thailand. We manufacture and distribute premium frozen vegetables, with main production bases in Chiang Mai, the most fertile agricultural region in Northern Thailand.",
      secAboutDesc2: "We collaborate with thousands of local farming families under our structured Contract Farming model. This ensures that crops are grown pesticide-free and harvested at their peak maturity, then immediately transported to our factories for advanced IQF (Individual Quick Freezing) processing to lock in natural sweetness, crunch, and nutritional values.",
      point1Title: "Full Traceability",
      point1Desc: "Every single product package can be tracked back to its original cultivation field and harvest date.",
      point2Title: "High-Tech Processing Lines",
      point2Desc: "Equipped with advanced color sorters, peelers, and IQF freezers from global leading manufacturers.",
      point3Title: "Social Development Partner",
      point3Desc: "Generating continuous income for northern farmers to build a strong, self-reliant farming community.",
      secProdTitle: "Our Premium Products",
      secProdDesc: "Selected fresh vegetables, cleaned, processed, and quick-frozen to preserve freshness as if they were just harvested.",
      prodSpecTitle: "Technical Specification",
      prodSpecTemp: "Recommended Temp",
      prodSpecHum: "Relative Humidity (RH)",
      prodSpecCarton: "Std. Weight per Carton",
      prodSpecMarket: "Primary Markets",
      prodMarketText: "Japan, United States, European Union, Taiwan, and Domestic markets.",
      secFarmingTitle: "Contract Farming Model",
      secFarmingHeading: "Growing Together Sustainably with Farmer Communities",
      secFarmingDesc: "We maintain a team of expert agronomists who visit and consult farmers in Chiang Mai and nearby provinces. We provide high-quality inspected seeds, guidance on safe fertilization, and guarantee a fair purchasing price for all yields to secure stable livelihoods.",
      timelineTitle: "From Field to Table: The Quality Lifecycle",
      tlStep1: "1. Land & Seed Selection",
      tlStep1Desc: "Sourcing rich agricultural lands and supplying high-germination, premium inspected seeds.",
      tlStep2: "2. Inspection & Field Guidance",
      tlStep2Desc: "CM Agronomists supervise cultivation, ensuring safe practices and zero chemical residues before harvest.",
      tlStep3: "3. Timely Harvest & Cool Log",
      tlStep3Desc: "Harvested at dawn to avoid heat, then promptly transported to our facilities within hours.",
      tlStep4: "4. IQF Instant Freezing",
      tlStep4Desc: "Washed, graded, and quick-frozen in a -40°C high-velocity blast freezer to preserve cellular integrity.",
      tlStep5: "5. Strict Contamination Screening",
      tlStep5Desc: "Inspected using color sorters, metal detectors, and audited by our international in-house quality laboratories.",
      tlStep6: "6. Cold Chain Export",
      tlStep6Desc: "Packed in moisture-barrier cartons, stored in temperature-controlled warehouses, and loaded into Reefer containers.",
      secCalcTitle: "Export Packing & Shipment Calculator",
      secCalcDesc: "Estimate the number of cartons, pallets, recommended container sizes, and freezing controls for your export orders.",
      calcProductLabel: "Select Vegetable Product",
      calcWeightLabel: "Required Quantity (Tons)",
      calcDestLabel: "Export Destination",
      destJapan: "Japan",
      destUsaEu: "USA / Europe",
      destAsia: "East Asia",
      destDomestic: "Domestic (Thailand)",
      calcResultTitle: "Packaging & Logistics Estimation",
      calcResultLive: "Live Calculation",
      calcResultTemp: "Control Freeze Temp",
      calcResultHum: "Recommended Humidity",
      calcResultCarton: "Est. Total Cartons",
      calcResultPallet: "Est. Pallets Needed",
      calcResultReefer: "Est. Reefers Required",
      calcResultTip: "Logistics Technical Advice:",
      calcBtnApply: "Apply Data to Inquiry Form",
      calcDisclaimer: "* Calculations are based on standard package sizes. Final layout and container booking will be verified by CM Frozen logistics team.",
      secCertTitle: "Global Certifications & Standards",
      secCertDesc: "Ensuring global consumers receive premium quality products with verified international industry credentials.",
      secContactTitle: "Contact Us",
      secContactHeading: "Partner with Thailand's Premier Frozen Exporter",
      secContactDesc: "Our sales and export specialists are ready to provide product pricing, container terms, and technical certificates. Submit your inquiry below.",
      contactHq: "Bangkok Head Office",
      contactHqAddr: "149/34 Anglo Plaza Lane, Surawong Road, Suriyawong, Bang Rak, Bangkok 10500 Thailand",
      contactHqTel: "Tel: +66 2634 0061 to 4 | Fax: +66 2238 4090",
      contactFactory1: "Chiang Mai Factory 1 (San Sai)",
      contactFactory1Addr: "92 Moo 3, Nong Chom Sub-district, San Sai District, Chiang Mai 50210 Thailand",
      contactFactory1Tel: "Tel: +66 5384 4961 to 4 | Fax: +66 5349 8199",
      contactFactory2: "Chiang Mai Factory 2 (San Sai)",
      contactFactory2Addr: "299 Moo 14, Mae Faek Mai Sub-district, San Sai District, Chiang Mai 50290 Thailand",
      contactFactory2Tel: "Tel: +66 5384 8088 to 94 | Fax: +66 5384 8097",
      formTitle: "Export Sales & Pricing Inquiry Form",
      formName: "Contact Name *",
      formNamePl: "e.g., Mr. David Smith",
      formPhone: "Phone Number *",
      formPhonePl: "e.g., +66 81 234 5678",
      formEmail: "Email Address",
      formEmailPl: "e.g., client@company.com",
      formCompany: "Company Name",
      formCompanyPl: "e.g., Global Veg Distributors Ltd.",
      formProductLabel: "Product of Interest",
      formWeightLabel: "Target Volume (Tons)",
      formMessage: "Inquiry / Special Specifications",
      formMessagePl: "Mention required shipping terms, container specs, or lab credentials.",
      formBtnSubmit: "Submit Export Inquiry",
      formSuccessTitle: "Inquiry Received Successfully!",
      formSuccessDesc: "Thank you for contacting Chiangmai Frozen Foods Public Company Limited (CM). Our export sales team will review your requirements and respond within 24 hours.",
      formBtnBack: "Submit Another Inquiry",
      footerDesc: "Chiangmai Frozen Foods Public Company Limited (CM) is a leading global supplier of frozen vegetables, committed to agricultural excellence, nutrition safety, and community empowerment.",
      footerWorkingHours: "Office & Factory Operating Hours",
      footerOfficeHours: "Bangkok Head Office: Mon - Fri (08:30 - 17:30)",
      footerFactoryHours: "Chiang Mai Plants: Mon - Sat (08:00 - 17:00)",
      footerCopyright: "© 2026 Chiangmai Frozen Foods Public Company Limited. All rights reserved.",
      footerLinks: "Policies & Terms",
      privacy: "Privacy Policy",
      terms: "Terms of Service"
    }
  };

  const t = text[lang];

  // Product descriptions and detailed points for tabs
  const productTabsData: Record<string, {
    title: string;
    desc: string;
    specs: { label: string; val: string }[];
  }> = {
    edamame: {
      title: lang === "th" ? "ถั่วแระญี่ปุ่นแช่แข็ง (Frozen Edamame)" : "Frozen Edamame",
      desc: lang === "th" 
        ? "ผลิตภัณฑ์หลักยอดนิยมอันดับหนึ่งของเรา ได้รับความไว้วางใจสูงสุดจากตลาดประเทศญี่ปุ่น คัดสรรเฉพาะฝักถั่วเหลืองสดที่มีความสมบูรณ์ 2-3 เมล็ด มีสีเขียวสดธรรมชาติ เมล็ดเต่งตึง รสหวานหอมเป็นเอกลักษณ์ ลวกและแช่แข็งฉับพลันภายในไม่กี่ชั่วโมงหลังการเก็บเกี่ยวเพื่อล็อกคุณประโยชน์สูงสุด"
        : "Our signature product and the top choice for the highly demanding Japanese market. We select only pristine pods with 2-3 plump kernels, boasting a natural green color, sweet taste, and signature aroma. Briefly blanched and quick-frozen within hours of harvest to lock in premium quality.",
      specs: [
        { label: t.prodSpecTemp, val: "-18°C ถึง -22°C" },
        { label: t.prodSpecHum, val: "85% - 90%" },
        { label: t.prodSpecCarton, val: "10 kg / carton" },
        { label: t.prodSpecMarket, val: t.prodMarketText }
      ]
    },
    sweetcorn: {
      title: lang === "th" ? "ข้าวโพดหวานแช่แข็ง (Frozen Sweet Corn)" : "Frozen Sweet Corn",
      desc: lang === "th" 
        ? "ข้าวโพดหวานสายพันธุ์คัดพิเศษ เพาะปลูกในที่ราบลุ่มแม่น้ำภาคเหนือที่มีอากาศเย็น เมล็ดข้าวโพดมีสีเหลืองทอง เปลือกเมล็ดบาง รสหวานและฉ่ำน้ำสูงมาก แปรรูปในรูปแบบเมล็ดล้วน (Kernels) และแบบฝักเดี่ยว (Cob) ปลอดสารเคมีตกค้างและได้เกรดความหวานสม่ำเสมอ"
        : "Selected sweet corn varieties cultivated in the fertile northern valley plains. The kernels have a brilliant golden color, thin skin, high sweetness, and juicy texture. Available in both Whole Kernels and Corn-on-the-Cob configurations, certified 100% pesticide-free and checked for sweetness grades.",
      specs: [
        { label: t.prodSpecTemp, val: "-18°C ถึง -20°C" },
        { label: t.prodSpecHum, val: "85%" },
        { label: t.prodSpecCarton, val: "12 kg / carton" },
        { label: t.prodSpecMarket, val: t.prodMarketText }
      ]
    },
    greenbeans: {
      title: lang === "th" ? "ถั่วแขกแช่แข็ง (Frozen Green Beans)" : "Frozen Green Beans",
      desc: lang === "th" 
        ? "ถั่วแขกสดคัดสรรฝักยาวเรียว ตรงสวย ไร้รอยเจาะทำลายของแมลงและปราศจากเส้นใยเหนียวด้านข้าง แปรรูปตัดแต่งรูปแบบตัดท่อน (Cut) หรือแบบทั้งฝักยาว (Whole) มีเนื้อกรอบ หวานละมุน และมีสีเขียวสว่างสดชื่นเมื่อนำไปประกอบอาหาร"
        : "Selected straight, slender green beans, free from blemishes or tough side fibers. Processed in Cut or Whole formats. Retains its tender-crisp texture, subtle sweet taste, and bright green presentation, making it highly desirable for restaurant and household cuisines.",
      specs: [
        { label: t.prodSpecTemp, val: "-18°C ถึง -20°C" },
        { label: t.prodSpecHum, val: "90%" },
        { label: t.prodSpecCarton, val: "8 kg / carton" },
        { label: t.prodSpecMarket, val: t.prodMarketText }
      ]
    },
    mixedveg: {
      title: lang === "th" ? "ผักรวมหั่นเต๋าแช่แข็ง (Frozen Mixed Vegetables)" : "Frozen Mixed Vegetables",
      desc: lang === "th" 
        ? "การรวมตัวของวัตถุดิบผักห้าสีคัดเกรด เช่น เมล็ดข้าวโพดหวาน แครอทหั่นเต๋า ถั่วลันเตา มันฝรั่ง และถั่วแขกหั่นท่อน ในสัดส่วนที่สมดุล สดใหม่ สะอาด พร้อมใช้ทันทีสำหรับอุตสาหกรรมอาหารแปรรูป เบเกอรี่ และร้านอาหารขนาดใหญ่"
        : "A vibrant blend of selected five-color vegetables, including sweet corn, diced carrots, green peas, potatoes, and cut green beans in precise, uniform ratios. Extremely fresh, clean, and ready-to-use for food processing manufacturers, bakery chains, and caterers.",
      specs: [
        { label: t.prodSpecTemp, val: "-18°C ถึง -22°C" },
        { label: t.prodSpecHum, val: "85%" },
        { label: t.prodSpecCarton, val: "10 kg / carton" },
        { label: t.prodSpecMarket, val: t.prodMarketText }
      ]
    }
  };

  return (
    <div className="flex-1 flex flex-col font-sans transition-colors duration-300">
      
      {/* 1. Sticky Header Navigation */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled 
          ? "glass shadow-lg py-3 border-b border-slate-200/40 dark:border-slate-800/40" 
          : "bg-transparent py-5"
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <a href="#" className="flex items-center gap-3 group">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-300">
                <Leaf className="w-6 h-6 animate-pulse-slow" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white leading-none">
                  CM FROZEN
                </span>
                <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 tracking-widest font-mono mt-1">
                  CHIANGMAI FROZEN FOODS
                </span>
              </div>
            </a>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-7">
              <a href="#about" className="text-sm font-semibold text-slate-600 hover:text-emerald-500 dark:text-slate-300 dark:hover:text-emerald-400 transition-colors">
                {t.navAbout}
              </a>
              <a href="#products" className="text-sm font-semibold text-slate-600 hover:text-emerald-500 dark:text-slate-300 dark:hover:text-emerald-400 transition-colors">
                {t.navProducts}
              </a>
              <a href="#farming" className="text-sm font-semibold text-slate-600 hover:text-emerald-500 dark:text-slate-300 dark:hover:text-emerald-400 transition-colors">
                {t.navFarming}
              </a>
              <a href="#calculator" className="text-sm font-semibold text-slate-600 hover:text-emerald-500 dark:text-slate-300 dark:hover:text-emerald-400 transition-colors">
                {t.secCalcTitle}
              </a>
              <a href="#certifications" className="text-sm font-semibold text-slate-600 hover:text-emerald-500 dark:text-slate-300 dark:hover:text-emerald-400 transition-colors">
                {t.navQuality}
              </a>
              <a href="#contact" className="text-sm font-semibold text-slate-600 hover:text-emerald-500 dark:text-slate-300 dark:hover:text-emerald-400 transition-colors">
                {t.navContact}
              </a>
            </nav>

            {/* Header Right Actions */}
            <div className="hidden lg:flex items-center gap-4">
              {/* Language Switcher */}
              <div className="flex bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-0.5">
                <button
                  onClick={() => setLang("th")}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                    lang === "th"
                      ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm"
                      : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  }`}
                >
                  TH
                </button>
                <button
                  onClick={() => setLang("en")}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                    lang === "en"
                      ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm"
                      : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  }`}
                >
                  EN
                </button>
              </div>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900 transition-colors cursor-pointer"
                aria-label="Toggle theme"
              >
                {isDark ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
              </button>
              
              <a
                href="#contact"
                className="px-4.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-bold shadow-md shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all duration-200"
              >
                {t.btnContact}
              </a>
            </div>

            {/* Mobile Actions (Menu + Theme + Lang) */}
            <div className="flex lg:hidden items-center gap-2">
              {/* Language mobile */}
              <button
                onClick={() => setLang(lang === "th" ? "en" : "th")}
                className="px-2 py-1 text-xs font-bold border border-slate-200 dark:border-slate-800 rounded-lg text-emerald-500 bg-white dark:bg-slate-900"
              >
                {lang === "th" ? "EN" : "TH"}
              </button>

              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-slate-500 dark:text-slate-400"
                aria-label="Toggle theme"
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900 transition-colors"
                aria-label="Toggle mobile menu"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden glass border-t border-slate-200/50 dark:border-slate-800/50 absolute top-full left-0 right-0 py-4 px-6 flex flex-col gap-3 shadow-xl">
            <a 
              href="#about" 
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-semibold py-2 text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800"
            >
              {t.navAbout}
            </a>
            <a 
              href="#products" 
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-semibold py-2 text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800"
            >
              {t.navProducts}
            </a>
            <a 
              href="#farming" 
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-semibold py-2 text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800"
            >
              {t.navFarming}
            </a>
            <a 
              href="#calculator" 
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-semibold py-2 text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800"
            >
              {t.secCalcTitle}
            </a>
            <a 
              href="#certifications" 
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-semibold py-2 text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800"
            >
              {t.navQuality}
            </a>
            <a 
              href="#contact" 
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-semibold py-2 text-slate-800 dark:text-slate-100"
            >
              {t.navContact}
            </a>
            <a
              href="#contact"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-md"
            >
              {t.btnContact}
            </a>
          </div>
        )}
      </header>

      {/* 2. Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden bg-gradient-to-b from-sky-50/40 via-emerald-50/20 to-white dark:from-slate-950 dark:via-slate-900/50 dark:to-slate-950">
        
        {/* Dynamic Pattern Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>

        {/* Ambient Blur Bubbles */}
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-400/10 dark:bg-emerald-500/5 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-[20%] left-[-10%] w-[400px] h-[400px] rounded-full bg-blue-400/10 dark:bg-blue-500/5 blur-3xl pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Content */}
            <div className="lg:col-span-7 flex flex-col gap-6 text-center lg:text-left">
              {/* Stock Ticker & Certification Badge */}
              <div className="inline-flex items-center gap-2.5 self-center lg:self-start px-3.5 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-emerald-500/20 shadow-sm text-xs font-bold text-slate-700 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">{t.ticker}</span>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  {t.standardText}
                </span>
              </div>
              
              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1] sm:leading-tight">
                {t.heroTitle}
                <span className="block mt-2.5 text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-600 dark:from-emerald-400 dark:to-sky-400">
                  {t.heroTitleColor}
                </span>
              </h1>
              
              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                {t.heroDesc}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mt-2">
                <a
                  href="#calculator"
                  className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Calculator className="w-4.5 h-4.5" />
                  {t.btnCalc}
                </a>
                <a
                  href="#products"
                  className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-bold shadow-sm hover:shadow transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {lang === "th" ? "ผลิตภัณฑ์ผักแช่แข็ง" : "Explore Products"}
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>

              {/* Statistics Counters */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8 pt-8 border-t border-slate-200/60 dark:border-slate-800/60">
                <div className="flex flex-col gap-1 text-center lg:text-left">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-blue-600 dark:from-emerald-400 dark:to-sky-400">{t.statExp}</span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.statExpDesc}</span>
                </div>
                <div className="flex flex-col gap-1 text-center lg:text-left">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-blue-600 dark:from-emerald-400 dark:to-sky-400">{t.statCap}</span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.statCapDesc}</span>
                </div>
                <div className="flex flex-col gap-1 text-center lg:text-left">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-blue-600 dark:from-emerald-400 dark:to-sky-400">{t.statFarmers}</span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.statFarmersDesc}</span>
                </div>
                <div className="flex flex-col gap-1 text-center lg:text-left">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-blue-600 dark:from-emerald-400 dark:to-sky-400">{t.statTon}</span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.statTonDesc}</span>
                </div>
              </div>
            </div>

            {/* Right Side Visual Block */}
            <div className="lg:col-span-5 relative flex justify-center">
              {/* Virtual Control & Plant Monitor Widget */}
              <div className="w-full max-w-[420px] rounded-3xl border border-slate-200/50 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-2xl p-6 relative overflow-hidden animate-float">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-400/10 to-transparent rounded-bl-full pointer-events-none"></div>
                
                {/* Header widget */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                      Factory IQF System
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-500 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded">ONLINE</span>
                </div>

                {/* Main Temperature Gauge Display */}
                <div className="py-6 flex flex-col gap-5">
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest mb-1.5">IQF Chamber 2 Temp</span>
                    
                    <div className="relative w-36 h-36 flex items-center justify-center rounded-full border-4 border-slate-100 dark:border-slate-800 shadow-inner">
                      <div className="text-center flex flex-col">
                        <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-mono">
                          -40.2°
                        </span>
                        <span className="text-[9px] font-bold text-blue-500 dark:text-sky-400 tracking-wider">
                          CELSIUS
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Sensors grid */}
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/40">
                      <span className="block text-[10px] font-semibold text-slate-400 uppercase">{lang === "th" ? "อัตราความสดคงเหลือ" : "Freshness Retention"}</span>
                      <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono">100% (Lock-in)</span>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/40">
                      <span className="block text-[10px] font-semibold text-slate-400 uppercase">{lang === "th" ? "อุณหภูมิแกนกลาง" : "Core Veg Temp"}</span>
                      <span className="text-base font-bold text-slate-900 dark:text-white font-mono">-18.5°C</span>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/40">
                      <span className="block text-[10px] font-semibold text-slate-400 uppercase">{lang === "th" ? "มาตรฐานการผลิต" : "Safety Audit"}</span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">GHP & HACCP PASSED</span>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/40">
                      <span className="block text-[10px] font-semibold text-slate-400 uppercase">{lang === "th" ? "สถานะการโหลดตู้" : "Reefer Loading"}</span>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono">STANDBY (Ready)</span>
                    </div>
                  </div>
                </div>

                {/* Footer simulation */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Last sync: Just now</span>
                  <span className="text-emerald-500 font-bold">✓ Active Carbon Neutral Program</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 3. About Section */}
      <section id="about" className="py-20 bg-slate-50 dark:bg-slate-950/30 border-y border-slate-200/50 dark:border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Visual Column */}
            <div className="lg:col-span-5 relative grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="bg-emerald-500/10 dark:bg-emerald-500/5 aspect-square rounded-3xl border border-emerald-500/20 flex flex-col justify-end p-6 group hover:border-emerald-500/40 transition-colors">
                  <Building className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mb-4" />
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">{lang === "th" ? "คลังสินค้ามาตรฐานสูง" : "Modern Infrastructure"}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{lang === "th" ? "คลังควบคุมอุณหภูมิจัดเก็บอุตสาหกรรมในเชียงใหม่" : "High-capacity freezing warehouse bases in Chiang Mai"}</p>
                </div>
                <div className="bg-emerald-600 text-white aspect-square rounded-3xl flex flex-col justify-end p-6 shadow-lg shadow-emerald-600/20">
                  <Award className="w-10 h-10 mb-4 text-emerald-100" />
                  <h3 className="font-bold text-base">{lang === "th" ? "จดทะเบียนในตลาดหลักทรัพย์" : "Public Listed (SET: CM)"}</h3>
                  <p className="text-xs text-emerald-100 mt-1">{lang === "th" ? "บริษัทมหาชนความมั่นคงและจรรยาบรรณระดับสูง" : "Listed public company guaranteeing transparency"}</p>
                </div>
              </div>
              <div className="space-y-4 pt-8">
                <div className="bg-slate-900 text-slate-100 aspect-square rounded-3xl flex flex-col justify-end p-6 dark:bg-slate-800">
                  <Clock className="w-10 h-10 text-emerald-400 mb-4" />
                  <h3 className="font-bold text-base text-white">{lang === "th" ? "ใส่ใจคุณภาพ 24 ชั่วโมง" : "24/7 Quality Control"}</h3>
                  <p className="text-xs text-slate-400 mt-1">{lang === "th" ? "ตรวจสอบสารตกค้างและความปลอดภัยทุกสายการแปรรูป" : "Continuous inspection across production lines"}</p>
                </div>
                <div className="bg-blue-500/10 dark:bg-blue-500/5 aspect-square rounded-3xl border border-blue-500/20 flex flex-col justify-end p-6">
                  <TrendingDown className="w-10 h-10 text-blue-600 dark:text-blue-400 mb-4" />
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">{lang === "th" ? "พลังงานโซลาร์สีเขียว" : "Solar energy source"}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{lang === "th" ? "ติดตั้งแผงโซลาร์เซลล์รวมช่วยลดคาร์บอนฟุตพริ้นท์" : "Solar rooftops deployed to lower carbon footprint"}</p>
                </div>
              </div>
            </div>

            {/* Content Column */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                {t.secAboutTitle}
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white leading-snug">
                {t.secAboutHeading}
              </h2>
              <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base leading-relaxed">
                {t.secAboutDesc1}
              </p>
              <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base leading-relaxed">
                {t.secAboutDesc2}
              </p>
              
              <div className="space-y-4.5 mt-2">
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">{t.point1Title}</h4>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">{t.point1Desc}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">{t.point2Title}</h4>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">{t.point2Desc}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">{t.point3Title}</h4>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">{t.point3Desc}</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 4. Products Section */}
      <section id="products" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12 flex flex-col gap-3">
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
            {t.secProdTitle}
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            {lang === "th" ? "ผลิตภัณฑ์แช่เยือกแข็งคุณภาพส่งออก" : "Premium Export-Grade Frozen Vegetables"}
          </h2>
          <p className="text-slate-600 dark:text-slate-300">
            {t.secProdDesc}
          </p>
        </div>

        {/* Tab Selection Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Tab Button List */}
          <div className="lg:col-span-4 flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-4 lg:pb-0 shrink-0">
            {Object.keys(PRODUCT_SPECS).map((key) => {
              const spec = PRODUCT_SPECS[key];
              const isSelected = activeProductTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveProductTab(key)}
                  className={`w-full text-left p-4 rounded-2xl transition-all duration-300 flex items-center justify-between border shrink-0 min-w-[260px] lg:min-w-0 cursor-pointer ${
                    isSelected
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-400 dark:border-emerald-500"
                      : "bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isSelected ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                    }`}>
                      {key === "edamame" && <Leaf className="w-5 h-5" />}
                      {key === "sweetcorn" && <Sparkles className="w-5 h-5" />}
                      {key === "greenbeans" && <Layers className="w-5 h-5" />}
                      {key === "mixedveg" && <Database className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                        {lang === "th" ? spec.nameTh.split(" ")[0] : spec.nameEn}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">{spec.temp}</span>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${
                    isSelected ? "translate-x-1 text-emerald-500" : "text-slate-400"
                  }`} />
                </button>
              );
            })}
          </div>

          {/* Active Tab Details Content */}
          <div className="lg:col-span-8">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col justify-between h-full relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/[0.02] rounded-bl-full pointer-events-none"></div>
              
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <span className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-xs font-semibold uppercase tracking-wider">
                    {lang === "th" ? "คัดสรรเกรดพรีเมียม" : "Premium Selected Grade"}
                  </span>
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold font-mono text-sm">
                    <Thermometer className="w-4 h-4" />
                    <span>{productTabsData[activeProductTab].specs[0].val}</span>
                  </div>
                </div>

                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {productTabsData[activeProductTab].title}
                </h3>
                
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
                  {productTabsData[activeProductTab].desc}
                </p>

                {/* Technical specs table style */}
                <div className="mt-2 flex flex-col gap-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">
                    {t.prodSpecTitle}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {productTabsData[activeProductTab].specs.map((item, idx) => (
                      <div key={idx} className="flex flex-col gap-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800/40">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">{item.label}</span>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{item.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between flex-wrap gap-4">
                <p className="text-xs text-slate-400 max-w-md">
                  {lang === "th" 
                    ? "* เพาะปลูกตามระบบมาตรฐานความปลอดภัยทางเคมีขั้นสูงสุด สอดคล้องตามเกณฑ์มาตรฐานนำเข้าของประเทศญี่ปุ่น" 
                    : "* Deployed under highest safety guidelines matching Japanese import sanitary regulations."}
                </p>
                <a
                  href="#contact"
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 text-white text-xs font-bold shadow-md flex items-center gap-2 transition-all duration-200 cursor-pointer"
                >
                  {lang === "th" ? "ขอใบเสนอราคาผลิตภัณฑ์" : "Request Spec & Quote"}
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Contract Farming & Quality Timeline Section */}
      <section id="farming" className="py-20 bg-slate-50 dark:bg-slate-950/20 border-y border-slate-200/50 dark:border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Section intro */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center mb-16">
            <div className="lg:col-span-7 flex flex-col gap-3">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                {t.secFarmingTitle}
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white leading-snug">
                {t.secFarmingHeading}
              </h2>
              <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base mt-2 leading-relaxed">
                {t.secFarmingDesc}
              </p>
            </div>
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <div className="px-6 py-5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-500/20 shadow-lg text-center flex flex-col items-center max-w-[280px]">
                <Leaf className="w-10 h-10 text-emerald-500 mb-2" />
                <span className="text-2xl font-black text-slate-800 dark:text-white font-mono">10,000+</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">{lang === "th" ? "ครอบครัวเกษตรกรร่วมพัฒนา" : "Active farm families supported"}</span>
              </div>
            </div>
          </div>

          {/* Vertical/Horizontal Timeline of Quality */}
          <div className="flex flex-col gap-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-emerald-500" />
              {t.timelineTitle}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Step 1 */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/60 p-6 rounded-2xl shadow-sm relative overflow-hidden group">
                <span className="absolute -top-3 -right-3 text-7xl font-black text-slate-100 dark:text-slate-950/40 select-none font-mono">01</span>
                <h4 className="font-bold text-base text-slate-900 dark:text-white relative z-10">{t.tlStep1}</h4>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2.5 leading-relaxed relative z-10">
                  {t.tlStep1Desc}
                </p>
              </div>

              {/* Step 2 */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/60 p-6 rounded-2xl shadow-sm relative overflow-hidden group">
                <span className="absolute -top-3 -right-3 text-7xl font-black text-slate-100 dark:text-slate-950/40 select-none font-mono">02</span>
                <h4 className="font-bold text-base text-slate-900 dark:text-white relative z-10">{t.tlStep2}</h4>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2.5 leading-relaxed relative z-10">
                  {t.tlStep2Desc}
                </p>
              </div>

              {/* Step 3 */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/60 p-6 rounded-2xl shadow-sm relative overflow-hidden group">
                <span className="absolute -top-3 -right-3 text-7xl font-black text-slate-100 dark:text-slate-950/40 select-none font-mono">03</span>
                <h4 className="font-bold text-base text-slate-900 dark:text-white relative z-10">{t.tlStep3}</h4>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2.5 leading-relaxed relative z-10">
                  {t.tlStep3Desc}
                </p>
              </div>

              {/* Step 4 */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/60 p-6 rounded-2xl shadow-sm relative overflow-hidden group">
                <span className="absolute -top-3 -right-3 text-7xl font-black text-slate-100 dark:text-slate-950/40 select-none font-mono">04</span>
                <h4 className="font-bold text-base text-slate-900 dark:text-white relative z-10">{t.tlStep4}</h4>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2.5 leading-relaxed relative z-10">
                  {t.tlStep4Desc}
                </p>
              </div>

              {/* Step 5 */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/60 p-6 rounded-2xl shadow-sm relative overflow-hidden group">
                <span className="absolute -top-3 -right-3 text-7xl font-black text-slate-100 dark:text-slate-950/40 select-none font-mono">05</span>
                <h4 className="font-bold text-base text-slate-900 dark:text-white relative z-10">{t.tlStep5}</h4>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2.5 leading-relaxed relative z-10">
                  {t.tlStep5Desc}
                </p>
              </div>

              {/* Step 6 */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/60 p-6 rounded-2xl shadow-sm relative overflow-hidden group">
                <span className="absolute -top-3 -right-3 text-7xl font-black text-slate-100 dark:text-slate-950/40 select-none font-mono">06</span>
                <h4 className="font-bold text-base text-slate-900 dark:text-white relative z-10">{t.tlStep6}</h4>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2.5 leading-relaxed relative z-10">
                  {t.tlStep6Desc}
                </p>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 6. Interactive Packing & Logistics Calculator */}
      <section id="calculator" className="py-20 bg-white dark:bg-slate-950 scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Inputs block */}
            <div className="lg:col-span-6 flex flex-col gap-6">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                {t.secCalcTitle}
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
                {lang === "th" ? "ประมาณการบรรจุตู้คอนเทนเนอร์เย็น" : "Export Packing & Shipment Calculator"}
              </h2>
              <p className="text-slate-600 dark:text-slate-300">
                {t.secCalcDesc}
              </p>

              {/* Inputs Form */}
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-6 shadow-md flex flex-col gap-5">
                
                {/* Product Select */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    {t.calcProductLabel}
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {Object.keys(PRODUCT_SPECS).map((key) => {
                      const spec = PRODUCT_SPECS[key];
                      const isSelected = calcProduct === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setCalcProduct(key)}
                          className={`p-3 text-xs font-bold rounded-xl text-center border transition-all duration-200 cursor-pointer ${
                            isSelected
                              ? "bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/20"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
                          }`}
                        >
                          <div>{lang === "th" ? spec.nameTh : spec.nameEn}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Weight Slider */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                      {t.calcWeightLabel}
                    </label>
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      {calcWeight} ตัน (Tons)
                    </span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="300"
                    step="5"
                    value={calcWeight}
                    onChange={(e) => setCalcWeight(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>5 T</span>
                    <span>100 T</span>
                    <span>200 T</span>
                    <span>300 T</span>
                  </div>
                </div>

                {/* Destination Selector */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    {t.calcDestLabel}
                  </label>
                  <select
                    value={calcDest}
                    onChange={(e) => setCalcDest(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:border-emerald-500 outline-none transition-colors cursor-pointer"
                  >
                    <option value="japan">{t.destJapan}</option>
                    <option value="usa_eu">{t.destUsaEu}</option>
                    <option value="asia">{t.destAsia}</option>
                    <option value="domestic">{t.destDomestic}</option>
                  </select>
                </div>

              </div>
            </div>

            {/* Right Display block */}
            <div className="lg:col-span-6">
              <div className="bg-slate-900 text-slate-100 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
                
                {/* Design graphic overlay */}
                <div className="absolute bottom-[-15%] right-[-15%] w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>

                <div className="flex items-center justify-between pb-5 border-b border-slate-800">
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <Calculator className="w-4.5 h-4.5 text-emerald-400" />
                    {t.calcResultTitle}
                  </h3>
                  <span className="text-[9px] uppercase font-mono tracking-widest text-emerald-400 bg-emerald-950 border border-emerald-800/50 px-2.5 py-0.5 rounded-md">
                    {t.calcResultLive}
                  </span>
                </div>

                {/* Results List */}
                <div className="py-6 flex flex-col gap-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-400">{t.calcResultTemp}</span>
                      <span className="text-xl font-bold text-emerald-400 font-mono mt-1">
                        {currentSpec.temp}
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-xs text-slate-400">{t.calcResultHum}</span>
                      <span className="text-xl font-bold text-emerald-400 font-mono mt-1">
                        {currentSpec.humidity}
                      </span>
                    </div>

                    <div className="flex flex-col col-span-2 pt-3 border-t border-slate-800/60">
                      <span className="text-xs text-slate-400">{t.calcResultCarton}</span>
                      <span className="text-2xl font-extrabold text-white font-mono mt-1 flex items-baseline gap-1">
                        {calculatedCartons.toLocaleString()}
                        <span className="text-xs text-slate-400 font-normal">{lang === "th" ? "กล่อง (Cartons)" : "Cartons"}</span>
                      </span>
                    </div>

                    <div className="flex flex-col col-span-2 pt-3 border-t border-slate-800/60">
                      <span className="text-xs text-slate-400">{t.calcResultPallet}</span>
                      <span className="text-2xl font-extrabold text-white font-mono mt-1 flex items-baseline gap-1">
                        {calculatedPallets}
                        <span className="text-xs text-slate-400 font-normal">{lang === "th" ? "พาเลทมาตรฐาน (1.2 x 1.0 m.)" : "Pallets"}</span>
                      </span>
                    </div>

                    <div className="flex flex-col col-span-2 pt-3 border-t border-slate-800/60">
                      <span className="text-xs text-slate-400">{t.calcResultReefer}</span>
                      <span className="text-lg font-bold text-white mt-1.5 flex items-center gap-2">
                        <Truck className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
                        {containerEstimation}
                      </span>
                    </div>
                  </div>

                  {/* Advice Box */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-850 flex gap-2.5 text-xs leading-relaxed text-slate-300">
                    <ShieldCheck className="w-4.5 h-4.5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-emerald-400 block mb-0.5">{t.calcResultTip}</strong>
                      {lang === "th" ? currentSpec.tipsTh : currentSpec.tipsEn}
                    </div>
                  </div>
                </div>

                {/* Apply Data Trigger */}
                <div className="pt-5 border-t border-slate-800 flex flex-col gap-3">
                  <button
                    onClick={handleApplyCalcToForm}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-slate-950 font-bold text-sm shadow-lg transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {t.calcBtnApply}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <p className="text-center text-[10px] text-slate-500">
                    {t.calcDisclaimer}
                  </p>
                </div>

              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 7. Certifications & Quality Badges Section */}
      <section id="certifications" className="py-20 bg-slate-50 dark:bg-slate-950/20 border-y border-slate-200/50 dark:border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 flex flex-col gap-3">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
              {t.secCertTitle}
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
              {lang === "th" ? "ใบรับรองมาตรฐานคุณภาพอาหารและความสะอาด" : "Verified Quality & Food Safety Standards"}
            </h2>
            <p className="text-slate-600 dark:text-slate-300">
              {t.secCertDesc}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/55 dark:border-slate-800/70 p-6 rounded-2xl text-center shadow-sm hover:shadow-md transition-shadow flex flex-col items-center justify-center gap-3">
              <Award className="w-12 h-12 text-emerald-500" />
              <div>
                <h4 className="font-extrabold text-base text-slate-900 dark:text-white">GHP & HACCP</h4>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-1">{lang === "th" ? "การปฏิบัติสุขลักษณะที่ดี" : "Food Hygiene & Critical Points"}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/55 dark:border-slate-800/70 p-6 rounded-2xl text-center shadow-sm hover:shadow-md transition-shadow flex flex-col items-center justify-center gap-3">
              <ShieldCheck className="w-12 h-12 text-emerald-500" />
              <div>
                <h4 className="font-extrabold text-base text-slate-900 dark:text-white">ISO 9001:2015</h4>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-1">{lang === "th" ? "ระบบจัดการคุณภาพ" : "Quality Management System"}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/55 dark:border-slate-800/70 p-6 rounded-2xl text-center shadow-sm hover:shadow-md transition-shadow flex flex-col items-center justify-center gap-3">
              <Building className="w-12 h-12 text-emerald-500" />
              <div>
                <h4 className="font-extrabold text-base text-slate-900 dark:text-white">BRCGS Global</h4>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-1">{lang === "th" ? "มาตรฐานสมาคมผู้ค้าปลีกอังกฤษ" : "British Retail Consortium Standard"}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/55 dark:border-slate-800/70 p-6 rounded-2xl text-center shadow-sm hover:shadow-md transition-shadow flex flex-col items-center justify-center gap-3">
              <Globe className="w-12 h-12 text-emerald-500" />
              <div>
                <h4 className="font-extrabold text-base text-slate-900 dark:text-white">HALAL & KOSHER</h4>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-1">{lang === "th" ? "มาตรฐานทางศาสนาสากล" : "Religious Compliances"}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Contact & Inquiries Section */}
      <section id="contact" className="py-20 bg-white dark:bg-slate-950 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
            
            {/* Contact Information (Left) */}
            <div className="lg:col-span-5 flex flex-col justify-between gap-8">
              <div className="flex flex-col gap-5">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                  {t.secContactTitle}
                </span>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {t.secContactHeading}
                </h2>
                <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base leading-relaxed">
                  {t.secContactDesc}
                </p>
              </div>

              {/* Real Offices Addresses */}
              <div className="flex flex-col gap-6 my-4">
                
                {/* HQ */}
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Building className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">{t.contactHq}</span>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{t.contactHqAddr}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">{t.contactHqTel}</span>
                  </div>
                </div>

                {/* Factory 1 */}
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">{t.contactFactory1}</span>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{t.contactFactory1Addr}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">{t.contactFactory1Tel}</span>
                  </div>
                </div>

                {/* Factory 2 */}
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">{t.contactFactory2}</span>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{t.contactFactory2Addr}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">{t.contactFactory2Tel}</span>
                  </div>
                </div>
              </div>

              {/* PDPA note */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/60 flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4" />
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                  {lang === "th" 
                    ? "ข้อมูลการส่งออกและติดต่อคู่ค้าจะได้รับการปกป้องตามหลักเกณฑ์ พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)" 
                    : "Your business inquiry and corporate data are protected under PDPA privacy regulations."}
                </span>
              </div>
            </div>

            {/* Inquiry Form (Right) */}
            <div className="lg:col-span-7">
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-xl">
                {formSubmitted ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                      <Check className="w-8 h-8" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                      {t.formSuccessTitle}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 max-w-md text-sm leading-relaxed">
                      {t.formSuccessDesc}
                    </p>
                    <button
                      onClick={() => {
                        setFormSubmitted(false);
                        setFormName("");
                        setFormPhone("");
                        setFormEmail("");
                        setFormCompany("");
                        setFormMessage("");
                      }}
                      className="mt-4 px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      {t.formBtnBack}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">
                      {t.formTitle}
                    </h3>

                    {formError && (
                      <div className="p-3 bg-red-500/10 text-red-500 text-xs font-semibold rounded-xl border border-red-500/20">
                        {formError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Name */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                          {t.formName}
                        </label>
                        <input
                          type="text"
                          required
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          placeholder={t.formNamePl}
                          className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:border-emerald-500 outline-none transition-colors"
                        />
                      </div>

                      {/* Phone */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                          {t.formPhone}
                        </label>
                        <input
                          type="tel"
                          required
                          value={formPhone}
                          onChange={(e) => setFormPhone(e.target.value)}
                          placeholder={t.formPhonePl}
                          className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:border-emerald-500 outline-none transition-colors"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Email */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                          {t.formEmail}
                        </label>
                        <input
                          type="text"
                          value={formEmail}
                          onChange={(e) => setFormEmail(e.target.value)}
                          placeholder={t.formEmailPl}
                          className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:border-emerald-500 outline-none transition-colors"
                        />
                      </div>

                      {/* Company */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                          {t.formCompany}
                        </label>
                        <input
                          type="text"
                          value={formCompany}
                          onChange={(e) => setFormCompany(e.target.value)}
                          placeholder={t.formCompanyPl}
                          className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:border-emerald-500 outline-none transition-colors"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Product Type Select */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                          {t.formProductLabel}
                        </label>
                        <select
                          value={formProduct}
                          onChange={(e) => setFormProduct(e.target.value)}
                          className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:border-emerald-500 outline-none transition-colors cursor-pointer"
                        >
                          <option value="edamame">{lang === "th" ? "ถั่วแระญี่ปุ่นแช่แข็ง" : "Frozen Edamame"}</option>
                          <option value="sweetcorn">{lang === "th" ? "ข้าวโพดหวานแช่แข็ง" : "Frozen Sweet Corn"}</option>
                          <option value="greenbeans">{lang === "th" ? "ถั่วแขกแช่แข็ง" : "Frozen Green Beans"}</option>
                          <option value="mixedveg">{lang === "th" ? "ผักรวมหั่นเต๋าแช่แข็ง" : "Frozen Mixed Veggies"}</option>
                          <option value="other">{lang === "th" ? "ผลิตภัณฑ์อื่น ๆ (ระบุในรายละเอียด)" : "Others (Specify in description)"}</option>
                        </select>
                      </div>

                      {/* Weight */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                          {t.formWeightLabel}
                        </label>
                        <input
                          type="number"
                          value={formWeight}
                          onChange={(e) => setFormWeight(e.target.value)}
                          placeholder="ระบุน้ำหนัก ตัน (Tons)"
                          className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:border-emerald-500 outline-none transition-colors"
                        />
                      </div>
                    </div>

                    {/* Message Area */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        {t.formMessage}
                      </label>
                      <textarea
                        rows={4}
                        value={formMessage}
                        onChange={(e) => setFormMessage(e.target.value)}
                        placeholder={t.formMessagePl}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:border-emerald-500 outline-none transition-colors resize-y"
                      ></textarea>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      className="mt-2 w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {t.formBtnSubmit}
                      <ArrowRight className="w-4.5 h-4.5" />
                    </button>
                  </form>
                )}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 9. Footer */}
      <footer className="bg-slate-900 dark:bg-slate-950 text-slate-400 py-12 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 pb-8 border-b border-slate-800">
            {/* Brand Block */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <a href="#" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white">
                  <Leaf className="w-5 h-5" />
                </div>
                <span className="font-bold text-lg text-white tracking-tight">
                  CM FROZEN
                </span>
              </a>
              <p className="text-xs leading-relaxed max-w-sm">
                {t.footerDesc}
              </p>
            </div>

            {/* Links Block 1 */}
            <div className="lg:col-span-3 flex flex-col gap-3">
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider">
                {lang === "th" ? "ผลิตภัณฑ์ส่งออกหลัก" : "Core Products"}
              </h4>
              <div className="flex flex-col gap-2 text-xs">
                <a href="#products" className="hover:text-emerald-400 transition-colors">{lang === "th" ? "ถั่วแระญี่ปุ่นแช่แข็ง" : "Frozen Edamame"}</a>
                <a href="#products" className="hover:text-emerald-400 transition-colors">{lang === "th" ? "ข้าวโพดหวานแช่แข็ง" : "Frozen Sweet Corn"}</a>
                <a href="#products" className="hover:text-emerald-400 transition-colors">{lang === "th" ? "ถั่วแขกแช่แข็ง" : "Frozen Green Beans"}</a>
                <a href="#products" className="hover:text-emerald-400 transition-colors">{lang === "th" ? "ผักรวมหั่นเต๋าแช่แข็ง" : "Frozen Mixed Veggies"}</a>
              </div>
            </div>

            {/* Links Block 2 */}
            <div className="lg:col-span-4 flex flex-col gap-3">
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider">
                {t.footerWorkingHours}
              </h4>
              <div className="flex flex-col gap-2 text-xs">
                <p>{t.footerOfficeHours}</p>
                <p>{t.footerFactoryHours}</p>
                <p>{lang === "th" ? "ห้องควบคุมระบบผลิตความเย็น: ทุกวัน 24 ชม." : "Cold System Control Center: 24/7 Operations"}</p>
              </div>
            </div>
          </div>

          {/* Bottom Copyright */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <p>
              {t.footerCopyright}
            </p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-emerald-400 transition-colors">{t.privacy}</a>
              <a href="#" className="hover:text-emerald-400 transition-colors">{t.terms}</a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
