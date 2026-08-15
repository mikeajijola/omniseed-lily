import { eveChannel, defaultEveAuth } from "eve/channels/eve";
import {
  extractBearerToken,
  verifyJwtHmac,
  withAuthChallenges,
  type AuthFn,
} from "eve/channels/auth";
import { loadBootstrap } from "../lib/omniseed-client.mjs";

const companyJwt: AuthFn<Request> = withAuthChallenges(async (request) => {
  const bootstrap = loadBootstrap();
  const secret = process.env.LILY_SESSION_JWT_SECRET;
  if (!secret) return null;
  const result = await verifyJwtHmac(
    extractBearerToken(request.headers.get("authorization")),
    {
      algorithm: "HS256",
      audiences: [process.env.LILY_SESSION_JWT_AUDIENCE ?? "omniseed-lily"],
      issuer: process.env.LILY_SESSION_JWT_ISSUER ?? "omniseed",
      secret,
      claims: { company_ref: [bootstrap.companyRef] },
    },
  );
  return result.ok ? result.sessionAuth : null;
}, [{ scheme: "Bearer" }]);

export default eveChannel({
  auth: [companyJwt],
  onMessage(ctx, message) {
    const bootstrap = loadBootstrap();
    return {
      auth: defaultEveAuth(ctx),
      context: [
        `Resolve organisational context through OmniSeed using companyRef=${bootstrap.companyRef} and agentIdentity=${bootstrap.identity}.`,
        `Authenticated caller=${ctx.eve.caller?.principalId ?? "unknown"}. User message: ${message}`,
      ],
    };
  },
});
