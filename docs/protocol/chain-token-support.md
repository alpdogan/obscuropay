# Chain and Token Support

## Current Support (MVP)

ObscurusPay v1 currently supports:

### Chains
- **Base Sepolia** (Chain ID: 84532) - Testnet only
- **Anvil** (Chain ID: 31337) - Local development

### Token
- **USDC** (ERC-20) only
  - Base Sepolia USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
  - Token address is **immutable** (set at deployment)

## Design Rationale

### Why Base Sepolia?
- Low transaction costs
- Fast block times (~2 seconds)
- Reliable testnet infrastructure
- Official Coinbase support
- USDC native support

### Why USDC Only?
The MVP constrains payment token to USDC because:

1. **Simplicity**: Single token reduces complexity in settlement, accounting, and merchant onboarding
2. **Stability**: USDC is a fiat-backed stablecoin (1 USDC ≈ 1 USD)
3. **Liquidity**: USDC is widely supported and has deep liquidity
4. **Merchant familiarity**: Merchants understand USD pricing
5. **Regulatory clarity**: Fiat-backed stablecoins have clearer regulatory status than crypto assets

### Design Constraints

The contract is **deliberately constrained**:

```solidity
// Token is immutable - cannot be changed after deployment
IERC20 public immutable usdc;

// Chain check enforced in constructor
if (block.chainid != BASE_SEPOLIA_CHAIN_ID && block.chainid != ANVIL_CHAIN_ID) {
    revert WrongChain();
}

// Asset check enforced in pay()
if (asset != address(usdc)) revert InvalidAsset();
```

This means:
- ❌ Cannot add new tokens without deploying a new contract
- ❌ Cannot use on Ethereum mainnet or other chains
- ✅ Prevents accidental mainnet deployment
- ✅ Prevents wrong token payments

## Future Expansion

### Mainnet Deployment (Future)

To deploy to **Base mainnet** (Chain ID: 8453):

1. Update `ObscurusPay.sol` to allow Base mainnet chain ID:
   ```solidity
   uint256 public constant BASE_MAINNET_CHAIN_ID = 8_453;
   ```

2. Use Base mainnet USDC address:
   ```solidity
   address public constant BASE_MAINNET_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
   ```

3. Deploy with appropriate treasury and owner addresses
4. Complete security audit before mainnet deployment

### Multi-Chain Support (Phase N)

To support multiple chains:

**Option A: Deploy per chain**
- Deploy separate `ObscurusPay` instances on each chain
- Merchants configure which chain(s) to accept
- Platform routes payments to appropriate chain
- Pros: Simple, proven pattern
- Cons: Liquidity fragmentation, user confusion

**Option B: Cross-chain aggregator** (Phase 25+)
- Single merchant settlement address
- Platform aggregates payments across chains
- Uses bridges/aggregators for settlement
- Pros: Better UX, unified liquidity
- Cons: Complex, bridge risk, higher costs

### Multi-Token Support (Future)

To support multiple ERC-20 tokens:

**Option A: Deploy per token**
- Deploy separate contract instances for USDC, USDT, DAI, etc.
- Merchants choose accepted tokens
- Pros: Simple, explicit
- Cons: Many contracts, gas overhead

**Option B: Multi-token contract**
- Refactor to accept `address[] supportedTokens`
- Admin function to add/remove tokens
- Merchants specify accepted tokens per endpoint
- Pros: Flexible, single contract
- Cons: More complex, requires governance

**Option C: Any ERC-20** (not recommended)
- Allow `pay(token, amount)` with any ERC-20
- Pros: Maximum flexibility
- Cons: 
  - Merchants receive random tokens
  - Price volatility risk
  - Scam token risk
  - No pricing stability

## Ethereum Mainnet

**Question**: Can we point ObscurusPay at Ethereum mainnet?

**Answer**: 

Currently **NO** - the contract explicitly restricts deployment to Base Sepolia (84532) and Anvil (31337).

For Ethereum mainnet in the future:
- ✅ **Technically possible** - contract could be modified to allow Ethereum chain ID (1)
- ❌ **Economically impractical** - Gas costs on Ethereum L1 are prohibitively expensive for small API payments
- ⚠️ **Not recommended** - Base (L2) provides the same security with 100x lower costs

**Better alternatives to Ethereum L1**:
- **Base mainnet** (recommended) - Official Coinbase L2, low cost
- **Optimism** - Similar L2 with low costs
- **Arbitrum** - Another popular L2
- **Polygon** - Sidechain with very low costs

All would require:
1. Contract modification to allow that chain ID
2. Deployment to that chain with correct USDC address
3. Security audit
4. Testing and verification

## Summary

| Feature | Current Support | Future Expansion |
|---------|----------------|------------------|
| **Chains** | Base Sepolia (testnet), Anvil (local) | Base mainnet → Other L2s → L1 (not recommended) |
| **Tokens** | USDC only (immutable) | Multiple stablecoins → Any ERC-20 (with caution) |
| **Settlement** | Direct on-chain | Cross-chain aggregation (Phase 25+) |

## See Also

- [Contract source](../contracts/src/ObscurusPay.sol)
- [Deployment script](../contracts/script/DeployBaseSepolia.s.sol)
- [Architecture overview](./architecture/overview.md)
- [Security model](./security/security-model.md)
- [Decision log](./architecture/decisions.md)

## Related Issues

- [#2: Deploy ObscurusPay to Base Sepolia](https://github.com/alpdogan/obscuropay/issues/2)
- [#23: Which chain and which token can this contract accept?](https://github.com/alpdogan/obscuropay/issues/23)
