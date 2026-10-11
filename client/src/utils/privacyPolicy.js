// DeePer's privacy policy (PDPA notice), shown in full on /privacy and in
// the "read more" sheet at signup. Kept as data — sections of a heading and
// paragraphs/bullets — so both places render the same text.
//
// When the wording changes, update UPDATED here and PRIVACY_VERSION in
// server/src/routes/auth.js together, so each account's recorded consent
// points at the text it actually agreed to.
export const PRIVACY_UPDATED = '2026-10-11';

// Each section: { title, body: [string | { list: string[] }] }
export const PRIVACY_POLICY = {
  th: {
    title: 'นโยบายความเป็นส่วนตัว',
    updated: 'ปรับปรุงล่าสุด 11 ตุลาคม 2569',
    intro:
      'DeePer ("เรา") ให้ความสำคัญกับข้อมูลส่วนบุคคลของคุณ นโยบายนี้อธิบายว่าเราเก็บข้อมูลอะไร ใช้ทำอะไร เก็บไว้นานแค่ไหน และคุณมีสิทธิ์อะไรบ้าง ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)',
    sections: [
      {
        title: '1. ข้อมูลที่เราเก็บ',
        body: [
          'ข้อมูลที่คุณให้เราโดยตรง',
          {
            list: [
              'ข้อมูลบัญชี: อีเมล ชื่อเล่น อายุ เพศ และรหัสผ่าน (เก็บแบบเข้ารหัส เราอ่านรหัสผ่านจริงของคุณไม่ได้)',
              'ถ้าสมัครด้วย Google: อีเมลและรหัสบัญชี Google ที่ Google ส่งให้เราตอนเข้าสู่ระบบ',
              'รูปโปรไฟล์ และข้อมูลของ "อีกฝ่าย" ที่คุณตั้งเอง เช่น ชื่อ สี รูปหรือไอคอน',
              'คำถามที่คุณบันทึก คำถามที่คุณเพิ่มเอง และคำตอบที่คุณกับอีกฝ่ายพิมพ์ไว้ในประวัติ',
              'รีวิวที่คุณเขียน และข้อความแจ้งปัญหา (รวมรูปหน้าจอถ้าคุณแนบมา)',
              'ถ้าคุณสนับสนุนเรา: รูปสลิปการโอน วันเวลา จำนวนเงิน และชื่อที่อยากให้แสดง',
            ],
          },
          'ข้อมูลที่เก็บโดยอัตโนมัติ',
          {
            list: [
              'ประวัติการเข้าสู่ระบบ: วันเวลา วิธีเข้าสู่ระบบ หมายเลข IP และชนิดอุปกรณ์/เบราว์เซอร์ เพื่อให้คุณดูและออกจากระบบอุปกรณ์อื่นได้',
              'สถิติการใช้งานแบบรวม: วันที่มีการใช้งาน และจำนวนครั้งที่ปัด ตอบ บันทึก หรือแชร์การ์ด',
              'การเข้าเว็บ: รหัสสุ่มที่เบราว์เซอร์ของคุณเก็บไว้ และเว็บที่พาคุณมา เพื่อนับจำนวนผู้เข้าชมต่อวัน โดยไม่ผูกกับตัวตนของคุณและไม่เก็บ IP',
              'ค่าที่เก็บในเครื่องของคุณ (localStorage) เช่น ภาษา หมวดคำถาม และระดับคำถามที่เลือก',
            ],
          },
        ],
      },
      {
        title: '2. เราใช้ข้อมูลทำอะไร',
        body: [
          {
            list: [
              'สร้างและดูแลบัญชีของคุณ และยืนยันตัวตนด้วยรหัส OTP ทางอีเมล',
              'แสดงการ์ดคำถาม เก็บคำถามที่บันทึกและประวัติคำตอบไว้ให้คุณกลับมาดูได้',
              'ดูแลความปลอดภัยของบัญชี เช่น แสดงประวัติการเข้าสู่ระบบ และป้องกันการเดารหัส',
              'ตอบกลับเรื่องที่คุณแจ้งเข้ามา และส่งอีเมลขอบคุณเมื่อเกี่ยวข้อง',
              'แสดงรีวิวที่ผ่านการตรวจแล้ว และชื่อผู้สนับสนุนบนหน้าแรก (เฉพาะที่คุณยินยอมให้แสดง)',
              'ดูภาพรวมการใช้งานเพื่อปรับปรุงแอป เช่น หมวดหรือคำถามที่คนใช้มากที่สุด',
            ],
          },
          'เราไม่ขายข้อมูลของคุณ ไม่ใช้ข้อมูลเพื่อโฆษณา และไม่ส่งคำตอบส่วนตัวของคุณให้ใคร',
        ],
      },
      {
        title: '3. ฐานทางกฎหมาย',
        body: [
          'เราประมวลผลข้อมูลโดยอาศัย (ก) ความยินยอมของคุณที่ให้ไว้ตอนสมัคร (ข) ความจำเป็นเพื่อให้บริการตามที่คุณขอ และ (ค) ประโยชน์โดยชอบด้วยกฎหมายในการดูแลความปลอดภัยและปรับปรุงบริการ',
        ],
      },
      {
        title: '4. การเปิดเผยข้อมูลให้ผู้อื่น',
        body: [
          'เราส่งข้อมูลให้ผู้ให้บริการเท่าที่จำเป็นต่อการทำงานของแอปเท่านั้น',
          {
            list: [
              'ผู้ให้บริการเซิร์ฟเวอร์และพื้นที่เก็บข้อมูล (hosting) ซึ่งอาจตั้งอยู่นอกประเทศไทย',
              'ผู้ให้บริการส่งอีเมล สำหรับส่งรหัส OTP และอีเมลตอบกลับ',
              'Google สำหรับการเข้าสู่ระบบด้วย Google (เฉพาะเมื่อคุณเลือกวิธีนี้)',
            ],
          },
          'นอกจากนี้ เราจะเปิดเผยข้อมูลเมื่อกฎหมายกำหนดเท่านั้น',
        ],
      },
      {
        title: '5. เราเก็บข้อมูลนานแค่ไหน',
        body: [
          {
            list: [
              'ข้อมูลบัญชี คำถามที่บันทึก และประวัติคำตอบ: เก็บไว้จนกว่าคุณจะลบออก หรือลบบัญชี',
              'รหัส OTP: หมดอายุภายใน 10 นาที',
              'เรื่องที่แจ้งเข้ามา สลิป และรีวิว: เก็บไว้เท่าที่จำเป็นต่อการดำเนินการ และลบได้เมื่อคุณขอ',
            ],
          },
          'เมื่อคุณลบบัญชี ข้อมูลบัญชี รูป คำถามที่บันทึก ประวัติคำตอบ รีวิว และประวัติการเข้าสู่ระบบจะถูกลบไปด้วย ส่วนเรื่องที่แจ้งและสลิปที่เคยส่งจะไม่ผูกกับบัญชีอีก และลบได้เมื่อคุณขอ ตัวเลขสถิติรวมที่ไม่ระบุตัวบุคคลยังคงอยู่',
        ],
      },
      {
        title: '6. สิทธิ์ของคุณ',
        body: [
          'ตาม PDPA คุณมีสิทธิ์',
          {
            list: [
              'ขอเข้าถึงหรือขอสำเนาข้อมูลของคุณ',
              'ขอแก้ไขข้อมูลให้ถูกต้อง (แก้ชื่อเล่น อายุ เพศ และรูปได้เองในหน้าโปรไฟล์)',
              'ขอลบข้อมูล (ลบบัญชีได้เองที่ โปรไฟล์ › ตั้งค่าความปลอดภัยขั้นสูง › ลบบัญชี)',
              'ขอระงับหรือคัดค้านการใช้ข้อมูล และขอให้โอนย้ายข้อมูล',
              'ถอนความยินยอมเมื่อใดก็ได้ ซึ่งอาจทำให้ใช้บางส่วนของแอปไม่ได้',
              'ร้องเรียนต่อสำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล (สคส.)',
            ],
          },
        ],
      },
      {
        title: '7. ความปลอดภัย',
        body: [
          'เราเข้ารหัสรหัสผ่าน ใช้การเชื่อมต่อแบบเข้ารหัส (HTTPS) จำกัดจำนวนครั้งในการเดารหัส และตรวจไฟล์รูปที่อัปโหลดว่าเป็นรูปจริง อย่างไรก็ตาม ไม่มีระบบใดปลอดภัย 100% หากพบปัญหาด้านความปลอดภัย เราจะแจ้งให้คุณทราบตามที่กฎหมายกำหนด',
        ],
      },
      {
        title: '8. ผู้ใช้อายุน้อย',
        body: [
          'หากคุณอายุต่ำกว่า 20 ปี (ยังไม่บรรลุนิติภาวะ) กรุณาให้ผู้ปกครองรับทราบก่อนสมัครใช้งาน และหากผู้ปกครองต้องการให้ลบข้อมูล ติดต่อเราได้ตามช่องทางด้านล่าง',
        ],
      },
      {
        title: '9. การเปลี่ยนแปลงนโยบาย',
        body: [
          'หากเราปรับนโยบายนี้ จะแสดงวันที่ปรับปรุงไว้ด้านบน และถ้าเป็นการเปลี่ยนแปลงสำคัญ เราจะแจ้งในแอปก่อนมีผล',
        ],
      },
      {
        title: '10. ติดต่อเรา',
        body: [
          'ใช้สิทธิ์ของคุณหรือสอบถามเรื่องข้อมูลส่วนบุคคลได้ที่เมนู "แจ้งปัญหาหรือเสนอแนะ" ในแอป หรือทาง Instagram @deeper.th.app',
        ],
      },
    ],
  },
  en: {
    title: 'Privacy policy',
    updated: 'Last updated 11 October 2026',
    intro:
      'DeePer ("we") cares about your personal data. This policy explains what we collect, what we use it for, how long we keep it and what your rights are, under Thailand’s Personal Data Protection Act B.E. 2562 (PDPA).',
    sections: [
      {
        title: '1. What we collect',
        body: [
          'What you give us',
          {
            list: [
              'Account details: email, nickname, age, gender and password (stored hashed — we can’t read your actual password)',
              'If you sign up with Google: the email and Google account id Google sends us at sign-in',
              'Your profile photo, and the details you set for "the other person", such as a name, colour, photo or icon',
              'Questions you save or add, and the answers you and the other person type into your history',
              'Reviews you write and problem reports you send (including a screenshot if you attach one)',
              'If you support us: the transfer slip image, date and time, amount, and the name you’d like shown',
            ],
          },
          'What is collected automatically',
          {
            list: [
              'Login history: date and time, sign-in method, IP address and device/browser type, so you can see and sign out other devices',
              'Aggregate usage: which days you were active, and counts of cards swiped, answered, saved or shared',
              'Site visits: a random id kept by your browser and the site that referred you, to count daily visitors — not linked to who you are, and no IP stored',
              'Settings kept on your device (localStorage), such as language, question category and question depth',
            ],
          },
        ],
      },
      {
        title: '2. What we use it for',
        body: [
          {
            list: [
              'Creating and running your account, and verifying it with an email OTP code',
              'Showing question cards, and keeping your saved questions and answer history for you to come back to',
              'Keeping your account safe, such as showing login history and limiting password guessing',
              'Replying to what you report, and sending a thank-you email where relevant',
              'Showing reviewed reviews and supporter names on the landing page (only where you agreed to be shown)',
              'Looking at overall usage to improve the app, such as the most used categories or questions',
            ],
          },
          'We don’t sell your data, don’t use it for advertising, and don’t pass your private answers to anyone.',
        ],
      },
      {
        title: '3. Legal basis',
        body: [
          'We process data based on (a) the consent you give at signup, (b) what’s necessary to provide the service you asked for, and (c) our legitimate interest in keeping the service secure and improving it.',
        ],
      },
      {
        title: '4. Sharing',
        body: [
          'We share data only with providers the app needs in order to work:',
          {
            list: [
              'Server and storage hosting, which may be located outside Thailand',
              'An email delivery provider, for OTP codes and replies',
              'Google, for Sign in with Google (only if you choose it)',
            ],
          },
          'Otherwise, we disclose data only where the law requires it.',
        ],
      },
      {
        title: '5. How long we keep it',
        body: [
          {
            list: [
              'Account details, saved questions and answer history: until you delete them or your account',
              'OTP codes: expire within 10 minutes',
              'Reports, slips and reviews: as long as needed to handle them, and deletable on request',
            ],
          },
          'Deleting your account deletes your account details, photos, saved questions, answer history, review and login history. Reports and slips you sent are unlinked from the account and can be deleted on request; aggregate totals that don’t identify anyone remain.',
        ],
      },
      {
        title: '6. Your rights',
        body: [
          'Under the PDPA you can:',
          {
            list: [
              'Access your data or ask for a copy',
              'Have it corrected (you can edit your nickname, age, gender and photo yourself on your profile)',
              'Have it deleted (delete your account yourself under Profile › Advanced security settings › Delete account)',
              'Restrict or object to its use, and ask for it to be transferred',
              'Withdraw your consent at any time, which may stop parts of the app from working',
              'Complain to Thailand’s Personal Data Protection Committee (PDPC)',
            ],
          },
        ],
      },
      {
        title: '7. Security',
        body: [
          'We hash passwords, use encrypted connections (HTTPS), limit password guessing, and check that uploaded images really are images. No system is 100% secure, though; if a security incident affects you, we’ll tell you as the law requires.',
        ],
      },
      {
        title: '8. Younger users',
        body: [
          'If you’re under 20 (not yet legally of age in Thailand), please let a parent or guardian know before signing up. If they’d like your data deleted, they can contact us through the channels below.',
        ],
      },
      {
        title: '9. Changes',
        body: [
          'If we update this policy, the date at the top changes, and for significant changes we’ll let you know in the app before they take effect.',
        ],
      },
      {
        title: '10. Contact',
        body: [
          'To use your rights or ask about your data, use "Report a problem or suggestion" in the app, or reach us on Instagram @deeper.th.app.',
        ],
      },
    ],
  },
};
