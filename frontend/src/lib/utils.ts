import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

export function formatRetentionDays(days: number): string {
  if (days < 1) {
    const hours = days * 24
    if (hours < 1) {
      const minutes = hours * 60
      return `${minutes.toFixed(0)} minutes`
    }
    return `${hours.toFixed(1)} hours`
  } else if (days < 7) {
    return `${days.toFixed(1)} days`
  } else if (days < 30) {
    const weeks = days / 7
    return `${weeks.toFixed(1)} weeks`
  } else if (days < 365) {
    const months = days / 30
    return `${months.toFixed(1)} months`
  } else {
    const years = days / 365
    return `${years.toFixed(1)} years`
  }
}

export function convertRetentionToDays(value: number, unit: string): number {
  const conversions = {
    minutes: 1 / 1440,
    hours: 1 / 24,
    days: 1,
    weeks: 7,
    months: 30,
    years: 365
  }
  
  return value * (conversions[unit as keyof typeof conversions] || 1)
}

export function convertDaysToUnit(days: number): { value: number; unit: string } {
  if (days < 1 / 24) {
    return { value: Math.round(days * 1440), unit: 'minutes' }
  } else if (days < 1) {
    return { value: Math.round(days * 24 * 10) / 10, unit: 'hours' }
  } else if (days < 7) {
    return { value: Math.round(days * 10) / 10, unit: 'days' }
  } else if (days < 30) {
    return { value: Math.round((days / 7) * 10) / 10, unit: 'weeks' }
  } else if (days < 365) {
    return { value: Math.round((days / 30) * 10) / 10, unit: 'months' }
  } else {
    return { value: Math.round((days / 365) * 10) / 10, unit: 'years' }
  }
}