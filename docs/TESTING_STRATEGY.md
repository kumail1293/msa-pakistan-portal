# Testing Strategy

## Overview

- **Framework**: Vitest
- **Approach**: Test-driven where practical
- **Coverage**: Focus on business logic and critical paths

---

## Test Types

### Unit Tests
- Pure functions
- Business logic
- Data transformations
- Validation rules

### Integration Tests
- Database operations (with test DB)
- API endpoints (with test server)
- Workflow transitions
- Form submissions

### E2E Tests (Future)
- Critical user journeys
- Cross-module flows

---

## Test Conventions

### File Naming
- `*.test.ts` co-located with source files
- Example: `workflowEngine.ts` → `workflowEngine.test.ts`

### Test Structure
```typescript
describe("WorkflowEngine", () => {
  describe("createWorkflow", () => {
    it("should create a workflow with stages", async () => {
      // Arrange
      const input = { name: "Test", stages: [...] };
      
      // Act
      const result = await createWorkflow(input);
      
      // Assert
      expect(result).not.toBeNull();
      expect(result!.id).toBeGreaterThan(0);
    });
    
    it("should return null if database is unavailable", async () => {
      // Test error handling
    });
  });
});
```

### Mocking
- Mock database calls for unit tests
- Use test database for integration tests
- Mock external services (email, storage)

---

## Test Categories

### Critical (Must Pass)
- Authentication flows
- Permission checks
- Workflow transitions
- Form submissions
- Audit logging

### Important (Should Pass)
- CRUD operations
- Configuration management
- Notification sending
- Document generation

### Nice to Have
- UI component tests
- Edge cases
- Performance tests

---

## Running Tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test workflowEngine.test.ts

# Run with coverage
pnpm test:coverage

# Run in watch mode
pnpm test:watch
```

---

## Test Database

### Setup
- Separate test database
- Reset between test runs
- Seed with test data

### Cleanup
- Each test cleans up after itself
- Transaction rollback where possible
- Truncate tables between test suites

---

## Mocking Strategy

### Database
```typescript
// Mock getDb for unit tests
vi.mock("../db", () => ({
  getDb: () => mockDb,
}));
```

### External Services
```typescript
// Mock email service
vi.mock("../services/emailService", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));
```

### Time
```typescript
// Mock date for SLA tests
vi.setSystemTime(new Date("2025-01-15T10:00:00Z"));
```

---

## Coverage Goals

- **Statements**: 80%
- **Branches**: 70%
- **Functions**: 80%
- **Lines**: 80%

Focus on critical paths, not 100% coverage everywhere.
