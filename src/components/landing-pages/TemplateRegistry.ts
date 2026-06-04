/**
 * Template Registry
 *
 * Maps template IDs to their React components.
 * Used by the editor for preview and by the public page for rendering.
 */
import { type ComponentType } from "react";
import { ModernProductTemplate } from "./templates/ModernProductTemplate";
import { ServiceBusinessTemplate } from "./templates/ServiceBusinessTemplate";
import { MinimalSaaSTemplate } from "./templates/MinimalSaaSTemplate";
import type { LandingPageContent, LandingPageTheme } from "@/types/landingPage";

export interface TemplateComponentProps {
    content: LandingPageContent;
    theme: LandingPageTheme;
    clientId: string;
    productId: string | null;
}

const TEMPLATE_MAP: Record<string, ComponentType<TemplateComponentProps>> = {
    "modern-product": ModernProductTemplate,
    "service-business": ServiceBusinessTemplate,
    "minimal-saas": MinimalSaaSTemplate,
};

/**
 * Get a template component by its ID.
 * Returns null if the template ID is not found.
 */
export function getTemplateComponent(
    templateId: string
): ComponentType<TemplateComponentProps> | null {
    return TEMPLATE_MAP[templateId] ?? null;
}

/**
 * Get all available template IDs.
 */
export function getAvailableTemplateIds(): string[] {
    return Object.keys(TEMPLATE_MAP);
}