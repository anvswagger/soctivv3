/**
 * Public Landing Page
 *
 * Renders a published landing page based on subdomain or custom domain.
 * Uses the template system to render structured content.
 * Handles lead form submission to CRM.
 */
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getTemplateComponent } from "@/components/landing-pages/TemplateRegistry";
import type { LandingPageContent, LandingPageTheme } from "@/types/landingPage";

interface PublicLandingPageProps {
  hostname: string;
}

export function PublicLandingPage({ hostname }: PublicLandingPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageData, setPageData] = useState<any>(null);
  const [content, setContent] = useState<LandingPageContent | null>(null);
  const [theme, setTheme] = useState<LandingPageTheme | null>(null);

  useEffect(() => {
    async function fetchLandingPage() {
      try {
        setLoading(true);

        // Extract subdomain or check custom domain
        let isSubdomain = false;
        let domainValue = hostname;

        if (hostname.endsWith(".soctiv.ly")) {
          isSubdomain = true;
          domainValue = hostname.replace(".soctiv.ly", "");
        } else if (hostname.endsWith(".localhost")) {
          isSubdomain = true;
          domainValue = hostname.replace(".localhost", "");
        }

        const query = (supabase as any)
          .from("landing_pages")
          .select("*, products(*), clients(*)")
          .eq("status", "published");

        if (isSubdomain) {
          query.eq("subdomain", domainValue);
        } else {
          query.eq("custom_domain", domainValue);
        }

        const { data, error: fetchError } = await query.single();

        if (fetchError || !data) {
          setError("Landing page not found or is not published yet.");
          return;
        }

        setPageData(data);
        setContent(data.content_data as LandingPageContent);
        setTheme(data.theme_config as LandingPageTheme);

        // Inject tracking pixel
        if (data.tracking_pixel) {
          try {
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = data.tracking_pixel;
            Array.from(tempDiv.children).forEach((child) => {
              document.head.appendChild(child.cloneNode(true));
            });
          } catch (e) {
            console.error("Error injecting tracking pixel:", e);
          }
        }

        // Set SEO meta tags
        const seo = data.content_data?.seo;
        if (seo) {
          if (seo.title) document.title = seo.title;
          if (seo.description) {
            const meta = document.querySelector('meta[name="description"]');
            if (meta) {
              meta.setAttribute("content", seo.description);
            } else {
              const newMeta = document.createElement("meta");
              newMeta.name = "description";
              newMeta.content = seo.description;
              document.head.appendChild(newMeta);
            }
          }
          // Open Graph
          if (seo.title) {
            const ogTitle = document.createElement("meta");
            ogTitle.setAttribute("property", "og:title");
            ogTitle.content = seo.title;
            document.head.appendChild(ogTitle);
          }
          if (seo.description) {
            const ogDesc = document.createElement("meta");
            ogDesc.setAttribute("property", "og:description");
            ogDesc.content = seo.description;
            document.head.appendChild(ogDesc);
          }
        }
      } catch (err) {
        console.error(err);
        setError("An error occurred loading this page.");
      } finally {
        setLoading(false);
      }
    }

    fetchLandingPage();
  }, [hostname]);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          height: "100vh",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "3px solid #e5e7eb",
              borderTopColor: "#2563eb",
              borderRadius: "50%",
              margin: "0 auto 16px",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: "#6b7280" }}>جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (error || !pageData || !content || !theme) {
    return (
      <div
        style={{
          display: "flex",
          height: "100vh",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Inter, system-ui, sans-serif",
          direction: "rtl",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: "400px" }}>
          <h1 style={{ fontSize: "48px", marginBottom: "16px" }}>404</h1>
          <p style={{ color: "#6b7280", fontSize: "18px" }}>
            {error || "الصفحة غير موجودة"}
          </p>
        </div>
      </div>
    );
  }

  // Get template component
  const templateId = pageData.template_id || "modern-product";
  const TemplateComponent = getTemplateComponent(templateId);

  if (!TemplateComponent) {
    return (
      <div
        style={{
          display: "flex",
          height: "100vh",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <p>Template "{templateId}" not found.</p>
      </div>
    );
  }

  // Render the template
  return (
    <div dir="rtl">
      <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Cairo:wght@400;500;600;700;800&family=Tajawal:wght@400;500;700;800&family=Noto+Sans+Arabic:wght@400;500;600;700;800&display=swap');
                * { margin: 0; padding: 0; box-sizing: border-box; }
                html { scroll-behavior: smooth; }
            `}</style>
      <TemplateComponent
        content={content}
        theme={theme}
        clientId={pageData.client_id}
        productId={pageData.product_id}
      />
    </div>
  );
}