# Comprehensive App Analytics System - Architecture Plan

## Executive Summary

This document outlines the architecture and implementation plan for a comprehensive analytics system that provides deep insights into client engagement, administrative activities, call tracking, and appointment scheduling. The system will support customizable reporting periods, drill-down analysis, and actionable insights through intuitive visualizations.

---

## 1. System Architecture Overview

### 1.1 Core Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ANALYTICS SYSTEM ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    ANALYTICS DASHBOARD LAYER                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │   │
│  │  │ Commitment  │  │   Admin     │  │    Call     │             │   │
│  │  │   Scorecard │  │   Activity  │  │   Tracking  │             │   │
│  │  └─────────────┘  │    Log      │  │   Analytics │             │   │
│  │  ┌─────────────┐  └─────────────┘  └─────────────┘             │   │
│  │  │ Appointment │  ┌─────────────┐  ┌─────────────┐             │   │
│  │  │  Analytics  │  │   Insights │  │   Export    │             │   │
│  │  └─────────────┘  │    Engine   │  │   Reports   │             │   │
│  │                   └─────────────┘  └─────────────┘             │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                  │                                         │
│                                  ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     ANALYTICS SERVICES LAYER                     │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │   │
│  │  │ ClientAnalytics │  │  AdminAudit     │  │   CallTracking  │ │   │
│  │  │     Service     │  │     Service     │  │     Service     │ │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘ │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │   │
│  │  │ AppointmentAna- │  │  Engagement      │  │   Export        │ │   │
│  │  │ lytics Service  │  │  Score Service  │  │   Service       │ │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                  │                                         │
│                                  ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                      DATA ACCESS LAYER                            │   │
│  │  ┌─────────────────────────────────────────────────────────────┐ │   │
│  │  │              SUPABASE DATABASE & FUNCTIONS                  │ │   │
│  │  │  - analytics_events        - call_logs                      │ │   │
│  │  │  - admin_activity_logs     - appointments                   │ │   │
│  │  │  - leads                   - profiles                       │ │   │
│  │  │  - clients                 - sms_logs                        │ │   │
│  │  └─────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA FLOW DIAGRAM                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   CLIENT INTERACTION          ADMIN ACTIVITY        CALL/APPOINTMENT│
│   ───────────────────         ──────────────        ──────────────── │
│         │                         │                        │          │
│         ▼                         ▼                        ▼          │
│   ┌───────────┐           ┌───────────────┐       ┌───────────────┐ │
│   │   Lead    │           │   Permission  │       │    Call Log   │ │
│   │ Events    │           │    Changes    │       │    Events     │ │
│   └─────┬─────┘           └───────┬───────┘       └───────┬───────┘ │
│         │                         │                       │          │
│         │                         │                       │          │
│         ▼                         ▼                       ▼          │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │                  ANALYTICS EVENT AGGREGATOR                 │  │
│   │         (Real-time event processing and aggregation)        │  │
│   └──────────────────────────┬──────────────────────────────────┘  │
│                              │                                        │
│                              ▼                                        │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │                    ANALYTICS STORAGE                        │  │
│   │  - Daily aggregations      - Trend data                    │  │
│   │  - Commitment scores       - Audit trails                  │  │
│   └──────────────────────────┬──────────────────────────────────┘  │
│                              │                                        │
│                              ▼                                        │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │                   QUERY & VISUALIZATION                    │  │
│   │  - Date range filtering   - Drill-down capability         │  │
│   │  - Export generation       - Insight generation            │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Client Engagement Analytics Module

### 2.1 Commitment Score Algorithm

The client commitment score is calculated based on multiple engagement factors:

```typescript
interface CommitmentScoreFactors {
  // Interaction Frequency (0-25 points)
  callFrequency: number;      // Calls per week
  smsFrequency: number;       // SMS exchanges per week
  appointmentAttendance: number; // Attendance rate
  
  // Response Time (0-25 points)
  avgResponseMinutes: number; // Average response time to communications
  responseRate: number;      // Percentage of communications responded to
  
  // Engagement Patterns (0-25 points)
  leadAge: number;            // Days since first contact
  statusProgression: number; // Speed through sales pipeline
  followUpRate: number;       // Rate of scheduled follow-ups kept
  
  // Quality Indicators (0-25 points)
  appointmentShowRate: number; // Show rate for scheduled appointments
  conversionProgress: number; // Movement toward sale
  communicationQuality: number; // Based on notes and interaction depth
}

interface ClientCommitmentScore {
  overallScore: number;       // 0-100
  tier: 'high' | 'medium' | 'low' | 'at_risk';
  factors: CommitmentScoreFactors;
  trend: 'improving' | 'stable' | 'declining';
  recommendations: string[];
}
```

### 2.2 Scoring Formula

```typescript
const calculateCommitmentScore = (factors: CommitmentScoreFactors): number => {
  // Interaction Frequency Score (max 25)
  const callScore = Math.min(factors.callFrequency * 5, 10);
  const smsScore = Math.min(factors.smsFrequency * 3, 10);
  const attendanceScore = factors.appointmentAttendance * 5;
  const interactionScore = callScore + smsScore + attendanceScore;
  
  // Response Time Score (max 25)
  const responseTimeScore = factors.avgResponseMinutes < 60 ? 15 : 
                            factors.avgResponseMinutes < 240 ? 10 : 5;
  const responseRateScore = factors.responseRate * 0.1;
  const responseScore = responseTimeScore + responseRateScore;
  
  // Engagement Pattern Score (max 25)
  const ageScore = Math.min(factors.leadAge / 30 * 5, 10);
  const progressionScore = factors.statusProgression * 5;
  const followUpScore = factors.followUpRate * 10;
  const engagementScore = ageScore + progressionScore + followUpScore;
  
  // Quality Indicators Score (max 25)
  const showRateScore = factors.appointmentShowRate * 15;
  const conversionScore = factors.conversionProgress * 5;
  const qualityScore = factors.communicationQuality * 5;
  const qualityIndicatorScore = showRateScore + conversionScore + qualityScore;
  
  return Math.min(100, interactionScore + responseScore + engagementScore + qualityIndicatorScore);
};
```

### 2.3 Dashboard Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                  CLIENT COMMITMENT SCORECARD                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  OVERALL COMMITMENT                                          │  │
│  │  ┌─────────────────────────────────────────────────────────┐│  │
│  │  │                    78/100                               ││  │
│  │  │  ████████████████████████████████████░░░░                ││  │
│  │  │                    HIGH ENGAGEMENT                       ││  │
│  │  └─────────────────────────────────────────────────────────┘│  │
│  │                                                              │  │
│  │  Trend: ▲ +5% from last week                                │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────┐ │
│  │  Interaction Freq  │  │  Response Time     │  │  Show Rate    │ │
│  │  ██████████░░░░    │  │  ██████████████    │  │  ██████████   │ │
│  │  8/10              │  │  12/15             │  │  9/10         │ │
│  │  Calls: 12/week    │  │  Avg: 45 min       │  │  90%          │ │
│  │  SMS: 8/week       │  │  Response: 85%     │  │  +5% vs last  │ │
│  └────────────────────┘  └────────────────────┘  └────────────────┘ │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  ENGAGEMENT TIMELINE                                         │  │
│  │  ─────────────────────────────────────────────────────────  │  │
│  │                                                              │  │
│  │  Jan 1  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░     │  │
│  │  Jan 8  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░     │  │
│  │  Jan 15 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░     │  │
│  │  Jan 22 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░     │  │
│  │                                                              │  │
│  │  ──────── Lead Created      ──────── First Contact          │  │
│  │  ◉ First Appointment        ★ Appointment Completed         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  ACTIONABLE INSIGHTS                                         │  │
│  │  ─────────────────────────────────────────────────────────  │  │
│  │  ⚠ Client hasn't responded to last 2 calls (3 days)         │  │
│  │  ✓ Follow-up appointment scheduled for tomorrow               │  │
│  │  📈 Response time improved by 15% this week                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Admin Activity Monitoring Module

### 3.1 Activity Log Types

```typescript
type AdminActivityType = 
  | 'user_permission_change'
  | 'role_assignment'
  | 'data_modification'
  | 'system_config_change'
  | 'bulk_operation'
  | 'report_generation'
  | 'settings_update'
  | 'user_suspension'
  | 'data_export'
  | 'api_key_generation';

interface AdminActivityLog {
  id: string;
  admin_user_id: string;
  admin_name: string;
  activity_type: AdminActivityType;
  target_user_id?: string;
  target_entity_type?: string;
  target_entity_id?: string;
  previous_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  ip_address: string;
  user_agent: string;
  timestamp: string;
  status: 'success' | 'failure';
  error_message?: string;
  metadata?: Record<string, unknown>;
}
```

### 3.2 Admin Dashboard View

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ADMIN ACTIVITY MONITORING                         │
├─────────────────────────────────────────────────────────────────────┤
│  Date Range: [Last 30 Days ▼]    User: [All ▼]    Action: [All ▼]   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  ACTIVITY SUMMARY                                           │  │
│  │  ─────────────────────────────────────────────────────────  │  │
│  │                                                              │  │
│  │  Total Actions: 1,247    │    Permission Changes: 89        │  │
│  │  Unique Admins: 12       │    Data Modifications: 456      │  │
│  │  Failed Attempts: 3       │    Config Changes: 12           │  │
│  │                                                              │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  ACTIVITY VOLUME BY DAY                               │  │  │
│  │  │                                                        │  │  │
│  │  │  60 ▓▓▓▓▓▓░░                                           │  │  │
│  │  │  50 ▓▓▓▓▓▓▓▓░░░░                                      │  │  │
│  │  │  40 ▓▓▓▓▓▓▓▓▓▓░░░░                                     │  │  │
│  │  │  30 ▓▓▓▓▓▓▓▓▓▓▓▓░░░░                                    │  │  │
│  │  │  20 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░                                   │  │  │
│  │  │  10 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    │  │  │
│  │  │   0 ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔   │  │  │
│  │  │      Mon  Tue  Wed  Thu  Fri  Sat  Sun                  │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  RECENT ACTIVITY LOG                                        │  │
│  │  ─────────────────────────────────────────────────────────  │  │
│  │                                                              │  │
│  │  ◉ 2024-01-15 14:32  Ahmed M.  Changed role: admin → super │  │
│  │  ◉ 2024-01-15 14:28  Sara K.   Updated client settings      │  │
│  │  ◉ 2024-01-15 14:15  Omar H.   Exported lead data (1,234)   │  │
│  │  ◉ 2024-01-15 13:45  Fatima A. Modified lead #56789         │  │
│  │  ◉ 2024-01-15 13:30  Ahmed M.  Changed user permissions     │  │
│  │  ◉ 2024-01-15 12:15  Sara K.   System config updated        │  │
│  │                                                              │  │
│  │  [View All Activity Logs →]                                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Call Tracking Module

### 4.1 Call Data Structure

```typescript
interface CallTrackingRecord {
  id: string;
  call_id: string;
  lead_id: string;
  lead_name: string;
  client_id: string;
  assigned_user_id: string;
  assigned_user_name: string;
  
  // Call Details
  call_type: 'incoming' | 'outgoing';
  call_direction: 'internal' | 'external';
  phone_number: string;
  
  // Timing
  started_at: string;
  answered_at?: string;
  ended_at: string;
  duration_seconds: number;
  talk_time_seconds: number;
  ring_time_seconds: number;
  
  // Outcome
  call_outcome: 'connected' | 'voicemail' | 'no_answer' | 'busy' | 'failed';
  disposition_code: string;
  notes?: string;
  
  // Follow-up
  follow_up_required: boolean;
  follow_up_date?: string;
  follow_up_notes?: string;
  
  // Recording (if applicable)
  recording_url?: string;
  recording_duration?: number;
}

interface CallAnalytics {
  total_calls: number;
  incoming_calls: number;
  outgoing_calls: number;
  connected_calls: number;
  avg_duration: number;
  avg_talk_time: number;
  avg_response_time: number;
  call_outcome_distribution: Record<string, number>;
  hourly_distribution: Record<number, number>;
  daily_trend: Array<{ date: string; calls: number; connected: number }>;
}
```

### 4.2 Call Analytics Dashboard

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CALL TRACKING ANALYTICS                         │
├─────────────────────────────────────────────────────────────────────┤
│  Period: [Last 30 Days ▼]     User: [All ▼]     Lead Status: [All] │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  KEY METRICS                                                  │  │
│  │  ────────────────────────────────────────────────────────────  │  │
│  │                                                               │  │
│  │  Total Calls: 2,847    │  Connected: 2,124 (74.5%)            │  │
│  │  Avg Duration: 4:32    │  Avg Talk Time: 3:45                │  │
│  │  Response Time: 1:23    │  No Answer: 456 (16%)               │  │
│  │                                                               │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌────────────────────────────┐  ┌────────────────────────────┐   │
│  │  HOURLY DISTRIBUTION        │  │  DAILY TREND                │   │
│  │  ────────────────────────   │  │  ────────────────────────   │   │
│  │                             │  │                             │   │
│  │  08:00 ████████████ 45      │  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 120     │   │
│  │  09:00 █████████████████ 78  │  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 115     │   │
│  │  10:00 ████████████████████ 98 │  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 132  │   │
│  │  11:00 ██████████████████ 89  │  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 128    │   │
│  │  12:00 ██████████████ 67      │  │  ▓▓▓▓▓▓▓▓▓▓▓▓