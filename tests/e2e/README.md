# End-to-End Testing

Obscurus uses Playwright for end-to-end testing across dashboard, checkout, and platform.

## Running Tests

### Prerequisites

```bash
pnpm install
pnpm exec playwright install chromium
```

### Run Tests

```bash
# Run all E2E tests (headless)
pnpm test:e2e

# Run with UI mode (interactive)
pnpm test:e2e:ui

# Run in headed mode (see browser)
pnpm test:e2e:headed

# View HTML report
pnpm test:e2e:report
```

### Test Servers

Playwright automatically starts required servers:
- Platform API: `http://localhost:8787`
- Dashboard: `http://localhost:3001`
- Checkout: `http://localhost:3000`

Tests wait for servers to be ready before running.

## Test Suites

### Payment Flow (`payment-flow.spec.ts`)

Tests the complete customer payment journey:

1. ✅ Merchant registers
2. ✅ Creates project and endpoint via API
3. ✅ Customer invokes endpoint
4. ✅ Navigates to checkout page
5. ✅ Completes payment with mock provider
6. ✅ Verifies fulfillment
7. ✅ Checks payment in dashboard

**Video:** `test-results/payment-flow-*/video.webm`

### Theme Editor (`theme-editor.spec.ts`)

Tests merchant theme customization:

1. ✅ Merchant registers and logs in
2. ✅ Navigates to branding page
3. ✅ Changes accent and background colors
4. ✅ Saves theme
5. ✅ Creates test payment
6. ✅ Verifies theme applied to checkout
7. ✅ Resets theme to default

**Video:** `test-results/theme-editor-*/video.webm`

### Merchant Flow (`merchant-flow.spec.ts`)

Tests merchant dashboard navigation:

1. ✅ Registration flow
2. ✅ Dashboard overview
3. ✅ Endpoints page navigation
4. ✅ Branding settings
5. ✅ Display name update
6. ✅ Integrations page
7. ✅ Developers page
8. ✅ Settings page
9. ✅ Logout and login

**Video:** `test-results/merchant-flow-*/video.webm`

## Video Recordings

Every test run produces video recordings:

```
test-results/
├── payment-flow-chromium/
│   ├── video.webm          # Full test recording
│   └── trace.zip           # Playwright trace
├── theme-editor-chromium/
│   ├── video.webm
│   └── trace.zip
└── merchant-flow-chromium/
    ├── video.webm
    └── trace.zip
```

### Viewing Videos

Videos are in WebM format and can be opened with:
- VLC Media Player
- Chrome/Firefox browser
- ffplay (command line): `ffplay test-results/*/video.webm`

### Trace Viewer

Playwright traces include:
- Screenshots at each step
- Network requests
- Console logs
- DOM snapshots

View traces:
```bash
npx playwright show-trace test-results/*/trace.zip
```

## Configuration

### playwright.config.ts

```typescript
{
  testDir: './tests/e2e',
  use: {
    video: 'on',              // Always record video
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  webServer: [...],           // Auto-start dev servers
}
```

### Parallel Execution

Tests run **sequentially** (`workers: 1`) because they:
- Share database state
- Create unique merchants per test
- Avoid race conditions

## Writing New Tests

### Example Test

```typescript
import { test, expect } from '@playwright/test';
import { registerMerchant, createProject } from './helpers';

test('my feature', async ({ page }) => {
  const email = `test-${Date.now()}@example.com`;
  
  // Register merchant
  await registerMerchant(page, email, 'password');
  
  // Create resources
  const projectId = await createProject(page, 'My Project');
  
  // Test feature
  await page.goto('http://localhost:3001/endpoints');
  await expect(page.locator('h1')).toContainText('Endpoints');
  
  // Video automatically recorded
});
```

### Helper Functions

Use `tests/e2e/helpers.ts` for common operations:

- `registerMerchant(page, email, password)`
- `loginMerchant(page, email, password)`
- `createProject(page, name)` → projectId
- `createEndpoint(page, projectId, config)` → endpointId
- `invokeEndpoint(page, endpointId)` → paymentId
- `generateTestEmail(prefix)` → unique email

## Debugging

### Failed Tests

When a test fails:
1. Check screenshot: `test-results/*/test-failed-1.png`
2. Watch video: `test-results/*/video.webm`
3. Open trace: `npx playwright show-trace test-results/*/trace.zip`

### Debug Mode

```bash
# Run with debugger
npx playwright test --debug

# Run specific test
npx playwright test payment-flow

# Run in headed mode with slow-mo
npx playwright test --headed --slow-mo=500
```

### Console Logs

Playwright captures browser console:

```typescript
page.on('console', msg => console.log('Browser:', msg.text()));
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Install Playwright
  run: pnpm exec playwright install --with-deps chromium

- name: Run E2E tests
  run: pnpm test:e2e

- name: Upload videos
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-videos
    path: test-results/**/video.webm
```

### Environment Variables

```bash
# Set in CI
CI=true                    # Enables retries, disables server reuse
```

## Artifacts

### Retention

```
test-results/       # Gitignored
playwright-report/  # Gitignored
```

Delete artifacts:
```bash
rm -rf test-results playwright-report
```

### Size

Typical artifact sizes:
- Video: 1-5 MB per test
- Trace: 5-20 MB per test
- Screenshot: 50-200 KB

Keep test-results small by running tests locally and cleaning up.

## Troubleshooting

### Servers not starting

```bash
# Check if ports are in use
lsof -i :8787
lsof -i :3000
lsof -i :3001

# Kill processes
kill -9 <PID>
```

### Timeouts

Increase timeout in test:
```typescript
test('slow test', async ({ page }) => {
  test.setTimeout(60000); // 60 seconds
  // ...
});
```

### Database state

Tests create unique merchants, so no cleanup needed between runs.

## Best Practices

1. **Unique emails** - Always use `Date.now()` for test isolation
2. **Wait for navigation** - Use `waitForURL()` after form submits
3. **Explicit waits** - Use `waitForSelector()` for dynamic content
4. **Video naming** - Test names become video filenames
5. **Test isolation** - Don't rely on test execution order

## Related

- [Testing Guide](../../docs/testing/README.md)
- [Mock Provider](../../docs/testing/mock-provider.md)
- [Demo Flow](../../docs/testing/demo-flow.md)
