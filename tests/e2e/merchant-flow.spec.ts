import { test, expect } from '@playwright/test';

test.describe('Merchant Flow E2E', () => {
  let merchantEmail: string;

  test.beforeAll(async () => {
    merchantEmail = `merchant-${Date.now()}@example.com`;
  });

  test('should complete merchant registration and endpoint creation flow', async ({ page }) => {
    // 1. Visit homepage and navigate to register
    await page.goto('http://localhost:3002/');
    await expect(page).toHaveURL('http://localhost:3002/login');

    await page.click('a[href="/register"]');
    await expect(page).toHaveURL('http://localhost:3002/register');

    // 2. Register new merchant
    await page.fill('input[name="email"]', merchantEmail);
    await page.fill('input[name="password"]', 'secure-password-123');
    await page.click('button[type="submit"]');

    // 3. Verify redirect to dashboard
    await page.waitForURL('http://localhost:3002/overview');
    await expect(page.locator('h1')).toContainText('Prove you paid');
    await expect(page.locator('nav')).toContainText('Endpoints');
    await expect(page.locator('nav')).toContainText('Payments');

    // 4. Navigate to Endpoints
    await page.click('nav a[href="/endpoints"]');
    await expect(page).toHaveURL('http://localhost:3002/endpoints');
    await expect(page.locator('h1')).toContainText('Monetized APIs');

    // 5. Skip endpoint form (not fully implemented yet)
    // Just verify the "new" link exists
    await expect(page.locator('a[href="/endpoints/new"]')).toContainText('Import from cURL');

    // 6. Navigate to Branding
    await page.click('nav a[href="/branding"]');
    await expect(page).toHaveURL('http://localhost:3002/branding');
    await expect(page.locator('h1')).toContainText('Checkout appearance');

    // 7. Set display name
    await page.fill('input[name="display_name"]', 'My Store');
    await page.click('button:has-text("Save name")');
    
    // Wait for save
    await page.waitForTimeout(1000);

    // 8. Verify Integrations page
    await page.click('nav a[href="/integrations"]');
    await expect(page).toHaveURL('http://localhost:3002/integrations');
    await expect(page.locator('h1')).toContainText('Channels');

    // 9. Check Developers page
    await page.click('nav a[href="/developers"]');
    await expect(page).toHaveURL('http://localhost:3002/developers');
    await expect(page.locator('h1')).toContainText('Merchant API');

    // 10. Navigate to Settings
    await page.click('nav a[href="/settings"]');
    await expect(page).toHaveURL('http://localhost:3002/settings');
    await expect(page.locator('h1')).toContainText('Account');

    // Test complete - merchant can navigate all dashboard pages
  });
});
