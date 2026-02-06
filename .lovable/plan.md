

## Fix: Build Error + Appointment Creation Error from Leads Page

### Problem 1: Build Error in `callLogsService.ts`

**File:** `src/services/callLogsService.ts`, line 90

The `logs` variable is typed as `any[]` (because the Supabase client is cast as `any` on line 28). When calling `logs.reduce<Record<string, number>>(...)`, TypeScript rejects the generic type argument on an untyped function call.

**Fix:** Remove the generic type argument from `reduce` and use a type assertion instead:
```typescript
const outcomeCounts = logs.reduce((acc: Record<string, number>, curr) => {
```

---

### Problem 2: Error Message When Creating Appointments from Leads Page

**Root Cause:** When an appointment is created, the `appointmentsService.createAppointment` method sends a confirmation SMS using `template_id: 'appointment-confirmation'`. The edge function logs show:

```
Ersaal API error: { message: "Template not found" }
```

The template `appointment-confirmation` does not exist in the Ersaal SMS provider. This causes the SMS to fail, a failure notification is created, and the user sees a "failed to send message" error notification -- making it seem like the appointment creation itself failed (even though it was actually created).

**Fix:** Change the SMS confirmation to use a plain text message instead of a non-existent template. This way the confirmation SMS will be sent directly without requiring a pre-configured template on the Ersaal platform.

**File:** `src/services/appointmentsService.ts`

Change the SMS invocation to remove `template_id` so it uses the direct message endpoint:
```typescript
await supabase.functions.invoke('send-sms', {
    body: {
        lead_id: data.lead_id,
        appointment_id: data.id,
        phone_number: leadData.phone,
        message: 'تم تأكيد موعدك بنجاح.'
    }
});
```

---

### Summary of Changes

| File | Change |
|------|--------|
| `src/services/callLogsService.ts` | Fix TypeScript error: move generic type to parameter annotation |
| `src/services/appointmentsService.ts` | Remove `template_id: 'appointment-confirmation'` from SMS call to use direct message instead |

Both changes are minimal and targeted. The appointment will still be created and the SMS will now send successfully using the plain text endpoint.

