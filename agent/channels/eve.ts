import { eveChannel, defaultEveAuth } from "eve/channels/eve";
import {
  extractBearerToken,
  verifyJwtHmac,
  withAuthChallenges,
  type AuthFn,
} from "eve/channels/auth";
import { loadBootstrap } from "../lib/omniseed-client.mjs";
import { executionProfileFor, messageText } from "../lib/execution-profile.mjs";

const companyJwt: AuthFn<Request> = withAuthChallenges(async (request) => {
  const bootstrap = loadBootstrap();
  const credentialReference = process.env.OMNISEED_SESSION_CREDENTIAL_ENV;
  const secret = credentialReference ? process.env[credentialReference] : undefined;
  if (!secret) return null;
  const result = await verifyJwtHmac(
    extractBearerToken(request.headers.get("authorization")),
    {
      algorithm: "HS256",
      audiences: [process.env.OMNISEED_SESSION_JWT_AUDIENCE ?? "omniseed-lily"],
      issuer: process.env.OMNISEED_SESSION_JWT_ISSUER ?? "omniseed",
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
    const profile = executionProfileFor(messageText({ content: message }));
    return {
      auth: defaultEveAuth(ctx),
      context: [
        `Resolve organisational context through OmniSeed using companyRef=${bootstrap.companyRef} and agentIdentity=${bootstrap.identity}.`,
        `Authenticated caller=${ctx.eve.caller?.principalId ?? "unknown"}. User message: ${message}`,
        `Enforced turn profile=${profile.name}; governed operation limit=${profile.governedToolLimit}. Tool availability is recalculated from durable Eve message history before every model step.`,
      ],
    };
  },
});
