/* Flexible validator accommodating multiple call signatures used in traderJoeEvaluator.ts */

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

/*
  We allow calls like:
  validateEvaluation(oneObject)
  validateEvaluation(router, factory, sessionId)
  validateEvaluation(router, factory, sessionId, extraObject)
*/
class TraderJoeValidator {
  async validateEvaluation(...args: any[]): Promise<EvaluationValidationResult> {
    let input: RawEvaluationArgs = {};

    if (args.length === 1 && typeof args[0] === 'object') {
      // This is a RouterEvaluation object
      const evaluation = args[0];
      input = { 
        ...evaluation,
        // Assume good defaults for v2.1 router when validating a RouterEvaluation
        router: '0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30', // v2.1 router
        factory: '0x8e42f2F4101563bF679975178e880FD87d3eFd4e', // v2.1 factory
        quote: evaluation.quote,
        profitUsd: evaluation.profitUsd,
        gasUsd: evaluation.gasUsd,
        tokenIn: evaluation.quote?.route?.input,
        tokenOut: evaluation.quote?.route?.output
      };
    } else if (args.length === 2 && typeof args[0] === 'object') {
      // RouterEvaluation + router address
      const [evaluation, router] = args;
      input = {
        ...evaluation,
        router,
        factory: '0x8e42f2F4101563bF679975178e880FD87d3eFd4e', // default factory
        quote: evaluation.quote,
        profitUsd: evaluation.profitUsd,
        gasUsd: evaluation.gasUsd,
        tokenIn: evaluation.quote?.route?.input,
        tokenOut: evaluation.quote?.route?.output
      };
    } else if (args.length >= 3 && typeof args[0] === 'object') {
      // RouterEvaluation + router + factory
      const [evaluation, router, factory, maybeExtra] = args;
      input = {
        ...evaluation,
        router,
        factory,
        quote: evaluation.quote,
        profitUsd: evaluation.profitUsd,
        gasUsd: evaluation.gasUsd,
        tokenIn: evaluation.quote?.route?.input,
        tokenOut: evaluation.quote?.route?.output
      };
      if (maybeExtra && typeof maybeExtra === 'object') {
        Object.assign(input, maybeExtra);
      }
    } else if (args.length >= 3 && typeof args[0] === 'string') {
      const [router, factory, sessionId, maybeExtra] = args;
      input.router = router;
      input.factory = factory;
      input.sessionId = sessionId;
      if (maybeExtra && typeof maybeExtra === 'object') {
        Object.assign(input, maybeExtra);
      }
    } else {
      input.rawArgs = args;
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Contract validation
    const routerValid = !!input.router && input.router.startsWith('0x') && input.router.length === 42 && input.router !== '0xunknown';
    const factoryValid = !!input.factory && input.factory.startsWith('0x') && input.factory.length === 42 && input.factory !== '0xunknown';
    
    if (!routerValid) warnings.push('Router address not supplied or invalid');
    if (!factoryValid) warnings.push('Factory address not supplied or invalid');

    // Version detection based on router address
    let version = 'unknown';
    if (input.router === '0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30') {
      version = 'v2.1';
    } else if (input.router === '0x60aE616a2155Ee3d9A68541Ba4544862310933d4') {
      version = 'v2-legacy';
    }

    // Token validation
    const inputValid = !!input.tokenIn || !!input.quote?.route?.input;
    const outputValid = !!input.tokenOut || !!input.quote?.route?.output;

    // Economic validation
    let profitabilityValid = true;
    
    if (input.quote && input.quote.priceImpact != null) {
      const maxImpact = 0.05; // 5%
      if (input.quote.priceImpact > maxImpact) {
        warnings.push(`Excessive price impact ${(input.quote.priceImpact * 100).toFixed(1)}% exceeds limit ${(maxImpact * 100).toFixed(1)}%`);
        recommendations.push('Consider reducing trade size or skipping');
        profitabilityValid = false;
      }
    }

    if (input.gasUsd != null && input.gasUsd > 10) {
      warnings.push(`High gas cost $${input.gasUsd}`);
      recommendations.push('Wait for lower gas prices');
      profitabilityValid = false;
    }

    if (input.profitUsd != null && input.profitUsd < 1.0) {
      warnings.push(`Profit below minimum: $${input.profitUsd} < $1.0`);
      recommendations.push('Aggregate or wait for higher rewards');
      profitabilityValid = false;
    }

    const isValid = errors.length === 0 && warnings.length === 0;

    return {
      ok: errors.length === 0,
      isValid,
      version,
      errors,
      warnings,
      recommendations,
      contractValidation: {
        routerValid,
        factoryValid
      },
      tokenValidation: {
        inputValid,
        outputValid
      },
      economicValidation: {
        profitabilityValid
      },
      meta: {
        evaluatedAt: Date.now(),
        sessionId: input.sessionId
      }
    };
  }

  getValidationRecommendations(validation: EvaluationValidationResult): string[] {
    const recommendations: string[] = [];
    
    if (!validation.contractValidation?.routerValid) {
      recommendations.push('Check router contract address for correct Trader Joe deployment');
    }
    if (!validation.contractValidation?.factoryValid) {
      recommendations.push('Check factory contract address for correct Trader Joe deployment');
    }
    if (!validation.tokenValidation?.inputValid) {
      recommendations.push('Verify input token configuration');
    }
    if (!validation.tokenValidation?.outputValid) {
      recommendations.push('Verify output token configuration');
    }
    if (!validation.economicValidation?.profitabilityValid) {
      recommendations.push('Consider waiting for better market conditions or higher rewards');
    }
    
    return recommendations.concat(validation.recommendations);
  }
}

export const traderJoeValidator = new TraderJoeValidator();

// Export the validation function expected by tests
export function validateTraderJoeEvaluation(...args: any[]): Promise<EvaluationValidationResult> {
  return traderJoeValidator.validateEvaluation(...args);
}