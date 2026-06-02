// Brand constants mirror eus/src/config/branding.ts. The values come from
// app_text_settings at runtime — these are just the fallback defaults if
// the table hasn't been loaded yet.

export const brandingDefaults = {
  orgName: 'Ekata Unnayan Sanstha',
  orgShort: 'EUS',
  orgNameNative: 'একতা উন্নয়ন সংস্থা',
  tagline: 'Member-owned cooperative savings',
};

export const locale = {
  currency: 'INR',
  currencyLocale: 'en-IN',
  currencySymbol: '₹',
};

// Bumped manually on every meaningful release. Shown in About dialog.
export const APP_VERSION = '0.4.0';
export const APP_REPO_URL = 'https://github.com/HITESHDAS-01/EUS_Desktop';
