import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function truncateText(text: string, maxLength: number = 100): string {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

export function formatProcessingTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function highlightText(text: string, searchTerms: string[]): string {
  if (!searchTerms.length) return text;
  
  let highlighted = text;
  searchTerms.forEach(term => {
    const regex = new RegExp(`(${term})`, 'gi');
    highlighted = highlighted.replace(regex, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>');
  });
  
  return highlighted;
}

export function getFieldTypeIcon(dataType: string): string {
  const type = dataType.toLowerCase();
  
  switch (type) {
    case 'date':
    case 'datetime':
      return 'calendar';
    case 'picklist':
    case 'multipicklist':
      return 'list';
    case 'currency':
    case 'number':
      return 'dollar-sign';
    case 'formula':
      return 'calculator';
    case 'text':
    case 'textarea':
      return 'type';
    case 'email':
      return 'mail';
    case 'phone':
      return 'phone';
    case 'url':
      return 'link';
    case 'checkbox':
      return 'check-square';
    default:
      return 'database';
  }
}

export function getObjectColor(objectName: string): string {
  const colors = [
    'bg-blue-100 text-blue-800',
    'bg-green-100 text-green-800', 
    'bg-purple-100 text-purple-800',
    'bg-orange-100 text-orange-800',
    'bg-pink-100 text-pink-800',
    'bg-indigo-100 text-indigo-800',
  ];
  
  // Simple hash function to consistently assign colors
  let hash = 0;
  for (let i = 0; i < objectName.length; i++) {
    hash = objectName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}
