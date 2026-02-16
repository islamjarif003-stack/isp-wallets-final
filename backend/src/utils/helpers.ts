export const helpers = {};

export function paginationMeta(total: number, page: number, limit: number): {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
} {
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 20;
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const totalPages = Math.max(1, Math.ceil(safeTotal / safeLimit));
  return {
    total: safeTotal,
    page: safePage,
    limit: safeLimit,
    totalPages,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
  };
}

export function sanitizeMobile(mobile: string): string {
  const digits = (mobile || '').replace(/\D/g, '');
  if (digits.startsWith('8801') && digits.length === 13) return `0${digits.slice(3)}`;
  if (digits.startsWith('01') && digits.length === 11) return digits;
  if (digits.startsWith('1') && digits.length === 10) return `0${digits}`;
  return digits;
}

export function generateOtp(length: number = 6): string {
  const len = Number.isFinite(length) && length > 0 ? Math.floor(length) : 6;
  const min = Math.pow(10, Math.max(1, len - 1));
  const max = Math.pow(10, len) - 1;
  const n = Math.floor(Math.random() * (max - min + 1)) + min;
  return String(n);
}
