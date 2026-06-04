/**
 * Modern Product Template
 *
 * Bold hero with gradient, feature grid with icons,
 * social proof section, and final CTA with form.
 * Designed for physical products and ecommerce.
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

export function ModernProductTemplate({
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
            {/* ─── Hero Section ─── */}
            <section
                style={{
                    background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})`,
                    color: "#FFFFFF",
                    padding: "80px 24px",
                    textAlign: "center",
                }}
            >
                <div style={{ maxWidth: "800px", margin: "0 auto" }}>
                    <h1
                        style={{
                            fontSize: "clamp(2rem, 5vw, 3.5rem)",
                            fontFamily: theme.headingFont,
                            fontWeight: 800,
                            lineHeight: 1.2,
                            marginBottom: "20px",
                            margin: "0 0 20px 0",
                        }}
                    >
                        {hero.headline}
                    </h1>
                    <p
                        style={{
                            fontSize: "clamp(1rem, 2.5vw, 1.35rem)",
                            opacity: 0.9,
                            lineHeight: 1.6,
                            marginBottom: "36px",
                            maxWidth: "600px",
                            marginLeft: "auto",
                            marginRight: "auto",
                        }}
                    >
                        {hero.subheadline}
                    </p>
                    <a
                        href="#cta"
                        style={{
                            display: "inline-block",
                            padding: "18px 48px",
                            backgroundColor: theme.accentColor,
                            color: theme.textColor,
                            fontWeight: 700,
                            fontSize: "1.15rem",
                            borderRadius: theme.borderRadius,
                            textDecoration: "none",
                            transition: "transform 0.2s, box-shadow 0.2s",
                            boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
                        }}
                    >
                        {hero.ctaText}
                    </a>
                </div>
            </section>

            {/* ─── Features Grid ─── */}
            <section style={{ padding: "80px 24px", maxWidth: "1100px", margin: "0 auto" }}>
                <h2
                    style={{
                        fontSize: "2rem",
                        fontFamily: theme.headingFont,
                        fontWeight: 700,
                        textAlign: "center",
                        marginBottom: "48px",
                        color: theme.textColor,
                    }}
                >
                    لماذا تختارنا؟
                </h2>
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                        gap: "32px",
                    }}
                >
                    {features.map((feature, idx) => (
                        <div
                            key={idx}
                            style={{
                                padding: "32px",
                                borderRadius: theme.borderRadius,
                                backgroundColor: `${theme.primaryColor}08`,
                                border: `1px solid ${theme.primaryColor}15`,
                                textAlign: "center",
                            }}
                        >
                            <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>
                                {feature.icon}
                            </div>
                            <h3
                                style={{
                                    fontSize: "1.2rem",
                                    fontFamily: theme.headingFont,
                                    fontWeight: 600,
                                    marginBottom: "12px",
                                    color: theme.primaryColor,
                                }}
                            >
                                {feature.title}
                            </h3>
                            <p style={{ lineHeight: 1.7, opacity: 0.8 }}>
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ─── Social Proof: Stats ─── */}
            {proofSection.stats.length > 0 && (
                <section
                    style={{
                        padding: "60px 24px",
                        backgroundColor: `${theme.primaryColor}06`,
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
                                        fontSize: "2.5rem",
                                        fontFamily: theme.headingFont,
                                        fontWeight: 800,
                                        color: theme.primaryColor,
                                    }}
                                >
                                    {stat.value}
                                </div>
                                <div style={{ fontSize: "0.95rem", opacity: 0.7, marginTop: "4px" }}>
                                    {stat.label}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ─── Testimonials ─── */}
            {proofSection.testimonials.length > 0 && (
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
                        ماذا يقول عملاؤنا
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
                                    padding: "28px",
                                    borderRadius: theme.borderRadius,
                                    border: `1px solid ${theme.textColor}15`,
                                    backgroundColor: theme.backgroundColor,
                                }}
                            >
                                <p
                                    style={{
                                        fontSize: "1rem",
                                        lineHeight: 1.8,
                                        marginBottom: "20px",
                                        fontStyle: "italic",
                                        opacity: 0.9,
                                    }}
                                >
                                    "{t.quote}"
                                </p>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                                        {t.author}
                                    </div>
                                    <div style={{ fontSize: "0.85rem", opacity: 0.6 }}>
                                        {t.role}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ─── Guarantees ─── */}
            {proofSection.guarantees.length > 0 && (
                <section style={{ padding: "48px 24px", textAlign: "center" }}>
                    <div
                        style={{
                            display: "flex",
                            flexWrap: "wrap",
                            justifyContent: "center",
                            gap: "24px",
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
                                    gap: "8px",
                                    padding: "12px 20px",
                                    backgroundColor: `${theme.accentColor}15`,
                                    borderRadius: theme.borderRadius,
                                    fontSize: "0.95rem",
                                    fontWeight: 500,
                                }}
                            >
                                <span>✓</span>
                                <span>{g}</span>
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
                    background: `linear-gradient(135deg, ${theme.secondaryColor}, ${theme.primaryColor})`,
                    color: "#FFFFFF",
                    textAlign: "center",
                }}
            >
                <div style={{ maxWidth: "700px", margin: "0 auto" }}>
                    <h2
                        style={{
                            fontSize: "clamp(1.5rem, 4vw, 2.5rem)",
                            fontFamily: theme.headingFont,
                            fontWeight: 700,
                            marginBottom: "16px",
                        }}
                    >
                        {cta.headline}
                    </h2>
                    <p style={{ fontSize: "1.15rem", opacity: 0.9, marginBottom: "40px" }}>
                        {cta.subheadline}
                    </p>
                    <LeadForm
                        formFields={cta.formFields}
                        buttonText={cta.buttonText}
                        clientId={clientId}
                        productId={productId}
                        source="Landing Page - Modern Product"
                        theme={{
                            ...theme,
                            primaryColor: "#FFFFFF",
                            textColor: theme.primaryColor,
                            backgroundColor: "transparent",
                        }}
                    />
                </div>
            </section>

            {/* ─── Footer ─── */}
            <footer
                style={{
                    padding: "24px",
                    textAlign: "center",
                    fontSize: "0.85rem",
                    opacity: 0.5,
                }}
            >
                © {new Date().getFullYear()} {content.seo.title}
            </footer>
        </div>
    );
}