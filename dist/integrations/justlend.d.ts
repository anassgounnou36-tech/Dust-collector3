import type { Integration, PendingReward } from '../types/common.js';
export declare const justlendIntegration: Integration;
export declare const JUSTLEND_CONTRACTS: {
    readonly USDT_JTOKEN: "TXJgMdjVX5dKiGhQzd8kEgpekeLhDuYf5W";
    readonly TRX_JTOKEN: "TL1LjJXMAkKspAWUJp5LwGi96qKwJEVhKA";
    readonly JST_TOKEN: "TCFLL5dx5ZJdKnWuesXxi1VPwjLVmWZZy9";
    readonly COMPTROLLER: "TL3hKa7jqaB1j7xXhkrYJ9K8wZ2fGQwLhM";
    readonly TOKENS: {
        readonly USDT: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
        readonly JST: "TCFLL5dx5ZJdKnWuesXxi1VPwjLVmWZZy9";
        readonly TRX: "TRX";
    };
};
export declare function getJTokenBalance(_walletAddress: string, _jTokenAddress: string): Promise<string>;
export declare function getAccruedInterest(_walletAddress: string, _jTokenAddress: string): Promise<string>;
export declare function getPendingJstRewards(_walletAddress: string): Promise<string>;
export declare function buildJustLendClaimTx(_rewards: PendingReward[]): Promise<any>;
//# sourceMappingURL=justlend.d.ts.map