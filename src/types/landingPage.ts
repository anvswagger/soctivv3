/**
 * Landing Page Template Types
 *
 * Defines the structured data schema that AI generates and templates consume.
 * Each template renders this data in its own visual style.
 */

// ─── Section Types ──────────────────────────────────────────────────────────

export interface HeroSection {
    headline: string;
    subheadline: string;
    ctaText: string;
    imageUrl?: string;
    backgroundStyle?: 'gradient' | 'solid' | 'image';
}

export interface FeatureItem {
    icon: string; // lucide icon name or emoji
    title: string;
    description: string;
}

export interface TestimonialItem {
    quote: string;
    author: string;
    role: string;
    avatarUrl?: string;
}

export interface StatItem {
    value: string; // e.g. "10,000+" or "99.9%"
    label: string;
}

export interface ProofSection {
    stats: StatItem[];
    testimonials: TestimonialItem[];
    guarantees: string[];
}

export interface CtaSection {
    headline: string;
    subheadline: string;
    buttonText: string;
    formFields: FormField[];
}

export interface FormField {
    name: string;
    label: string;
    type: 'text' | 'email' | 'tel' | 'textarea';
    required: boolean;
    placeholder?: string;
}

export interface SeoData {
    title: string;
    description: string;
    keywords: string[];
    ogImage?: string;
}

// ─── Theme ──────────────────────────────────────────────────────────────────

export interface LandingPageTheme {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    backgroundColor: string;
    textColor: string;
    headingFont: string;
    bodyFont: string;
    borderRadius: string; // e.g. '8px', '12px', '0px'
}

// ─── Main Content Schema ────────────────────────────────────────────────────

export interface LandingPageContent {
    hero: HeroSection;
    features: FeatureItem[];
    proofSection: ProofSection;
    cta: CtaSection;
    seo: SeoData;
}

// ─── Template Definition ────────────────────────────────────────────────────

export interface LandingPageTemplate {
    id: string;
    name: string;
    nameAr: string;
    description: string;
    descriptionAr: string;
    thumbnail: string; // URL or SVG path
    defaultTheme: LandingPageTheme;
    /** Categories this template is suited for */
    categories: string[];
}

// ─── Landing Page Record (DB) ───────────────────────────────────────────────

export interface LandingPageRecord {
    id: string;
    client_id: string;
    product_id: string | null;
    product_dna_id: string | null;
    subdomain: string | null;
    custom_domain: string | null;
    title: string;
    status: 'draft' | 'published';
    template_id: string;
    theme_config: LandingPageTheme;
    content_data: LandingPageContent;
    tracking_pixel: string | null;
    seo_data?: SeoData;
    custom_domain_status?: 'pending' | 'active' | 'error';
    created_at: string;
    updated_at: string;
}

// ─── AI Generation Request/Response ─────────────────────────────────────────

export interface LandingPageGenerationRequest {
    landing_page_id: string;
    template_id: string;
    product_dna_id: string;
}

export interface LandingPageGenerationResponse {
    content: LandingPageContent;
    theme: LandingPageTheme;
}

// ─── Template Registry Constants ────────────────────────────────────────────

export const LANDING_PAGE_TEMPLATES: LandingPageTemplate[] = [
    {
        id: 'modern-product',
        name: 'Modern Product',
        nameAr: 'منتج عصري',
        description: 'Bold hero, feature grid, social proof — perfect for physical products',
        descriptionAr: 'بطل جريء، شبكة ميزات، دليل اجتماعي — مثالي للمنتجات المادية',
        thumbnail: '/templates/modern-product.svg',
        defaultTheme: {
            primaryColor: '#2563EB',
            secondaryColor: '#1E40AF',
            accentColor: '#F59E0B',
            backgroundColor: '#FFFFFF',
            textColor: '#1F2937',
            headingFont: 'Inter',
            bodyFont: 'Inter',
            borderRadius: '12px',
        },
        categories: ['product', 'ecommerce', 'physical'],
    },
    {
        id: 'service-business',
        name: 'Service Business',
        nameAr: 'خدمة أعمال',
        description: 'Trust-focused with testimonials — ideal for agencies and service providers',
        descriptionAr: 'مركّز على الثقة مع شهادات — مثالي للوكالات ومزودي الخدمات',
        thumbnail: '/templates/service-business.svg',
        defaultTheme: {
            primaryColor: '#059669',
            secondaryColor: '#047857',
            accentColor: '#10B981',
            backgroundColor: '#F9FAFB',
            textColor: '#111827',
            headingFont: 'Inter',
            bodyFont: 'Inter',
            borderRadius: '8px',
        },
        categories: ['service', 'agency', 'consulting'],
    },
    {
        id: 'minimal-saas',
        name: 'Minimal SaaS',
        nameAr: 'SaaS بسيط',
        description: 'Clean, minimal design — perfect for software and digital products',
        descriptionAr: 'تصميم نظيف وبسيط — مثالي للبرمجيات والمنتجات الرقمية',
        thumbnail: '/templates/minimal-saas.svg',
        defaultTheme: {
            primaryColor: '#7C3AED',
            secondaryColor: '#6D28D9',
            accentColor: '#A78BFA',
            backgroundColor: '#FFFFFF',
            textColor: '#1F2937',
            headingFont: 'Inter',
            bodyFont: 'Inter',
            borderRadius: '16px',
        },
        categories: ['saas', 'software', 'digital'],
    },
];

// ─── Helper Functions ───────────────────────────────────────────────────────

export function getTemplateById(id: string): LandingPageTemplate | undefined {
    return LANDING_PAGE_TEMPLATES.find(t => t.id === id);
}

export function getTemplateCategories(): string[] {
    const categories = new Set<string>();
    LANDING_PAGE_TEMPLATES.forEach(t => t.categories.forEach(c => categories.add(c)));
    return Array.from(categories);
}