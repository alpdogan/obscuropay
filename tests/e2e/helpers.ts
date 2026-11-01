import { Page } from '@playwright/test';

export async function registerMerchant(page: Page, email: string, password: string) {
  await page.goto('http://localhost:3002/register');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('http://localhost:3002/overview');
}

export async function loginMerchant(page: Page, email: string, password: string) {
  await page.goto('http://localhost:3002/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('http://localhost:3002/overview');
}

export async function createProject(page: Page, name: string): Promise<string> {
  const response = await page.request.post('http://localhost:8787/v1/projects', {
    data: { name },
  });
  const data = await response.json();
  return data.project.id;
}

export async function createEndpoint(
  page: Page,
  projectId: string,
  config: {
    name: string;
    method?: string;
    url?: string;
    priceAmount?: string;
  }
): Promise<string> {
  const response = await page.request.post('http://localhost:8787/v1/endpoints', {
    data: {
      project_id: projectId,
      name: config.name,
      method: config.method || 'GET',
      url: config.url || 'https://httpbin.org/json',
      input_schema: { fields: [] },
      price_amount: config.priceAmount || '0.25',
      price_asset: 'USDC',
    },
  });
  const data = await response.json();
  return data.endpoint.id;
}

export async function invokeEndpoint(page: Page, endpointId: string): Promise<string> {
  const response = await page.request.post('http://localhost:8787/v1/invoke', {
    data: {
      endpoint_id: endpointId,
      input: {},
    },
  });
  const data = await response.json();
  return data.payment.id;
}

export function generateTestEmail(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}@example.com`;
}
