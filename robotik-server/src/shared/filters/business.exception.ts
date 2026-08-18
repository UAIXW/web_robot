import { HttpException, HttpStatus } from '@nestjs/common'
import { ErrorCode, ErrorCodeMessage } from '../constants/error-codes'

export class BusinessException extends HttpException {
  errorCode: ErrorCode

  constructor(errorCode: ErrorCode, status: HttpStatus = HttpStatus.BAD_REQUEST, message?: string) {
    super(
      {
        errorCode,
        message: message ?? ErrorCodeMessage[errorCode],
      },
      status,
    )
    this.errorCode = errorCode
  }
}
