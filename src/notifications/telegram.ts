/**
 * Telegram Bot API notification system for Phase 4
 * 
 * Sends structured alerts about profitable trading opportunities,
 * execution errors, and system status updates using MarkdownV2 formatting.
 */

import { logger } from '../engine/logger.js';

/**
 * Configuration for Telegram notifications
 */
interface TelegramConfig {
  enabled: boolean;
  botToken?: string;
  chatId?: string;
}

/**
 * Alert types for different notification scenarios
 */
export type AlertType = 'profitable_opportunity' | 'execution_error' | 'system_status' | 'evaluation_summary';

/**
 * Alert data structure
 */
export interface AlertData {
  type: AlertType;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
}

/**
 * Get Telegram configuration from environment variables
 */
function getTelegramConfig(): TelegramConfig {
  return {
    enabled: process.env.TELEGRAM_ENABLED === 'true',
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID
  };
}

/**
 * Escape text for Telegram MarkdownV2 format
 * 
 * MarkdownV2 requires escaping these characters: _ * [ ] ( ) ~ ` > # + - = | { } . !
 */
function escapeMarkdownV2(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

/**
 * Format alert data as MarkdownV2 message
 */
function formatAlert(alert: AlertData): string {
  const timestamp = alert.timestamp || new Date();
  const formattedTime = escapeMarkdownV2(timestamp.toISOString());
  const title = escapeMarkdownV2(alert.title);
  const message = escapeMarkdownV2(alert.message);
  
  let formatted = `*🤖 Cross\\-Protocol Dust Collector Bot*\n\n`;
  formatted += `*${title}*\n\n`;
  formatted += `${message}\n\n`;
  formatted += `⏰ _${formattedTime}_`;
  
  // Add metadata if present
  if (alert.metadata && Object.keys(alert.metadata).length > 0) {
    formatted += '\n\n*Details:*\n';
    
    for (const [key, value] of Object.entries(alert.metadata)) {
      const escapedKey = escapeMarkdownV2(String(key));
      const escapedValue = escapeMarkdownV2(String(value));
      formatted += `• ${escapedKey}: \`${escapedValue}\`\n`;
    }
  }
  
  return formatted;
}

/**
 * Send Telegram alert using Bot API
 * 
 * @param alert - Alert data to send
 * @returns Promise that resolves to true if sent successfully, false otherwise
 */
export async function sendTelegramAlert(alert: AlertData): Promise<boolean> {
  const config = getTelegramConfig();
  
  // Check if Telegram is enabled
  if (!config.enabled) {
    logger.debug('Telegram notifications disabled, skipping alert');
    return false;
  }
  
  // Validate configuration
  if (!config.botToken || !config.chatId) {
    logger.warn('Telegram configuration incomplete - missing bot token or chat ID');
    return false;
  }
  
  try {
    const formattedMessage = formatAlert(alert);
    const telegramApiUrl = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
    
    const payload = {
      chat_id: config.chatId,
      text: formattedMessage,
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true,
      disable_notification: alert.type === 'system_status' // Don't notify for status updates
    };
    
    logger.debug(`Sending Telegram alert: ${alert.type}`, { 
      title: alert.title,
      messageLength: formattedMessage.length 
    });
    
    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Telegram API error: ${response.status} ${response.statusText}`, {
        error: errorText,
        alertType: alert.type
      });
      return false;
    }
    
    const result = await response.json() as {
      ok: boolean;
      description?: string;
      error_code?: number;
      result?: {
        message_id: number;
      };
    };
    
    if (!result.ok) {
      logger.error('Telegram API returned error response', {
        error: result.description,
        errorCode: result.error_code,
        alertType: alert.type
      });
      return false;
    }
    
    logger.info(`Telegram alert sent successfully: ${alert.type}`, {
      messageId: result.result?.message_id,
      title: alert.title
    });
    
    return true;
    
  } catch (error) {
    logger.error('Failed to send Telegram alert', {
      error: error instanceof Error ? error.message : 'Unknown error',
      alertType: alert.type,
      alertTitle: alert.title
    });
    return false;
  }
}

/**
 * Create a profitable opportunity alert
 */
export function createProfitableOpportunityAlert(
  pair: string,
  amountUsd: number,
  profitUsd: number,
  netUsd: number,
  executionScore: number
): AlertData {
  return {
    type: 'profitable_opportunity',
    title: '💰 Profitable Opportunity Detected',
    message: `Found profitable trading opportunity for ${pair} with $${amountUsd} input amount.`,
    metadata: {
      'Trading Pair': pair,
      'Input Amount': `$${amountUsd.toFixed(2)}`,
      'Expected Profit': `$${profitUsd.toFixed(2)}`,
      'Net Profit': `$${netUsd.toFixed(2)}`,
      'Execution Score': `${executionScore.toFixed(1)}/100`
    },
    timestamp: new Date()
  };
}

/**
 * Create an execution error alert
 */
export function createExecutionErrorAlert(
  error: string,
  context?: Record<string, any>
): AlertData {
  return {
    type: 'execution_error',
    title: '⚠️ Execution Error',
    message: `An error occurred during Phase 4 evaluation: ${error}`,
    metadata: context,
    timestamp: new Date()
  };
}

/**
 * Create a system status alert
 */
export function createSystemStatusAlert(
  status: string,
  details?: Record<string, any>
): AlertData {
  return {
    type: 'system_status',
    title: '📊 System Status Update',
    message: status,
    metadata: details,
    timestamp: new Date()
  };
}

/**
 * Create an enhanced cycle summary alert
 */
export function createCycleSummaryAlert(
  cycleNumber: number,
  walletsDiscovered: number,
  rewardsFound: number,
  bundlesCreated: number,
  netProfitUsd: number,
  duration: number,
  successRate: number,
  recommendations: string[]
): AlertData {
  const emoji = netProfitUsd > 0 ? '📈' : netProfitUsd < 0 ? '📉' : '📊';
  const profitText = netProfitUsd > 0 ? 'Profitable' : netProfitUsd < 0 ? 'Loss' : 'Break-even';
  
  return {
    type: 'evaluation_summary',
    title: `${emoji} Cycle ${cycleNumber} Complete`,
    message: `${profitText} cycle completed in ${(duration / 1000).toFixed(1)} seconds`,
    metadata: {
      'Cycle Number': cycleNumber,
      'Wallets Discovered': walletsDiscovered,
      'Rewards Found': rewardsFound,
      'Bundles Created': bundlesCreated,
      'Net Profit': `$${netProfitUsd.toFixed(2)}`,
      'Duration': `${(duration / 1000).toFixed(1)}s`,
      'Success Rate': `${(successRate * 100).toFixed(1)}%`,
      'Recommendations': recommendations.length > 0 ? recommendations.slice(0, 3).join('; ') : 'None'
    },
    timestamp: new Date()
  };
}

/**
 * Create a discovery progress alert
 */
export function createDiscoveryProgressAlert(
  protocol: string,
  walletsFound: number,
  rewardsFound: number,
  totalRewardsUsd: number
): AlertData {
  return {
    type: 'system_status',
    title: '🔍 Discovery Progress',
    message: `${protocol} discovery completed with promising results`,
    metadata: {
      'Protocol': protocol,
      'Wallets Found': walletsFound,
      'Rewards Found': rewardsFound,
      'Total Rewards Value': `$${totalRewardsUsd.toFixed(2)}`
    },
    timestamp: new Date()
  };
}

/**
 * Create a performance warning alert
 */
export function createPerformanceWarningAlert(
  warnings: string[],
  successRate: number,
  recentErrors: number
): AlertData {
  return {
    type: 'execution_error',
    title: '⚠️ Performance Warning',
    message: `System performance degradation detected - requires attention`,
    metadata: {
      'Success Rate': `${(successRate * 100).toFixed(1)}%`,
      'Recent Errors': recentErrors,
      'Primary Warnings': warnings.slice(0, 3).join('; '),
      'Total Warnings': warnings.length
    },
    timestamp: new Date()
  };
}

/**
 * Create a high-value opportunity alert
 */
export function createHighValueOpportunityAlert(
  protocol: string,
  pair: string,
  amountUsd: number,
  profitUsd: number,
  executionScore: number,
  specialNotes?: string
): AlertData {
  return {
    type: 'profitable_opportunity',
    title: '💎 High-Value Opportunity',
    message: `Exceptional ${protocol} opportunity detected for ${pair}`,
    metadata: {
      'Protocol': protocol,
      'Trading Pair': pair,
      'Input Amount': `$${amountUsd.toFixed(2)}`,
      'Expected Profit': `$${profitUsd.toFixed(2)}`,
      'Profit Margin': `${((profitUsd / amountUsd) * 100).toFixed(1)}%`,
      'Execution Score': `${executionScore.toFixed(1)}/100`,
      'Special Notes': specialNotes || 'High confidence opportunity'
    },
    timestamp: new Date()
  };
}

/**
 * Create a system startup alert
 */
export function createSystemStartupAlert(
  version: string,
  features: string[],
  configuration: Record<string, any>
): AlertData {
  return {
    type: 'system_status',
    title: '🚀 Phase 4 System Started',
    message: `Cross-Protocol Dust Collector Bot Phase 4 initialized successfully`,
    metadata: {
      'Version': version,
      'Active Features': features.join(', '),
      'Mock Mode': configuration.mockMode ? 'Enabled' : 'Disabled',
      'Protocols': configuration.protocols || 'All enabled',
      'Telegram Alerts': 'Active'
    },
    timestamp: new Date()
  };
}

/**
 * Create enhanced evaluation summary alert
 */
export function createEvaluationSummaryAlert(
  totalEvaluations: number,
  profitableCount: number,
  averageProfit: number,
  timespan: string
): AlertData {
  const profitabilityRate = totalEvaluations > 0 ? (profitableCount / totalEvaluations * 100) : 0;
  
  // Add performance indicators
  let performanceEmoji = '📊';
  if (profitabilityRate > 20) performanceEmoji = '🚀';
  else if (profitabilityRate > 10) performanceEmoji = '📈';
  else if (profitabilityRate < 2) performanceEmoji = '📉';
  
  return {
    type: 'evaluation_summary',
    title: `${performanceEmoji} Evaluation Summary`,
    message: `Phase 4 evaluation summary for ${timespan}`,
    metadata: {
      'Total Evaluations': totalEvaluations,
      'Profitable Opportunities': profitableCount,
      'Profitability Rate': `${profitabilityRate.toFixed(1)}%`,
      'Average Profit': `$${averageProfit.toFixed(2)}`,
      'Time Period': timespan,
      'Performance': profitabilityRate > 10 ? 'Excellent' : profitabilityRate > 5 ? 'Good' : 'Poor'
    },
    timestamp: new Date()
  };
}