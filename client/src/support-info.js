// Donation / support details shown in the "support us" modal.
// Placeholder values — replace with the real account details.
// promptPay.qrImage should point to a static image (e.g. under client/public/)
// generated from a banking/TrueMoney app; leave it null to show a
// "coming soon" placeholder instead of a broken image.
export const SUPPORT_INFO = {
  bank: {
    bankName: 'ชื่อธนาคาร',
    accountName: 'ชื่อ-นามสกุล',
    accountNumber: 'xxx-x-xxxxx-x',
  },
  trueMoney: {
    phone: '0xx-xxx-xxxx',
  },
  promptPay: {
    id: '0xx-xxx-xxxx',
    qrImage: null,
  },
};
