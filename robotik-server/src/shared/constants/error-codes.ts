export enum ErrorCode {
  AUTH_MISSING = 'E1001',
  AUTH_INVALID_TOKEN = 'E1002',
  AUTH_PERMISSION_DENIED = 'E1003',

  RATE_LIMIT = 'E2001',

  CHAT_BUSY = 'E3001',
  CHAT_FAILED = 'E3002',

  CONVERSATION_NOT_FOUND = 'E4001',

  INTERNAL_ERROR = 'E9001',
  VALIDATION_ERROR = 'E9002',
}

export const ErrorCodeMessage: Record<ErrorCode, string> = {
  [ErrorCode.AUTH_MISSING]: '缺少认证信息',
  [ErrorCode.AUTH_INVALID_TOKEN]: '认证无效或已过期',
  [ErrorCode.AUTH_PERMISSION_DENIED]: '权限不足',
  [ErrorCode.RATE_LIMIT]: '请求频率超限',
  [ErrorCode.CHAT_BUSY]: '上一条消息还在处理中',
  [ErrorCode.CHAT_FAILED]: '对话处理失败',
  [ErrorCode.CONVERSATION_NOT_FOUND]: '会话不存在或无权访问',
  [ErrorCode.INTERNAL_ERROR]: '内部服务器错误',
  [ErrorCode.VALIDATION_ERROR]: '参数校验失败',
}
