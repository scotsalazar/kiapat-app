import axios from 'axios';

export interface ApiErrorResponse {
  code?: string;
  message?: string;
  details?: unknown;
}

const FRIENDLY_MESSAGES: Record<string, string> = {
  'auth.invalid_credentials': 'Invalid username or password.',
  'auth.forbidden': 'You do not have permission to perform this action.',
  'auth.password_complexity': 'Password does not meet the required complexity rules.',
  'users.username_exists': 'A user with that username already exists.',
  'users.email_exists': 'A user with that email already exists.',
  'users.not_found': 'The requested user could not be found.',
  'catalog.classification_exists': 'A classification with that size and color already exists.',
  'catalog.classification_not_found': 'The selected classification could not be found.',
  'catalog.classification_delete_conflict': 'This classification cannot be deleted because it has related records.',
  'catalog.price_invalid_range': 'The effective dates are invalid for this price.',
  'catalog.price_overlap': 'The price overlaps an existing effective period.',
  'catalog.price_not_found': 'The requested price entry could not be found.',
  'pricing.missing_price': 'No price is configured for the selected classification and unit.',
  'inventory.invalid_state': 'The inventory movement is no longer in a valid state for that action.',
  'inventory.insufficient_stock': 'Not enough stock is available for this classification.',
  'sales.invalid_date_range': 'End date must be on or after the start date.',
  'sales.invoice_not_found': 'The requested invoice could not be found.',
};

export interface ParsedApiError {
  code?: string;
  message: string;
  details?: unknown;
}

export const extractApiError = (
  error: unknown,
  fallbackMessage = 'Something went wrong. Please try again.',
): ParsedApiError => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorResponse | undefined;
    if (data && typeof data === 'object') {
      const code = data.code;
      if (code && typeof code === 'string') {
        const message = FRIENDLY_MESSAGES[code] ?? data.message ?? fallbackMessage;
        return { code, message, details: data.details };
      }
      if (typeof data.message === 'string' && data.message) {
        return { message: data.message, details: data.details };
      }
    }
    if (typeof error.message === 'string' && error.message) {
      return { message: error.message };
    }
  }
  if (error instanceof Error && error.message) {
    return { message: error.message };
  }
  return { message: fallbackMessage };
};

export const getFriendlyMessageForCode = (code?: string, fallback?: string): string | undefined => {
  if (!code) {
    return fallback;
  }
  return FRIENDLY_MESSAGES[code] ?? fallback;
};
