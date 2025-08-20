import { IPagination } from '../types';

/**
 * Calculate pagination metadata
 */
export function calculatePagination(
  page: number,
  limit: number,
  total: number
): IPagination {
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  return {
    page,
    limit,
    total,
    totalPages,
    hasNext,
    hasPrev,
  };
}

/**
 * Get offset for database queries
 */
export function getOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

/**
 * Parse pagination query parameters
 */
export function parsePaginationQuery(query: any): {
  page: number;
  limit: number;
} {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 10));

  return { page, limit };
}

/**
 * Apply pagination to Prisma query
 */
export function applyPagination(page: number, limit: number) {
  const offset = getOffset(page, limit);
  
  return {
    skip: offset,
    take: limit,
  };
}

/**
 * Create paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number
) {
  const pagination = calculatePagination(page, limit, total);
  
  return {
    data,
    pagination,
  };
}

/**
 * Validate pagination parameters
 */
export function validatePagination(page: number, limit: number): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (page < 1) {
    errors.push('Page must be greater than 0');
  }

  if (limit < 1) {
    errors.push('Limit must be greater than 0');
  }

  if (limit > 100) {
    errors.push('Limit cannot exceed 100');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get default pagination values
 */
export function getDefaultPagination(): { page: number; limit: number } {
  return {
    page: 1,
    limit: 10,
  };
}

/**
 * Create pagination links for API responses
 */
export function createPaginationLinks(
  baseUrl: string,
  pagination: IPagination,
  queryParams: Record<string, any> = {}
): {
  first: string;
  last: string;
  prev?: string;
  next?: string;
} {
  const params = new URLSearchParams(queryParams);
  
  const first = `${baseUrl}?${params.toString()}`;
  
  params.set('page', pagination.totalPages.toString());
  const last = `${baseUrl}?${params.toString()}`;
  
  let prev: string | undefined;
  let next: string | undefined;
  
  if (pagination.hasPrev) {
    params.set('page', (pagination.page - 1).toString());
    prev = `${baseUrl}?${params.toString()}`;
  }
  
  if (pagination.hasNext) {
    params.set('page', (pagination.page + 1).toString());
    next = `${baseUrl}?${params.toString()}`;
  }
  
  return {
    first,
    last,
    prev,
    next,
  };
}
