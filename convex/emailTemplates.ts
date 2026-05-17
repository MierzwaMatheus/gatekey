export function magicLinkHtml(link: string, locale: string): string {
  if (locale === "pt-BR") {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Seu link de acesso</title></head>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
  <h2>Acesse sua conta</h2>
  <p>Clique no botão abaixo para Entrar. Este link expira em 15 minutos.</p>
  <a href="${link}" style="display:inline-block;padding:12px 24px;background:#F0A500;color:#0D1117;text-decoration:none;border-radius:4px;font-weight:bold">Entrar</a>
  <p style="color:#8B949E;font-size:12px;margin-top:24px">Se você não solicitou este link, ignore este email.</p>
</body>
</html>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Your sign-in link</title></head>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
  <h2>Sign in to your account</h2>
  <p>Click the button below to Sign in. This link expires in 15 minutes.</p>
  <a href="${link}" style="display:inline-block;padding:12px 24px;background:#F0A500;color:#0D1117;text-decoration:none;border-radius:4px;font-weight:bold">Sign in</a>
  <p style="color:#8B949E;font-size:12px;margin-top:24px">If you did not request this link, you can safely ignore this email.</p>
</body>
</html>`;
}
