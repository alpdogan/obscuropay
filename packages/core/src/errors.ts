export class DomainError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.status = status;
  }
}

export function badRequest(code: string, message: string): DomainError {
  return new DomainError(code, message, 400);
}

export function unauthorized(message = "Authentication required"): DomainError {
  return new DomainError("unauthorized", message, 401);
}

export function forbidden(message = "Not allowed"): DomainError {
  return new DomainError("forbidden", message, 403);
}

export function notFound(entity: string): DomainError {
  return new DomainError("not_found", `${entity} not found`, 404);
}

export function conflict(code: string, message: string): DomainError {
  return new DomainError(code, message, 409);
}

export function paymentRequired(message = "Payment required"): DomainError {
  return new DomainError("payment_required", message, 402);
}
