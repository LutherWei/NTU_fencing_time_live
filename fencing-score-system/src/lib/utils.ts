import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 簡單的ID生成
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}
