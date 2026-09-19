import {
  AesGcmSecretBox,
  parseResponseMapping,
  renderTemplate,
  transformResponse,
  type HeaderSpec,
} from "@obscurus/core";
import { nowSeconds } from "./clock.ts";
import { ExecutorError, executeMerchantRequest } from "./executor.ts";
import { findSecret } from "./repos/secrets.ts";
import type { EndpointRow, InvocationRow } from "./repos/types.ts";
import { isProduction } from "./runtime.ts";

export async function resolveEndpointHeaders(
  env: Env,
  merchantId: string,
  specs: HeaderSpec[],
): Promise<Record<string, string>> {
  const box = AesGcmSecretBox.fromBase64(env.SECRET_KEK);
  const headers: Record<string, string> = {};
  for (const spec of specs) {
    if ("secretId" in spec) {
      const secret = await findSecret(env.DB, merchantId, spec.secretId);
      if (!secret) {
        throw new ExecutorError("secret_missing");
      }
      headers[spec.name] = await box.decrypt(secret.ciphertext);
    } else {
      headers[spec.name] = spec.value;
    }
  }
  return headers;
}

export async function executeStoredEndpoint(
  env: Env,
  endpoint: EndpointRow,
  invocation: InvocationRow,
  input: Record<string, unknown>,
): Promise<InvocationRow> {
  const next = { ...invocation };
  try {
    const headers = await resolveEndpointHeaders(
      env,
      endpoint.merchant_id,
      JSON.parse(endpoint.headers_json) as HeaderSpec[],
    );
    const renderedBody = endpoint.body_template ? renderTemplate(endpoint.body_template, input) : null;
    const result = await executeMerchantRequest({
      method: endpoint.method,
      url: endpoint.url,
      headers,
      body: renderedBody,
      allowHttp: !isProduction(env),
    });
    next.status = result.status >= 200 && result.status < 300 ? "FULFILLED" : "FAILED";
    next.http_status = result.status;
    next.output_preview = transformResponse(
      result.body,
      parseResponseMapping({
        mode: endpoint.response_mode,
        select: endpoint.response_select,
        template: endpoint.response_template,
      }),
    ).slice(0, 2048);
    next.completed_at = nowSeconds();
  } catch (error) {
    next.status = "FAILED";
    next.error_class = error instanceof ExecutorError ? error.reason : "executor_error";
    next.completed_at = nowSeconds();
  }
  return next;
}
