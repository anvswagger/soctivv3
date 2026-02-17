/**
 * Admin Activity Monitoring Service
 * 
 * This service provides comprehensive admin activity monitoring including:
 * - Activity logging and tracking
 * - Permission change monitoring
 * - Data modification audit trails
 * - Administrative action reports
 */

import { supabase } from '@/integrations/supabase/client';
import { analyticsService } from '@/services/analyticsService';
import type {
    AdminActivityLog,
    AdminActivityType,
    AdminActivitySummary,
    DateRange,
    PaginatedAnalyticsResult,
} from '@/types/analytics';

// ============================================================================
// ACTIVITY TYPE MAPPINGS
// ============================================================================

const ACTIVITY_TYPE_LABELS: Record<AdminActivityType, string> = {
    'user_permission_change': 'تغيير صلاحيات المستخدم',
    'role_assignment': 'تعيين دور',
    'role_revoke': 'إلغاء دور',
    'data_modification': 'تعديل بيانات',
    'data_creation': 'إنشاء بيانات',
    'data_deletion': 'حذف بيانات',
    'bulk_operation': 'عملية جماعية',
    'report_generation': 'إنشاء تقرير',
    'report_export': 'تصدير تقرير',
    'settings_update': 'تحديث إعدادات',
    'user_suspension': 'تعليق مستخدم',
    'user_activation': 'تفعيل مستخدم',
    'data_export': 'تصدير بيانات',
    'api_key_generation': 'إنشاء مفتاح API',
    'api_key_revocation': 'إلغاء مفتاح API',
    'system_config_change': 'تغيير تكوين النظام',
    'client_onboarding': 'إعداد عميل جديد',
    'client_offboarding': 'إزالة عميل',
    'sms_template_modification': 'تعديل قالب SMS',
    'appointment_bulk_update': 'تحديث جماعي للمواعيد',
};

const ACTIVITY_TYPE_ICONS: Record<AdminActivityType, string> = {
    'user_permission_change': '🔐',
    'role_assignment': '👤',
    'role_revoke': '🚫',
    'data_modification': '✏️',
    'data_creation': '➕',
    'data_deletion': '🗑️',
    'bulk_operation': '📦',
    'report_generation': '📊',
    'report_export': '📤',
    'settings_update': '⚙️',
    'user_suspension': '⏸️',
    'user_activation': '✅',
    'data_export': '💾',
    'api_key_generation': '🔑',
    'api_key_revocation': '❌',
    'system_config_change': '🔧',
    'client_onboarding': '🏢',
    'client_offboarding': '🚪',
    'sms_template_modification': '📝',
    'appointment_bulk_update': '📅',
};

// ============================================================================
// MAIN SERVICE
// ============================================================================

export const adminAuditService = {
    /**
     * Log an admin activity event
     */
    async logActivity(
        adminUserId: string,
        adminName: string,
        activityType: AdminActivityType,
        options: {
            targetUserId?: string;
            targetUserName?: string;
            targetEntityType?: string;
            targetEntityId?: string;
            previousValue?: Record<string, unknown>;
            newValue?: Record<string, unknown>;
            ipAddress?: string;
            userAgent?: string;
            status?: 'success' | 'failure';
            errorMessage?: string;
            metadata?: Record<string, unknown>;
        } = {}
    ): Promise<AdminActivityLog | null> {
        try {
            // Get IP address and user agent if not provided
            const ipAddress = options.ipAddress || 'unknown';
            const userAgent = options.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : 'system');

            const activityLog: Omit<AdminActivityLog, 'id' | 'timestamp'> = {
                adminUserId,
                adminName,
                activityType,
                targetUserId: options.targetUserId,
                targetUserName: options.targetUserName,
                targetEntityType: options.targetEntityType as any,
                targetEntityId: options.targetEntityId,
                previousValue: options.previousValue,
                newValue: options.newValue,
                ipAddress,
                userAgent,
                status: options.status || 'success',
                errorMessage: options.errorMessage,
                metadata: options.metadata,
            };

            // Insert into admin_activity_logs table (if it exists)
            const { data, error } = await (supabase as any)
                .from('admin_activity_logs')
                .insert(activityLog)
                .select()
                .single();

            if (error) {
                console.error('Error logging admin activity:', error);
                // Fallback: track via analytics service
                await analyticsService.trackEvent({
                    userId: adminUserId,
                    eventType: 'admin_activity',
                    eventName: activityType,
                    metadata: {
                        ...activityLog,
                        activityType,
                    },
                });
                return null;
            }

            return data as AdminActivityLog;
        } catch (error) {
            console.error('Error logging admin activity:', error);
            return null;
        }
    },

    /**
     * Log permission change activity
     */
    async logPermissionChange(
        adminUserId: string,
        adminName: string,
        targetUserId: string,
        targetUserName: string,
        previousRole: string,
        newRole: string,
        grantedPermissions: string[],
        revokedPermissions: string[],
        ipAddress?: string
    ): Promise<void> {
        await this.logActivity(adminUserId, adminName, 'user_permission_change', {
            targetUserId,
            targetUserName,
            targetEntityType: 'user',
            previousValue: { role: previousRole, permissions: revokedPermissions },
            newValue: { role: newRole, permissions: grantedPermissions },
            ipAddress,
        });
    },

    /**
     * Log data modification activity
     */
    async logDataModification(
        adminUserId: string,
        adminName: string,
        entityType: string,
        entityId: string,
        previousData: Record<string, unknown>,
        newData: Record<string, unknown>,
        ipAddress?: string
    ): Promise<void> {
        await this.logActivity(adminUserId, adminName, 'data_modification', {
            targetEntityType: entityType as any,
            targetEntityId: entityId,
            previousValue: previousData,
            newValue: newData,
            ipAddress,
        });
    },

    /**
     * Get paginated activity logs
     */
    async getActivityLogs(
        filters: {
            adminUserId?: string;
            activityType?: AdminActivityType;
            targetUserId?: string;
            dateRange?: DateRange;
            status?: 'success' | 'failure';
        } = {},
        page: number = 1,
        pageSize: number = 50
    ): Promise<PaginatedAnalyticsResult<AdminActivityLog>> {
        try {
            let query = (supabase as any)
                .from('admin_activity_logs')
                .select('*', { count: 'exact' })
                .order('timestamp', { ascending: false });

            if (filters.adminUserId) {
                query = query.eq('admin_user_id', filters.adminUserId);
            }

            if (filters.activityType) {
                query = query.eq('activity_type', filters.activityType);
            }

            if (filters.targetUserId) {
                query = query.eq('target_user_id', filters.targetUserId);
            }

            if (filters.status) {
                query = query.eq('status', filters.status);
            }

            if (filters.dateRange) {
                query = query
                    .gte('timestamp', filters.dateRange.start.toISOString())
                    .lte('timestamp', filters.dateRange.end.toISOString());
            }

            // Apply pagination
            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;

            query = query.range(from, to);

            const { data, error, count } = await query;

            if (error) throw error;

            return {
                data: (data || []) as AdminActivityLog[],
                total: count || 0,
                page,
                pageSize,
                totalPages: count ? Math.ceil(count / pageSize) : 0,
            };
        } catch (error) {
            console.error('Error getting activity logs:', error);
            return {
                data: [],
                total: 0,
                page,
                pageSize,
                totalPages: 0,
            };
        }
    },

    /**
     * Get admin activity summary
     */
    async getActivitySummary(
        dateRange?: DateRange
    ): Promise<AdminActivitySummary | null> {
        try {
            // Get total actions
            let query = (supabase as any)
                .from('admin_activity_logs')
                .select('*', { count: 'exact', head: true });

            if (dateRange) {
                query = query
                    .gte('timestamp', dateRange.start.toISOString())
                    .lte('timestamp', dateRange.end.toISOString());
            }

            const { count: totalActions, error: totalError } = await query;
            if (totalError) throw totalError;

            // Get failed attempts
            const { count: failedAttempts, error: failedError } = await (supabase as any)
                .from('admin_activity_logs')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'failure');
            if (failedError) throw failedError;

            // Get unique admins
            const { data: adminIds, error: adminError } = await (supabase as any)
                .from('admin_activity_logs')
                .select('admin_user_id, admin_name');

            if (adminError) throw adminError;

            const uniqueAdmins = new Set((adminIds || []).map((a: any) => a.admin_user_id));

            const adminCounts: Record<string, { name: string; count: number }> = {};
            (adminIds || []).forEach((a: any) => {
                if (!adminCounts[a.admin_user_id]) {
                    adminCounts[a.admin_user_id] = { name: a.admin_name, count: 0 };
                }
                adminCounts[a.admin_user_id].count++;
            });

            const adminPerformance = Object.entries(adminCounts)
                .map(([id, data]) => ({
                    adminId: id,
                    adminName: data.name,
                    actionCount: data.count,
                }))
                .sort((a, b) => b.actionCount - a.actionCount)
                .slice(0, 10);

            // Get activity by type
            const { data: typeData, error: typeError } = await (supabase as any)
                .from('admin_activity_logs')
                .select('activity_type');

            if (typeError) throw typeError;

            const activityByType: Record<string, number> = {};
            (typeData || []).forEach((a: any) => {
                activityByType[a.activity_type] = (activityByType[a.activity_type] || 0) + 1;
            });

            // Get recent activities
            const { data: recentActivities, error: recentError } = await (supabase as any)
                .from('admin_activity_logs')
                .select('*')
                .order('timestamp', { ascending: false })
                .limit(20);

            if (recentError) throw recentError;

            // Get daily volume (last 30 days)
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const { data: volumeData, error: volumeError } = await (supabase as any)
                .from('admin_activity_logs')
                .select('timestamp')
                .gte('timestamp', thirtyDaysAgo.toISOString());

            if (volumeError) throw volumeError;

            const dailyVolume: Record<string, number> = {};
            (volumeData || []).forEach((v: any) => {
                const date = v.timestamp.split('T')[0];
                dailyVolume[date] = (dailyVolume[date] || 0) + 1;
            });

            const trendData = Object.entries(dailyVolume)
                .map(([date, count]) => ({ date, count: count as unknown as number }))
                .sort((a, b) => a.date.localeCompare(b.date));

            return {
                totalActions: totalActions || 0,
                uniqueAdmins: uniqueAdmins.size,
                failedAttempts: failedAttempts || 0,
                activityByType: activityByType as Record<AdminActivityType, number>,
                activityByAdmin: adminPerformance,
                recentActivities: (recentActivities || []) as AdminActivityLog[],
                dailyVolume: trendData,
            };
        } catch (error) {
            console.error('Error getting activity summary:', error);
            return null;
        }
    },

    /**
     * Get activity type label
     */
    getActivityTypeLabel(activityType: AdminActivityType): string {
        return ACTIVITY_TYPE_LABELS[activityType] || activityType;
    },

    /**
     * Get activity type icon
     */
    getActivityTypeIcon(activityType: AdminActivityType): string {
        return ACTIVITY_TYPE_ICONS[activityType] || '📋';
    },

    /**
     * Detect suspicious activity patterns
     */
    async detectSuspiciousActivity(
        adminUserId: string,
        timeWindowHours: number = 24
    ): Promise<Array<{ type: string; message: string; severity: 'warning' | 'critical' }>> {
        const warnings: Array<{ type: string; message: string; severity: 'warning' | 'critical' }> = [];

        try {
            const windowStart = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);

            // Check for high frequency of permission changes
            const { data: permissionChanges, error: permError } = await (supabase as any)
                .from('admin_activity_logs')
                .select('id')
                .eq('admin_user_id', adminUserId)
                .eq('activity_type', 'user_permission_change')
                .gte('timestamp', windowStart.toISOString());

            if (permError) throw permError;

            if ((permissionChanges || []).length > 10) {
                warnings.push({
                    type: 'high_permission_changes',
                    message: `User performed ${(permissionChanges || []).length} permission changes in ${timeWindowHours} hours`,
                    severity: 'warning',
                });
            }

            // Check for failed activities
            const { data: failedActivities, error: failedError } = await (supabase as any)
                .from('admin_activity_logs')
                .select('id, activity_type, error_message')
                .eq('admin_user_id', adminUserId)
                .eq('status', 'failure')
                .gte('timestamp', windowStart.toISOString());

            if (failedError) throw failedError;

            if ((failedActivities || []).length > 5) {
                warnings.push({
                    type: 'high_failure_rate',
                    message: `${(failedActivities || []).length} failed activities in ${timeWindowHours} hours`,
                    severity: 'critical',
                });
            }

            return warnings;
        } catch (error) {
            console.error('Error detecting suspicious activity:', error);
            return warnings;
        }
    },
};
