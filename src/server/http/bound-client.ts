import { clientKeyFromRequest } from "@/server/ai/client-key";
import { ensureSessionId } from "@/server/http/session";

/**
 * Resolve the bound client key for a request, minting a session cookie when needed.
 */
export function bindClientFromRequest(request: Request): {
  clientKeyHash: string;
  sessionId: string;
  setCookie?: string;
} {
  const session = ensureSessionId(request);
  return {
    clientKeyHash: clientKeyFromRequest(request.headers, session.sessionId),
    sessionId: session.sessionId,
    setCookie: session.setCookie,
  };
}
