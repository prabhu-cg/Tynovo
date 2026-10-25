import { ImportError, ValidationError } from '@/modules/brand-projects/service'
import { StorageError } from '@/modules/persistence/types'

/** Plain-language message for anything thrown by the service layer. */
export function describeError(e: unknown): string {
  if (e instanceof StorageError || e instanceof ImportError || e instanceof ValidationError) return e.message
  return e instanceof Error ? e.message : 'Something went wrong.'
}
