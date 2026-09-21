export class UpstreamError extends Error {
  public readonly cause: unknown;
  public readonly code: string;

  constructor(message: string, cause?: unknown, code: string = 'UPSTREAM_ERROR') {
    super(message);
    this.name = 'UpstreamError';
    this.cause = cause;
    this.code = code;
    Object.setPrototypeOf(this, UpstreamError.prototype);
  }
}
