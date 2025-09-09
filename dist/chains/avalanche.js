"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AvalancheClient = void 0;
exports.gasPrice = gasPrice;
exports.simulate = simulate;
exports.sendRaw = sendRaw;
exports.nativeUsd = nativeUsd;
const ethers_1 = require("ethers");
// Chainlink AVAX/USD feed address on Avalanche C-Chain
const CHAINLINK_AVAX_USD_FEED = '0x0A77230d17318075983913bC2145DB16C7366156';
const DEFAULT_AVAX_CLAIM_GAS = 120000;
// Minimal ABI for Chainlink price feed
const CHAINLINK_ABI = [
    'function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)'
];
// Default provider instance for exported functions
let defaultProvider;
let defaultWallet;
function getDefaultProvider() {
    if (!defaultProvider) {
        const rpcUrl = process.env.AVALANCHE_RPC_URL || process.env.PRICER_RPC_AVAX || 'https://api.avax.network/ext/bc/C/rpc';
        defaultProvider = new ethers_1.ethers.JsonRpcProvider(rpcUrl);
    }
    return defaultProvider;
}
function getDefaultWallet() {
    if (!defaultWallet && process.env.PRIVATE_KEY) {
        defaultWallet = new ethers_1.ethers.Wallet(process.env.PRIVATE_KEY, getDefaultProvider());
    }
    return defaultWallet;
}
class AvalancheClient {
    chain = 'avalanche';
    provider;
    wallet;
    constructor(rpcUrl, privateKey) {
        this.provider = new ethers_1.ethers.JsonRpcProvider(rpcUrl);
        if (privateKey) {
            this.wallet = new ethers_1.ethers.Wallet(privateKey, this.provider);
        }
    }
    async gasPrice() {
        const feeData = await this.provider.getFeeData();
        // Use maxFeePerGas with fallback to gasPrice as specified
        return feeData.maxFeePerGas || feeData.gasPrice || 25000000000n; // 25 gwei default
    }
    async nativeUsd() {
        try {
            // Try Chainlink feed first
            const feedAddress = process.env.CHAINLINK_AVAX_USD_FEED || CHAINLINK_AVAX_USD_FEED;
            const contract = new ethers_1.ethers.Contract(feedAddress, CHAINLINK_ABI, this.provider);
            const [, answer] = await contract.latestRoundData();
            // Chainlink AVAX/USD feed returns price with 8 decimals
            const price = Number(answer) / 1e8;
            if (price > 0) {
                return price;
            }
        }
        catch (error) {
            console.warn('Failed to fetch AVAX price from Chainlink, using fallback:', error);
            // TODO: Implement additional price sources (CoinGecko, DEX routers)
        }
        // Fallback static price
        return 35.0;
    }
    async simulate(bundle) {
        try {
            // Use bundle data if available, otherwise fall back to placeholder
            const to = bundle.contractAddress || bundle.claimTo.value;
            const data = bundle.callData || '0x';
            const value = bundle.value || 0;
            try {
                const result = await this.provider.call({ to, data, value });
                // Log simulation success for sJOE protocol
                if (bundle.protocol === 'traderjoe' && bundle.callData) {
                    console.log(`TraderJoe sJOE: Simulation successful for ${data.slice(0, 10)}... -> ${result}`);
                }
                return { ok: true, reason: `Simulation successful: ${result}` };
            }
            catch (error) {
                // Try to extract revert reason from error
                let reason = 'Unknown revert reason';
                try {
                    if (error.data) {
                        // Try to decode revert reason from error.data
                        const errorData = error.data;
                        if (typeof errorData === 'string' && errorData.length > 10) {
                            // Simple revert reason extraction - would need more sophisticated parsing for real use
                            reason = `Revert: ${errorData}`;
                        }
                    }
                    else if (error.error?.data) {
                        reason = `Revert: ${error.error.data}`;
                    }
                    else if (error.reason) {
                        reason = error.reason;
                    }
                    else if (error.message) {
                        reason = error.message;
                    }
                    // TODO: Implement proper revert reason extraction for various error formats
                }
                catch (parseError) {
                    console.warn('Failed to extract revert reason:', parseError);
                }
                return { ok: false, reason };
            }
        }
        catch (error) {
            return {
                ok: false,
                reason: `Simulation setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    async sendRaw(bundle) {
        try {
            // In MOCK_MODE, return mocked result
            if (process.env.MOCK_MODE === 'true') {
                const gasUsed = BigInt(DEFAULT_AVAX_CLAIM_GAS * bundle.items.length);
                const gasPrice = await this.gasPrice();
                const gasNative = Number(gasUsed * gasPrice) / 1e18;
                const gasUsd = gasNative * await this.nativeUsd();
                return {
                    success: true,
                    txHash: `0x${Math.random().toString(16).substr(2, 64)}`,
                    gasUsed: gasUsed.toString(),
                    gasUsd,
                    claimedUsd: bundle.totalUsd,
                    chain: 'avalanche',
                    status: 'mock'
                };
            }
            if (!this.wallet) {
                throw new Error('No wallet configured for execution');
            }
            // Build transaction
            const maxFeePerGas = await this.gasPrice();
            const feeData = await this.provider.getFeeData();
            const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || maxFeePerGas / 10n;
            // Estimate gas if not provided
            let gasLimit = BigInt(DEFAULT_AVAX_CLAIM_GAS);
            const totalEstGas = bundle.items.reduce((sum, item) => sum + (item.estGasLimit || DEFAULT_AVAX_CLAIM_GAS), 0);
            if (totalEstGas > 0) {
                gasLimit = BigInt(totalEstGas);
            }
            // Build transaction using bundle data if available
            const tx = {
                to: bundle.contractAddress || bundle.claimTo.value,
                data: bundle.callData || '0x',
                value: bundle.value || 0,
                gasLimit,
                maxFeePerGas,
                maxPriorityFeePerGas
            };
            // Log transaction details for sJOE protocol
            if (bundle.protocol === 'traderjoe' && bundle.callData) {
                console.log(`TraderJoe sJOE: Executing transaction to ${tx.to} with data ${tx.data.slice(0, 10)}...`);
            }
            const response = await this.wallet.sendTransaction(tx);
            const receipt = await response.wait();
            if (!receipt) {
                throw new Error('Transaction receipt not available');
            }
            // Compute gas cost in USD
            const gasUsed = receipt.gasUsed;
            const effectiveGasPrice = receipt.gasPrice || maxFeePerGas;
            const gasNative = Number(gasUsed * effectiveGasPrice) / 1e18;
            const gasUsd = gasNative * await this.nativeUsd();
            return {
                success: receipt.status === 1,
                txHash: receipt.hash,
                gasUsed: gasUsed.toString(),
                gasUsd,
                claimedUsd: receipt.status === 1 ? bundle.totalUsd : 0,
                chain: 'avalanche'
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                claimedUsd: 0,
                chain: 'avalanche'
            };
        }
    }
    async getBalance(address) {
        return this.provider.getBalance(address);
    }
    async getBlockNumber() {
        return this.provider.getBlockNumber();
    }
    async getCode(address) {
        return this.provider.getCode(address);
    }
}
exports.AvalancheClient = AvalancheClient;
// Exported functions as specified in requirements
async function gasPrice() {
    const provider = getDefaultProvider();
    const feeData = await provider.getFeeData();
    return feeData.maxFeePerGas || feeData.gasPrice || 25000000000n;
}
async function simulate(to, data, value = 0) {
    const provider = getDefaultProvider();
    try {
        const result = await provider.call({ to, data, value });
        return result;
    }
    catch (error) {
        // Extract revert reason as specified
        let reason = 'Unknown revert reason';
        try {
            if (error.data) {
                reason = `Revert: ${error.data}`;
            }
            else if (error.error?.data) {
                reason = `Revert: ${error.error.data}`;
            }
            else if (error.reason) {
                reason = error.reason;
            }
            // TODO: Implement more sophisticated revert reason extraction
        }
        catch (parseError) {
            // Extraction failed, keep generic reason
        }
        throw new Error(reason);
    }
}
async function sendRaw(to, data, value = 0, gasLimit) {
    const wallet = getDefaultWallet();
    if (process.env.MOCK_MODE === 'true') {
        const gasUsed = BigInt(gasLimit || DEFAULT_AVAX_CLAIM_GAS);
        const gasPriceBig = await gasPrice();
        const gasNative = Number(gasUsed * gasPriceBig) / 1e18;
        const gasUsd = gasNative * await nativeUsd();
        return {
            success: true,
            txHash: `0x${Math.random().toString(16).substr(2, 64)}`,
            gasUsed: gasUsed.toString(),
            gasUsd,
            claimedUsd: 0, // Unknown without bundle context
            chain: 'avalanche',
            status: 'mock'
        };
    }
    if (!wallet) {
        throw new Error('No wallet configured for execution');
    }
    const provider = getDefaultProvider();
    const maxFeePerGas = await gasPrice();
    const feeData = await provider.getFeeData();
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || maxFeePerGas / 10n;
    // Estimate gas if not provided
    let estimatedGasLimit = BigInt(gasLimit || DEFAULT_AVAX_CLAIM_GAS);
    if (!gasLimit) {
        try {
            const estimate = await provider.estimateGas({ to, data, value });
            estimatedGasLimit = estimate;
        }
        catch (error) {
            // Use default if estimation fails
        }
    }
    const tx = {
        to,
        data,
        value,
        gasLimit: estimatedGasLimit,
        maxFeePerGas,
        maxPriorityFeePerGas
    };
    try {
        const response = await wallet.sendTransaction(tx);
        const receipt = await response.wait();
        if (!receipt) {
            throw new Error('Transaction receipt not available');
        }
        const gasUsed = receipt.gasUsed;
        const effectiveGasPrice = receipt.gasPrice || maxFeePerGas;
        const gasNative = Number(gasUsed * effectiveGasPrice) / 1e18;
        const gasUsd = gasNative * await nativeUsd();
        return {
            success: receipt.status === 1,
            txHash: receipt.hash,
            gasUsed: gasUsed.toString(),
            gasUsd,
            claimedUsd: 0, // Unknown without bundle context
            chain: 'avalanche'
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            claimedUsd: 0,
            chain: 'avalanche'
        };
    }
}
async function nativeUsd() {
    try {
        const provider = getDefaultProvider();
        const feedAddress = process.env.CHAINLINK_AVAX_USD_FEED || CHAINLINK_AVAX_USD_FEED;
        const contract = new ethers_1.ethers.Contract(feedAddress, CHAINLINK_ABI, provider);
        const [, answer] = await contract.latestRoundData();
        const price = Number(answer) / 1e8;
        if (price > 0) {
            return price;
        }
    }
    catch (error) {
        console.warn('Failed to fetch AVAX price from Chainlink, using fallback:', error);
        // TODO: Implement additional price sources
    }
    return 35.0;
}
//# sourceMappingURL=avalanche.js.map