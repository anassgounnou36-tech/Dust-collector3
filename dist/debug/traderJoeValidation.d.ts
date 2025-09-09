export interface RawEvaluationArgs {
    router?: string;
    factory?: string;
    sessionId?: string;
    [k: string]: any;
}
export interface EvaluationValidationResult {
    ok: boolean;
    isValid: boolean;
    version?: string;
    errors: string[];
    warnings: string[];
    recommendations: string[];
    contractValidation?: {
        routerValid: boolean;
        factoryValid: boolean;
    };
    tokenValidation?: {
        inputValid: boolean;
        outputValid: boolean;
    };
    economicValidation?: {
        profitabilityValid: boolean;
    };
    meta?: Record<string, any>;
}
declare class TraderJoeValidator {
    validateEvaluation(...args: any[]): Promise<EvaluationValidationResult>;
    getValidationRecommendations(validation: EvaluationValidationResult): string[];
}
export declare const traderJoeValidator: TraderJoeValidator;
export declare function validateTraderJoeEvaluation(...args: any[]): Promise<EvaluationValidationResult>;
export {};
//# sourceMappingURL=traderJoeValidation.d.ts.map