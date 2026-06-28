/**
 * Small form field components used across the editor's section cards.
 * Thin wrappers over the shadcn Input/Textarea/Label to keep the editor's
 * section components short and consistent.
 */
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
    label: string;
    hint?: string;
}

export function Field({ label, hint, className, ...props }: FieldProps) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs font-medium">{label}</Label>
            <Input
                className={cn('h-9 text-sm', className)}
                dir="auto"
                {...props}
            />
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
    );
}

export interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label: string;
    hint?: string;
}

export function TextareaField({ label, hint, className, ...props }: TextareaFieldProps) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs font-medium">{label}</Label>
            <Textarea
                className={cn('text-sm min-h-[60px]', className)}
                dir="auto"
                {...props}
            />
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
    );
}
