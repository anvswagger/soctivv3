import { Slider } from '@/components/ui/slider';

interface SliderQuestionProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  unit?: string;
}

export function SliderQuestion({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  unit = '%',
}: SliderQuestionProps) {
  return (
    <div className="space-y-6 w-full">
      {label && (
        <p className="text-sm text-muted-foreground text-center">{label}</p>
      )}

      <div className="px-2">
        <div className="text-center mb-4">
          <span className="text-4xl font-bold text-primary">{value}{unit}</span>
        </div>
        <Slider
          value={[value]}
          onValueChange={(vals) => onChange(vals[0])}
          min={min}
          max={max}
          step={step}
          className="w-full"
        />
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>{min}{unit}</span>
          <span>{max}{unit}</span>
        </div>
      </div>
    </div>
  );
}
