import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Laptop, RotateCcw } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { useThemeConfig, type ThemeColor } from "@/components/theme-config-provider";

const colorOptions: Array<{
  value: ThemeColor;
  label: string;
  swatch: string;
}> = [
    { value: "classic", label: "كلاسيكي", swatch: "hsl(222 47% 11%)" },
    { value: "slate", label: "محايد", swatch: "hsl(222 47% 11%)" },
    { value: "blue", label: "أزرق", swatch: "hsl(212 90% 50%)" },
    { value: "emerald", label: "زمردي", swatch: "hsl(158 64% 40%)" },
    { value: "amber", label: "كهرماني", swatch: "hsl(38 92% 50%)" },
    { value: "rose", label: "وردي", swatch: "hsl(347 77% 50%)" },
  ];

const radiusMarks = [
  { value: 4, label: "حاد" },
  { value: 8, label: "متوازن" },
  { value: 16, label: "ناعم" },
];

export function ThemeCustomizer() {
  const { theme, setTheme } = useTheme();
  const { config, setColor, setRadius, reset } = useThemeConfig();

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>المظهر</CardTitle>
          <CardDescription>اختر الوضع والألوان التي تناسبك.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="text-sm font-medium">الوضع</div>
            <ToggleGroup
              type="single"
              value={theme}
              onValueChange={(value) => value && setTheme(value)}
              className="justify-start"
            >
              <ToggleGroupItem value="light" aria-label="Light mode" className="gap-2">
                <Sun className="h-4 w-4" />
                فاتح
              </ToggleGroupItem>
              <ToggleGroupItem value="dark" aria-label="Dark mode" className="gap-2">
                <Moon className="h-4 w-4" />
                داكن
              </ToggleGroupItem>
              <ToggleGroupItem value="system" aria-label="System mode" className="gap-2">
                <Laptop className="h-4 w-4" />
                النظام
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-medium">اللون الأساسي</div>
            <ToggleGroup
              type="single"
              value={config.color}
              onValueChange={(value) => value && setColor(value as ThemeColor)}
              className="flex flex-wrap justify-start gap-2"
            >
              {colorOptions.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  className="gap-2 rounded-full px-4 py-2"
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: option.swatch }}
                    aria-hidden
                  />
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">انحناء الزوايا</div>
              <div className="text-xs text-muted-foreground">{config.radius}px</div>
            </div>
            <Slider
              value={[config.radius]}
              min={4}
              max={16}
              step={1}
              onValueChange={(value) => setRadius(value[0] ?? 8)}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              {radiusMarks.map((mark) => (
                <span key={mark.value}>{mark.label}</span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>إعادة التعيين</CardTitle>
          <CardDescription>العودة إلى النمط الافتراضي.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full gap-2" onClick={reset}>
            <RotateCcw className="h-4 w-4" />
            استعادة الافتراضي
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
