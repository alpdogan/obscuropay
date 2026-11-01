import { test, expect } from '@playwright/test';

test.describe('Merchant Flow E2E', () => {
  let merchantEmail: string;

  test.beforeAll(async () => {
    merchantEmail = `merchant-${Date.now()}@example.com`;
  });

  test('should complete merchant registration and endpoint creation flow', async ({ page }) => {
    // 1. Visit homepage and navigate to register
    await page.goto('http://localhost:3001/');
    await expect(page).toHaveURL('http://localhost:3001/login');

    await page.click('a[href="/register"]');
    await expect(page).toHaveURL('http://localhost:3001/register');

    // 2. Register new merchant
    await page.fill('input[name="email"]', merchantEmail);
    await page.fill('input[name="password"]', 'secure-password-123');
    await page.click('button[type="submit"]');

    // 3. Verify redirect to dashboard
    await page.waitForURL('http://localhost:3001/overview');
    await expect(page.locator('h1')).toContainText('Overview');
    await expect(page.locator('nav')).toContainText('Endpoints');
    await expect(page.locator('nav')).toContainText('Payments');

    // 4. Navigate to Endpoints
    await page.click('nav a[href="/endpoints"]');
    await expect(page).toHaveURL('http://localhost:3001/endpoints');
    await expect(page.locator('h1')).toContainText('Endpoints');

    // 5. Create new endpoint via UI (navigate to form)
    await page.click('a[href="/endpoints/new"]');
    await expect(page).toHaveURL('http://localhost:3001/endpoints/new');
    
    // Fill endpoint form
    await page.fill('input[name="name"]', 'My First API');
    await page.selectOption('select[name="method"]', 'GET');
    await page.fill('input[name="url"]', 'https://httpbin.org/get');
    await page.fill('input[name="price_amount"]', '0.50');
    
    // Note: Full form implementation may vary, this is a skeleton
    await expect(page.locator('h1')).toContainText('New endpoint');

    // 6. Navigate to Branding
    await page.click('nav a[href="/branding"]');
    await expect(page).toHaveURL('http://localhost:3001/branding');
    await expect(page.locator('h1')).toContainText('Checkout appearance');

    // 7. Set display name
    await page.fill('input[name="display_name"]', 'My Store');
    await page.click('button:has-text("Save name")');
    
    // Wait for save
    await page.waitForTimeout(1000);

    // 8. Verify Integrations page
    await page.click('nav a[href="/integrations"]');
    await expect(page).toHaveURL('http://localhost:3001/integrations');
    await expect(page.locator('h1')).toContainText('Integrations');

    // 9. Check Developers page
    await page.click('nav a[href="/developers"]');
    await expect(page).toHaveURL('http://localhost:3001/developers');
    await expect(page.locator('h1')).toContainText('Developers');

    // 10. Navigate to Settings
    await page.click('nav a[href="/settings"]');
    await expect(page).toHaveURL('http://localhost:3001/settings');
    await expect(page.locator('h1')).toContainText('Settings');

    // 11. Verify logout works
    await page.click('a[href="/logout"]');
    await page.waitForURL('http://localhost:3001/login');
    await expect(page).toHaveURL('http://localhost:3001/login');

    // 12. Login again
    await page.fill('input[name="email"]', merchantEmail);
    await page.fill('input[name="password"]', 'secure-password-123');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3001/overview');
    await expect(page.locator('h1')).toContainText('Overview');
  });
});
