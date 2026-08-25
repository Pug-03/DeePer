# DeePer 💬

**ภาษาไทย** · [English](./README.en.md)

> แอปการ์ดคำถามชวนคุยลึก ๆ สำหรับใช้ร่วมกัน **บนเครื่องเดียว** — คู่รัก / เพื่อน ๆ / ครอบครัว
> ดีไซน์ Glassmorphism โทนดำ–แดง เน้นประสบการณ์บน iPad / iPhone (mobile-first, รองรับ gesture ปัด)

---

## ✨ ไฮไลต์

- 🃏 **การ์ดคำถามปัดได้** — ปัดซ้าย = ข้าม, ปัดขวา = ตอบ พร้อมปุ่มลัด ข้าม / บันทึก / ตอบ
- 🗂️ **3 หมวด × 36 คำถาม** คัดสรร (คู่รัก / เพื่อน / ครอบครัว) + เติมด้วย AI ได้ (Anthropic)
- ✍️ **หน้าตอบผลัดกันพิมพ์** ("ถึงตาอีกฝ่าย") ตั้งชื่อ + เลือกสีอีกฝ่ายได้
- 🔖 **บันทึกไว้ / ประวัติ** เรียงใหม่สุดบนสุด พร้อมวันที่
- 🔐 **สมัคร/เข้าสู่ระบบ** ด้วยอีเมล + OTP 4 หลัก หรือ Google OAuth
- 🌐 **สองภาษา** ไทย / อังกฤษ สลับได้ในแอป
- 📱 **PWA** เพิ่มลงหน้าจอโฮมแล้วเปิดแบบเต็มจอได้

---

## 🧱 เทคโนโลยี

| ส่วน | ใช้ |
|---|---|
| Frontend | React 18 + Vite 5 + Framer Motion 11 + React Router 6 |
| Backend | Node.js + Express 4 |
| ฐานข้อมูล | SQLite ผ่าน `node:sqlite` (ในตัว Node — ไม่ต้อง build อะไรเพิ่ม) |
| Auth | JWT + bcryptjs, OTP 4 หลัก, Google OAuth (`google-auth-library`) |
| อีเมล | Nodemailer (fallback = พิมพ์ OTP ลง console) |
| อัปโหลดรูป | Multer |
| AI | `@anthropic-ai/sdk` (โมเดล `claude-opus-4-8`) |

> แอปทำงานได้ทันทีโดยไม่ต้องตั้งค่าอะไรเลย — Google, การส่งอีเมล OTP จริง และ AI เป็น **ออปชัน**
> (ถ้าไม่ตั้งค่า: OTP จะแสดงใน console ของเซิร์ฟเวอร์, ปุ่ม Google ถูกปิด, ใช้เฉพาะคลังคำถามที่คัดสรร)

---

## ✅ ความต้องการของระบบ

- **Node.js 22+** (แนะนำ 24) — จำเป็นเพราะใช้ `node:sqlite`
- npm

---

## 🚀 เริ่มใช้งาน (Development)

```bash
# 1) ติดตั้ง dependencies ทั้งหมด (server + client)
npm run install:all

# 2) รันเซิร์ฟเวอร์ (เทอร์มินัลที่ 1)
npm run dev:server      # http://localhost:4000

# 3) รัน client (เทอร์มินัลที่ 2)
npm run dev:client      # http://localhost:5173  ← เปิดอันนี้ในเบราว์เซอร์
```

Vite dev server จะ proxy `/api` และ `/uploads` ไปที่เซิร์ฟเวอร์พอร์ต 4000 ให้อัตโนมัติ

### 🍎 รันบน Mac (Terminal)

เช็คก่อนว่ามี Node 22+ ไหม (ถ้าไม่มีให้ `brew install node`):

```bash
node -v
```

จากนั้นเปิด Terminal 2 หน้าต่าง (หรือ 2 แท็บ) ที่โฟลเดอร์โปรเจกต์:

```bash
# ครั้งแรกครั้งเดียว
cd ~/Desktop/Code/Dee_Per
npm run install:all
```

**หน้าต่างที่ 1 — เซิร์ฟเวอร์**
```bash
cd ~/Desktop/Code/Dee_Per
npm run dev:server
```

**หน้าต่างที่ 2 — client**
```bash
cd ~/Desktop/Code/Dee_Per
npm run dev:client
```

เปิดเบราว์เซอร์ที่ **http://localhost:5173**

### 🔑 ทดสอบ OTP โดยไม่ตั้งค่า SMTP

ตอนสมัครด้วยอีเมล ระบบจะพิมพ์รหัส OTP ลงใน console ของเซิร์ฟเวอร์ และ (ในโหมดพัฒนา) เด้ง toast บอกรหัสบนหน้าจอด้วย

---

## 📦 Build & Deploy (Production)

```bash
npm run build           # สร้าง client/dist
npm start               # เซิร์ฟเวอร์เสิร์ฟทั้ง API และหน้าเว็บที่พอร์ตเดียว (4000)
```

เมื่อมีโฟลเดอร์ `client/dist` อยู่ เซิร์ฟเวอร์ Express จะเสิร์ฟไฟล์ static + fallback ไปที่ `index.html`
พร้อม deploy ขึ้นบริการที่รัน Node ได้ (Render / Railway / Fly.io / VPS ฯลฯ) — ตั้ง env `PORT` ตามที่ผู้ให้บริการกำหนด

---

## ⚙️ ตั้งค่าเพิ่มเติม (ทั้งหมดเป็น optional)

คัดลอก `server/.env.example` เป็น `server/.env` แล้วเติมค่า:

| ตัวแปร | ผล |
|---|---|
| `JWT_SECRET` | ความลับสำหรับเซ็น token (**ต้อง**ตั้งค่าจริงตอน deploy — ถ้า `NODE_ENV=production` แล้วไม่ตั้ง เซิร์ฟเวอร์จะไม่ยอมสตาร์ท) |
| `NODE_ENV` | ตั้งเป็น `production` ตอน deploy จริง — บังคับตั้ง `JWT_SECRET` เอง และซ่อนรหัส OTP ออกจาก response แม้ยังไม่ได้ตั้งค่า SMTP |
| `CORS_ORIGIN` | โดเมนของ client ที่อนุญาตให้เรียก API (คั่นด้วย `,`) — ไม่ตั้งค่า = อนุญาตทุกโดเมน |
| `GOOGLE_CLIENT_ID` | เปิดปุ่มเข้าสู่ระบบ/สมัครด้วย Google (สร้างที่ Google Cloud Console, ประเภท Web) |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` / … | ส่งอีเมล OTP จริง |
| `ANTHROPIC_API_KEY` | เปิดปุ่ม "สร้างคำถามด้วย AI" (โมเดล `claude-opus-4-8`) |
| `PORT` | พอร์ตของเซิร์ฟเวอร์ (ดีฟอลต์ 4000) |

> **Google OAuth:** เพิ่ม origin ของเว็บ (เช่น `http://localhost:5173` และโดเมน production) ใน
> "Authorized JavaScript origins" ของ OAuth Client แล้วนำ Client ID มาใส่ใน `GOOGLE_CLIENT_ID`

---

## 📁 โครงสร้างโปรเจกต์

```
Dee_Per/
├── server/                    # Express + SQLite
│   ├── src/
│   │   ├── index.js           # entry — เสิร์ฟ API + static
│   │   ├── db.js              # schema + seed คลังคำถาม (node:sqlite)
│   │   ├── auth.js            # JWT, bcrypt, กฎรหัสผ่าน
│   │   ├── mailer.js          # ส่ง OTP (fallback = console)
│   │   ├── ai.js              # สร้างคำถามด้วย Anthropic
│   │   ├── questions-bank.js  # คลังคำถาม 3 หมวด × 36
│   │   └── routes/            # auth · questions · data (saved/history)
│   └── .env.example
└── client/                    # React + Vite
    └── src/
        ├── pages/             # Welcome, Signup, Login, ForgotPassword, Home,
        │                      # Answer, Saved, History, Profile, AccountSettings, Support…
        ├── components/        # BottomNav, OtpInput, PasswordStrength, GoogleButton, icons, ui…
        ├── store/             # auth + i18n context
        ├── utils/             # password, avatar helpers
        ├── api.js             # ตัวเรียก API
        └── styles.css         # ดีไซน์ซิสเต็ม (glassmorphism ดำ–แดง)
```

---

## 🧩 ฟีเจอร์ตามสเปค

- หน้าเปิดแอป → เลือกสมัคร / ล็อกอิน
- สมัครด้วย **Google** (ไม่ต้องตั้งรหัส) หรือ **อีเมล + OTP 4 หลัก** แล้วตั้งรหัสผ่าน
  - รหัสผ่านต้องมี: พิมพ์ใหญ่ + พิมพ์เล็ก + ตัวเลข + อักขระพิเศษ (มี strength meter ไล่สีแบบเรียลไทม์)
- **แถบเมนูล่าง 4 อัน:** หน้าหลัก / บันทึกไว้ / ประวัติ / โปรไฟล์
- **การ์ดคำถาม** glassmorphism ปัดได้ (ซ้าย = ข้าม, ขวา = ตอบ) + ปุ่ม ข้าม / บันทึก / ตอบ
- **หน้าตอบ 2 ช่อง** ผลัดกันพิมพ์ ("ถึงตาอีกฝ่าย") ตั้งชื่อ + เลือกสีอีกฝ่ายได้
- **บันทึกไว้ / ประวัติ** เรียงใหม่สุดบนสุด พร้อมวันที่
- ผู้ใช้เพิ่มคำถามของตัวเองได้ + ผู้พัฒนาแก้คลังได้ที่ `server/src/questions-bank.js`

---

## 📜 คำสั่ง npm

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run install:all` | ติดตั้ง dependencies ของ server และ client |
| `npm run dev:server` | รันเซิร์ฟเวอร์แบบ dev (auto-reload) ที่พอร์ต 4000 |
| `npm run dev:client` | รัน Vite dev server ที่พอร์ต 5173 |
| `npm run build` | build client ไปที่ `client/dist` |
| `npm start` | รัน production (เสิร์ฟ API + static ที่พอร์ตเดียว) |

---

## 📝 License

โปรเจกต์ส่วนตัว (private) — ยังไม่ได้กำหนดสัญญาอนุญาตแบบเปิด
