import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Check, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface Product {
    id: string;
    name: string;
    description: string | null;
    price: number;
    category: string | null;
    offer: string | null;
    return_rate: number | null;
    code: string | null;
}

interface MasterPromptProps {
    clientData?: {
        industry?: string;
        specialty?: string;
        promotional_offer?: string;
        work_area?: string;
    };
    products?: Product[];
    serviceOptions?: string[];
    offerOptions?: string[];
    onSaveToVault?: (title: string, content: string, category: string) => Promise<void>;
}

export function MasterPrompt({ clientData, products = [], serviceOptions = [], offerOptions = [], onSaveToVault }: MasterPromptProps) {
    const [selectedProductId, setSelectedProductId] = useState<string>("");
    const [inputs, setInputs] = useState({
        industry: clientData?.industry || "",
        service: "",
        offer: "",
        icp: clientData?.work_area ? `العملاء في منطقة ${clientData.work_area}` : "",
        duration: "60",
    });

    const [generatedPrompt, setGeneratedPrompt] = useState("");
    const [copied, setCopied] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const selectedProduct = products.find(p => p.id === selectedProductId);

    React.useEffect(() => {
        if (selectedProduct) {
            setInputs(prev => ({
                ...prev,
                industry: clientData?.industry || prev.industry,
                service: selectedProduct.name || prev.service,
                offer: selectedProduct.offer || prev.offer,
                icp: clientData?.work_area ? `العملاء في منطقة ${clientData.work_area}` : prev.icp
            }));
        }
    }, [selectedProduct, clientData]);

    const handleInputChange = (field: keyof typeof inputs, value: string) => {
        setInputs((prev) => ({ ...prev, [field]: value }));
    };

    const generatePrompt = () => {
        const { industry, service, offer, icp, duration } = inputs;

        if (!industry || !service || !offer || !icp || !duration) {
            toast.error("يرجى ملء جميع الحقول لتوليد البرومبت");
            return;
        }

        const promptText = `Act like a world-class direct-response copywriter and Facebook Ads strategist who specializes in high-converting, direct-to-camera ads for local service businesses in emerging markets.

Your objective is to generate a 10/10 Facebook Ads script (TEXT ONLY) that maximizes hook rate (50%+) and hold rate (30%+) for the Libyan market using the inputs below.

==================================================
INPUTS (FILL THESE IN BEFORE GENERATING THE AD)
- Industry: ${industry}
- Service: ${service}
- Offer: ${offer}
- ICP (Ideal Customer Profile): ${icp}
- Video Duration (seconds): ${duration}
==================================================

NON-NEGOTIABLE ANTI-SKIP PROTOCOL (DO THIS FIRST — SILENTLY):
1) Read this entire prompt from top to bottom WITHOUT stopping early.
2) Do NOT start writing the ad until you reach the line that says: “START WRITING THE AD (NOW)”.
3) If you catch yourself starting to write before that line, STOP, discard what you wrote, and restart from the top.
4) While reading, build an internal checklist of:
   - INPUTS
   - Hard constraints
   - Required output format
   - Hook rules + hook types
   - What-Who-When framework + the 8 “What” elements
   - CTA rules (spell it out, easy next step)
5) Before outputting, silently verify you used the whole prompt by confirming the final COPY includes:
   - At least 1 clear WHO perspective (spouse/kids/parents/boss/friends/rivals, etc.)
   - At least 1 clear WHEN reference (past OR present OR future)
   - At least 4 of the 8 “What” value elements (seamlessly, not as a list)
   - A spelled-out CTA (Click / Call / Reply “YES” / Go to website)
6) Do NOT output your checklist, notes, analysis, or reasoning. ONLY output the ad in the exact required format.

Task:
Write ONLY the ad text. No introductions, no explanations, no small talk, no meta-commentary. Output must strictly follow the format defined below.

Audience & Market Context:
- Market: Libya
- Language style: Libyan street-level neutral Arabic (as commonly used in Libyan ads), simple vocabulary a 5th grader can easily understand.
- Tone: Direct, confident, familiar, human, and emotionally aware.
- Speak exactly how the target audience talks in real life. No corporate language. No hype words that sound fake or “salesy.”
- Assume the viewer is a homeowner or decision-maker who has already been disappointed, overcharged, or confused before.
- Assume the audience has no idea who you are, what you do, how it works, they’re in a rush, and they have a 3rd grade education.

Non-Negotiables / Hard Constraints:
- Total duration must fit: ${duration} seconds
- Platform: Facebook Ads
- Style: Direct-to-camera spoken ad
- Output text only. No emojis. No hashtags.
- No guarantees, no exaggerated claims, no buzzwords.
- Do NOT explain what you are doing.

Core Ad Structure (STRICT ORDER):
Hook -> Value -> CTA

==================================================
1) HOOK (attention comes first, by a lot)
==================================================
Hook: People noticing your ad is the most important part of the ad...by a lot.
The purpose of each second of the ad is to sell the next second of the ad. And the headline is the first sale.
Focus your effort front to back.
A Hook is whatever you do to get the attention of your audience.

Types of Hooks (you may use any, but your 5 hooks should be diverse):
A) Labels
B) Yes-Questions
C) If–Then Statements
D) Ridiculous Results

A) Labels
A Label is a word or set of words used to put people into a specific group. These can include:
- Features
- Traits
- Titles
- Places
- Other descriptors
Examples provided:
- Clark County Moms
- Gym Owners
- Remote Workers
- I’m looking for XYZ
To maximize effectiveness, your ideal customers must identify with the label used.

B) Yes-Questions
These are questions designed so that if a person answers "yes, that's me," they automatically qualify themselves for your offer.
Examples:
- "Do you wake up to pee more than once a night?"
- "Do you have trouble tying your shoes?"
- "Do you have a home worth over $400,000?"

C) If–Then Statements
If they meet your conditions then you help them make a decision.
Examples:
- If you run over $10,000 per month in ads, we can save you 20% or more...
- If you were born between 1978 and 1986 in Muskogee Oklahoma, you may qualify for a class action lawsuit...
- If you want to XYZ, then pay attention...

D) Ridiculous Results
Bizarre, rare, or out of the ordinary stuff someone would want.
Examples:
- Massage studio books out two years in advance. Clients furious.
- This woman lost 50 pounds eating pizza and fired her trainer
- The government is handing out thousand dollar checks to anyone who can answer three questions etc.

HOOK OUTPUT REQUIREMENT:
- Create 5 scroll-stopping hooks for:
  - Industry: ${industry}
  - Service: ${service}
  - ICP: ${icp}
- Each hook must:
  - Sound like something the audience would say themselves
  - Call out a painful problem immediately
  - Feel personal, not generic
- Each hook should be short, punchy, spoken, and direct-to-camera friendly.

==================================================
2) VALUE (WHY they should care)
==================================================
Use the What-Who-When Framework to build value that feels personal, status-relevant, and time-based.

What-Who-When Framework:
1. WHAT
Represented by a carrot (positive) vs. a stick (negative):
(+) MORE / DREAM: Includes Fast, Easy, and Likely.
(-) LESS / NIGHTMARE: Includes Slow, Hard, and Risky.

2. WHO
Targeting the impact on specific groups:
- THEMSELVES
- FAMILY
- FRIENDS
- COLLEAGUES
- RIVALS
- ETC...

3. WHEN
Represented by an hourglass icon:
- PAST
- PRESENT
- FUTURE

The What: Eight Key Elements
(use as many as you can seamlessly; you do NOT need all 8, but more = stronger)
- Dream Outcome
- Opposite – Nightmare
- Perceived Likelihood of Achievement
- Opposite – Risk
- Time Delay
- Opposite – Speed
- Effort and Sacrifice
- Opposite – Ease

Dream Outcome:
A good ad will show and tell the maximum benefit the prospect can achieve using the thing you sell. It should align with the ideal prospect’s dream outcome for that sort of product or service. These are the results they experience after buying the thing.

Opposite – Nightmare:
A good ad will also show them the worst possible hassles, pain, etc. of going without your solution. In short – the bad stuff they’ll experience if they don’t buy.

Perceived Likelihood of Achievement:
Because of past failures, we assume that even when we buy, there’s a risk we don’t get what we want.
Lower perceived risk by minimizing or explaining away past failures, emphasizing the success of people like them, giving assurances by authority, guarantees, and how what you have to offer will at least give them a better chance of success than what they currently do, etc.

Opposite – Risk:
A good ad will also show them how risky it is to not act. What will their life be like if they carried on as they always have? Show how they will repeat their past failures and how their problems will get bigger and worse...

Time Delay:
A good ad will also show them how slow their current trajectory is or that they’ll never get what they want at their current rate...

Opposite – Speed:
To get things we want – we know we have to spend time getting them. A good ad will show and tell how much faster they will get the thing they want.

Effort and Sacrifice:
A good ad will also show them the amount of work and skill they’ll need to get the result without your solution.
How they’ll be forced to keep giving up the things they love and continue suffering from the things they hate.
Or worse, that they work hard and sacrifice a ton right now… and have gotten…nowhere.

Opposite – Ease:
To get things we want – we know we have to change something. But we then assume we have to do stuff we hate and give up stuff we love. And ease comes from a lack of needed work or skill.
A good ad disproves the assumption. It tells and shows how you can avoid the stuff you hate doing, do more of the stuff you love doing, without working hard, or having a lot of skill and still get the dream outcome.

All 8 Elements don't necessarily have to be in the ad, the more that you have it seamlessly the more powerful the ad will be.

The Who:
Humans are primarily status-driven. And the status of one human comes from how the other humans treat them.
- People gaining status: your customers.
- People giving it to them: Spouse, Kids, Parents, Extended Family, Colleagues, Bosses, Friends, Rivals, Competitors, etc.
Think of the benefit from the WHAT elements and describe it in every possible way from these people's perspective.

The When:
People often only think of how their decisions affect the here and now. But if we want to be extra compelling (and we do), we should also explain what their decisions led to in the past and what their decisions could lead to in the future. We do this by getting them to visualize through their own timeline (past–present–future).

Putting the What, the Who, and the When together answers WHY they should be interested.
Examples (use as a thinking pattern, do not copy literally):
- Their spouse (WHO) will perceive how fast (WHAT) they fit into ‘that suit your wife loves that didn’t fit but does now’ in the future (WHEN).
- Or, how their kids (WHO) month after month (WHEN) got more interested in eating healthy and tagging along during workouts (WHAT).
- Or, how they (WHO) catch a look at themselves in a reflection in the mall in a few months (WHEN) and realize ‘stuff actually fits me in this store’ (WHAT).

Value Writing Requirements (must be felt inside the COPY for ${icp} in Libya):
- Prove you understand their pain better than they do (related to ${service})
- Agitate the problem without exaggeration
- Position ${service} as the simple, stress-free solution
- Naturally lead into ${offer} without sounding pushy

==================================================
3) CTA (Tell them what to do next)
==================================================
If your ad got them interested, then your audience will have huge motivation... for a tiny time. Take advantage.
Tell them exactly what to do next. S-P-E-L-L it out: Click this button. Call this number. Reply with “YES.” Go to this website.

Make CTAs quick and easy:
- Easy phone numbers, obvious buttons, simple websites.
- If you use a website CTA, make the web address short and memorable:
  Instead of... alexsprivateequityfirm.com/free-book-and-course2782
  Use.. acquisition.com/training

==================================================
EXECUTION (SILENT) — DO NOT OUTPUT THIS
==================================================
1. Deeply analyze the ICP: ${icp}
   - Their daily frustrations
   - Their biggest fears related to ${service}
   - What they complain about to friends
   - What they secretly worry will go wrong again
2. Craft 5 hooks:
   - Diverse across Labels / Yes-Questions / If–Then / Ridiculous Results
   - Feels like the viewer is being called out personally
3. Write the main COPY (spoken, direct-to-camera) that follows Hook -> Value -> CTA:
   - Pain recognition -> agitation -> simple solution -> offer -> CTA
   - Use What-Who-When thinking to make the value personal and time-based
   - Use as many of the 8 “What” elements as possible seamlessly
4. Write a short, clear, benefit-driven headline that reinforces trust and action.
5. Final silent self-check:
   - Sounds like real Libyan street-level neutral Arabic, simple and natural
   - No fake hype, no exaggerated claims, no guarantees
   - CTA is spelled out and easy
   - Stays within ${duration} seconds (tight pacing, no fluff)

==================================================
START WRITING THE AD (NOW)
(If you have not read the entire prompt above, STOP and go back.)
==================================================

Required Output Format (EXACT):
Hook1:

Hook2:

Hook3:

Hook4:

Hook5:

COPY:

Headline:

Take a deep breath and work on this problem step-by-step.`;

        setGeneratedPrompt(promptText);
        toast.success("تم توليد البرومبت بنجاح");
    };

    const copyToClipboard = async () => {
        if (!generatedPrompt) return;
        await navigator.clipboard.writeText(generatedPrompt);
        setCopied(true);
        toast.success("تم نسخ البرومبت");
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-6" dir="rtl">
            <div className="space-y-2">
                <Label htmlFor="product">اختر المنتج</Label>
                <Select
                    value={selectedProductId}
                    onValueChange={setSelectedProductId}
                >
                    <SelectTrigger id="product" className="w-full text-right" dir="rtl">
                        <SelectValue placeholder="اختر المنتج لتوليد الإعلان" />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                        {products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                                {product.name} - {product.price} د.ل
                                {product.offer ? ` (${product.offer})` : ''}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="industry">المجال</Label>
                    <Input
                        id="industry"
                        placeholder="مثال: العقارات، المطاعم..."
                        value={inputs.industry}
                        onChange={(e) => handleInputChange("industry", e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="service">المنتج / الخدمة</Label>
                    <Input
                        id="service"
                        placeholder="سيتم ملؤه تلقائياً من المنتج"
                        value={inputs.service}
                        onChange={(e) => handleInputChange("service", e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="offer">العرض</Label>
                    <Input
                        id="offer"
                        placeholder="سيتم ملؤه تلقائياً من المنتج"
                        value={inputs.offer}
                        onChange={(e) => handleInputChange("offer", e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="duration">المدة (بالثواني)</Label>
                    <Input
                        id="duration"
                        type="number"
                        placeholder="60"
                        value={inputs.duration}
                        onChange={(e) => handleInputChange("duration", e.target.value)}
                    />
                </div>
                <div className="col-span-1 md:col-span-2 space-y-2">
                    <Label htmlFor="icp">العميل المثالي</Label>
                    <Textarea
                        id="icp"
                        placeholder="وصف تفصيلي للعميل المستهدف ومشاكله..."
                        value={inputs.icp}
                        onChange={(e) => handleInputChange("icp", e.target.value)}
                        className="min-h-[80px]"
                    />
                </div>
            </div>

            <Button onClick={generatePrompt} className="w-full gap-2" size="lg">
                <RefreshCw className="h-4 w-4" />
                توليد البرومبت
            </Button>

            {generatedPrompt && (
                <Card className="mt-6 border-2 border-primary/20">
                    <CardHeader className="bg-muted/30 pb-3 flex flex-row items-center justify-between">
                        <CardTitle className="text-base text-primary">البرومبت الجاهز</CardTitle>
                        <div className="flex gap-2">
                            {onSaveToVault && (
                                <Button
                                    variant="default"
                                    size="sm"
                                    onClick={async () => {
                                        if (!generatedPrompt) return;
                                        setIsSaving(true);
                                        try {
                                    await onSaveToVault(
                                        `إعلان: ${selectedProduct?.name || inputs.service}`,
                                        generatedPrompt,
                                        "Ad Copy"
                                    );
                                        } finally {
                                            setIsSaving(false);
                                        }
                                    }}
                                    className="gap-2 bg-green-600 hover:bg-green-700"
                                    disabled={isSaving}
                                >
                                    <Check className="h-4 w-4" />
                                    {isSaving ? "جاري الحفظ..." : "حفظ في المخزن"}
                                </Button>
                            )}
                            <Button variant="outline" size="sm" onClick={copyToClipboard} className="gap-2">
                                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                {copied ? "تم النسخ" : "نسخ البرومبت"}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-[300px] w-full p-4" dir="ltr">
                            <pre className="whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                                {generatedPrompt}
                            </pre>
                        </ScrollArea>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
