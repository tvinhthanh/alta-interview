export type ApiErrorCode = 'NETWORK' | 'TIMEOUT' | 'SNAPSHOT_EXPIRED' | 'NOT_FOUND' | 'ABORTED'

export class ApiError extends Error {
  readonly code: ApiErrorCode

  constructor(code: ApiErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'ApiError'
    this.code = code
  }
}

export const isAborted = (err: unknown) => err instanceof ApiError && err.code === 'ABORTED'
export const isSnapshotExpired = (err: unknown) => err instanceof ApiError && err.code === 'SNAPSHOT_EXPIRED'

export function describeError(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Có lỗi không xác định.'
  switch (err.code) {
    case 'TIMEOUT':
      return 'Máy chủ phản hồi quá lâu.'
    case 'NETWORK':
      return 'Không kết nối được tới máy chủ.'
    case 'NOT_FOUND':
      return 'Không tìm thấy bảng xếp hạng của tháng này.'
    default:
      return 'Không tải được dữ liệu.'
  }
}
