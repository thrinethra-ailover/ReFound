import { Input } from '../ui/Input';
import { ID_CARD_PRESENCE_ATTRIBUTE_KEY, ID_CARD_PRESENT_VALUE } from '../../lib/matching/verificationAttributes';

export interface AttributeRow {
  key: string;
  value: string;
}

interface DistinctiveAttributesEditorProps {
  rows: AttributeRow[];
  onChange: (rows: AttributeRow[]) => void;
  category: string;
}

const MAX_ATTRIBUTES = 5;

const ID_CARD_CATEGORIES = new Set(['Bags & Backpacks', 'Wallets & Cards', 'Clothing & Accessories']);

export function DistinctiveAttributesEditor({ rows, onChange, category }: DistinctiveAttributesEditorProps) {
  const supportsIdCardCheck = ID_CARD_CATEGORIES.has(category);
  const hasIdCardAttribute = rows.some((row) => row.key === ID_CARD_PRESENCE_ATTRIBUTE_KEY);
  const visibleRows = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !supportsIdCardCheck || row.key !== ID_CARD_PRESENCE_ATTRIBUTE_KEY);

  const toggleIdCardAttribute = (checked: boolean) => {
    if (checked) {
      if (rows.length >= MAX_ATTRIBUTES || hasIdCardAttribute) return;
      onChange([...rows, { key: ID_CARD_PRESENCE_ATTRIBUTE_KEY, value: ID_CARD_PRESENT_VALUE }]);
    } else {
      onChange(rows.filter((row) => row.key !== ID_CARD_PRESENCE_ATTRIBUTE_KEY));
    }
  };

  const updateRow = (index: number, field: keyof AttributeRow, value: string) => {
    const next = rows.map((row, i) => (i === index ? { ...row, [field]: value } : row));
    onChange(next);
  };

  const addRow = () => {
    if (rows.length >= MAX_ATTRIBUTES) return;
    onChange([...rows, { key: '', value: '' }]);
  };

  const removeRow = (index: number) => {
    onChange(rows.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-paper/60 p-4">
      <div>
        <p className="text-sm font-semibold text-ink">Private verification details</p>
        <p className="text-xs text-slate mt-0.5">
          Record details you observed on the item that its owner could identify. Use a short prompt such as “Sticker” and keep the answer private, such as “silver star on the bottom-left corner.” The claimant will answer the prompt; the saved answer is never shown to them or on public item cards.
        </p>
      </div>

      {supportsIdCardCheck && (
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-white/60 p-3 text-sm text-ink">
          <input
            type="checkbox"
            checked={hasIdCardAttribute}
            onChange={(event) => toggleIdCardAttribute(event.target.checked)}
            disabled={!hasIdCardAttribute && rows.length >= MAX_ATTRIBUTES}
            className="mt-0.5 h-4 w-4 accent-signal"
          />
          <span>
            <span className="block font-medium">ID card or equivalent is inside</span>
            <span className="mt-0.5 block text-xs text-slate">Adds a private yes/no ownership question.</span>
          </span>
        </label>
      )}

      {visibleRows.length === 0 && !hasIdCardAttribute && (
        <p className="text-xs text-slate-light italic">No distinctive attributes added yet.</p>
      )}

      {visibleRows.map(({ row, index }) => (
        <div key={index} className="flex items-end gap-2">
          <Input
            label="Question prompt"
            placeholder="e.g. Sticker"
            value={row.key}
            onChange={(e) => updateRow(index, 'key', e.target.value)}
            className="flex-1"
          />
          <Input
            label="Detail"
            placeholder="e.g. Silver star on bottom-left corner"
            value={row.value}
            onChange={(e) => updateRow(index, 'value', e.target.value)}
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => removeRow(index)}
            className="mb-[3px] rounded-lg border border-border px-2.5 py-2.5 text-coral-dark hover:bg-coral/5"
            aria-label="Remove attribute"
          >
            &times;
          </button>
        </div>
      ))}

      {rows.length < MAX_ATTRIBUTES && (
        <button
          type="button"
          onClick={addRow}
          className="self-start text-sm font-medium text-signal hover:text-signal-dark"
        >
          + Add distinctive attribute
        </button>
      )}
    </div>
  );
}
