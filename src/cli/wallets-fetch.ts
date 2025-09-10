#!/usr/bin/env node

import { CovalentCollector, BitqueryCollector, SnowTraceCollector, FileCollector } from '../collectors/index.js';
import { normalizeWallets, deduplicateWallets, filterByMinUsd, computeUsdBalances, formatAsCSV, sortByBalance } from '../collectors/normalize.js';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { env } from '../config/env.js';

/**
 * CLI for fetching wallets from multiple sources
 * Usage: tsx src/cli/wallets-fetch.ts [options]
 */

interface FetchOptions {
  source?: string;
  token?: string;
  output?: string;
  limit?: number;
  minUsd?: number;
  dryRun?: boolean;
}

const DEFAULT_GMX_TOKEN = '0x62edc0692BD897D2295872a9FFCac5425011c661';
const DEFAULT_OUTPUT = process.env.DEFAULT_WALLETS_FILE || './data/wallets.csv';

async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  console.log('🔍 Multi-Source Wallet Discovery for GMX Dust Collection');
  console.log('======================================================');

  if (options.dryRun) {
    console.log('🧪 DRY RUN MODE - No files will be written');
  }

  const tokenAddress = options.token || DEFAULT_GMX_TOKEN;
  const outputPath = options.output || DEFAULT_OUTPUT;
  const limit = options.limit || parseInt(process.env.WALLET_FETCH_LIMIT || '5000');
  const minUsd = options.minUsd || 0.5;

  console.log(`📍 Target token: ${tokenAddress}`);
  console.log(`📄 Output file: ${outputPath}`);
  console.log(`🔢 Wallet limit: ${limit}`);
  console.log(`💰 Min USD filter: $${minUsd}`);

  let allWallets: any[] = [];

  try {
    if (!options.source || options.source === 'all') {
      // Fetch from all sources
      allWallets = await fetchFromAllSources(tokenAddress, limit);
    } else {
      // Fetch from specific source
      allWallets = await fetchFromSource(options.source, tokenAddress, limit);
    }

    if (allWallets.length === 0) {
      console.log('⚠️  No wallets discovered from any source');
      return;
    }

    console.log(`\n🔄 Processing ${allWallets.length} discovered wallets...`);

    // Normalize and process wallets
    const normalized = normalizeWallets(allWallets);
    const deduplicated = deduplicateWallets(normalized);
    
    // Compute USD balances (using simple GMX price for now)
    const gmxPrice = parseFloat(process.env.GMX_PRICE_USD || '25.0');
    const withUsd = computeUsdBalances(deduplicated, gmxPrice);
    
    // Filter and sort
    const filtered = filterByMinUsd(withUsd, minUsd);
    const sorted = sortByBalance(filtered);

    console.log(`\n📊 Final Results:`);
    console.log(`   Total discovered: ${allWallets.length}`);
    console.log(`   After deduplication: ${deduplicated.length}`);
    console.log(`   Above $${minUsd} threshold: ${filtered.length}`);

    if (filtered.length > 0) {
      console.log(`\n🏆 Top 5 wallets by estimated value:`);
      sorted.slice(0, 5).forEach((wallet, i) => {
        console.log(`   ${i + 1}. ${wallet.address} - $${(wallet.balance_usd || 0).toFixed(2)} (${wallet.source})`);
      });
    }

    // Save to file
    if (!options.dryRun) {
      saveWalletsToFile(sorted, outputPath);
      console.log(`\n✅ Saved ${sorted.length} wallets to ${outputPath}`);
    } else {
      console.log(`\n🧪 DRY RUN: Would save ${sorted.length} wallets to ${outputPath}`);
    }

    console.log('\n🎯 Next steps:');
    console.log(`   1. Review the wallet list: ${outputPath}`);
    console.log(`   2. Run wallet scanner: npm run wallets:scan -- --wallets-file ${outputPath}`);
    console.log(`   3. Check accepted wallets: ${process.env.ACCEPTED_WALLETS_FILE || './data/accepted-wallets.csv'}`);

  } catch (error) {
    console.error('❌ Error during wallet discovery:', error);
    process.exit(1);
  }
}

async function fetchFromAllSources(tokenAddress: string, limit: number): Promise<any[]> {
  const allWallets: any[] = [];
  const perSourceLimit = Math.floor(limit / 4); // Divide among 4 sources

  console.log(`\n🌐 Fetching from all sources (${perSourceLimit} per source)...`);

  // Covalent
  if (process.env.COVALENT_API_KEY) {
    try {
      console.log('\n📡 Fetching from Covalent...');
      const covalent = new CovalentCollector(process.env.COVALENT_API_KEY);
      const wallets = await covalent.collect(tokenAddress, { limit: perSourceLimit });
      allWallets.push(...wallets);
      console.log(`✅ Covalent: ${wallets.length} wallets`);
    } catch (error) {
      console.warn(`⚠️  Covalent failed: ${error}`);
    }
  } else {
    console.log('⏭️  Skipping Covalent (no API key)');
  }

  // Bitquery
  if (process.env.BITQUERY_API_KEY) {
    try {
      console.log('\n📊 Fetching from Bitquery...');
      const bitquery = new BitqueryCollector(process.env.BITQUERY_API_KEY);
      const wallets = await bitquery.collect(tokenAddress, { limit: perSourceLimit });
      allWallets.push(...wallets);
      console.log(`✅ Bitquery: ${wallets.length} wallets`);
    } catch (error) {
      console.warn(`⚠️  Bitquery failed: ${error}`);
    }
  } else {
    console.log('⏭️  Skipping Bitquery (no API key)');
  }

  // SnowTrace
  if (process.env.SNOWTRACE_API_KEY) {
    try {
      console.log('\n❄️  Fetching from SnowTrace...');
      const snowtrace = new SnowTraceCollector(process.env.SNOWTRACE_API_KEY);
      const wallets = await snowtrace.collect(tokenAddress, { limit: perSourceLimit });
      allWallets.push(...wallets);
      console.log(`✅ SnowTrace: ${wallets.length} wallets`);
    } catch (error) {
      console.warn(`⚠️  SnowTrace failed: ${error}`);
    }
  } else {
    console.log('⏭️  Skipping SnowTrace (no API key)');
  }

  // File import (if default file exists)
  const defaultFile = './data/wallets-seed.csv';
  if (existsSync(defaultFile)) {
    try {
      console.log('\n📁 Loading from seed file...');
      const fileCollector = new FileCollector();
      const wallets = await fileCollector.collect(defaultFile, { limit: perSourceLimit });
      allWallets.push(...wallets);
      console.log(`✅ File: ${wallets.length} wallets`);
    } catch (error) {
      console.warn(`⚠️  File import failed: ${error}`);
    }
  }

  return allWallets;
}

async function fetchFromSource(source: string, tokenAddress: string, limit: number): Promise<any[]> {
  console.log(`\n🎯 Fetching from ${source}...`);

  switch (source.toLowerCase()) {
    case 'covalent':
      if (!process.env.COVALENT_API_KEY) throw new Error('COVALENT_API_KEY required');
      const covalent = new CovalentCollector(process.env.COVALENT_API_KEY);
      return covalent.collect(tokenAddress, { limit });

    case 'bitquery':
      if (!process.env.BITQUERY_API_KEY) throw new Error('BITQUERY_API_KEY required');
      const bitquery = new BitqueryCollector(process.env.BITQUERY_API_KEY);
      return bitquery.collect(tokenAddress, { limit });

    case 'snowtrace':
      if (!process.env.SNOWTRACE_API_KEY) throw new Error('SNOWTRACE_API_KEY required');
      const snowtrace = new SnowTraceCollector(process.env.SNOWTRACE_API_KEY);
      return snowtrace.collect(tokenAddress, { limit });

    case 'file':
      const filePath = process.argv.find(arg => arg.startsWith('--file='))?.split('=')[1];
      if (!filePath) throw new Error('--file=path required for file source');
      const fileCollector = new FileCollector();
      return fileCollector.collect(filePath, { limit });

    default:
      throw new Error(`Unknown source: ${source}. Use: covalent, bitquery, snowtrace, file, or all`);
  }
}

function saveWalletsToFile(wallets: any[], filePath: string): void {
  // Ensure directory exists
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const csvContent = formatAsCSV(wallets);
  writeFileSync(filePath, csvContent, 'utf8');
}

function parseArgs(args: string[]): FetchOptions {
  const options: FetchOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    } else if (arg === '--source' || arg === '-s') {
      options.source = args[++i];
    } else if (arg === '--token' || arg === '-t') {
      options.token = args[++i];
    } else if (arg === '--output' || arg === '-o') {
      options.output = args[++i];
    } else if (arg === '--limit' || arg === '-l') {
      options.limit = parseInt(args[++i]);
    } else if (arg === '--min-usd') {
      options.minUsd = parseFloat(args[++i]);
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--source=')) {
      options.source = arg.split('=')[1];
    } else if (arg.startsWith('--token=')) {
      options.token = arg.split('=')[1];
    } else if (arg.startsWith('--output=')) {
      options.output = arg.split('=')[1];
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--min-usd=')) {
      options.minUsd = parseFloat(arg.split('=')[1]);
    }
  }

  return options;
}

function showHelp(): void {
  console.log(`
🔍 Multi-Source Wallet Discovery CLI

Usage:
  npm run wallets:fetch [options]

Options:
  --source, -s     Source to fetch from: covalent, bitquery, snowtrace, file, all (default: all)
  --token, -t      Token contract address (default: GMX token)
  --output, -o     Output CSV file path (default: ./data/wallets.csv)
  --limit, -l      Maximum wallets to fetch (default: 5000)
  --min-usd       Minimum USD balance filter (default: 0.5)
  --dry-run       Don't write files, just show results
  --help, -h      Show this help

Examples:
  npm run wallets:fetch
  npm run wallets:fetch -- --source covalent --limit 1000
  npm run wallets:fetch -- --token 0x123... --output ./my-wallets.csv
  npm run wallets:fetch -- --source file --file=./my-list.csv
  npm run wallets:fetch -- --dry-run

Environment Variables:
  COVALENT_API_KEY, BITQUERY_API_KEY, SNOWTRACE_API_KEY
  DEFAULT_WALLETS_FILE, WALLET_FETCH_LIMIT
`);
}

// Run CLI
main().catch(console.error);