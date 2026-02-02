import type { QueryResult } from '@/types'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'

export async function runQuery<T>(queryFn: () => Promise<QueryResult<T>>): Promise<QueryResult<T>> {
  try {
    return await queryFn()
  }
  catch {
    return {
      data: null,
      error: DEFAULT_ERROR_MESSAGE,
    }
  }
}
