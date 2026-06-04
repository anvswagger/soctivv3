/**
 * Service Business Template
 *
 * Trust-focused layout with testimonials, stats bar,
 * and service-oriented CTA. Ideal for agencies and service providers.
 */
import type {
    LandingPageContent,
    LandingPageTheme,
} from "@/types/landingPage";
import { LeadForm } from "../LeadForm";

interface TemplateProps {
    content: LandingPageContent;
    theme: LandingPageTheme;
    clientId: string;
    productId: string | null;
}

export function ServiceBusinessTemplate({
    content,
    theme,
    clientId,
    productId,
}: TemplateProps) {
    const { hero, features, proofSection, cta } = content;

    return (
        <div
            style={{
                fontFamily: theme.bodyFont,
                color: theme.textColor,
                backgroundColor: theme.backgroundColor,
                margin: 0,
                padding: 0,
                direction: "rtl",
            }}
        >
            {/* ─── Hero: Split Layout ─── */}
            <section
                style={{
                    padding: "80px 24px",
                    backgroundColor: theme.backgroundColor,
                }}
            >
                <div
                    style={{
                        maxWidth: "900px",
                        margin: "0 auto",
                        textAlign: "center",
                    }}
                >
                    <div
                        style={{
                            display: "inline-block",
                            padding: "8px 20px",
                            backgroundColor: `${theme.primaryColor}12`,
                            color: theme.primaryColor,
                            borderRadius: "100px",
                            fontSize: "0.9rem",
                            fontWeight: 600,
                            marginBottom: "24px",
                        }}
                    >
                        خدمة موثوقة ومتخصصة
                    </div>
                    <h1
                        style={{
                            fontSize: "clamp(2rem, 5vw, 3.2rem)",
                            fontFamily: theme.headingFont,
                            fontWeight: 800,
                            lineHeight: 1.25,
                            marginBottom: "20px",
                            color: theme.textColor,
                        }}
                    >
                        {hero.headline}
                    </h1>
                    <p
                        style={{
                            fontSize: "clamp(1rem, 2.5vw, 1.25rem)",
                            lineHeight: 1.7,
                            opacity: 0.7,
                            maxWidth: "650px",
                            margin: "0 auto 36px auto",
                        }}
                    >
                        {hero.subheadline}
                    </p>
                    <a
                        href="#cta"
                        style={{
                            display: "inline-block",
                            padding: "16px 44px",
                            backgroundColor: theme.primaryColor,
                            color: "#FFFFFF",
                            fontWeight: 700,
                            fontSize: "1.1rem",
                            borderRadius: theme.borderRadius,
                            textDecoration: "none",
                            boxShadow: `0 4px 12px ${theme.primaryColor}30`,
                        }}
                    >
                        {hero.ctaText}
                    </a>
                </div>
            </section>

            {/* ─── Stats Bar ─── */}
            {proofSection.stats.length > 0 && (
                <section
                    style={{
                        padding: "40px 24px",
                        backgroundColor: theme.primaryColor,
                        color: "#FFFFFF",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            flexWrap: "wrap",
                            justifyContent: "center",
                            gap: "48px",
                            maxWidth: "900px",
                            margin: "0 auto",
                        }}
                    >
                        {proofSection.stats.map((stat, idx) => (
                            <div key={idx} style={{ textAlign: "center" }}>
                                <div
                                    style={{
                                        fontSize: "2.2rem",
                                        fontFamily: theme.headingFont,
                                        fontWeight: 800,
                                    }}
                                >
                                    {stat.value}
                                </div>
                                <div style={{ fontSize: "0.9rem", opacity: 0.85 }}>
                                    {stat.label}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ─── Services/Features ─── */}
            <section style={{ padding: "80px 24px", maxWidth: "1000px", margin: "0 auto" }}>
                <h2
                    style={{
                        fontSize: "2rem",
                        fontFamily: theme.headingFont,
                        fontWeight: 700,
                        textAlign: "center",
                        marginBottom: "48px",
                    }}
                >
                    خدماتنا
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                    {features.map((feature, idx) => (
                        <div
                            key={idx}
                            style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: "20px",
                                padding: "28px 32px",
                                borderRadius: theme.borderRadius,
                                backgroundColor: "#FFFFFF",
                                border: `1px solid ${theme.textColor}10`,
                                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                            }}
                        >
                            <div
                                style={{
                                    fontSize: "2rem",
                                    flexShrink: 0,
                                    width: "56px",
                                    height: "56px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    backgroundColor: `${theme.primaryColor}10`,
                                    borderRadius: theme.borderRadius,
                                }}
                            >
                                {feature.icon}
                            </div>
                            <div>
                                <h3
                                    style={{
                                        fontSize: "1.15rem",
                                        fontFamily: theme.headingFont,
                                        fontWeight: 600,
                                        marginBottom: "8px",
                                    }}
                                >
                                    {feature.title}
                                </h3>
                                <p style={{ lineHeight: 1.7, opacity: 0.75 }}>
                                    {feature.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ─── Testimonials ─── */}
            {proofSection.testimonials.length > 0 && (
                <section
                    style={{
                        padding: "80px 24px",
                        backgroundColor: `${theme.primaryColor}05`,
                    }}
                >
                    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
                        <h2
                            style={{
                                fontSize: "2rem",
                                fontFamily: theme.headingFont,
                                fontWeight: 700,
                                textAlign: "center",
                                marginBottom: "48px",
                            }}
                        >
                            آراء عملائنا
                        </h2>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                                gap: "24px",
                            }}
                        >
                            {proofSection.testimonials.map((t, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        padding: "32px",
                                        borderRadius: theme.borderRadius,
                                        backgroundColor: "#FFFFFF",
                                        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: "1.5rem",
                                            color: theme.primaryColor,
                                            marginBottom: "12px",
                                        }}
                                    >
                                        ★★★★★
                                    </div>
                                    <p
                                        style={{
                                            fontSize: "0.95rem",
                                            lineHeight: 1.8,
                                            marginBottom: "20px",
                                            fontStyle: "italic",
                                            opacity: 0.85,
                                        }}
                                    >
                                        "{t.quote}"
                                    </p>
                                    <div
                                        style={{
                                            borderTop: `1px solid ${theme.textColor}10`,
                                            paddingTop: "16px",
                                        }}
                                    >
                                        <div style={{ fontWeight: 600 }}>{t.author}</div>
                                        <div style={{ fontSize: "0.85rem", opacity: 0.5 }}>
                                            {t.role}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ─── Guarantees ─── */}
            {proofSection.guarantees.length > 0 && (
                <section style={{ padding: "48px 24px" }}>
                    <div
                        style={{
                            display: "flex",
                            flexWrap: "wrap",
                            justifyContent: "center",
                            gap: "32px",
                            maxWidth: "900px",
                            margin: "0 auto",
                        }}
                    >
                        {proofSection.guarantees.map((g, idx) => (
                            <div
                                key={idx}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "10px",
                                    fontSize: "0.95rem",
                                    fontWeight: 500,
                                }}
                            >
                                <div
                                    style={{
                                        width: "32px",
                                        height: "32px",
                                        borderRadius: "50%",
                                        backgroundColor: theme.primaryColor,
                                        color: "#FFFFFF",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "0.85rem",
                                        flexShrink: 0,
                                    }}
                                >
                                    ✓
                                </div>
                                {g}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ─── CTA + Lead Form ─── */}
            <section
                id="cta"
                style={{
                    padding: "80px 24px",
                    backgroundColor: theme.backgroundColor,
                    textAlign: "center",
                }}
            >
                <div
                    style={{
                        maxWidth: "600px",
                        margin: "0 auto",
                        padding: "48px",
                        borderRadius: theme.borderRadius,
                        backgroundColor: "#FFFFFF",
                        boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
                    }}
                >
                    <h2
                        style={{
                            fontSize: "1.8rem",
                            fontFamily: theme.headingFont,
                            fontWeight: 700,
                            marginBottom: "12px",
                        }}
                    >
                        {cta.headline}
                    </h2>
                    <p
                        style={{
                            fontSize: "1.05rem",
                            opacity: 0.65,
                            marginBottom: "36px",
                        }}
                    >
                        {cta.subheadline}
                    </p>
                    <LeadForm
                        formFields={cta.formFields}
                        buttonText={cta.buttonText}
                        clientId={clientId}
                        productId={productId}
                        source="Landing Page - Service Business"
                        theme={theme}
                    />
                </div>
            </section>

            {/* ─── Footer ─── */}
            <footer
                style={{
                    padding: "24px",
                    textAlign: "center",
                    fontSize: "0.85rem",
                    opacity: 0.4,
                }}
            >
                © {new Date().getFullYear()} {content.seo.title}
            </footer>
        </div>
    );
}