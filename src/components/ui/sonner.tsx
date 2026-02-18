import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      dir="rtl"
      theme={theme as ToasterProps["theme"]}
      position="top-center"
      richColors
      closeButton
      visibleToasts={4}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:w-full group-[.toaster]:max-w-[560px] group-[.toaster]:rounded-xl group-[.toaster]:border group-[.toaster]:border-border/70 group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:px-4 group-[.toaster]:py-3 group-[.toaster]:shadow-xl group-[.toaster]:backdrop-blur-sm",
          title: "group-[.toast]:text-sm group-[.toast]:font-bold group-[.toast]:leading-6 group-[.toast]:text-right",
          description: "group-[.toast]:mt-1 group-[.toast]:text-sm group-[.toast]:leading-6 group-[.toast]:text-right group-[.toast]:text-foreground/85",
          success: "group-[.toast]:border-emerald-500/40 group-[.toast]:bg-emerald-50 dark:group-[.toast]:bg-emerald-950/40",
          error: "group-[.toast]:border-rose-500/40 group-[.toast]:bg-rose-50 dark:group-[.toast]:bg-rose-950/40",
          warning: "group-[.toast]:border-amber-500/40 group-[.toast]:bg-amber-50 dark:group-[.toast]:bg-amber-950/40",
          info: "group-[.toast]:border-sky-500/40 group-[.toast]:bg-sky-50 dark:group-[.toast]:bg-sky-950/40",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton: "group-[.toast]:border-border/60 group-[.toast]:bg-background/80 group-[.toast]:text-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
