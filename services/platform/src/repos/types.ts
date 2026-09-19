export type MerchantRow = {
  id: string;
  email: string;
  password_hash: string;
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
