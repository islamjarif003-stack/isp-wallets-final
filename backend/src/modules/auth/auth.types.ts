export interface SignupRequestOtpInput {
  mobile: string;
  fullName: string;
}

export interface SignupCompleteInput {
  mobile: string;
  otp: string;
  fullName: string;
  password: string;
  email?: string;
}

export interface LoginInput {
  mobile: string;
  password: string;
}

export interface ForgotPasswordRequestInput {
  mobile: string;
}

export interface ForgotPasswordResetInput {
  mobile: string;
  otp: string;
  newPassword: string;
}

export interface RefreshTokenInput {
  refreshToken: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface AuthResponse {
  user: {
    id: string;
    mobile: string;
    fullName: string;
    email: string | null;
    role: string;
    isVerified: boolean;
  };
  wallet: {
    id: string;
    status: string;
  };
  tokens: AuthTokens;
}