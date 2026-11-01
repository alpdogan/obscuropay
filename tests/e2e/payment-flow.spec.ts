import { test, expect } from '@playwright/test';

test.describe('Payment Flow E2E', () => {
  let merchantEmail: string;
  let projectId: string;
  let endpointId: string;
  let paymentId: string;

  test.beforeAll(async () => {
    merchantEmail = `test-${Date.now()}@example.com`;
  });

  test('should complete full payment flow with mock provider', async ({ page }) => {
    // 1. Register merchant
    await page.goto('http://localhost:3001/register');
    await page.fill('input[name="email"]', merchantEmail);
    await page.fill('input[name="password"]', 'test-password-123');
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL('http://localhost:3001/overview');
    await expect(page.locator('h1')).toContainText('Overview');

    // 2. Create project via API
    const projectResponse = await page.request.post('http://localhost:8787/v1/projects', {
      data: { name: 'Test Project' },
    });
    expect(projectResponse.ok()).toBeTruthy();
    const projectData = await projectResponse.json();
    projectId = projectData.project.id;

    // 3. Create endpoint via API
    const endpointResponse = await page.request.post('http://localhost:8787/v1/endpoints', {
      data: {
        project_id: projectId,
        name: 'Test Endpoint',
        method: 'GET',
        url: 'https://httpbin.org/json',
        input_schema: { fields: [] },
        price_amount: '0.25',
        price_asset: 'USDC',
      },
    });
    expect(endpointResponse.ok()).toBeTruthy();
    const endpointData = await endpointResponse.json();
    endpointId = endpointData.endpoint.id;

    // 4. Invoke endpoint (customer perspective)
    const invokeResponse = await page.request.post('http://localhost:8787/v1/invoke', {
      data: {
        endpoint_id: endpointId,
        input: {},
      },
    });
    expect(invokeResponse.ok()).toBeTruthy();
    const invokeData = await invokeResponse.json();
    paymentId = invokeData.payment.id;
    expect(invokeData.payment.state).toBe('AWAITING_PAYMENT');

    // 5. Navigate to checkout
    await page.goto(`http://localhost:3000/pay/${paymentId}`);
    
    // Verify checkout page loaded
    await expect(page.locator('h2')).toContainText('Protected by Obscurus');
    await expect(page.locator('h1')).toContainText('Test Endpoint');
    await expect(page.locator('.amount')).toContainText('0.25 USDC');

    // 6. Complete payment with mock
    const payButton = page.locator('button:has-text("Pay with wallet")');
    await expect(payButton).toBeVisible();
    await payButton.click();

    // Wait for payment to process
    await page.waitForTimeout(2000);

    // 7. Verify payment completed
    await expect(page.locator('.muted')).toContainText('State: FULFILLED');

    // 8. Verify in dashboard
    await page.goto('http://localhost:3001/payments');
    await expect(page.locator('table')).toContainText('Test Endpoint');
    await expect(page.locator('table')).toContainText('0.25');
    await expect(page.locator('table')).toContainText('FULFILLED');
  });
});
