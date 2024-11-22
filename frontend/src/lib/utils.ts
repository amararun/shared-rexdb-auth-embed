import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parsePipeDelimitedText(content: string) {
  const lines = content.trim().split('\n')
  const headers = lines[0].split('|').map(header => header.trim())
  
  const data = lines.slice(1).map(line => {
    const values = line.split('|').map(value => value.trim())
    return headers.reduce((obj, header, index) => {
      obj[header] = values[index]
      return obj
    }, {} as Record<string, string>)
  })

  return { headers, data }
}
