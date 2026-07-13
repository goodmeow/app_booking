export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (code, message, details) => new HttpError(400, code, message, details);
export const forbidden = (message = "Forbidden") => new HttpError(403, "FORBIDDEN", message);
export const notFound = (message = "Not found") => new HttpError(404, "NOT_FOUND", message);
export const conflict = (code, message, details) => new HttpError(409, code, message, details);
