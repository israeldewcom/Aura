// js/config.js
export const API_BASE = 'https://changex-backend-1.onrender.com/api/v1';
export const FRONTEND_URL = window.location.origin || 'https://changex.academy';
export const PAYSTACK_PUBLIC_KEY = 'pk_live_your_paystack_public_key';
export const CURRENCY_SYMBOLS = { NGN: '₦', USD: '$', GBP: '£', EUR: '€' };
export const ADSTERRA_TAG = 'https://pl30155373.effectivecpmnetwork.com/cc89042fff30e53e48049a8c585d9105/invoke.js';
export const INSTALL_BANNER_KEY = 'cx_install_banner_dismissed_at';
export const BANNER_HIDE_DAYS = 7;

export const PLATFORM_BANK_DETAILS = [
    { bankName: 'Lead Bank', accountName: 'Ijigai John Thomas', accountNumber: '215799076919',
        routing: '101019644', accountType: 'Checking', note: 'For international/wire transfers' },
    { bankName: 'Taj Bank', accountName: 'Ijigai John Thomas', accountNumber: '0009624235',
        note: 'For local Nigerian transfers (Naira)' }
];

export let exchangeRates = { NGN: 1, USD: 0.00062, EUR: 0.00058, GBP: 0.0005 };

export function setExchangeRates(rates) {
    exchangeRates = { NGN: 1, ...rates };
}
