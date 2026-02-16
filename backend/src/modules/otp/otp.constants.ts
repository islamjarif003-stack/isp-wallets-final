export const OTP_MESSAGES = {
  SIGNUP: (otp: string) =>
    `Your ISP Wallet verification code is: ${otp}. Valid for 3 minutes. Do not share with anyone.`,
  FORGOT_PASSWORD: (otp: string) =>
    `Your password reset code is: ${otp}. Valid for 3 minutes. If you didn't request this, ignore this message.`,
} as const;