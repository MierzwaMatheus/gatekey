export class GatekeyAuthError extends Error {
  constructor(
    public readonly code: string,
    message?: string
  ) {
    super(message ?? code);
    this.name = "GatekeyAuthError";
  }
}

export class GatekeyApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string
  ) {
    super(message ?? `API error ${status}: ${code}`);
    this.name = "GatekeyApiError";
  }
}
