export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function validateConvexUrl(url: string): Promise<ValidationResult> {
  if (!url || !url.startsWith("https://")) {
    return { ok: false, reason: "A URL deve começar com https://" };
  }

  try {
    const response = await fetch(`${url}/version`);
    if (!response.ok) {
      return { ok: false, reason: "Não foi possível acessar (health check falhou)" };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `Não foi possível reach a URL: ${msg}` };
  }
}
