import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles, Loader2 } from "lucide-react";
import { VaultList } from "./VaultList";
import { VaultItemForm } from "./VaultItemForm";
import { MasterPrompt } from "./MasterPrompt";
import { vaultService, VaultItem, CreateVaultItemData, UpdateVaultItemData } from "@/services/vaultService";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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

interface VaultDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clientId: string;
    clientName: string;
    client?: any;
}

interface VaultDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clientId: string;
    clientName: string;
    client?: any;
}

export function VaultDialog({ open, onOpenChange, clientId, clientName, client }: VaultDialogProps) {
    const [items, setItems] = useState<VaultItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState<"list" | "form">("list");
    const [activeTab, setActiveTab] = useState("vault");
    const [editingItem, setEditingItem] = useState<VaultItem | null>(null);
    const [clientProducts, setClientProducts] = useState<Product[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(false);

    const fetchItems = async () => {
        try {
            setLoading(true);
            const data = await vaultService.getVaultItems(clientId);
            setItems(data);
        } catch (error) {
            console.error("Error fetching vault items:", error);
            toast.error("فشل في تحميل عناصر المخزن");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open && clientId) {
            fetchItems();
            setView("list");
            setEditingItem(null);
            fetchClientProducts();
        }
    }, [open, clientId]);

    const fetchClientProducts = async () => {
        setLoadingProducts(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('client_id', clientId)
                .eq('is_active', true)
                .order('name');
            if (error) throw error;
            setClientProducts((data || []) as unknown as Product[]);
        } catch (error) {
            console.error("Error fetching client products:", error);
            setClientProducts([]);
        } finally {
            setLoadingProducts(false);
        }
    };

    const handleSave = async (data: CreateVaultItemData) => {
        try {
            if (editingItem) {
                await vaultService.updateVaultItem(editingItem.id, data as UpdateVaultItemData);
                toast.success("تم تحديث العنصر بنجاح");
            } else {
                await vaultService.createVaultItem(data);
                toast.success("تم إضافة العنصر بنجاح");
            }
            await fetchItems();
            setView("list");
            setEditingItem(null);
        } catch (error: any) {
            console.error("Error saving vault item:", error);
            toast.error(`فشل في حفظ العنصر: ${error.message || "خطأ غير معروف"}`);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("هل أنت متأكد من حذف هذا العنصر؟")) return;
        try {
            await vaultService.deleteVaultItem(id);
            toast.success("تم حذف العنصر");
            setItems(items.filter((item) => item.id !== id));
        } catch (error) {
            console.error("Error deleting vault item:", error);
            toast.error("فشل في حذف العنصر");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                    <div className="flex items-center justify-between pl-8">
                        <DialogTitle>مخزن {clientName}</DialogTitle>
                    </div>
                    <DialogDescription className="hidden">
                        لوحة تحكم لإدارة نصوص وإعلانات العميل
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="vault">العناصر المحفوظة</TabsTrigger>
                        <TabsTrigger value="master-prompt" className="gap-2">
                            <Sparkles className="h-4 w-4 text-purple-500" />
                            توليد إعلان
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="vault">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-medium text-muted-foreground">قائمة العناصر</h3>
                            {view === "list" && (
                                <Button onClick={() => { setEditingItem(null); setView("form"); }} size="sm" className="gap-2">
                                    <Plus className="h-4 w-4" />
                                    إضافة جديد
                                </Button>
                            )}
                        </div>

                        {view === "list" ? (
                            <VaultList
                                items={items}
                                onEdit={(item) => {
                                    setEditingItem(item);
                                    setView("form");
                                }}
                                onDelete={handleDelete}
                            />
                        ) : (
                            <div className="mt-4">
                                <VaultItemForm
                                    clientId={clientId}
                                    initialData={editingItem}
                                    onSave={handleSave}
                                    onCancel={() => {
                                        setView("list");
                                        setEditingItem(null);
                                    }}
                                />
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="master-prompt">
                        {loadingProducts ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            </div>
                        ) : (
                            <MasterPrompt
                                clientData={client}
                                products={clientProducts}
                                serviceOptions={client?.specialty ? client.specialty.split(',').map((s: string) => s.trim()).filter(Boolean) : []}
                                offerOptions={client?.promotional_offer ? client.promotional_offer.split(',').map((s: string) => s.trim()).filter(Boolean) : []}
                                onSaveToVault={async (title: string, content: string, category: string) => {
                                    await handleSave({
                                        client_id: clientId,
                                        title,
                                        content,
                                        category,
                                        is_favorite: false
                                    });
                                    // Switch back to vault view to see the new item
                                    setActiveTab("vault");
                                }}
                            />
                        )}
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
