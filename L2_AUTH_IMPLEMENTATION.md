# L2 Authentication Context Implementation

Implementation of issue #355: feat: implement browser authentication

## Overview

This implementation adds browser-bound L2 authentication using an explicit `l2AuthContextId` that ensures trading requests are only valid from the browser where the trading authentication was initially set up.

## Architecture

### Backend Changes

#### Database Schema
- Added `l2_auth_context_id` and `l2_auth_context_expires_at` fields to `users` table
- Migration: `2026_02_16_001_l2_auth_context.sql`

#### Core Libraries
- `src/lib/l2-auth-context.ts` - Core utilities for L2 context generation and validation
- `src/lib/l2-auth-context-client.ts` - Client-side localStorage management
- `src/lib/l2-auth-schema.ts` - Zod schemas for L2 context validation

#### Trading Auth Integration
- Enhanced `src/lib/trading-auth/server.ts` with L2 context validation functions:
  - `generateL2AuthContext()` - Generate new context with expiry
  - `validateL2AuthContext()` - Validate client-provided context
  - `getUserTradingAuthSecretsWithL2Validation()` - Get secrets with L2 validation
  - `clearL2AuthContext()` - Cleanup expired/revoked contexts

#### Action Updates
Updated all trading-related server actions to require L2 auth context:
- `store-order.ts` - Order placement
- `cancel-order.ts` - Order cancellation
- `approve-tokens.ts` - Token approvals
- `pending-deposit.ts` - Deposit processing
- `cancel-all-orders.ts` - Bulk order cancellation
- `proxy-wallet.ts` - Proxy wallet operations

### Frontend Changes

#### Trading Auth Flow
- `TradingOnboardingProvider.tsx` - Store L2 context ID in localStorage after auth
- `generateTradingAuthAction()` - Returns L2 context ID to client

#### Client Utilities
- `src/hooks/use-l2-auth-context.ts` - React hook for L2 context management
- `src/hooks/use-trading-actions.ts` - Action wrappers with automatic context injection

## Security Model

### Context Generation
- Generated when trading auth credentials are created/updated
- 32-character random string with `l2_` prefix
- 7-day expiry (configurable via `L2_AUTH_CONTEXT_EXPIRY_MS`)

### Validation Requirements
On every L2 trading request:
1. Client provides `l2AuthContextId` from localStorage
2. Server validates context exists and matches user's stored context
3. Server checks context hasn't expired
4. If validation fails, request is rejected with `requiresReauth: true`

### Revocation Scenarios
L2 context is invalidated when:
- User generates new trading credentials (new browser/device)
- Context expires (7 days)
- Manual context clearing (logout, security)
- Environment hash mismatch (future enhancement)

## Usage Examples

### Client-Side Action Calls
```typescript
import { useTradingActions } from '@/hooks/use-trading-actions'

function TradingComponent() {
  const { withL2Context, withL2ContextSingle } = useTradingActions()

  async function handlePlaceOrder(orderData) {
    // Automatically includes l2AuthContextId
    const result = await withL2Context(storeOrderAction, orderData)
    return result
  }
  
  async function handleCancelOrder(orderId) {
    // For single-parameter actions
    const result = await withL2ContextSingle(cancelOrderAction, orderId)
    return result
  }
}
```

### Server Action Implementation
```typescript
export async function storeOrderAction(payload: StoreOrderInput) {
  // payload includes l2_auth_context_id from client
  const auth = await getUserTradingAuthSecretsWithL2Validation(
    user.id,
    payload.l2_auth_context_id
  )

  if (!auth?.clob) {
    return { error: TRADING_AUTH_REQUIRED_ERROR }
  }

  // Continue with order processing...
}
```

## Error Handling

### Client-Side
- Missing context ID → Prompt re-authentication
- Invalid context format → Clear localStorage, prompt re-auth

### Server-Side
- Missing/invalid/expired context → Return error with `requiresReauth: true`
- Context mismatch → Security warning logged, request rejected

## Migration Path

1. **Deployment**: New columns added, existing users unaffected
2. **First Trading Action**: Users prompted to re-authenticate (generate L2 context)
3. **Subsequent Requests**: Validated against stored L2 context
4. **Legacy Cleanup**: Old trading flows continue working until re-auth

## Configuration

```typescript
// Context expiry (default: 7 days)
export const L2_AUTH_CONTEXT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000

// localStorage key for client storage
export const L2_AUTH_CONTEXT_STORAGE_KEY = 'kuest_l2_auth_context_id'
```

## Testing

### Manual Test Flow
1. Clear localStorage
2. Generate trading auth credentials
3. Verify L2 context ID stored in localStorage
4. Place an order → Should succeed
5. Clear localStorage
6. Try to place order → Should fail with re-auth required
7. Re-authenticate → Should generate new context and succeed

### Automated Tests
- [ ] L2 context generation and validation
- [ ] Context expiry handling
- [ ] Cross-browser context isolation
- [ ] Error scenarios and re-auth flow
