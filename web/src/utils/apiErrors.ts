export interface ApiErrorResponse {
  code?: string;
  message?: string;
  details?: unknown;
  detail?: string;
}

const CODE_MESSAGES: Record<string, string> = {
  'auth:forbidden': 'You do not have permission to perform this action.',
  'catalog:duplicate_classification': 'A classification with the same size and color already exists.',
  'catalog:not_found': 'The selected classification could not be found.',
  'catalog:delete_conflict': 'The classification cannot be deleted while related records exist.',
  'pricing:invalid_range': 'The pricing period is invalid. Ensure the end date is after the start date.',
  'pricing:overlap': 'The pricing period overlaps with an existing price.',
  'pricing:not_found': 'Pricing information for this item could not be located.',
  'sales:empty_invoice': 'Add at least one item to create an invoice.',
  'sales:price_missing': 'A price has not been configured for one of the requested items.',
  'sales:invalid_state': 'The invoice cannot be updated in its current state.',
  'sales:not_found': 'The requested invoice was not found.',
  'inventory:invalid_state': 'The movement is not in a valid state for this action.',
  'users:username_exists': 'That username is already taken.',
  'users:email_exists': 'That email address is already in use.',
  'users:not_found': 'The selected user could not be found.',
  'common:validation_error': 'One or more inputs are invalid.',
};

export interface ParsedApiError {
  message: string;
  code?: string;
  details?: unknown;
}

export const parseApiError = (error: unknown, fallbackMessage: string): ParsedApiError => {
  const anyError = error as { response?: { data?: ApiErrorResponse } } | undefined;
  const responseData = anyError?.response?.data;
  const code = responseData?.code;

  if (code) {
    const mappedMessage = CODE_MESSAGES[code];
    if (mappedMessage) {
      return { message: mappedMessage, code, details: responseData?.details };
    }
    if (responseData?.message) {
      return { message: responseData.message, code, details: responseData?.details };
    }
  }

  if (responseData?.message) {
    return { message: responseData.message, code: responseData.code, details: responseData.details };
  }

  if (typeof responseData?.detail === 'string') {
    if (responseData.detail.toLowerCase().includes('could not validate credentials')) {
      return { message: 'Session expired. Please sign in again.' };
    }
    return { message: responseData.detail };
  }

  if (error instanceof Error && error.message) {
    return { message: error.message };
  }

  return { message: fallbackMessage };
};

export const getApiErrorMessage = (error: unknown, fallbackMessage: string): string => {
  return parseApiError(error, fallbackMessage).message;
};
