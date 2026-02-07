import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { VaultItem, CreateVaultItemData } from "@/services/vaultService";

interface VaultItemFormProps {
    clientId: string;
    initialData?: VaultItem | null;
    onSave: (data: CreateVaultItemData) => Promise<void>;
    onCancel: () => void;
}

const CATEGORIES = [
    "General",
    "Social Media",
    "Email Marketing",
    "Ad Copy",
    "SEO",
    "Video Scripts",
    "Other"
];

export function VaultItemForm({ clientId, initialData, onSave, onCancel }: VaultItemFormProps) {
    const [formData, setFormData] = useState<CreateVaultItemData>({
        client_id: clientId,
        title: "",
        content: "",
        category: "General",
        is_favorite: false,
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData({
                client_id: initialData.client_id,
                title: initialData.title,
                content: initialData.content,
                category: initialData.category || "General",
                is_favorite: initialData.is_favorite || false,
            });
        }
    }, [initialData, clientId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);
            await onSave(formData);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="title">العنوان</Label>
                <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="عنوان النص أو الفكرة"
                    required
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="category">التصنيف</Label>
                <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="اختر التصنيف" />
                    </SelectTrigger>
                    <SelectContent>
                        {CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                                {cat}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label htmlFor="content">المحتوى / Prompt</Label>
                <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="أدخل النص أو الـ Prompt هنا..."
                    className="min-h-[150px] font-mono text-sm"
                    required
                    dir="ltr"
                />
            </div>

            <div className="flex items-center space-x-2 space-x-reverse">
                <Switch
                    id="is_favorite"
                    checked={formData.is_favorite}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_favorite: checked })}
                />
                <Label htmlFor="is_favorite">إضافة للمفضلة</Label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                    إلغاء
                </Button>
                <Button type="submit" disabled={loading}>
                    {loading ? "جاري الحفظ..." : initialData ? "تحديث" : "إضافة"}
                </Button>
            </div>
        </form>
    );
}
