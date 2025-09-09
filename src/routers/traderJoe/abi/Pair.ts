/**
 * Trader Joe Liquidity Book (V2.1) Pair ABI
 * Contains essential functions for pair interaction and pricing
 */
export const TRADER_JOE_PAIR_ABI = [
  // Basic pair information
  'function getTokenX() external view returns (address)',
  'function getTokenY() external view returns (address)',
  'function getActiveId() external view returns (uint24)',
  'function getBin(uint24 id) external view returns (uint128 reserveX, uint128 reserveY)',
  
  // Price and liquidity functions
  'function getSwapIn(uint128 amountOut, bool swapForY) external view returns (uint128 amountIn, uint128 amountOutLeft, uint128 fee)',
  'function getSwapOut(uint128 amountIn, bool swapForY) external view returns (uint128 amountInLeft, uint128 amountOut, uint128 fee)',
  
  // Reserves and bin information
  'function getReserves() external view returns (uint128 reserveX, uint128 reserveY)',
  'function findFirstNonEmptyBinId(uint24 id, bool swapForY) external view returns (uint24)',
  
  // Fee and parameters
  'function getStaticFeeParameters() external view returns (uint16 baseFactor, uint16 filterPeriod, uint16 decayPeriod, uint16 reductionFactor, uint24 variableFeeControl, uint16 protocolShare, uint24 maxVolatilityAccumulator)',
  'function getVariableFeeParameters() external view returns (uint24 volatilityAccumulator, uint24 volatilityReference, uint24 indexRef, uint40 time)',
  
  // Events for monitoring
  'event Swap(address indexed sender, address indexed to, uint24 id, bytes32 amountsIn, bytes32 amountsOut, uint24 volatilityAccumulator, bytes32 totalFees, bytes32 protocolFees)',
  'event CompositionFees(address indexed sender, address indexed to, uint24 id, bytes32 feesX, bytes32 feesY)',
  
  // Factory and pair creation
  'function factory() external view returns (address)',
  'function feeParameters() external view returns (uint16, uint16, uint16, uint16, uint24, uint16, uint24)'
] as const;

/**
 * Trader Joe Router ABI for swapping
 */
export const TRADER_JOE_ROUTER_ABI = [
  // Swap functions
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, uint256[] memory pairBinSteps, address[] memory tokenPath, address to, uint256 deadline) external returns (uint256 amountOut)',
  'function swapTokensForExactTokens(uint256 amountOut, uint256 amountInMax, uint256[] memory pairBinSteps, address[] memory tokenPath, address to, uint256 deadline) external returns (uint256 amountIn)',
  
  // Quote functions
  'function getSwapIn(address pair, uint128 amountOut, bool swapForY) external view returns (uint128 amountIn, uint128 amountOutLeft, uint128 fee)',
  'function getSwapOut(address pair, uint128 amountIn, bool swapForY) external view returns (uint128 amountInLeft, uint128 amountOut, uint128 fee)',
  
  // Path finding
  'function findBestPathFromAmountIn(address[] memory tokenPath, uint256 amountIn) external view returns (uint256[] memory pairBinSteps, uint256 amountOut)',
  'function findBestPathFromAmountOut(address[] memory tokenPath, uint256 amountOut) external view returns (uint256[] memory pairBinSteps, uint256 amountIn)',
  
  // Factory reference
  'function factory() external view returns (address)',
  'function WAVAX() external view returns (address)'
] as const;

/**
 * Trader Joe Factory ABI for pair discovery
 */
export const TRADER_JOE_FACTORY_ABI = [
  // Pair creation and lookup
  'function getLBPairInformation(address tokenA, address tokenB, uint256 binStep) external view returns (address lbPair, bool created)',
  'function getAvailableLBPairBinSteps(address tokenA, address tokenB) external view returns (uint256[] memory availableBinSteps)',
  
  // All pairs enumeration
  'function getAllLBPairs(address tokenX, address tokenY) external view returns (tuple(uint16 binStep, address lbPair, bool createdByOwner, bool ignoredForRouting)[] memory lbPairsAvailable)',
  'function getNumberOfLBPairs() external view returns (uint256)',
  
  // Fee configuration
  'function getPreset(uint16 binStep) external view returns (uint256 baseFactor, uint256 filterPeriod, uint256 decayPeriod, uint256 reductionFactor, uint256 variableFeeControl, uint256 protocolShare, uint256 maxVolatilityAccumulator, bool isOpen)',
  
  // Events
  'event LBPairCreated(address indexed tokenX, address indexed tokenY, uint256 indexed binStep, address lbPair, uint256 pid)'
] as const;

/**
 * ERC20 ABI subset for token operations
 */
export const ERC20_ABI = [
  'function balanceOf(address owner) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
  'function name() external view returns (string)',
  'function totalSupply() external view returns (uint256)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) external returns (bool)',
  
  // Events
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)'
] as const;

/**
 * Type definitions for contract interfaces
 */
export type TraderJoePairContract = {
  getTokenX(): Promise<string>;
  getTokenY(): Promise<string>;
  getActiveId(): Promise<number>;
  getBin(id: number): Promise<[bigint, bigint]>;
  getSwapOut(amountIn: bigint, swapForY: boolean): Promise<[bigint, bigint, bigint]>;
  getReserves(): Promise<[bigint, bigint]>;
};

export type TraderJoeRouterContract = {
  getSwapOut(pair: string, amountIn: bigint, swapForY: boolean): Promise<[bigint, bigint, bigint]>;
  findBestPathFromAmountIn(tokenPath: string[], amountIn: bigint): Promise<[bigint[], bigint]>;
  factory(): Promise<string>;
  WAVAX(): Promise<string>;
};

export type TraderJoeFactoryContract = {
  getLBPairInformation(tokenA: string, tokenB: string, binStep: number): Promise<[string, boolean]>;
  getAvailableLBPairBinSteps(tokenA: string, tokenB: string): Promise<bigint[]>;
  getAllLBPairs(tokenX: string, tokenY: string): Promise<Array<{
    binStep: number;
    lbPair: string;
    createdByOwner: boolean;
    ignoredForRouting: boolean;
  }>>;
};

export type ERC20Contract = {
  balanceOf(owner: string): Promise<bigint>;
  decimals(): Promise<number>;
  symbol(): Promise<string>;
  name(): Promise<string>;
  allowance(owner: string, spender: string): Promise<bigint>;
};