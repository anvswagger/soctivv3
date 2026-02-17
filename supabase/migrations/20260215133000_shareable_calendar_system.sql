-- Shareable & Embeddable Calendar System
-- Migration: Create calendar configuration and availability tables

-- 1. Calendar Configuration Table
CREATE TABLE IF NOT EXISTS public.calendar_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    
    -- Branding
    logo_url TEXT,
    company_name TEXT,
    primary_color TEXT DEFAULT '#0f172a',
    secondary_color TEXT DEFAULT '#ffffff',
    
    -- Display Settings
    calendar_title TEXT DEFAULT 'احجز موعد',
    description TEXT,
    show_company_logo BOOLEAN DEFAULT true,
    timezone TEXT DEFAULT 'Africa/Tripoli',
    
    -- Booking Settings
    allow_cancellation BOOLEAN DEFAULT true,
    require_confirmation BOOLEAN DEFAULT false, -- Auto-confirm as per user request
    show_location BOOLEAN DEFAULT true,
    custom_location TEXT,
    buffer_minutes INTEGER DEFAULT 15,
    
    -- Sharing
    share_token UUID UNIQUE DEFAULT gen_random_uuid(),
    is_public BOOLEAN DEFAULT false,
    embed_enabled BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Availability Rules Table
CREATE TABLE IF NOT EXISTS public.availability_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_config_id UUID REFERENCES public.calendar_configs(id) ON DELETE CASCADE,
    
    -- Day of week (0=Sunday, 6=Saturday)
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
    
    -- Time range
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    
    -- Is this slot available or blocked?
    is_available BOOLEAN DEFAULT true,
    
    -- Specific date (optional, for exceptions)
    specific_date DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Booking Types Table (Service Types)
CREATE TABLE IF NOT EXISTS public.booking_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_config_id UUID REFERENCES public.calendar_configs(id) ON DELETE CASCADE,
    
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Booking Slot Locks (to prevent double-booking)
CREATE TABLE IF NOT EXISTS public.booking_slot_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_config_id UUID REFERENCES public.calendar_configs(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    lock_token UUID NOT NULL DEFAULT gen_random_uuid(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Row Level Security Policies

-- Calendar Configs: Users can only access their own
ALTER TABLE public.calendar_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own calendar config"
ON public.calendar_configs FOR ALL
USING (
    client_id IN (
        SELECT id FROM public.clients 
        WHERE user_id = auth.uid()
    )
);

-- Availability Rules: Users can only access their own
ALTER TABLE public.availability_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own availability rules"
ON public.availability_rules FOR ALL
USING (
    calendar_config_id IN (
        SELECT id FROM public.calendar_configs 
        WHERE client_id IN (
            SELECT id FROM public.clients 
            WHERE user_id = auth.uid()
        )
    )
);

-- Booking Types: Users can only access their own
ALTER TABLE public.booking_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own booking types"
ON public.booking_types FOR ALL
USING (
    calendar_config_id IN (
        SELECT id FROM public.calendar_configs 
        WHERE client_id IN (
            SELECT id FROM public.clients 
            WHERE user_id = auth.uid()
        )
    )
);

-- Public read access for calendar configs (by share token)
CREATE POLICY "Public can read calendar config by token"
ON public.calendar_configs FOR SELECT
USING (is_public = true);

-- Public read access for availability (by calendar config)
CREATE POLICY "Public can read availability rules"
ON public.availability_rules FOR SELECT
USING (
    calendar_config_id IN (
        SELECT id FROM public.calendar_configs 
        WHERE is_public = true
    )
);

-- Public read access for booking types
CREATE POLICY "Public can read booking types"
ON public.booking_types FOR SELECT
USING (
    calendar_config_id IN (
        SELECT id FROM public.calendar_configs 
        WHERE is_public = true
    )
    AND is_active = true
);

-- Booking slot locks: Allow booking function to manage locks
ALTER TABLE public.booking_slot_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow insert for booking locks"
ON public.booking_slot_locks FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow select for booking locks"
ON public.booking_slot_locks FOR SELECT
USING (true);

CREATE POLICY "Allow delete for booking locks"
ON public.booking_slot_locks FOR DELETE
USING (true);

-- Indexes for performance
CREATE INDEX idx_availability_by_config ON public.availability_rules(calendar_config_id);
CREATE INDEX idx_availability_by_date ON public.availability_rules(specific_date);
CREATE INDEX idx_booking_types_by_config ON public.booking_types(calendar_config_id);
CREATE INDEX idx_slot_locks_by_time ON public.booking_slot_locks(scheduled_at, calendar_config_id);
CREATE INDEX idx_calendar_configs_share_token ON public.calendar_configs(share_token) WHERE is_public = true;

-- Function to clean up expired locks
CREATE OR REPLACE FUNCTION cleanup_expired_locks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.booking_slot_locks 
    WHERE expires_at < NOW();
END;
$$;

-- Trigger to auto-create calendar config for new clients
CREATE OR REPLACE FUNCTION create_default_calendar_config()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    config_id UUID;
BEGIN
    -- Create default calendar config
    INSERT INTO public.calendar_configs (client_id, company_name)
    VALUES (NEW.id, COALESCE(NEW.company_name, 'مكتبي'))
    RETURNING id INTO config_id;
    
    -- Create default availability rules (9 AM - 5 PM, Sunday to Thursday)
    INSERT INTO public.availability_rules (calendar_config_id, day_of_week, start_time, end_time, is_available)
    VALUES 
        (config_id, 0, '09:00', '17:00', false),  -- Sunday - blocked
        (config_id, 1, '09:00', '17:00', true),   -- Monday
        (config_id, 2, '09:00', '17:00', true),   -- Tuesday
        (config_id, 3, '09:00', '17:00', true),   -- Wednesday
        (config_id, 4, '09:00', '17:00', true),   -- Thursday
        (config_id, 5, '09:00', '17:00', true),   -- Friday
        (config_id, 6, '09:00', '17:00', false); -- Saturday - blocked
    
    -- Create default booking type
    INSERT INTO public.booking_types (calendar_config_id, name_ar, name_en, duration_minutes)
    VALUES (config_id, 'استشارة', 'Consultation', 30);
    
    RETURN NEW;
END;
$$;

-- Apply trigger to existing clients (optional - for new clients it's automatic)
-- This will be triggered when a new client is created

COMMENT ON TABLE public.calendar_configs IS 'Configuration for shareable/embeddable calendars';
COMMENT ON TABLE public.availability_rules IS 'Weekly availability and blocked dates for calendars';
COMMENT ON TABLE public.booking_types IS 'Service types offered in the booking calendar';
COMMENT ON TABLE public.booking_slot_locks IS 'Temporary locks on time slots to prevent double-booking';
