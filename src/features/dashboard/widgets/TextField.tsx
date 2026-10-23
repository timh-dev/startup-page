import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function TextField({
  id, label, value, placeholder, onChange,
}: { id: string; label: string; value: string; placeholder?: string; onChange: (value: string) => void }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
