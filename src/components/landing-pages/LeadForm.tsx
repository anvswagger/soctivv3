/**
 * Lead Capture Form for Landing Pages
 *
 * Renders dynamically based on the CTA section's formFields config.
 * Submits leads to Supabase and connects them to the CRM.
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { FormField, LandingPageTheme } from "@/types/landingPage";

interface LeadFormProps {
    formFields: FormField[];
    buttonText: string;
    clientId: string;
    productId: string | null;
    source: string;
    theme: LandingPageTheme;
    onSuccess?: () => void;
}

export function LeadForm({
    formFields,
    buttonText,
    clientId,
    productId,
    source,
    theme,
    onSuccess,
}: LeadFormProps) {
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const formData = new FormData(e.currentTarget);
        const values: Record<string, string> = {};
        formFields.forEach((f) => {
            values[f.name] = (formData.get(f.name) as string) || "";
        });

        try {
            // Extract UTM params from URL
            const params = new URLSearchParams(window.location.search);
            const utmSource = params.get("utm_source") || "";
            const utmMedium = params.get("utm_medium") || "";
            const utmCampaign = params.get("utm_campaign") || "";

            const { error: insertError } = await supabase.from("leads").insert({
                client_id: clientId,
                product_id: productId,
                first_name: values.first_name || "",
                last_name: values.last_name || "",
                phone: values.phone || "",
                email: values.email || undefined,
                source: source || "Landing Page",
                status: "new",
                notes: JSON.stringify({
                    utm_source: utmSource,
                    utm_medium: utmMedium,
                    utm_campaign: utmCampaign,
                    referrer: document.referrer || "",
                    landing_url: window.location.href,
                }),
            } as any);

            if (insertError) throw insertError;
            setSubmitted(true);
            onSuccess?.();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "حدث خطأ أثناء الإرسال. حاول مرة أخرى."
            );
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <div
                style={{
                    textAlign: "center",
                    padding: "40px 20px",
                    color: theme.primaryColor,
                }}
            >
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>✓</div>
                <h3 style={{ fontSize: "1.5rem", marginBottom: "8px" }}>
                    شكراً لك! تم استلام طلبك بنجاح
                </h3>
                <p style={{ color: theme.textColor, opacity: 0.7 }}>
                    سنتواصل معك في أقرب وقت
                </p>
            </div>
        );
    }

    const inputStyle: React.CSSProperties = {
        width: "100%",
        padding: "14px 16px",
        border: `1px solid ${theme.textColor}20`,
        borderRadius: theme.borderRadius,
        fontSize: "16px",
        fontFamily: theme.bodyFont,
        color: theme.textColor,
        backgroundColor: theme.backgroundColor,
        outline: "none",
        boxSizing: "border-box" as const,
        transition: "border-color 0.2s",
    };

    const labelStyle: React.CSSProperties = {
        display: "block",
        marginBottom: "6px",
        fontSize: "14px",
        fontWeight: 500,
        color: theme.textColor,
    };

    return (
        <form
            onSubmit={handleSubmit}
            style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                maxWidth: "480px",
                margin: "0 auto",
            }}
        >
            {formFields.map((field) => (
                <div key={field.name}>
                    <label style={labelStyle}>{field.label}</label>
                    {field.type === "textarea" ? (
                        <textarea
                            name={field.name}
                            required={field.required}
                            placeholder={field.placeholder}
                            rows={4}
                            style={{ ...inputStyle, resize: "vertical" as const }}
                        />
                    ) : (
                        <input
                            type={field.type}
                            name={field.name}
                            required={field.required}
                            placeholder={field.placeholder}
                            dir={field.type === "tel" ? "ltr" : undefined}
                            style={inputStyle}
                        />
                    )}
                </div>
            ))}

            {error && (
                <p style={{ color: "#EF4444", fontSize: "14px", textAlign: "center" }}>
                    {error}
                </p>
            )}

            <button
                type="submit"
                disabled={loading}
                style={{
                    padding: "16px 32px",
                    backgroundColor: theme.primaryColor,
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: theme.borderRadius,
                    fontSize: "18px",
                    fontWeight: 600,
                    fontFamily: theme.headingFont,
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.7 : 1,
                    transition: "opacity 0.2s, transform 0.1s",
                }}
            >
                {loading ? "جاري الإرسال..." : buttonText}
            </button>
        </form>
    );
}