# DeePer 💬

แอปการ์ดคำถามชวนคุยลึก ๆ สำหรับใช้ร่วมกัน **บนเครื่องเดียว** — คู่รัก / เพื่อน ๆ / ครอบครัว
ดีไซน์ Glassmorphism โทนดำ–แดง เน้นประสบการณ์บน iPad / iPhone (mobile-first, รองรับ gesture ปัด)

- **Frontend:** React + Vite + Framer Motion (responsive, touch-friendly)
- **Backend:** Node.js + Express
- **ฐานข้อมูล:** SQLite (ใช้ `node:sqlite` ในตัว Node — ไม่ต้อง build อะไรเพิ่ม)
- **Auth:** อีเมล + รหัสผ่าน (OTP 4 หลัก) และ Google OAuth
- **คำถาม:** คลังคัดสรร ~36 ข้อ/หมวด + เติมด้วย AI ได้ (Anthropic)

> แอปทำงานได้ทันทีโดยไม่ต้องตั้งค่าอะไรเลย — Google, การส่งอีเมล OTP จริง และ AI เป็น **ออปชัน**
> (ถ้าไม่ตั้งค่า: OTP จะแสดงใน console ของเซิร์ฟเวอร์, ปุ่ม Google ถูกปิด, ใช้เฉพาะคลังคำถามที่คัดสรร)

---

## เริ่มใช้งาน (Development)

ต้องมี **Node.js 22+** (แนะนำ 24) เพราะใช้ `node:sqlite`

```bash
# 1) ติดตั้ง dependencies ทั้งหมด
npm run install:all

# 2) รันเซิร์ฟเวอร์ (เทอร์มินัลที่ 1)
npm run dev:server      # http://localhost:4000

# 3) รัน client (เทอร์มินัลที่ 2)
npm run dev:client      # http://localhost:5173  ← เปิดอันนี้ในเบราว์เซอร์
```

Vite dev server จะ proxy `/api` ไปที่เซิร์ฟเวอร์ที่พอร์ต 4000 ให้อัตโนมัติ

### ทดสอบ OTP โดยไม่ตั้งค่า SMTP
ตอนสมัครด้วยอีเมล ระบบจะพิมพ์รหัส OTP ลงใน console ของเซิร์ฟเวอร์ และ (ในโหมดพัฒนา) เด้ง toast บอกรหัสบนหน้าจอด้วย

---

## Build & Deploy (Production)

```bash
npm run build           # สร้าง client/dist
npm start               # เซิร์ฟเวอร์เสิร์ฟทั้ง API และหน้าเว็บที่พอร์ตเดียว (4000)
```

เมื่อมีโฟลเดอร์ `client/dist` อยู่ เซิร์ฟเวอร์ Express จะเสิร์ฟไฟล์ static + fallback ไปที่ `index.html`
พร้อม deploy ขึ้นบริการที่รัน Node ได้ (Render / Railway / Fly.io / VPS ฯลฯ) — ตั้ง env `PORT` ตามที่ผู้ให้บริการกำหนด

---

## ตั้งค่าเพิ่มเติม (ทั้งหมดเป็น optional)

คัดลอก `server/.env.example` เป็น `server/.env` แล้วเติมค่า:

| ตัวแปร | ผล |
|---|---|
| `JWT_SECRET` | ความลับสำหรับเซ็น token (ควรตั้งค่าจริงตอน deploy) |
| `GOOGLE_CLIENT_ID` | เปิดปุ่มเข้าสู่ระบบ/สมัครด้วย Google (สร้างที่ Google Cloud Console, ประเภท Web) |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` / ... | ส่งอีเมล OTP จริง |
| `ANTHROPIC_API_KEY` | เปิดปุ่ม "สร้างคำถามด้วย AI" (โมเดล claude-opus-4-8) |

> สำหรับ Google OAuth: เพิ่ม origin ของเว็บ (เช่น `http://localhost:5173` และโดเมน production) ใน
> "Authorized JavaScript origins" ของ OAuth Client แล้วนำ Client ID มาใส่ใน `GOOGLE_CLIENT_ID`

---

## โครงสร้าง

```
Dee_Per/
├── server/                 # Express + SQLite
│   ├── src/
│   │   ├── index.js        # entry, เสิร์ฟ API + static
│   │   ├── db.js           # schema + seed คลังคำถาม
│   │   ├── auth.js         # JWT, bcrypt, กฎรหัสผ่าน
│   │   ├── mailer.js       # ส่ง OTP (fallback = console)
│   │   ├── ai.js           # สร้างคำถามด้วย Anthropic
│   │   ├── questions-bank.js
│   │   └── routes/         # auth, questions, data (saved/history)
│   └── .env.example
└── client/                 # React + Vite
    └── src/
        ├── pages/          # Welcome, Signup, Login, Home, Answer, Saved, History, Profile
        ├── components/     # BottomNav, GoogleButton, icons, ui (loading/empty/error/toast)
        ├── store/auth.jsx  # auth context
        ├── api.js
        └── styles.css      # design system (glassmorphism ดำ–แดง)
```

## ฟีเจอร์ตามสเปค
- หน้าเปิดแอป → เลือกสมัคร/ล็อกอิน
- สมัครด้วย Google (ไม่ต้องตั้งรหัส) หรืออีเมล + OTP 4 หลัก + ตั้งรหัสผ่าน (มี strength indicator + เช็คเงื่อนไข real-time)
- แถบเมนูล่าง 4 อัน: หน้าหลัก / บันทึกไว้ / ประวัติ / โปรไฟล์
- การ์ดคำถามแบบ glassmorphism ปัดได้ (ซ้าย=ข้าม, ขวา=ตอบ) + ปุ่ม ✕ / 🔖 / ✓
- หน้าตอบ 2 ช่อง ผลัดกันพิมพ์ ("ถึงตาอีกฝ่าย") ตั้งชื่อ + เลือกสีอีกฝ่ายได้
- บันทึกไว้ / ประวัติ เรียงใหม่สุดบนสุด พร้อมวันที่
- ผู้ใช้เพิ่มคำถามของตัวเองได้ + ผู้พัฒนาแก้คลังได้ที่ `server/src/questions-bank.js`
```
