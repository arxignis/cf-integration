# Test Suite for CF Integration

This directory contains comprehensive Vitest tests for the Cloudflare Workers integration codebase.

## Test Structure

The test suite is organized to mirror the source code structure:

```
src/
├── __tests__/
│   ├── setup.ts                    # Test setup and global mocks
│   ├── index.test.ts              # Main handler tests
│   └── lib/
│       ├── __tests__/
│       │   ├── helper.test.ts     # Helper function tests
│       │   ├── cache.test.ts      # Cache manager tests
│       │   ├── threat.test.ts     # Threat detection tests
│       │   ├── access-rules.test.ts # Access rules tests
│       │   ├── ip-handler.test.ts # IP handling tests
│       │   ├── captcha.test.ts    # Captcha tests
│       │   ├── log.test.ts        # Logging tests
│       │   ├── metrics.test.ts    # Metrics tests
│       │   ├── durable-buffer.test.ts # Durable Object tests
│       │   └── types.test.ts      # Type definition tests
│       └── README.md              # This file
```

## Running Tests

### Run all tests
```bash
npm test
# or
pnpm test
```

### Run tests with coverage
```bash
npm run test:coverage
# or
pnpm test:coverage
```

### Run specific test files
```bash
npm test -- helper.test.ts
# or
pnpm test helper.test.ts
```

### Run tests in watch mode
```bash
npm run test:watch
# or
pnpm test:watch
```

## Test Coverage

The test suite provides comprehensive coverage for:

- **Helper Functions** (`helper.test.ts`): IP validation, API requests, IP type detection
- **Cache Management** (`cache.test.ts`): KV storage operations, cache hits/misses
- **Threat Detection** (`threat.test.ts`): API integration, caching, error handling
- **Access Rules** (`access-rules.test.ts`): Rule evaluation, country/ASN/IP matching
- **IP Handling** (`ip-handler.test.ts`): IP list management, CIDR ranges, performance
- **Captcha** (`captcha.test.ts`): JWT verification, Turnstile integration
- **Logging** (`log.test.ts`): Request logging, body parsing, TLS information
- **Metrics** (`metrics.test.ts`): Metrics collection, hostname extraction
- **Durable Objects** (`durable-buffer.test.ts`): Buffer management, batch processing
- **Main Handler** (`index.test.ts`): Request flow, decision logic, error handling
- **Type Definitions** (`types.test.ts`): Interface validation, type compatibility

## Test Features

### Mocking Strategy
- **External APIs**: All external API calls are mocked using Vitest's `vi.mock()`
- **Cloudflare APIs**: KV storage, Durable Objects, and other CF APIs are mocked
- **OpenTelemetry**: Tracing and metrics collection are mocked
- **JWT**: Token verification and signing are mocked

### Error Testing
- Network failures and timeouts
- Invalid input data
- API errors and malformed responses
- Missing environment variables
- Resource unavailability

### Edge Cases
- Empty and null values
- Invalid IP addresses and CIDR ranges
- Malformed JSON responses
- Missing headers and cookies
- Large request bodies

### Performance Testing
- IP lookup performance benchmarks
- Cache hit/miss scenarios
- Buffer size limits and overflow handling

## Test Data

Tests use realistic test data including:
- Valid and invalid IP addresses (IPv4 and IPv6)
- CIDR ranges for network testing
- Sample threat intelligence data
- Mock access rules and policies
- Realistic request headers and bodies

## Environment Setup

The test setup (`setup.ts`) provides:
- Global mocks for browser/Node.js APIs
- Console output suppression for cleaner test runs
- Performance API mocking
- Math.random mocking for predictable tests

## Writing New Tests

When adding new functionality:

1. Create test files following the naming convention: `*.test.ts`
2. Place tests in the appropriate directory structure
3. Mock external dependencies using `vi.mock()`
4. Test both success and error scenarios
5. Include edge cases and boundary conditions
6. Update this README if adding new test categories

## Test Best Practices

- Use descriptive test names that explain the scenario
- Group related tests using `describe` blocks
- Use `beforeEach` and `afterEach` for setup/cleanup
- Mock external dependencies to ensure test isolation
- Test both happy path and error conditions
- Verify side effects and state changes
- Use realistic test data that matches production scenarios

## Debugging Tests

To debug failing tests:

1. Run tests with verbose output: `npm test -- --reporter=verbose`
2. Use `console.log` statements (they're mocked in tests)
3. Check test coverage to identify untested code paths
4. Use `vi.debug()` to inspect mock calls
5. Run individual test files to isolate issues

## Continuous Integration

The test suite is designed to run in CI environments:
- No external dependencies or network calls
- Deterministic test results
- Comprehensive error handling
- Fast execution times
- Clear failure reporting
