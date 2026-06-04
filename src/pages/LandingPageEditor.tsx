/**
 * Landing Page Editor
 *
 * Full-featured editor for creating and editing AI-generated landing pages.
 * Supports template selection, section editing, theme customization,
 * live preview, tracking pixel, and custom domain setup.
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase as rawSupabase } from "@/integrations/supabase/client";
const supabase = rawSupabase as any;
import { Loader2, Wand2, ArrowRight, Eye, Settings, Palette, FileText, Globe, Code } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ThemeCustomizer } from "@/components/landing-pages/ThemeCustomizer";
import { getTemplateComponent } from "@/components/landing-pages/TemplateRegistry";
import { generateAndSaveLandingPage } from "@/services/landingPageGenerationService";
import { LANDING_PAGE_TEMPLATES } from "@/types/landingPage";
import type { LandingPageContent, LandingPageTheme } from "@/types/landingPage";

// ─── Default empty content ──────────────────────────────────────────────────

const EMPTY_CONTENT: LandingPageContent = {
    hero: { headline: "", subheadline: "", ctaText: "" },
    features: [],
    proofSection: { stats: [], testimonials: [], guarantees: [] },
    cta: { headline: "", subheadline: "", buttonText: "", formFields: [] },
    seo: { title: "", description: "", keywords: [] },
};

const EMPTY_THEME: LandingPageTheme = {
    primaryColor: "#2563EB",
    secondaryColor: "#1E40AF",
    accentColor: "#F59E0B",
    backgroundColor: "#FFFFFF",
    textColor: "#1F2937",
    headingFont: "Inter",
    bodyFont: "Inter",
    borderRadius: "12px",
};

// ─── Section Editor Component ───────────────────────────────────────────────

function SectionEditor({
    content,
    onChange,
}: {
    content: LandingPageContent;
    onChange: (c: LandingPageContent) => void;
}) {
    const update = (path: string, value: string) => {
        const newContent = { ...content };
        const keys = path.split(".");
        let obj: any = newContent;
        for (let i = 0; i < keys.length - 1; i++) {
            obj = obj[keys[i]];
        }
        obj[keys[keys.length - 1]] = value;
        onChange(newContent);
    };

    return (
        <div className="space-y-5">
            <h3 className="font-semibold text-lg">محتوى الصفحة</h3>

            {/* Hero */}
            <div className="space-y-3 p-3 rounded-lg bg-muted/30">
                <h4 className="font-medium text-sm text-primary">البطل (Hero)</h4>
                <div className="space-y-2">
                    <Label className="text-xs">العنوان الرئيسي</Label>
                    <Input
                        value={content.hero.headline}
                        onChange={(e) => update("hero.headline", e.target.value)}
                        placeholder="عنوان رئيسي جذاب"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs">العنوان الفرعي</Label>
                    <Input
                        value={content.hero.subheadline}
                        onChange={(e) => update("hero.subheadline", e.target.value)}
                        placeholder="عنوان فرعي يدعم العنوان الرئيسي"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs">نص الزر</Label>
                    <Input
                        value={content.hero.ctaText}
                        onChange={(e) => update("hero.ctaText", e.target.value)}
                        placeholder="اطلب الآن"
                    />
                </div>
            </div>

            {/* CTA */}
            <div className="space-y-3 p-3 rounded-lg bg-muted/30">
                <h4 className="font-medium text-sm text-primary">قسم الدعوة للعمل (CTA)</h4>
                <div className="space-y-2">
                    <Label className="text-xs">عنوان القسم</Label>
                    <Input
                        value={content.cta.headline}
                        onChange={(e) => update("cta.headline", e.target.value)}
                        placeholder="جاهز للبدء؟"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs">النص الفرعي</Label>
                    <Input
                        value={content.cta.subheadline}
                        onChange={(e) => update("cta.subheadline", e.target.value)}
                        placeholder="تواصل معنا الآن"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs">نص الزر</Label>
                    <Input
                        value={content.cta.buttonText}
                        onChange={(e) => update("cta.buttonText", e.target.value)}
                        placeholder="احجز استشارة مجانية"
                    />
                </div>
            </div>

            {/* SEO */}
            <div className="space-y-3 p-3 rounded-lg bg-muted/30">
                <h4 className="font-medium text-sm text-primary">تحسين محركات البحث (SEO)</h4>
                <div className="space-y-2">
                    <Label className="text-xs">عنوان الصفحة</Label>
                    <Input
                        value={content.seo.title}
                        onChange={(e) => update("seo.title", e.target.value)}
                        placeholder="عنوان الصفحة في محرك البحث"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs">الوصف</Label>
                    <Textarea
                        value={content.seo.description}
                        onChange={(e) => update("seo.description", e.target.value)}
                        placeholder="وصف الصفحة في نتائج البحث"
                        rows={2}
                    />
                </div>
            </div>
        </div>
    );
}

// ─── Main Editor Component ──────────────────────────────────────────────────

export default function LandingPageEditor() {
    const { id, dnaId } = useParams<{ id?: string; dnaId?: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { client } = useAuth();

    const isNew = !!dnaId;
    const [selectedTemplate, setSelectedTemplate] = useState<string>("modern-product");
    const [activeTab, setActiveTab] = useState("settings");

    const [formData, setFormData] = useState({
        title: "صفحة الهبوط الخاصة بي",
        subdomain: "",
        custom_domain: "",
        tracking_pixel: "",
        status: "draft",
    });

    const [content, setContent] = useState<LandingPageContent>(EMPTY_CONTENT);
    const [theme, setTheme] = useState<LandingPageTheme>(EMPTY_THEME);

    // ─── Fetch existing page ─────────────────────────────────────────────
    const { data: pageData, isLoading } = useQuery({
        queryKey: ["landing_page", id],
        queryFn: async () => {
            if (isNew) return null;
            const { data, error } = await supabase
                .from("landing_pages")
                .select("*")
                .eq("id", id as any)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !isNew,
    });

    // ─── Fetch Product DNA ──────────────────────────────────────────────
    const { data: dnaData } = useQuery({
        queryKey: ["product_dna", dnaId || pageData?.product_dna_id],
        queryFn: async () => {
            const targetId = dnaId || pageData?.product_dna_id;
            if (!targetId) return null;
            const { data, error } = await supabase
                .from("product_dna")
                .select("*, products(*)")
                .eq("id", targetId as any)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!(dnaId || pageData?.product_dna_id),
    });

    // ─── Sync form data from page ───────────────────────────────────────
    useEffect(() => {
        if (pageData) {
            setFormData({
                title: pageData.title || "",
                subdomain: pageData.subdomain || "",
                custom_domain: pageData.custom_domain || "",
                tracking_pixel: pageData.tracking_pixel || "",
                status: pageData.status || "draft",
            });
            if (pageData.template_id) setSelectedTemplate(pageData.template_id);
            if (pageData.content_data && Object.keys(pageData.content_data).length > 0) {
                setContent(pageData.content_data as unknown as LandingPageContent);
            }
            if (pageData.theme_config && Object.keys(pageData.theme_config).length > 0) {
                setTheme(pageData.theme_config as unknown as LandingPageTheme);
            }
        }
    }, [pageData]);

    // ─── Save mutation ──────────────────────────────────────────────────
    const saveMutation = useMutation({
        mutationFn: async () => {
            const payload = {
                title: formData.title,
                subdomain: formData.subdomain || null,
                custom_domain: formData.custom_domain || null,
                tracking_pixel: formData.tracking_pixel || null,
                status: formData.status,
                template_id: selectedTemplate,
                content_data: content as any,
                theme_config: theme as any,
            };

            if (isNew) {
                if (!client?.id) throw new Error("Missing client data");
                const { data, error } = await supabase
                    .from("landing_pages")
                    .insert({
                        ...payload,
                        client_id: client.id,
                        product_id: dnaData?.product_id || null,
                        product_dna_id: dnaId,
                    } as any)
                    .select()
                    .single();
                if (error) throw error;
                return data;
            } else {
                const { data, error } = await supabase
                    .from("landing_pages")
                    .update(payload as any)
                    .eq("id", id as any)
                    .select()
                    .single();
                if (error) throw error;
                return data;
            }
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["landing_pages"] });
            toast({ title: "تم الحفظ", description: "تم حفظ صفحة الهبوط بنجاح" });
            if (isNew) {
                navigate(`/landing-pages/${data.id}/edit`, { replace: true });
            }
        },
        onError: (error: any) => {
            toast({ title: "خطأ", description: error.message || "فشل الحفظ", variant: "destructive" });
        },
    });

    // ─── AI Generation ──────────────────────────────────────────────────
    const generateAiMutation = useMutation({
        mutationFn: async () => {
            let activeId = id;
            if (isNew) {
                const saved = await saveMutation.mutateAsync();
                activeId = saved.id;
                // Navigate to the new URL
                navigate(`/landing-pages/${saved.id}/edit`, { replace: true });
            }

            if (!activeId || !dnaId) throw new Error("Missing page or DNA ID");

            const result = await generateAndSaveLandingPage(
                activeId,
                dnaId,
                selectedTemplate
            );

            return result;
        },
        onSuccess: (result) => {
            if (result) {
                setContent(result.content);
                setTheme(result.theme);
            }
            queryClient.invalidateQueries({ queryKey: ["landing_page", id] });
            toast({ title: "تم التوليد", description: "تم إنشاء المحتوى بواسطة الذكاء الاصطناعي بنجاح" });
            setActiveTab("content");
        },
        onError: (error: any) => {
            toast({ title: "خطأ", description: error.message || "فشل في توليد المحتوى", variant: "destructive" });
        },
    });

    // ─── Template Component ─────────────────────────────────────────────
    const TemplateComponent = getTemplateComponent(selectedTemplate);
    const hasContent = content.hero.headline && content.hero.headline.length > 0;

    if (isLoading) {
        return (
            <DashboardLayout>
                <div className="flex justify-center p-12">
                    <Loader2 className="animate-spin h-8 w-8 text-primary" />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-3xl font-bold">
                            {isNew ? "إنشاء صفحة هبوط جديدة" : "تعديل صفحة الهبوط"}
                        </h1>
                        {dnaData?.products?.name && (
                            <p className="text-muted-foreground mt-1">
                                المنتج: {dnaData.products.name}
                            </p>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => saveMutation.mutate()}
                            disabled={saveMutation.isPending}
                        >
                            {saveMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                            حفظ
                        </Button>
                        <Button
                            onClick={() => generateAiMutation.mutate()}
                            disabled={generateAiMutation.isPending || saveMutation.isPending}
                        >
                            {generateAiMutation.isPending ? (
                                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Wand2 className="ml-2 h-4 w-4" />
                            )}
                            توليد بالذكاء الاصطناعي
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* ─── Left Panel: Editor ─── */}
                    <div className="lg:col-span-1 space-y-4">
                        <Tabs value={activeTab} onValueChange={setActiveTab}>
                            <TabsList className="w-full grid grid-cols-4">
                                <TabsTrigger value="settings" className="text-xs">
                                    <Settings className="h-3.5 w-3.5 ml-1" />
                                </TabsTrigger>
                                <TabsTrigger value="template" className="text-xs">
                                    <FileText className="h-3.5 w-3.5 ml-1" />
                                </TabsTrigger>
                                <TabsTrigger value="content" className="text-xs">
                                    <Palette className="h-3.5 w-3.5 ml-1" />
                                </TabsTrigger>
                                <TabsTrigger value="domain" className="text-xs">
                                    <Globe className="h-3.5 w-3.5 ml-1" />
                                </TabsTrigger>
                            </TabsList>

                            {/* Settings Tab */}
                            <TabsContent value="settings" className="mt-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">الإعدادات</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>عنوان الصفحة</Label>
                                            <Input
                                                value={formData.title}
                                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>الحالة</Label>
                                            <Select
                                                value={formData.status}
                                                onValueChange={(val) => setFormData({ ...formData, status: val })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="draft">مسودة</SelectItem>
                                                    <SelectItem value="published">منشور</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Pixel Integration */}
                                        <div className="space-y-2">
                                            <Label>بيكسل التتبع</Label>
                                            <div className="flex gap-2 mb-2">
                                                <Badge
                                                    variant="outline"
                                                    className="cursor-pointer hover:bg-primary/10 text-xs"
                                                    onClick={() => {
                                                        const id = prompt("أدخل Meta Pixel ID:");
                                                        if (id) {
                                                            setFormData({
                                                                ...formData,
                                                                tracking_pixel: `<!-- Meta Pixel -->\n<script>\n!function(f,b,e,v,n,t,s)\n{if(f.fbq)return;n=f.fbq=function(){n.callMethod?\nn.callMethod.apply(n,arguments):n.queue.push(arguments)};\nif(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';\nn.queue=[];t=b.createElement(e);t.async=!0;\nt.src=v;s=b.getElementsByTagName(e)[0];\ns.parentNode.insertBefore(t,s)}(window, document,'script',\n'https://connect.facebook.net/en_US/fbevents.js');\nfbq('init', '${id}');\nfbq('track', 'PageView');\n</script>\n<!-- End Meta Pixel -->`,
                                                            });
                                                        }
                                                    }}
                                                >
                                                    Meta Pixel
                                                </Badge>
                                                <Badge
                                                    variant="outline"
                                                    className="cursor-pointer hover:bg-primary/10 text-xs"
                                                    onClick={() => {
                                                        const id = prompt("أدخل Google Tag Manager ID (GTM-XXXX):");
                                                        if (id) {
                                                            setFormData({
                                                                ...formData,
                                                                tracking_pixel: `<!-- Google Tag Manager -->\n<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':\nnew Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],\nj=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=\n'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);\n})(window,document,'script','dataLayer','${id}');</script>\n<!-- End Google Tag Manager -->`,
                                                            });
                                                        }
                                                    }}
                                                >
                                                    GTM
                                                </Badge>
                                            </div>
                                            <Textarea
                                                value={formData.tracking_pixel}
                                                onChange={(e) => setFormData({ ...formData, tracking_pixel: e.target.value })}
                                                placeholder='<script>...</script>'
                                                dir="ltr"
                                                className="font-mono text-xs"
                                                rows={3}
                                            />
                                        </div>

                                        <Button
                                            className="w-full"
                                            onClick={() => saveMutation.mutate()}
                                            disabled={saveMutation.isPending}
                                        >
                                            {saveMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                                            حفظ الإعدادات
                                        </Button>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {/* Template Tab */}
                            <TabsContent value="template" className="mt-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">اختر التصميم</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        {LANDING_PAGE_TEMPLATES.map((tmpl) => (
                                            <div
                                                key={tmpl.id}
                                                onClick={() => setSelectedTemplate(tmpl.id)}
                                                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedTemplate === tmpl.id
                                                    ? "border-primary bg-primary/5"
                                                    : "border-border hover:border-primary/30"
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="w-10 h-10 rounded-lg flex-shrink-0"
                                                        style={{
                                                            background: `linear-gradient(135deg, ${tmpl.defaultTheme.primaryColor}, ${tmpl.defaultTheme.secondaryColor})`,
                                                        }}
                                                    />
                                                    <div>
                                                        <div className="font-medium">{tmpl.nameAr}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {tmpl.descriptionAr}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {/* Content Tab */}
                            <TabsContent value="content" className="mt-4">
                                <Card>
                                    <CardContent className="pt-6">
                                        <Tabs defaultValue="sections">
                                            <TabsList className="w-full mb-4">
                                                <TabsTrigger value="sections" className="text-xs flex-1">
                                                    المحتوى
                                                </TabsTrigger>
                                                <TabsTrigger value="theme" className="text-xs flex-1">
                                                    التصميم
                                                </TabsTrigger>
                                            </TabsList>
                                            <TabsContent value="sections">
                                                <SectionEditor content={content} onChange={setContent} />
                                            </TabsContent>
                                            <TabsContent value="theme">
                                                <ThemeCustomizer theme={theme} onChange={setTheme} />
                                            </TabsContent>
                                        </Tabs>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {/* Domain Tab */}
                            <TabsContent value="domain" className="mt-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">النطاق</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>النطاق الفرعي (Subdomain)</Label>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    value={formData.subdomain}
                                                    onChange={(e) => {
                                                        // Only allow lowercase alphanumeric and hyphens
                                                        const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 63);
                                                        setFormData({ ...formData, subdomain: val });
                                                    }}
                                                    placeholder="my-product"
                                                    dir="ltr"
                                                    maxLength={63}
                                                />
                                                <span className="text-muted-foreground text-sm whitespace-nowrap" dir="ltr">
                                                    .soctiv.ly
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                سيتوفر على: {formData.subdomain ? `${formData.subdomain}.soctiv.ly` : "product.soctiv.ly"}
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>نطاق مخصص (Custom Domain)</Label>
                                            <Input
                                                value={formData.custom_domain}
                                                onChange={(e) => setFormData({ ...formData, custom_domain: e.target.value })}
                                                placeholder="www.myproduct.com"
                                                dir="ltr"
                                            />
                                            <div className="p-3 rounded-lg bg-muted/50 text-xs space-y-1">
                                                <p className="font-medium">خطوات إعداد النطاق المخصص:</p>
                                                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                                                    <li>أدخل نطاقك أعلاه</li>
                                                    <li>أضف سجل CNAME في DNS:</li>
                                                    <li className="font-mono text-[10px] bg-background p-1 rounded" dir="ltr">
                                                        CNAME: {formData.custom_domain || "www.myproduct.com"} → {formData.subdomain || "product"}.soctiv.ly
                                                    </li>
                                                    <li>انتظر تفعيل SSL (تلقائي)</li>
                                                </ol>
                                            </div>
                                        </div>

                                        <Button
                                            className="w-full"
                                            onClick={() => saveMutation.mutate()}
                                            disabled={saveMutation.isPending}
                                        >
                                            {saveMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                                            حفظ إعدادات النطاق
                                        </Button>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    </div>

                    {/* ─── Right Panel: Live Preview ─── */}
                    <div className="lg:col-span-2">
                        <Card className="h-full min-h-[700px] flex flex-col">
                            <CardHeader>
                                <CardTitle className="text-lg flex justify-between items-center">
                                    <span className="flex items-center gap-2">
                                        <Eye className="h-4 w-4" />
                                        معاينة مباشرة
                                    </span>
                                    {formData.subdomain && (
                                        <a
                                            href={`http://${formData.subdomain}.soctiv.ly`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-sm text-primary font-normal hover:underline flex items-center gap-1"
                                        >
                                            <Code className="h-3 w-3" />
                                            فتح في نافذة جديدة
                                        </a>
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 bg-muted/20 rounded-b-xl border-t relative overflow-hidden p-0">
                                {hasContent && TemplateComponent ? (
                                    <div className="w-full h-full min-h-[700px] overflow-auto">
                                        <div
                                            style={{
                                                transform: "scale(0.75)",
                                                transformOrigin: "top center",
                                                width: "133.33%",
                                            }}
                                        >
                                            <TemplateComponent
                                                content={content}
                                                theme={theme}
                                                clientId={client?.id || ""}
                                                productId={dnaData?.product_id || null}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground min-h-[700px] gap-4">
                                        <FileText className="h-12 w-12 opacity-30" />
                                        <p className="text-center max-w-md">
                                            {isNew
                                                ? "اختر تصنيفاً واضغط 'توليد بالذكاء الاصطناعي' لإنشاء محتوى صفحة الهبوط"
                                                : "لم يتم توليد محتوى بعد. اضغط على زر توليد المحتوى."
                                            }
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}