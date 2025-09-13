"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationsController = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class OrganizationsController {
    // Get all active organizations
    getOrganizations(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const organizations = yield prisma.organization.findMany({
                    where: { isActive: true },
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        address: true,
                        phone: true,
                        email: true,
                        website: true
                    },
                    orderBy: { name: 'asc' }
                });
                res.json({
                    success: true,
                    data: organizations
                });
            }
            catch (error) {
                console.error('Error fetching organizations:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch organizations',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Get organization by ID
    getOrganizationById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                // Validate UUID format
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                if (!uuidRegex.test(id)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid organization ID format'
                    });
                }
                const organization = yield prisma.organization.findFirst({
                    where: { id, isActive: true },
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        address: true,
                        phone: true,
                        email: true,
                        website: true
                    }
                });
                if (!organization) {
                    return res.status(404).json({
                        success: false,
                        message: 'Organization not found'
                    });
                }
                res.json({
                    success: true,
                    data: organization
                });
            }
            catch (error) {
                console.error('Error fetching organization:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch organization',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
    // Get doctors by organization
    getDoctorsByOrganization(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { organizationId } = req.params;
                // Validate UUID format
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                if (!uuidRegex.test(organizationId)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid organization ID format'
                    });
                }
                const doctors = yield prisma.user.findMany({
                    where: {
                        role: 'DOCTOR',
                        organizationId: organizationId
                    },
                    select: {
                        id: true,
                        email: true,
                        doctorInfo: {
                            select: {
                                firstName: true,
                                lastName: true,
                                specialization: true
                            }
                        }
                    },
                    orderBy: [
                        { doctorInfo: { firstName: 'asc' } },
                        { doctorInfo: { lastName: 'asc' } }
                    ]
                });
                const formattedDoctors = doctors.map(doctor => {
                    var _a;
                    return ({
                        id: doctor.id,
                        name: doctor.doctorInfo
                            ? `Dr. ${doctor.doctorInfo.firstName} ${doctor.doctorInfo.lastName}`
                            : doctor.email,
                        specialization: ((_a = doctor.doctorInfo) === null || _a === void 0 ? void 0 : _a.specialization) || 'General Practice',
                        organizationId: organizationId
                    });
                });
                res.json({
                    success: true,
                    data: formattedDoctors
                });
            }
            catch (error) {
                console.error('Error fetching doctors by organization:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch doctors',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }
}
exports.OrganizationsController = OrganizationsController;
