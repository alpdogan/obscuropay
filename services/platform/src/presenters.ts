import type { HeaderSpec } from "@obscurus/core";
import type { EndpointRow, InvocationRow, PaymentRow } from "./repos/types.ts";

export function presentEndpoint(row: EndpointRow) {
  const headers = JSON.parse(row.headers_json) as HeaderSpec[];
  return {
    id: row.id,
    project_id: row.project_id,
    name: row.name,
    slug: row.slug,
    method: row.method,
    url: row.url,
    headers: headers.map((header) =>
      "secretId" in header
        ? { name: header.name, secret_id: header.secretId }
        : { name: header.name, value: header.value },
    ),
    body_template: row.body_template,
    input_schema: JSON.parse(row.input_schema_json),
    pricing: {
      type: row.pricing_type,
      amount: row.price_amount,
      asset: row.price_asset,
    },
    response: {
      mode: row.response_mode,
      select: row.response_select,
      template: row.response_template,
    },
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function presentInvocation(row: InvocationRow) {
  return {
    id: row.id,
    project_id: row.project_id,
    endpoint_id: row.endpoint_id,
    source: row.source,
    status: row.status,
    input: JSON.parse(row.input_json),
    output_preview: row.output_preview,
    error_class: row.error_class,
    http_status: row.http_status,
    created_at: row.created_at,
    completed_at: row.completed_at,
  };
}

export function presentPayment(row: PaymentRow) {
  return {
    id: row.id,
    endpoint_id: row.endpoint_id,
    invocation_id: row.invocation_id,
    amount: row.amount,
    asset: row.asset,
    state: row.state,
    payment_ref: row.payment_ref,
    provider: row.provider,
    expires_at: row.expires_at,
    checkout_url: `/pay/${row.id}`,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function presentCheckoutPayment(
  row: PaymentRow,
  extras: {
    serviceName: string;
    settlementAddress: string | null;
    displayName: string | null;
    logoUrl: string | null;
  },
) {
  return {
    ...presentPayment(row),
    service_name: extras.serviceName,
    settlement_address: extras.settlementAddress,
    branding: {
      display_name: extras.displayName,
      logo_url: extras.logoUrl,
    },
  };
}
