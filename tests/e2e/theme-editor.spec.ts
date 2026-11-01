import { test, expect } from '@playwright/test';

test.describe('Dashboard Theme Editor E2E', () => {
  let merchantEmail: string;

  test.beforeAll(async () => {
    merchantEmail = `theme-test-${Date.now()}@example.com`;
  });

  test('should customize theme via dashboard and see changes on checkout', async ({ page, context }) => {
    test.setTimeout(90000); // 90 seconds for checkout build
    
    // 1. Register and login
    await page.goto('http://localhost:3002/register');
    await page.fill('input[name="email"]', merchantEmail);
    await page.fill('input[name="password"]', 'test-password-123');
    await page.click('button[type="submit"]');
    
    await page.waitForURL('http://localhost:3002/overview');

    // 2. Navigate to Branding page
    await page.goto('http://localhost:3002/branding');
    await expect(page.locator('h1')).toContainText('Checkout appearance');

    // 3. Verify Theme Editor is visible
    await expect(page.locator('text=Checkout Theme')).toBeVisible();
    
    // 4. Change accent color
    const accentInput = page.locator('input[type="text"][value^="#"]').first();
    await accentInput.fill('#ff6b35');
    
    // 5. Change background color
    const bgInput = page.locator('input[type="text"][value^="#"]').nth(1);
    await bgInput.fill('#1a1a2e');

    // 6. Save theme
    await page.click('button:has-text("Save Theme")');
    
    // Wait for success message
    await expect(page.locator('text=Theme saved')).toBeVisible({ timeout: 5000 });

    // 7. Create a test payment to verify theme
    const projectResponse = await page.request.post('http://localhost:8787/v1/projects', {
      data: { name: 'Theme Test Project' },
    });
    const projectData = await projectResponse.json();

    const endpointResponse = await page.request.post('http://localhost:8787/v1/endpoints', {
      data: {
        project_id: projectData.project.id,
        name: 'Theme Test',
        method: 'GET',
        url: 'https://httpbin.org/json',
        input_schema: { fields: [] },
        price_amount: '1.00',
        price_asset: 'USDC',
      },
    });
    const endpointData = await endpointResponse.json();

    const invokeResponse = await page.request.post('http://localhost:8787/v1/invoke', {
      data: {
        endpoint_id: endpointData.endpoint.id,
        input: {},
      },
    });
    const invokeData = await invokeResponse.json();

    // 8. Open checkout in new page
    const checkoutPage = await context.newPage();
    await checkoutPage.goto(`http://localhost:3000/pay/${invokeData.payment.id}`);
    
    // 9. Verify custom theme is applied
    const root = await checkoutPage.locator('html');
    const accentColor = await root.evaluate((el) => 
      getComputedStyle(el).getPropertyValue('--accent')
    );
    const bgColor = await root.evaluate((el) => 
      getComputedStyle(el).getPropertyValue('--bg')
    );

    expect(accentColor.trim()).toBe('#ff6b35');
    expect(bgColor.trim()).toBe('#1a1a2e');

    await checkoutPage.close();

    // 10. Reset theme to default
    await page.goto('http://localhost:3002/branding');
    await page.click('button:has-text("Reset to Default")');
    await page.click('button:has-text("Save Theme")');
    await expect(page.locator('text=Theme saved')).toBeVisible({ timeout: 5000 });
  });
});
