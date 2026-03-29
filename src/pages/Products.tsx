import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { hapticLight } from '@/lib/haptics';
import { clientsService } from '@/services/clientsService';
import { Plus, Search, Package, Edit, Trash2, Loader2, Download, Upload, Image as ImageIcon, X } from 'lucide-react';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Product {
    id: string;
    name: string;
    description: string | null;
    price: number;
    sku: string | null;
    code: string | null;
    category: string | null;
    stock_quantity: number;
    image_url: string | null;
    client_id: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

function generateLocalCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

export default function Products() {
    const { client, isAdmin, isSuperAdmin, assignedClients } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [search, setSearch] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        sku: '',
        category: '',
        stock_quantity: '0',
        image_url: '',
        client_id: '',
        is_active: true,
    });

    const { data: products = [], isLoading } = useQuery({
        queryKey: ['products', search],
        queryFn: async () => {
            let query = supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false }) as any;

            if (search) {
                query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,code.ilike.%${search}%,category.ilike.%${search}%`);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data as Product[];
        },
        staleTime: 1000 * 60 * 5,
    });

    const { data: clients = [] } = useQuery({
        queryKey: ['clients'],
        queryFn: () => clientsService.getClients(),
        enabled: isAdmin || isSuperAdmin,
        staleTime: 1000 * 60 * 30,
    });

    const availableClients = isSuperAdmin
        ? clients
        : isAdmin
            ? clients.filter((c: any) => assignedClients.includes(c.id))
            : [];

    const uploadImage = async (file: File): Promise<string | null> => {
        setUploadingImage(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `products/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from('product-images')
                .getPublicUrl(filePath);

            return data.publicUrl;
        } catch (error: any) {
            toast({ title: 'خطأ في رفع الصورة', description: error.message, variant: 'destructive' });
            return null;
        } finally {
            setUploadingImage(false);
        }
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast({ title: 'خطأ', description: 'يرجى اختيار ملف صورة صالح', variant: 'destructive' });
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast({ title: 'خطأ', description: 'حجم الصورة يجب أن يكون أقل من 5 ميجابايت', variant: 'destructive' });
            return;
        }

        setImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setImagePreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const clearImage = () => {
        setImageFile(null);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const { error } = await supabase.from('products').insert(data);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast({ title: 'تمت الإضافة', description: 'تمت إضافة المنتج بنجاح' });
            setDialogOpen(false);
            resetForm();
        },
        onError: (error: any) => {
            toast({ title: 'خطأ', description: error.message || 'فشل في إضافة المنتج', variant: 'destructive' });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            const { error } = await supabase.from('products').update(data).eq('id', id as any);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast({ title: 'تم التحديث', description: 'تم تحديث المنتج بنجاح' });
            setDialogOpen(false);
            resetForm();
        },
        onError: (error: any) => {
            toast({ title: 'خطأ', description: error.message || 'فشل في تحديث المنتج', variant: 'destructive' });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('products').delete().eq('id', id as any);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast({ title: 'تم الحذف', description: 'تم حذف المنتج بنجاح' });
        },
        onError: (error: any) => {
            toast({ title: 'خطأ', description: error.message || 'فشل في حذف المنتج', variant: 'destructive' });
        },
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        let imageUrl = formData.image_url || null;

        if (imageFile) {
            const uploaded = await uploadImage(imageFile);
            if (uploaded) {
                imageUrl = uploaded;
            } else {
                return;
            }
        }

        const clientId = isAdmin ? (formData.client_id || null) : (client?.id || null);

        const productData: any = {
            name: formData.name,
            description: formData.description || null,
            price: parseFloat(formData.price) || 0,
            sku: formData.sku || null,
            category: formData.category || null,
            stock_quantity: parseInt(formData.stock_quantity) || 0,
            image_url: imageUrl,
            client_id: clientId,
            is_active: formData.is_active,
        };

        if (editingProduct) {
            updateMutation.mutate({ id: editingProduct.id, data: productData });
        } else {
            createMutation.mutate(productData);
        }
    };

    const handleEdit = (product: Product) => {
        setEditingProduct(product);
        setFormData({
            name: product.name,
            description: product.description || '',
            price: product.price.toString(),
            sku: product.sku || '',
            category: product.category || '',
            stock_quantity: product.stock_quantity.toString(),
            image_url: product.image_url || '',
            client_id: product.client_id || '',
            is_active: product.is_active,
        });
        if (product.image_url) {
            setImagePreview(product.image_url);
        }
        setDialogOpen(true);
    };

    const handleDelete = (id: string) => {
        deleteMutation.mutate(id);
    };

    const resetForm = () => {
        setEditingProduct(null);
        clearImage();
        setFormData({
            name: '',
            description: '',
            price: '',
            sku: '',
            category: '',
            stock_quantity: '0',
            image_url: '',
            client_id: '',
            is_active: true,
        });
    };

    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-heading font-bold">المنتجات</h1>
                        <p className="text-muted-foreground">إدارة كتالوج المنتجات</p>
                    </div>
                    <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
                        <DialogTrigger asChild>
                            <Button onClick={() => hapticLight()} className="gap-2">
                                <Plus className="h-4 w-4" />
                                إضافة منتج
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
                            <DialogHeader>
                                <DialogTitle>{editingProduct ? 'تعديل المنتج' : 'إضافة منتج جديد'}</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>اسم المنتج *</Label>
                                    <Input
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>السعر *</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={formData.price}
                                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>الكمية في المخزون</Label>
                                        <Input
                                            type="number"
                                            value={formData.stock_quantity}
                                            onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>رمز المنتج (SKU)</Label>
                                        <Input
                                            value={formData.sku}
                                            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>الفئة</Label>
                                        <Input
                                            value={formData.category}
                                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        />
                                    </div>
                                </div>
                                {isAdmin && (
                                    <div className="space-y-2">
                                        <Label>المتجر / العميل</Label>
                                        <Select
                                            value={formData.client_id}
                                            onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="اختر المتجر" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableClients.map((c: any) => (
                                                    <SelectItem key={c.id} value={c.id}>
                                                        {c.company_name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <Label>الوصف</Label>
                                    <Textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>صورة المنتج</Label>
                                    <div className="flex items-center gap-3">
                                        {imagePreview ? (
                                            <div className="relative w-20 h-20 rounded-lg overflow-hidden border">
                                                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={clearImage}
                                                    className="absolute top-1 left-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center">
                                                <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                                            </div>
                                        )}
                                        <div className="flex-1">
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={handleImageSelect}
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="gap-2"
                                            >
                                                <Upload className="h-4 w-4" />
                                                {imageFile ? 'تغيير الصورة' : 'رفع صورة'}
                                            </Button>
                                            <p className="text-xs text-muted-foreground mt-1">PNG, JPG حتى 5MB</p>
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    type="submit"
                                    className="w-full"
                                    disabled={createMutation.isPending || updateMutation.isPending || uploadingImage}
                                >
                                    {(createMutation.isPending || updateMutation.isPending || uploadingImage) ? (
                                        <><Loader2 className="h-4 w-4 animate-spin ml-2" />جاري الحفظ...</>
                                    ) : editingProduct ? 'تحديث' : 'إضافة'}
                                </Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="بحث عن منتج (بالاسم، الرمز، أو الفئة)..."
                                    className="pr-10"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : products.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p>لا توجد منتجات</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-right">المنتج</TableHead>
                                        <TableHead className="text-right">الرمز</TableHead>
                                        <TableHead className="text-right">السعر</TableHead>
                                        <TableHead className="text-right">المخزون</TableHead>
                                        <TableHead className="text-right">الفئة</TableHead>
                                        {isAdmin && <TableHead className="text-right">المتجر</TableHead>}
                                        <TableHead className="text-right">الحالة</TableHead>
                                        <TableHead className="text-right">الإجراءات</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {products.map((product) => (
                                        <TableRow key={product.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    {product.image_url ? (
                                                        <img src={product.image_url} alt={product.name} className="w-10 h-10 rounded-lg object-cover" />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                                                            <Package className="h-5 w-5 text-muted-foreground" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-medium">{product.name}</p>
                                                        {product.sku && <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {product.code && (
                                                    <Badge variant="outline" className="font-mono text-xs">
                                                        {product.code}
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-medium">{product.price.toLocaleString()} د.ل</TableCell>
                                            <TableCell>
                                                <Badge variant={product.stock_quantity > 0 ? 'default' : 'destructive'}>
                                                    {product.stock_quantity}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{product.category || '-'}</TableCell>
                                            {isAdmin && (
                                                <TableCell>
                                                    {clients.find((c: any) => c.id === product.client_id)?.company_name || '-'}
                                                </TableCell>
                                            )}
                                            <TableCell>
                                                <Badge variant={product.is_active ? 'default' : 'secondary'}>
                                                    {product.is_active ? 'نشط' : 'غير نشط'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-2">
                                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(product)}>
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(product.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
