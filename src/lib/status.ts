import type { ProductStatus } from './types';
import type { Tone as BadgeTone } from '@/components/vbds';

/**
 * Product status → badge tone. One mapping, used everywhere, so a status
 * never means two different colours in two different tables.
 */
const STATUS_TONE: Record<ProductStatus, BadgeTone> = {
  Commercial: 'success',
  Development: 'warning',
  Pilot: 'info',
  Discontinued: 'neutral',
};

export function statusTone(status: ProductStatus): BadgeTone {
  return STATUS_TONE[status] ?? 'neutral';
}
