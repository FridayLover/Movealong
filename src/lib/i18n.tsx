"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export const LANGS = [
  { code: "en", label: "English", short: "EN" },
  { code: "th", label: "ไทย", short: "ไทย" },
  { code: "zh", label: "中文", short: "中文" },
  { code: "es", label: "Español", short: "ES" },
] as const;
export type Lang = (typeof LANGS)[number]["code"];
const isLang = (v: string | null): v is Lang => !!v && LANGS.some((l) => l.code === v);

// Dictionary keyed by the English source string. Missing keys fall back to English.
const D: Record<Exclude<Lang, "en">, Record<string, string>> = {
  th: {
    "Feed": "ฟีด", "Map": "แผนที่", "AI Room": "ห้อง AI", "Agent": "ผู้ช่วย", "Messages": "ข้อความ", "Credits": "เครดิต",
    "Sign in": "เข้าสู่ระบบ", "Logout": "ออกจากระบบ", "Menu": "เมนู", "Favorites": "รายการโปรด", "Cart": "ตะกร้า",
    "+ List item": "+ ลงขาย", "Unlimited": "ไม่จำกัด", "cr": "เครดิต", "unread": "ยังไม่อ่าน",
    "Skip to content": "ข้ามไปเนื้อหา", "Credits & Subscriptions": "เครดิตและแพ็กเกจ", "Profile": "โปรไฟล์",
    "Search items, buildings…": "ค้นหาของ อาคาร…", "Search": "ค้นหา", "FREE only": "ฟรีเท่านั้น", "Filters": "ตัวกรอง",
    "Sort: Nearest": "เรียง: ใกล้ที่สุด", "Sort: Newest": "เรียง: ใหม่ล่าสุด", "Sort: Price low → high": "เรียง: ราคาต่ำ → สูง", "Sort: Price high → low": "เรียง: ราคาสูง → ต่ำ", "Sort: Most favorited": "เรียง: ถูกใจมากสุด",
    "Clear all": "ล้างทั้งหมด", "Reset all": "รีเซ็ตทั้งหมด", "Reset": "รีเซ็ต", "Category": "หมวดหมู่", "All": "ทั้งหมด",
    "Max distance": "ระยะทางสูงสุด", "Building contains…": "ชื่ออาคาร…", "Any distance": "ทุกระยะทาง",
    "FREE": "ฟรี", "Same building": "อาคารเดียวกัน", "Must go": "ต้องไปด่วน", "away": "ห่าง", "Size": "ขนาด",
    "Preview in my room": "ดูในห้องของฉัน", "Add to favorites": "เพิ่มในรายการโปรด", "Remove from favorites": "ลบจากรายการโปรด", "Add to cart": "ใส่ตะกร้า",
    "Near you, from people moving out": "ใกล้คุณ จากคนที่กำลังย้ายออก", "Same-building first. Self-pickup at the seller's place.": "อาคารเดียวกันก่อน รับของเองที่บ้านผู้ขาย",
    "Sell / give free": "ขาย / ให้ฟรี", "Your location": "ตำแหน่งของคุณ", "Items near you": "ของใกล้คุณ",
    "Loading…": "กำลังโหลด…", "Could not load listings.": "โหลดรายการไม่สำเร็จ", "Retry": "ลองอีกครั้ง",
    "No items match. Try widening distance or clearing filters.": "ไม่มีของที่ตรง ลองขยายระยะหรือล้างตัวกรอง",
    "List it free": "ลงขายฟรี", "Saved": "บันทึกแล้ว", "Save search": "บันทึกการค้นหา",
    "Chat": "แชท", "Buy / reserve": "ซื้อ / จอง", "Pay at pickup recommended": "แนะนำจ่ายตอนรับของ", "No returns — second-hand, inspect at pickup.": "ไม่รับคืน — ของมือสอง ตรวจสอบตอนรับของ",
    "Condition": "สภาพ", "Description": "รายละเอียด", "Seller": "ผู้ขาย", "View shop": "ดูร้านค้า", "Pickup": "การรับของ",
    "Self-pickup / self-delivery only": "รับเอง / ส่งเองเท่านั้น", " people favorited this": " คนถูกใจสิ่งนี้",
    "Title": "ชื่อสินค้า", "Price (0 = FREE)": "ราคา (0 = ฟรี)", "Photos (different angles)": "รูปภาพ (หลายมุม)", "Publish listing": "ลงประกาศ", "Building / condo": "อาคาร / คอนโด",
    "Email": "อีเมล", "Password": "รหัสผ่าน", "Name": "ชื่อ", "Create account": "สร้างบัญชี", "Welcome back": "ยินดีต้อนรับกลับ",
    "Credits & plans": "เครดิตและแพ็กเกจ", "Buy credits": "ซื้อเครดิต", "Current plan": "แพ็กเกจปัจจุบัน",
    "Ask Baan": "ถามบ้าน", "Baan — your MoveAlong concierge": "บ้าน — ผู้ช่วย MoveAlong ของคุณ",
    "Type a message…": "พิมพ์ข้อความ…", "Send": "ส่ง", "Close assistant": "ปิดผู้ช่วย", "Expand assistant": "ขยายผู้ช่วย", "Shrink assistant": "ย่อผู้ช่วย",
    "Recommend for my room": "แนะนำสำหรับห้องฉัน", "Help me sell — fill my listing": "ช่วยขาย — กรอกประกาศให้", "Draft a chat reply": "ร่างข้อความตอบแชท",
    "Use this draft — fill Sell for me": "ใช้ร่างนี้ — กรอกหน้าขายให้ฉัน", "Thinking…": "กำลังคิด…",
    "My profile": "โปรไฟล์ของฉัน", "View my shop": "ดูร้านของฉัน", "My listings": "ประกาศของฉัน", "Orders": "คำสั่งซื้อ",
    "Checkout": "ชำระเงิน", "Pay at seller's place (recommended)": "จ่ายที่บ้านผู้ขาย (แนะนำ)", "Pay by card (demo)": "จ่ายด้วยบัตร (ทดลอง)",
    "furniture": "เฟอร์นิเจอร์", "appliances": "เครื่องใช้ไฟฟ้า", "kitchen": "ครัว", "electronics": "อิเล็กทรอนิกส์", "decor": "ของตกแต่ง", "other": "อื่นๆ",
    "Like new": "เหมือนใหม่", "Good": "ดี", "Fair": "พอใช้", "Needs repair": "ต้องซ่อม",
    "Just now": "เมื่อกี้", "Today": "วันนี้", "Tomorrow": "พรุ่งนี้", "This weekend": "สุดสัปดาห์นี้",
    "Furniture": "เฟอร์นิเจอร์", "Appliances": "เครื่องใช้ไฟฟ้า", "Decor": "ของตกแต่ง", "Kitchen": "ครัว", "Electronics": "อิเล็กทรอนิกส์", "Other": "อื่นๆ",
    "New": "ใหม่", "Like New": "เหมือนใหม่", "Instant preview": "ดูตัวอย่างทันที", "Details": "รายละเอียด", "favorites": "ถูกใจ", "saved by": "บันทึกโดย", "people": "คน", "person": "คน", "Nearby": "ใกล้เคียง",
    "Search title, description, building…": "ค้นหาชื่อ รายละเอียด อาคาร…", "Search listings": "ค้นหาประกาศ", "Applied filters": "ตัวกรองที่ใช้", "Within": "ภายใน", "Building": "อาคาร",
    "Must go today": "ต้องไปวันนี้", "Past move-out date": "เลยวันย้ายออก", "km away": "กม.", "m away": "ม.",
    "like new": "เหมือนใหม่", "good": "ดี", "fair": "พอใช้", "poor": "ต้องซ่อม", "new": "ใหม่",
    "Furniture, appliances and decor — pickup only, in your building or a few km away. See the saving vs new on every card, and try items in your room before you go.": "เฟอร์นิเจอร์ เครื่องใช้ไฟฟ้า ของตกแต่ง — รับเองเท่านั้น ในอาคารของคุณหรือห่างไม่กี่กม. ดูส่วนลดเทียบของใหม่ทุกใบ และลองวางในห้องก่อนไปรับ",
    "+ List an item": "+ ลงขายสินค้า",
    "Sort": "เรียง",
    "Nearest first": "ใกล้ที่สุดก่อน",
    "Must-go soonest": "ต้องไปเร็วสุดก่อน",
    "Biggest saving vs new": "ประหยัดสุดเทียบของใหม่",
    "Cheapest": "ถูกที่สุด",
    "Newest": "ใหม่ล่าสุด",
    "items near you": "ชิ้นใกล้คุณ",
    "item near you": "ชิ้นใกล้คุณ",
    "Finding nearby…": "กำลังค้นหาใกล้คุณ…",
    "Notify me — save this search": "แจ้งเตือน — บันทึกการค้นหานี้",
    "Clear all filters": "ล้างตัวกรองทั้งหมด",
    "No items match that search.": "ไม่มีสินค้าตรงกับการค้นหา",
    "Listings did not load": "โหลดประกาศไม่สำเร็จ",
    "Moving out next week?": "จะย้ายออกสัปดาห์หน้า?",
    "List an item →": "ลงขายสินค้า →",
    "In cart": "ในตะกร้า",
    "Recommend": "แนะนำ",
    "Sell": "ขาย",
    "Reply": "ตอบกลับ",
    "for my room": "สำหรับห้องฉัน",
    "fill my listing": "กรอกประกาศให้",
    "draft a chat": "ร่างแชท",
    "Clear": "ล้าง",
    "Close": "ปิด",
    "List an item": "ลงขายสินค้า",
    "Price (USD)": "ราคา (USD)",
    "Handover": "การส่งมอบ",
    "Buyer picks up": "ผู้ซื้อมารับเอง",
    "I can deliver nearby": "ส่งใกล้ๆ ได้",
    "Either": "ได้ทั้งสองแบบ",
    "Photos — different angles (1–8) *": "รูปภาพ — หลายมุม (1–8) *",
    "Welcome to MoveAlong": "ยินดีต้อนรับสู่ MoveAlong",
    "Building (optional)": "อาคาร (ไม่บังคับ)",
    "Credits & subscriptions": "เครดิตและแพ็กเกจ",
    "Your balance": "ยอดคงเหลือของคุณ",
    "Credit packs (one-time)": "แพ็กเครดิต (ครั้งเดียว)",
    "Subscriptions": "แพ็กเกจรายเดือน",
    "Buy (mock)": "ซื้อ (ทดลอง)",
    "Subscribe (mock)": "สมัคร (ทดลอง)",
    "List item": "ลงสินค้า",
    "Size (optional — improves AI preview)": "ขนาด (ไม่บังคับ — ช่วยให้ AI แม่นขึ้น)",
    "Address / area": "ที่อยู่ / ย่าน",
    "Publish": "ลงประกาศ",
    "Language": "ภาษา",
  },
  zh: {
    "Feed": "动态", "Map": "地图", "AI Room": "AI 房间", "Agent": "助手", "Messages": "消息", "Credits": "额度",
    "Sign in": "登录", "Logout": "退出", "Menu": "菜单", "Favorites": "收藏", "Cart": "购物车",
    "+ List item": "+ 发布物品", "Unlimited": "无限", "cr": "额度", "unread": "未读",
    "Skip to content": "跳到内容", "Credits & Subscriptions": "额度与订阅", "Profile": "个人资料",
    "Search items, buildings…": "搜索物品、楼盘…", "Search": "搜索", "FREE only": "仅免费", "Filters": "筛选",
    "Sort: Nearest": "排序：最近", "Sort: Newest": "排序：最新", "Sort: Price low → high": "排序：价格从低到高", "Sort: Price high → low": "排序：价格从高到低", "Sort: Most favorited": "排序：收藏最多",
    "Clear all": "清除全部", "Reset all": "重置全部", "Reset": "重置", "Category": "类别", "All": "全部",
    "Max distance": "最大距离", "Building contains…": "楼盘名称…", "Any distance": "不限距离",
    "FREE": "免费", "Same building": "同一栋楼", "Must go": "急出", "away": "距离", "Size": "尺寸",
    "Preview in my room": "在我的房间预览", "Add to favorites": "加入收藏", "Remove from favorites": "取消收藏", "Add to cart": "加入购物车",
    "Near you, from people moving out": "你附近，来自正在搬家的人", "Same-building first. Self-pickup at the seller's place.": "同楼优先。在卖家处自提。",
    "Sell / give free": "出售 / 免费送", "Your location": "你的位置", "Items near you": "你附近的物品",
    "Loading…": "加载中…", "Could not load listings.": "无法加载列表", "Retry": "重试",
    "No items match. Try widening distance or clearing filters.": "没有匹配的物品。试试扩大距离或清除筛选。",
    "List it free": "免费发布", "Saved": "已保存", "Save search": "保存搜索",
    "Chat": "聊天", "Buy / reserve": "购买 / 预订", "Pay at pickup recommended": "建议取货时付款", "No returns — second-hand, inspect at pickup.": "不退货 — 二手物品，取货时检查。",
    "Condition": "成色", "Description": "描述", "Seller": "卖家", "View shop": "查看店铺", "Pickup": "取货",
    "Self-pickup / self-delivery only": "仅自提 / 自送", " people favorited this": " 人收藏了此物品",
    "Title": "标题", "Price (0 = FREE)": "价格（0 = 免费）", "Photos (different angles)": "照片（不同角度）", "Publish listing": "发布", "Building / condo": "楼盘 / 公寓",
    "Email": "邮箱", "Password": "密码", "Name": "姓名", "Create account": "创建账户", "Welcome back": "欢迎回来",
    "Credits & plans": "额度与套餐", "Buy credits": "购买额度", "Current plan": "当前套餐",
    "Ask Baan": "问 Baan", "Baan — your MoveAlong concierge": "Baan — 你的 MoveAlong 助手",
    "Type a message…": "输入消息…", "Send": "发送", "Close assistant": "关闭助手", "Expand assistant": "展开助手", "Shrink assistant": "收起助手",
    "Recommend for my room": "为我的房间推荐", "Help me sell — fill my listing": "帮我卖 — 填写发布信息", "Draft a chat reply": "起草聊天回复",
    "Use this draft — fill Sell for me": "使用此草稿 — 帮我填发布页", "Thinking…": "思考中…",
    "My profile": "我的资料", "View my shop": "查看我的店铺", "My listings": "我的发布", "Orders": "订单",
    "Checkout": "结账", "Pay at seller's place (recommended)": "在卖家处付款（推荐）", "Pay by card (demo)": "银行卡支付（演示）",
    "furniture": "家具", "appliances": "家电", "kitchen": "厨房", "electronics": "电子产品", "decor": "装饰", "other": "其他",
    "Like new": "几乎全新", "Good": "良好", "Fair": "一般", "Needs repair": "需维修",
    "Just now": "刚刚", "Today": "今天", "Tomorrow": "明天", "This weekend": "本周末",
    "Furniture": "家具", "Appliances": "家电", "Decor": "装饰", "Kitchen": "厨房", "Electronics": "电子产品", "Other": "其他",
    "New": "全新", "Like New": "几乎全新", "Instant preview": "即时预览", "Details": "详情", "favorites": "收藏", "saved by": "收藏者", "people": "人", "person": "人", "Nearby": "附近",
    "Search title, description, building…": "搜索标题、描述、楼盘…", "Search listings": "搜索列表", "Applied filters": "已应用筛选", "Within": "范围", "Building": "楼盘",
    "Must go today": "今天必须出", "Past move-out date": "已过搬出日期", "km away": "公里", "m away": "米",
    "like new": "几乎全新", "good": "良好", "fair": "一般", "poor": "需维修", "new": "全新",
    "Furniture, appliances and decor — pickup only, in your building or a few km away. See the saving vs new on every card, and try items in your room before you go.": "家具、家电和装饰 — 仅自提，在你的楼里或几公里内。每张卡片都能看到比新品省多少，去之前先在房间里试摆。",
    "+ List an item": "+ 发布物品",
    "Sort": "排序",
    "Nearest first": "最近优先",
    "Must-go soonest": "最急优先",
    "Biggest saving vs new": "比新品最省",
    "Cheapest": "最便宜",
    "Newest": "最新",
    "items near you": "件在你附近",
    "item near you": "件在你附近",
    "Finding nearby…": "正在查找附近…",
    "Notify me — save this search": "通知我 — 保存此搜索",
    "Clear all filters": "清除所有筛选",
    "No items match that search.": "没有物品符合搜索",
    "Listings did not load": "列表加载失败",
    "Moving out next week?": "下周要搬家？",
    "List an item →": "发布物品 →",
    "In cart": "已在购物车",
    "Recommend": "推荐",
    "Sell": "出售",
    "Reply": "回复",
    "for my room": "为我的房间",
    "fill my listing": "填写发布",
    "draft a chat": "起草聊天",
    "Clear": "清除",
    "Close": "关闭",
    "List an item": "发布物品",
    "Price (USD)": "价格（美元）",
    "Handover": "交接方式",
    "Buyer picks up": "买家自提",
    "I can deliver nearby": "可送附近",
    "Either": "都可以",
    "Photos — different angles (1–8) *": "照片 — 不同角度（1–8）*",
    "Welcome to MoveAlong": "欢迎来到 MoveAlong",
    "Building (optional)": "楼盘（可选）",
    "Credits & subscriptions": "额度与订阅",
    "Your balance": "你的余额",
    "Credit packs (one-time)": "额度包（一次性）",
    "Subscriptions": "订阅",
    "Buy (mock)": "购买（演示）",
    "Subscribe (mock)": "订阅（演示）",
    "List item": "发布",
    "Size (optional — improves AI preview)": "尺寸（可选 — 提升 AI 预览）",
    "Address / area": "地址 / 区域",
    "Publish": "发布",
    "Language": "语言",
  },
  es: {
    "Feed": "Inicio", "Map": "Mapa", "AI Room": "Sala IA", "Agent": "Asistente", "Messages": "Mensajes", "Credits": "Créditos",
    "Sign in": "Iniciar sesión", "Logout": "Cerrar sesión", "Menu": "Menú", "Favorites": "Favoritos", "Cart": "Carrito",
    "+ List item": "+ Publicar artículo", "Unlimited": "Ilimitado", "cr": "cr", "unread": "sin leer",
    "Skip to content": "Saltar al contenido", "Credits & Subscriptions": "Créditos y suscripciones", "Profile": "Perfil",
    "Search items, buildings…": "Buscar artículos, edificios…", "Search": "Buscar", "FREE only": "Solo GRATIS", "Filters": "Filtros",
    "Sort: Nearest": "Ordenar: Más cercano", "Sort: Newest": "Ordenar: Más reciente", "Sort: Price low → high": "Ordenar: Precio de menor a mayor", "Sort: Price high → low": "Ordenar: Precio de mayor a menor", "Sort: Most favorited": "Ordenar: Más favoritos",
    "Clear all": "Borrar todo", "Reset all": "Restablecer todo", "Reset": "Restablecer", "Category": "Categoría", "All": "Todo",
    "Max distance": "Distancia máxima", "Building contains…": "Edificio…", "Any distance": "Cualquier distancia",
    "FREE": "GRATIS", "Same building": "Mismo edificio", "Must go": "Urge vender", "away": "de distancia", "Size": "Tamaño",
    "Preview in my room": "Ver en mi habitación", "Add to favorites": "Añadir a favoritos", "Remove from favorites": "Quitar de favoritos", "Add to cart": "Añadir al carrito",
    "Near you, from people moving out": "Cerca de ti, de personas que se mudan", "Same-building first. Self-pickup at the seller's place.": "Primero tu edificio. Recogida en casa del vendedor.",
    "Sell / give free": "Vender / regalar", "Your location": "Tu ubicación", "Items near you": "Artículos cerca de ti",
    "Loading…": "Cargando…", "Could not load listings.": "No se pudieron cargar los anuncios.", "Retry": "Reintentar",
    "No items match. Try widening distance or clearing filters.": "Ningún artículo coincide. Amplía la distancia o borra los filtros.",
    "List it free": "Publicar gratis", "Saved": "Guardado", "Save search": "Guardar búsqueda",
    "Chat": "Chat", "Buy / reserve": "Comprar / reservar", "Pay at pickup recommended": "Se recomienda pagar al recoger", "No returns — second-hand, inspect at pickup.": "Sin devoluciones: segunda mano, revisa al recoger.",
    "Condition": "Estado", "Description": "Descripción", "Seller": "Vendedor", "View shop": "Ver tienda", "Pickup": "Recogida",
    "Self-pickup / self-delivery only": "Solo recogida / entrega por el usuario", " people favorited this": " personas guardaron esto",
    "Title": "Título", "Price (0 = FREE)": "Precio (0 = GRATIS)", "Photos (different angles)": "Fotos (distintos ángulos)", "Publish listing": "Publicar anuncio", "Building / condo": "Edificio / condominio",
    "Email": "Correo", "Password": "Contraseña", "Name": "Nombre", "Create account": "Crear cuenta", "Welcome back": "Bienvenido de nuevo",
    "Credits & plans": "Créditos y planes", "Buy credits": "Comprar créditos", "Current plan": "Plan actual",
    "Ask Baan": "Preguntar a Baan", "Baan — your MoveAlong concierge": "Baan — tu asistente de MoveAlong",
    "Type a message…": "Escribe un mensaje…", "Send": "Enviar", "Close assistant": "Cerrar asistente", "Expand assistant": "Ampliar asistente", "Shrink assistant": "Reducir asistente",
    "Recommend for my room": "Recomendar para mi habitación", "Help me sell — fill my listing": "Ayúdame a vender: completa mi anuncio", "Draft a chat reply": "Redactar respuesta de chat",
    "Use this draft — fill Sell for me": "Usar este borrador: completar venta", "Thinking…": "Pensando…",
    "My profile": "Mi perfil", "View my shop": "Ver mi tienda", "My listings": "Mis anuncios", "Orders": "Pedidos",
    "Checkout": "Pagar", "Pay at seller's place (recommended)": "Pagar en casa del vendedor (recomendado)", "Pay by card (demo)": "Pagar con tarjeta (demo)",
    "furniture": "Muebles", "appliances": "Electrodomésticos", "kitchen": "Cocina", "electronics": "Electrónica", "decor": "Decoración", "other": "Otros",
    "Like new": "Como nuevo", "Good": "Bueno", "Fair": "Aceptable", "Needs repair": "Necesita reparación",
    "Just now": "Ahora mismo", "Today": "Hoy", "Tomorrow": "Mañana", "This weekend": "Este fin de semana",
    "Furniture": "Muebles", "Appliances": "Electrodomésticos", "Decor": "Decoración", "Kitchen": "Cocina", "Electronics": "Electrónica", "Other": "Otros",
    "New": "Nuevo", "Like New": "Como nuevo", "Instant preview": "Vista previa instantánea", "Details": "Detalles", "favorites": "favoritos", "saved by": "guardado por", "people": "personas", "person": "persona", "Nearby": "Cerca",
    "Search title, description, building…": "Buscar título, descripción, edificio…", "Search listings": "Buscar anuncios", "Applied filters": "Filtros aplicados", "Within": "A menos de", "Building": "Edificio",
    "Must go today": "Debe irse hoy", "Past move-out date": "Fecha de mudanza pasada", "km away": "km", "m away": "m",
    "like new": "Como nuevo", "good": "Bueno", "fair": "Aceptable", "poor": "Necesita reparación", "new": "Nuevo",
    "Furniture, appliances and decor — pickup only, in your building or a few km away. See the saving vs new on every card, and try items in your room before you go.": "Muebles, electrodomésticos y decoración — solo recogida, en tu edificio o a pocos km. Ve el ahorro frente a nuevo en cada tarjeta y prueba los artículos en tu habitación antes de ir.",
    "+ List an item": "+ Publicar un artículo",
    "Sort": "Ordenar",
    "Nearest first": "Más cercano primero",
    "Must-go soonest": "Más urgente primero",
    "Biggest saving vs new": "Mayor ahorro frente a nuevo",
    "Cheapest": "Más barato",
    "Newest": "Más reciente",
    "items near you": "artículos cerca de ti",
    "item near you": "artículo cerca de ti",
    "Finding nearby…": "Buscando cerca…",
    "Notify me — save this search": "Avísame — guardar esta búsqueda",
    "Clear all filters": "Borrar todos los filtros",
    "No items match that search.": "Ningún artículo coincide con la búsqueda",
    "Listings did not load": "Los anuncios no se cargaron",
    "Moving out next week?": "¿Te mudas la próxima semana?",
    "List an item →": "Publicar un artículo →",
    "In cart": "En el carrito",
    "Recommend": "Recomendar",
    "Sell": "Vender",
    "Reply": "Responder",
    "for my room": "para mi habitación",
    "fill my listing": "completar mi anuncio",
    "draft a chat": "redactar un chat",
    "Clear": "Borrar",
    "Close": "Cerrar",
    "List an item": "Publicar un artículo",
    "Price (USD)": "Precio (USD)",
    "Handover": "Entrega",
    "Buyer picks up": "El comprador recoge",
    "I can deliver nearby": "Puedo entregar cerca",
    "Either": "Ambas opciones",
    "Photos — different angles (1–8) *": "Fotos — distintos ángulos (1–8) *",
    "Welcome to MoveAlong": "Bienvenido a MoveAlong",
    "Building (optional)": "Edificio (opcional)",
    "Credits & subscriptions": "Créditos y suscripciones",
    "Your balance": "Tu saldo",
    "Credit packs (one-time)": "Paquetes de créditos (únicos)",
    "Subscriptions": "Suscripciones",
    "Buy (mock)": "Comprar (demo)",
    "Subscribe (mock)": "Suscribirse (demo)",
    "List item": "Publicar",
    "Size (optional — improves AI preview)": "Tamaño (opcional — mejora la vista IA)",
    "Address / area": "Dirección / zona",
    "Publish": "Publicar",
    "Language": "Idioma",
  },
};

// Exact translations for seeded demo listing titles/descriptions (user content
// not in this map is translated on demand by /api/translate — see below).
export const CONTENT: Record<Exclude<Lang, "en">, Record<string, string>> = {
  th: {
    "IKEA MALM 6-drawer dresser — oak, good cond.": "ตู้ลิ้นชัก IKEA MALM 6 ลิ้นชัก — สีโอ๊ค สภาพดี",
    "Mitsubishi 6.5kg washing machine — FREE": "เครื่องซักผ้า Mitsubishi 6.5 กก. — ฟรี",
    "3-seat fabric sofa — light grey, like new": "โซฟาผ้า 3 ที่นั่ง — สีเทาอ่อน เหมือนใหม่",
    "Standing desk 120×60 + chair — FREE to good home": "โต๊ะปรับระดับ 120×60 + เก้าอี้ — ฟรี",
    "Kitchen set — plates, pans, microwave": "ชุดครัว — จาน กระทะ ไมโครเวฟ",
    "32-inch TV + wall mount": "ทีวี 32 นิ้ว + ขาแขวนผนัง",
    "Wooden coffee table — walnut 90×55": "โต๊ะกาแฟไม้ — วอลนัท 90×55",
    "Floor lamp warm light — dimmable": "โคมไฟตั้งพื้นแสงอุ่น — ปรับหรี่ได้",
  },
  zh: {
    "IKEA MALM 6-drawer dresser — oak, good cond.": "IKEA MALM 六斗柜 — 橡木色，成色好",
    "Mitsubishi 6.5kg washing machine — FREE": "三菱 6.5kg 洗衣机 — 免费",
    "3-seat fabric sofa — light grey, like new": "三人布艺沙发 — 浅灰色，几乎全新",
    "Standing desk 120×60 + chair — FREE to good home": "升降桌 120×60 + 椅子 — 免费送",
    "Kitchen set — plates, pans, microwave": "厨房套装 — 盘子、锅、微波炉",
    "32-inch TV + wall mount": "32 英寸电视 + 壁挂支架",
    "Wooden coffee table — walnut 90×55": "木质茶几 — 胡桃木 90×55",
    "Floor lamp warm light — dimmable": "暖光落地灯 — 可调光",
  },
  es: {
    "IKEA MALM 6-drawer dresser — oak, good cond.": "Cómoda IKEA MALM de 6 cajones — roble, buen estado",
    "Mitsubishi 6.5kg washing machine — FREE": "Lavadora Mitsubishi 6.5 kg — GRATIS",
    "3-seat fabric sofa — light grey, like new": "Sofá de tela de 3 plazas — gris claro, como nuevo",
    "Standing desk 120×60 + chair — FREE to good home": "Escritorio elevable 120×60 + silla — GRATIS",
    "Kitchen set — plates, pans, microwave": "Set de cocina — platos, sartenes, microondas",
    "32-inch TV + wall mount": "TV de 32 pulgadas + soporte de pared",
    "Wooden coffee table — walnut 90×55": "Mesa de centro de madera — nogal 90×55",
    "Floor lamp warm light — dimmable": "Lámpara de pie luz cálida — regulable",
  },
};

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (s: string) => string; tc: (s: string) => string };
const I18nCtx = createContext<Ctx>({ lang: "en", setLang: () => {}, t: (s) => s, tc: (s) => s });
export const useI18n = () => useContext(I18nCtx);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    const saved = localStorage.getItem("movealong:lang");
    const detected = isLang(saved) ? saved : (navigator.language || "en").slice(0, 2);
    const initial = isLang(detected) ? detected : "en";
    setLangState(initial);
    document.documentElement.lang = initial;
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("movealong:lang", l);
    document.documentElement.lang = l;
  };
  const t = (s: string) => (lang === "en" ? s : D[lang][s] ?? s);
  const tc = (s: string) => (lang === "en" ? s : CONTENT[lang][s] ?? s);
  return <I18nCtx.Provider value={{ lang, setLang, t, tc }}>{children}</I18nCtx.Provider>;
}

export function LanguageSelect({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open ]);
  const current = LANGS.find((l) => l.code === lang) || LANGS[0];
  return (
    <div ref={rootRef} className={`relative shrink-0 ${className}`}>
      <button
        type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="true" aria-expanded={open}
        aria-label={`${t("Language")}: ${current.label}`} title={`${t("Language")}: ${current.label}`}
        className="press relative grid h-9 w-9 flex-none shrink-0 aspect-square place-items-center rounded-full bg-white border border-line text-ink shadow-sm hover:bg-amber-50"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 0 20 15.3 15.3 0 0 1 0-20z" /></svg>
      </button>
      {open && (
        <div role="menu" aria-label={t("Language")} className="animate-msg-in absolute right-0 top-full mt-2 flex flex-nowrap gap-1 bg-white border border-line rounded-full shadow-card p-1 z-[70]">
          {LANGS.map((l) => (
            <button
              key={l.code} type="button" role="menuitemradio" aria-checked={lang === l.code}
              onClick={() => { setLang(l.code); setOpen(false); }}
              className={`press min-h-[44px] px-3.5 rounded-full whitespace-nowrap text-[14px] font-bold ${lang === l.code ? "bg-[#1c1917] text-white" : "text-ink hover:bg-amber-50"}`}
            >
              <span lang={l.code}>{l.short}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// On-demand translation for user-written content not in CONTENT: dictionary
// first, then /api/translate (Meta Muse Spark when configured), cached.
const cache = new Map<string, string>();
export function useTranslated(text: string): string {
  const { lang, tc } = useI18n();
  const known = tc(text);
  const [out, setOut] = useState(known);
  useEffect(() => {
    if (lang === "en" || known !== text) { setOut(known); return; }
    const key = `${lang}:${text}`;
    const hit = cache.get(key) || (typeof localStorage !== "undefined" ? localStorage.getItem(`movealong:tr:${key}`) : null);
    if (hit) { cache.set(key, hit); setOut(hit); return; }
    let live = true;
    fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, target: lang }) })
      .then((r) => r.json()).then((d) => { if (live && d.translation) { cache.set(key, d.translation); try { localStorage.setItem(`movealong:tr:${key}`, d.translation); } catch {} setOut(d.translation); } })
      .catch(() => {});
    return () => { live = false; };
  }, [text, lang, known]);
  return out;
}
