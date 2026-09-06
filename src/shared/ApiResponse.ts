import { Response } from "express";

type ApiResponseOptions<T> = {
  statusCode?: number;
  message: string;
  data?: T;
};

export class ApiResponse {
  static success<T>(
    res: Response,
    options: ApiResponseOptions<T>
  ): Response {
    const { statusCode = 200, message, data } = options;

    const responsePayload: {
      success: boolean;
      message: string;
      data?: T;
    } = {
      success: true,
      message,
    };

    if (data !== undefined) {
      responsePayload.data = data;
    }

    return res.status(statusCode).json(responsePayload);
  }
}

export default ApiResponse;
