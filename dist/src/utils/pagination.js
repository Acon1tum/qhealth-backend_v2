"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculatePagination = calculatePagination;
exports.getOffset = getOffset;
exports.parsePaginationQuery = parsePaginationQuery;
exports.applyPagination = applyPagination;
exports.createPaginatedResponse = createPaginatedResponse;
exports.validatePagination = validatePagination;
exports.getDefaultPagination = getDefaultPagination;
exports.createPaginationLinks = createPaginationLinks;
/**
 * Calculate pagination metadata
 */
function calculatePagination(page, limit, total) {
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
function getOffset(page, limit) {
    return (page - 1) * limit;
}
/**
 * Parse pagination query parameters
 */
function parsePaginationQuery(query) {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10));
    return { page, limit };
}
/**
 * Apply pagination to Prisma query
 */
function applyPagination(page, limit) {
    const offset = getOffset(page, limit);
    return {
        skip: offset,
        take: limit,
    };
}
/**
 * Create paginated response
 */
function createPaginatedResponse(data, page, limit, total) {
    const pagination = calculatePagination(page, limit, total);
    return {
        data,
        pagination,
    };
}
/**
 * Validate pagination parameters
 */
function validatePagination(page, limit) {
    const errors = [];
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
function getDefaultPagination() {
    return {
        page: 1,
        limit: 10,
    };
}
/**
 * Create pagination links for API responses
 */
function createPaginationLinks(baseUrl, pagination, queryParams = {}) {
    const params = new URLSearchParams(queryParams);
    const first = `${baseUrl}?${params.toString()}`;
    params.set('page', pagination.totalPages.toString());
    const last = `${baseUrl}?${params.toString()}`;
    let prev;
    let next;
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
