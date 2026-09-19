export type MerchantRow = {
  id: string;
  email: string;
  password_hash: string;
  settlement_address: string | null;
};

export type ProjectRow = {
  id: string;
  merchant_id: string;
  name: string;
  created_at: number;
  updated_at: number;
};

export type SecretRow = {
  id: string;
  merchant_id: string;
  project_id: string;
  name: string;
  ciphertext: string;
  hint: string;
  created_at: number;
};

export type EndpointRow = {
  id: string;
  merchant_id: string;
  project_id: string;
  name: string;
  slug: string;
  method: string;
  url: string;
  headers_json: string;
  body_template: string | null;
  input_schema_json: string;
  pricing_type: string;
  price_amount: string;
  price_asset: string;
  response_mode: string;
  response_select: string | null;
  response_template: string | null;
  created_at: number;
  updated_at: number;
};

export type InvocationRow = {
  id: string;
  merchant_id: string;
  project_id: string;
  endpoint_id: string;
  source: string;
  status: string;
  input_json: string;
  output_preview: string | null;
  error_class: string | null;
  http_status: number | null;
  created_at: number;
  completed_at: number | null;
};

export type PaymentRow = {
  id: string;
  merchant_id: string;
  project_id: string | null;
  endpoint_id: string | null;
  invocation_id: string | null;
  amount: string;
  asset: string;
  state: string;
  payment_ref: string;
  provider: string;
  expires_at: number | null;
  mock_ready: number;
  created_at: number;
  updated_at: number;
};

export type EntitlementRow = {
  id: string;
  merchant_id: string;
  endpoint_id: string;
  invocation_id: string;
  payment_id: string;
  pricing_type: string;
  status: string;
  claimed_at: number | null;
  created_at: number;
};
