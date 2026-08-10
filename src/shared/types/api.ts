export type ApplicationErrorCode =
  | "INVALID_INPUT"
  | "LOCATION_PERMISSION_DENIED"
  | "GEOCODING_FAILED"
  | "ROUTE_NOT_FOUND"
  | "TRANSIT_PROVIDER_UNAVAILABLE"
  | "AI_UNAVAILABLE"
  | "INTERNAL_ERROR";

export interface ApiError<TCode extends ApplicationErrorCode = ApplicationErrorCode> {
  code: TCode;
  message: string;
}

export type ApiResult<TData, TCode extends ApplicationErrorCode = ApplicationErrorCode> =
  { success: true; data: TData } | { success: false; error: ApiError<TCode> };
