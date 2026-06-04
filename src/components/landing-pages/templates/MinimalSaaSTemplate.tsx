/**
 * Minimal SaaS Template
 *
 * Clean, modern design with feature cards,
 * minimal color usage, and a focused CTA.
 * Perfect for software and digital products.
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

export function MinimalSaaSTemplate({
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
            {/* ─── Hero: Minimal Centered ─── */}
            <section
                style={{
                    padding: "100px 24px 80px",
                    textAlign: "center",
                    position: "relative" as const,
                    overflow: "hidden",
                }}
            >
                {/* Decorative gradient orb */}
                <div
                    style={{
                        position: "absolute",
                        top: "-200px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: "600px",
                        height: "600px",
                        borderRadius: "50%",
                        background: `radial-gradient(circle, ${theme.primaryColor}10 0%, transparent 70%)`,
                        pointerEvents: "none",
                    }}
                />
                <div style={{ position: "relative", maxWidth: "700px", margin: "0 auto" }}>
                    <h1
                        style={{
                            fontSize: "clamp(2.2rem, 6vw, 3.8rem)",
                            fontFamily: theme.headingFont,
                            fontWeight: 800,
                            lineHeight: 1.15,
                            marginBottom: "24px",
                            letterSpacing: "-0.02em",
                        }}
                    >
                        {hero.headline}
                    </h1>
                    <p
                        style={{
                            fontSize: "clamp(1rem, 2.5vw, 1.2rem)",
                            lineHeight: 1.7,
                            opacity: 0.6,
                            maxWidth: "550px",
                            margin: "0 auto 40px",
                        }}
                    >
                        {hero.subheadline}
                    </p>
                    <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
                        <a
                            href="#cta"
                            style={{
                                display: "inline-block",
                                padding: "16px 40px",
                                backgroundColor: theme.primaryColor,
                                color: "#FFFFFF",
                                fontWeight: 600,
                                fontSize: "1rem",
                                borderRadius: theme.borderRadius,
                                textDecoration: "none",
                                transition: "transform 0.15s",
                            }}
                        >
                            {hero.ctaText}
                        </a>
                    </div>
                </div>
            </section>

            {/* ─── Features: Card Grid ─── */}
            <section style={{ padding: "80px 24px", maxWidth: "1000px", margin: "0 auto" }}>
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                        gap: "24px",
                    }}
                >
                    {features.map((feature, idx) => (
                        <div
                            key={idx}
                            style={{
                                padding: "36px 28px",
                                borderRadius: theme.borderRadius,
                                border: `1px solid ${theme.textColor}0D`,
                                transition: "border-color 0.2s, box-shadow 0.2s",
                            }}
                        >
                            <div
                                style={{
                                    fontSize: "1.8rem",
                                    marginBottom: "20px",
                                    width: "48px",
                                    height: "48px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    backgroundColor: `${theme.primaryColor}0A`,
                                    borderRadius: "12px",
                                }}
                            >
                                {feature.icon}
                            </div>
                            <h3
                                style={{
                                    fontSize: "1.1rem",
                                    fontFamily: theme.headingFont,
                                    fontWeight: 600,
                                    marginBottom: "10px",
                                }}
                            >
                                {feature.title}
                            </h3>
                            <p style={{ lineHeight: 1.7, opacity: 0.6, fontSize: "0.95rem" }}>
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ─── Stats: Inline ─── */}
            {proofSection.stats.length > 0 && (
                <section style={{ padding: "48px 24px" }}>
                    <div
                        style={{
                            display: "flex",
                            flexWrap: "wrap",
                            justifyContent: "center",
                            gap: "64px",
                            maxWidth: "800px",
                            margin: "0 auto",
                        }}
                    >
                        {proofSection.stats.map((stat, idx) => (
                            <div key={idx} style={{ textAlign: "center" }}>
                                <div
                                    style={{
                                        fontSize: "2.5rem",
                                        fontFamily: theme.headingFont,
                                        fontWeight: 800,
                                        color: theme.primaryColor,
                                        letterSpacing: "-0.02em",
                                    }}
                                >
                                    {stat.value}
                                </div>
                                <div style={{ fontSize: "0.85rem", opacity: 0.5, marginTop: "4px" }}>
                                    {stat.label}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ─── Testimonials: Minimal ─── */}
            {proofSection.testimonials.length > 0 && (
                <section style={{ padding: "60px 24px", maxWidth: "800px", margin: "0 auto" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
                        {proofSection.testimonials.map((t, idx) => (
                            <div
                                key={idx}
                                style={{
                                    padding: "0 24px",
                                    borderRight: `3px solid ${theme.primaryColor}`,
                                    textAlign: "right",
                                }}
                            >
                                <p
                                    style={{
                                        fontSize: "1.05rem",
                                        lineHeight: 1.8,
                                        marginBottom: "16px",
                                        opacity: 0.8,
                                    }}
                                >
                                    "{t.quote}"
                                </p>
                                <div>
                                    <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                                        {t.author}
                                    </span>
                                    <span style={{ opacity: 0.4, margin: "0 8px" }}>—</span>
                                    <span style={{ opacity: 0.5, fontSize: "0.85rem" }}>
                                        {t.role}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ─── Guarantees ─── */}
            {proofSection.guarantees.length > 0 && (
                <section style={{ padding: "40px 24px" }}>
                    <div
                        style={{
                            display: "flex",
                            flexWrap: "wrap",
                            justifyContent: "center",
                            gap: "24px",
                            maxWidth: "800px",
                            margin: "0 auto",
                        }}
                    >
                        {proofSection.guarantees.map((g, idx) => (
                            <div
                                key={idx}
                                style={{
                                    padding: "10px 20px",
                                    borderRadius: "100px",
                                    border: `1px solid ${theme.textColor}15`,
                                    fontSize: "0.9rem",
                                    opacity: 0.7,
                                }}
                            >
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
                    padding: "100px 24px",
                    textAlign: "center",
                    position: "relative" as const,
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        bottom: "-200px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: "500px",
                        height: "500px",
                        borderRadius: "50%",
                        background: `radial-gradient(circle, ${theme.accentColor}08 0%, transparent 70%)`,
                        pointerEvents: "none",
                    }}
                />
                <div style={{ position: "relative", maxWidth: "500px", margin: "0 auto" }}>
                    <h2
                        style={{
                            fontSize: "clamp(1.5rem, 4vw, 2.2rem)",
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
                            opacity: 0.55,
                            marginBottom: "40px",
                        }}
                    >
                        {cta.subheadline}
                    </p>
                    <LeadForm
                        formFields={cta.formFields}
                        buttonText={cta.buttonText}
                        clientId={clientId}
                        productId={productId}
                        source="Landing Page - Minimal SaaS"
                        theme={theme}
                    />
                </div>
            </section>

            {/* ─── Footer ─── */}
            <footer
                style={{
                    padding: "32px 24px",
                    textAlign: "center",
                    fontSize: "0.8rem",
                    opacity: 0.3,
                }}
            >
                © {new Date().getFullYear()} {content.seo.title}
            </footer>
        </div>
    );
}