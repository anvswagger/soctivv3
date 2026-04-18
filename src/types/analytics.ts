/**
 * Comprehensive Analytics System Types
 * 
 * This module defines all TypeScript interfaces and types for the analytics system,
 * including client engagement metrics, admin activity logs, call tracking, and appointment analytics.
 */

// ============================================================================
// COMMON TYPES
// ============================================================================

/** Date range for filtering analytics data */
export interface DateRange {
  start: Date;
  end: Date;
}

/** Preset date range options */
export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisQuarter'
  | 'thisYear'
  | 'last7Days'
  | 'last30Days'
  | 'last90Days'
  | 'custom';

/** Trend direction for metrics */
export type TrendDirection = 'up' | 'down' | 'stable';

/** Comparison period for period-over-period analytics */
export interface ComparisonPeriod {
  current: DateRange;
  previous: DateRange;
}

/** Export format options */
export type ExportFormat = 'csv' | 'pdf' | 'excel';

/** Drill-down context for navigation from summary to details */
export interface DrillDownContext {
  metricId: string;
  filterValues: Record<string, unknown>;
  sourcePage: string;
}

// ============================================================================
// CLIENT ENGAGEMENT ANALYTICS TYPES
// ============================================================================

/** Commitment tier levels */
export type CommitmentTier = 'high' | 'medium' | 'low' | 'at_risk';

/** Commitment score factors */
export interface CommitmentScoreFactors {
  // Interaction Frequency (0-25 points)
  callFrequency: number;        // Calls per week
  smsFrequency: number;        // SMS exchanges per week
  appointmentAttendance: number;// Attendance rate (0-1)

  // Response Time (0-25 points)
  avgResponseMinutes: number;   // Average response time to communications
  responseRate: number;        // Percentage of communications responded to (0-1)

  // Engagement Patterns (0-25 points)
  leadAge: number;             // Days since first contact
  statusProgression: number;   // Speed through sales pipeline (0-1)
  followUpRate: number;        // Rate of scheduled follow-ups kept (0-1)

  // Quality Indicators (0-25 points)
  appointmentShowRate: number;  // Show rate for scheduled appointments (0-1)
  conversionProgress: number;  // Movement toward sale (0-1)
  communicationQuality: number; // Based on notes and interaction depth (0-1)
}

/** Complete client commitment score */
export interface ClientCommitmentScore {
  overallScore: number;        // 0-100
  tier: CommitmentTier;
  factors: CommitmentScoreFactors;
  trend: TrendDirection;
  trendPercentage: number;
  recommendations: string[];
  lastUpdated: string;
}

/** Client engagement summary for dashboard */
export interface ClientEngagementSummary {
  totalClients: number;
  avgCommitmentScore: number;
  highEngagementCount: number;
  mediumEngagementCount: number;
  lowEngagementCount: number;
  atRiskCount: number;
  trendData: Array<{
    date: string;
    avgScore: number;
    highCount: number;
    atRiskCount: number;
  }>;
}

/** Interaction event for tracking client engagement */
export interface InteractionEvent {
  id: string;
  clientId: string;
  leadId?: string;
  eventType: 'call' | 'sms' | 'email' | 'appointment' | 'note' | 'meeting';
  timestamp: string;
  duration?: number;          // Duration in seconds for calls/meetings
  outcome?: string;
  notes?: string;
  userId: string;
}

/** Client engagement timeline entry */
export interface EngagementTimelineEntry {
  id: string;
  date: string;
  type: 'call' | 'sms' | 'email' | 'appointment' | 'status_change' | 'note';
  title: string;
  description: string;
  duration?: number;
  outcome?: string;
  userId: string;
  userName: string;
}

// ============================================================================
// ADMIN ACTIVITY MONITORING TYPES
// ============================================================================

/** Types of admin activities */
export type AdminActivityType =
  | 'user_permission_change'
  | 'role_assignment'
  | 'role_revoke'
  | 'data_modification'
  | 'data_creation'
  | 'data_deletion'
  | 'bulk_operation'
  | 'report_generation'
  | 'report_export'
  | 'settings_update'
  | 'user_suspension'
  | 'user_activation'
  | 'data_export'
  | 'api_key_generation'
  | 'api_key_revocation'
  | 'system_config_change'
  | 'client_onboarding'
  | 'client_offboarding'
  | 'sms_template_modification'
  | 'appointment_bulk_update';

/** Admin activity log entry */
export interface AdminActivityLog {
  id: string;
  adminUserId: string;
  adminName: string;
  activityType: AdminActivityType;
  targetUserId?: string;
  targetUserName?: string;
  targetEntityType?: 'user' | 'client' | 'lead' | 'appointment' | 'setting' | 'template';
  targetEntityId?: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  status: 'success' | 'failure';
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  requestId?: string;
}

/** Admin activity summary */
export interface AdminActivitySummary {
  totalActions: number;
  uniqueAdmins: number;
  failedAttempts: number;
  activityByType: Record<AdminActivityType, number>;
  activityByAdmin: Array<{
    adminId: string;
    adminName: string;
    actionCount: number;
  }>;
  recentActivities: AdminActivityLog[];
  dailyVolume: Array<{
    date: string;
    count: number;
  }>;
}

/** Permission change details */
export interface PermissionChange {
  role: string;
  permissions: string[];
  grantedAt: string;
  grantedBy: string;
  expiresAt?: string;
}

// ============================================================================
// CALL TRACKING ANALYTICS TYPES
// ============================================================================

/** Call outcome types */
export type CallOutcome =
  | 'connected'
  | 'voicemail'
  | 'no_answer'
  | 'busy'
  | 'failed'
  | 'wrong_number'
  | 'disconnected';

/** Call disposition codes */
export type CallDisposition =
  | 'interested'
  | 'not_interested'
  | 'callback_later'
  | 'pricing_ objection'
  | 'need_consultation'
  | 'not_qualified'
  | 'duplicate'
  | 'already_customer'
  | 'spam'
  | 'do_not_call';

/** Call type */
export type CallType = 'incoming' | 'outgoing';

/** Call direction */
export type CallDirection = 'internal' | 'external';

/** Complete call tracking record */
export interface CallTrackingRecord {
  id: string;
  callId: string;
  leadId: string;
  leadName: string;
  clientId: string;
  assignedUserId: string;
  assignedUserName: string;

  // Call Details
  callType: CallType;
  callDirection: CallDirection;
  phoneNumber: string;

  // Timing
  startedAt: string;
  answeredAt?: string;
  endedAt: string;
  durationSeconds: number;
  talkTimeSeconds: number;
  ringTimeSeconds: number;
  holdTimeSeconds?: number;

  // Outcome
  callOutcome: CallOutcome;
  dispositionCode: CallDisposition;
  notes?: string;

  // Follow-up
  followUpRequired: boolean;
  followUpDate?: string;
  followUpNotes?: string;

  // Recording
  recordingUrl?: string;
  recordingDuration?: number;

  // Tags for filtering
  tags?: string[];
}

/** Call analytics summary */
export interface CallAnalyticsSummary {
  totalCalls: number;
  incomingCalls: number;
  outgoingCalls: number;
  connectedCalls: number;
  connectionRate: number;
  avgDuration: number;
  avgTalkTime: number;
  avgRingTime: number;
  avgResponseTime: number;
  callOutcomeDistribution: Record<CallOutcome, number>;
  dispositionDistribution: Record<CallDisposition, number>;
  hourlyDistribution: Record<number, number>;  // 0-23 hours
  dailyTrend: Array<{
    date: string;
    totalCalls: number;
    connectedCalls: number;
    avgDuration: number;
  }>;
  userPerformance: Array<{
    userId: string;
    userName: string;
    totalCalls: number;
    connectedCalls: number;
    avgDuration: number;
  }>;
}

/** Call outcome with follow-up requirement */
export interface CallWithFollowUp {
  callId: string;
  leadId: string;
  leadName: string;
  callDate: string;
  outcome: CallOutcome;
  followUpRequired: boolean;
  followUpDate?: string;
  followUpNotes?: string;
}

// ============================================================================
// APPOINTMENT ANALYTICS TYPES
// ============================================================================

/** Appointment status */
export type AppointmentAnalyticsStatus =
  | 'scheduled'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'rescheduled';

/** Appointment type */
export type AppointmentType =
  | 'initial_consultation'
  | 'follow_up'
  | 'demo'
  | 'proposal'
  | 'closing'
  | 'support';

/** Cancellation reason categories */
export type CancellationReason =
  | 'scheduling_conflict'
  | 'customer_request'
  | 'not_available'
  | 'weather'
  | 'technical_issues'
  | 'rescheduled'
  | 'other';

/** Complete appointment record with analytics fields */
export interface AppointmentAnalyticsRecord {
  id: string;
  leadId: string;
  leadName: string;
  clientId: string;
  clientName: string;
  assignedUserId: string;
  assignedUserName: string;

  // Scheduling Details
  scheduledAt: string;
  durationMinutes: number;
  type: AppointmentType;
  location?: string;
  meetingLink?: string;

  // Status History
  currentStatus: AppointmentAnalyticsStatus;
  statusHistory: Array<{
    status: AppointmentAnalyticsStatus;
    timestamp: string;
    userId?: string;
    notes?: string;
  }>;

  // Confirmation
  confirmedAt?: string;
  confirmedBy?: string;

  // Cancellation Details
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: CancellationReason;
  cancellationNotes?: string;

  // Rescheduling
  rescheduledFrom?: string;
  rescheduleCount: number;
  originalScheduledAt?: string;

  // Completion
  completedAt?: string;
  completedNotes?: string;

  // Reminders
  reminderSent: boolean;
  reminderSentAt?: string;
}

/** Appointment analytics summary */
export interface AppointmentAnalyticsSummary {
  totalAppointments: number;
  scheduledCount: number;
  confirmedCount: number;
  completedCount: number;
  cancelledCount: number;
  noShowCount: number;
  rescheduledCount: number;

  // Rates
  completionRate: number;
  showRate: number;
  cancellationRate: number;
  noShowRate: number;

  // Duration
  avgDuration: number;
  avgScheduledLeadTime: number;

  // Trends
  dailyTrend: Array<{
    date: string;
    scheduled: number;
    completed: number;
    cancelled: number;
    noShow: number;
  }>;

  // By Type
  byType: Record<AppointmentType, number>;

  // By User
  byUser: Array<{
    userId: string;
    userName: string;
    scheduled: number;
    completed: number;
    noShow: number;
  }>;
}

/** Appointment lifecycle timeline */
export interface AppointmentTimeline {
  appointmentId: string;
  leadName: string;
  events: Array<{
    timestamp: string;
    eventType: 'created' | 'scheduled' | 'confirmed' | 'reminder_sent' | 'completed' | 'cancelled' | 'rescheduled' | 'no_show';
    description: string;
    userId?: string;
    userName?: string;
    metadata?: Record<string, unknown>;
  }>;
}

// ============================================================================
// ANALYTICS INSIGHTS TYPES
// ============================================================================

/** Insight severity levels */
export type InsightSeverity = 'info' | 'warning' | 'critical';

/** Insight categories */
export type InsightCategory =
  | 'performance'
  | 'engagement'
  | 'retention'
  | 'efficiency'
  | 'opportunity'
  | 'alert';

/** Actionable insight */
export interface ActionableInsight {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  description: string;
  metricId?: string;
  metricValue?: number;
  threshold?: number;
  recommendation: string;
  actionItems: Array<{
    action: string;
    priority: 'high' | 'medium' | 'low';
    impact: string;
  }>;
  relatedRecords?: Array<{
    recordType: string;
    recordId: string;
    recordName: string;
  }>;
  createdAt: string;
  validUntil?: string;
}

/** Bottleneck analysis result */
export interface BottleneckAnalysis {
  stage: string;
  conversionRate: number;
  averageTimeInStage: number;
  dropOffCount: number;
  potentialImprovement: string;
  recommendations: string[];
}

// ============================================================================
// DASHBOARD & VISUALIZATION TYPES
// ============================================================================

/** Dashboard widget configuration */
export interface AnalyticsWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'timeline' | 'funnel' | 'scorecard';
  title: string;
  size: 'small' | 'medium' | 'large' | 'full';
  position: { x: number; y: number };
  config: Record<string, unknown>;
  visible: boolean;
}

/** Conversion funnel stage */
export interface FunnelStage {
  id: string;
  name: string;
  count: number;
  percentage: number;
  conversionRate: number;  // From previous stage
  dropoffRate: number;
  avgTimeInStage?: number;
}

/** Conversion funnel */
export interface ConversionFunnel {
  id: string;
  name: string;
  stages: FunnelStage[];
  overallConversionRate: number;
  totalEntries: number;
  totalCompletions: number;
}

/** Comparative analytics result */
export interface ComparativeAnalytics {
  metric: string;
  currentValue: number;
  previousValue: number;
  change: number;
  changePercentage: number;
  trend: TrendDirection;
  context: string;
}

// ============================================================================
// EXPORT TYPES
// ============================================================================

/** Export configuration */
export interface ExportConfig {
  format: ExportFormat;
  dateRange: DateRange;
  filters?: Record<string, unknown>;
  columns?: string[];
  includeCharts?: boolean;
  includeSummary?: boolean;
}

/** Export job status */
export interface ExportJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  downloadUrl?: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
  expiresAt?: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/** Generic analytics API response */
export interface AnalyticsApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  metadata?: {
    executionTime: number;
    cached: boolean;
    lastUpdated?: string;
  };
}

/** Paginated analytics results */
export interface PaginatedAnalyticsResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================================================
// ANALYTICS EVENT TYPES (for tracking)
// ============================================================================

/** Analytics event types for tracking user/system events */
export type AnalyticsEventType =
  | 'page_view'
  | 'lead_created'
  | 'lead_updated'
  | 'lead_status_changed'
  | 'appointment_created'
  | 'appointment_updated'
  | 'appointment_completed'
  | 'appointment_cancelled'
  | 'call_logged'
  | 'sms_sent'
  | 'user_login'
  | 'user_logout'
  | 'export_generated'
  | 'report_viewed'
  | 'dashboard_filter_changed'
  | 'onboarding_started'
  | 'admin_activity';

/** Analytics event payload */
export interface AnalyticsEventPayload {
  userId: string;
  clientId?: string | null;
  leadId?: string | null;
  eventType: AnalyticsEventType;
  eventName?: string;
  metadata?: Record<string, unknown> | null;
  timestamp?: string;
}

/** Super admin analytics response (referenced in existing code) */
export interface SuperAdminAnalyticsResponse {
  summary: {
    totalLeads: number;
    totalAppointments: number;
    totalCalls: number;
    avgLeadResponseMinutes?: number;
    callsBeforeAppointmentRate?: number;
    avgCallsBeforeAppointment?: number;
    avgFirstCallToAppointmentMinutes?: number;
  };
  callHourly?: Array<{ hour: number; count: number }>;
  companyMetrics?: Array<{
    companyId: string;
    companyName: string;
    callsCount: number;
    appointmentsCount: number;
    leadsCount: number;
    avgLeadResponseMinutes?: number;
    callsBeforeAppointmentRate?: number;
    avgCallsBeforeAppointment?: number;
    avgFirstCallToAppointmentMinutes?: number;
  }>;
}
