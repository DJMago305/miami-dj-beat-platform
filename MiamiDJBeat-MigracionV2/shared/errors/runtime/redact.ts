/** MOD-014 Error Handler — redaction — TICKET-V2-RUNTIME-ERROR-HANDLER-001 */

const SENSITIVE_PATTERN =
  /password|token|authorization|secret|apikey|service.?role|bearer|sql|select\s+from|insert\s+into|supabase_service|set-cookie|cookie/i;

const JWT_PATTERN = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+/i;

export function redactErrorText(value: string): string {
  let output = value;

  if (SENSITIVE_PATTERN.test(output) || JWT_PATTERN.test(output)) {
    return '[REDACTED]';
  }

  output = output.replace(/([?&])(token|code|access_token|refresh_token)=[^&\s]+/gi, '$1$2=[REDACTED]');

  if (output.length > 512) {
    return `${output.slice(0, 512)}…`;
  }

  return output;
}

export function redactErrorMessage(message: string): string {
  return redactErrorText(message);
}
