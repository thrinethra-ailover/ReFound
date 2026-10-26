import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import { TextArea } from '../ui/TextArea';
import { Spinner } from '../ui/Spinner';
import { DistinctiveAttributesEditor, type AttributeRow } from './DistinctiveAttributesEditor';
import { ITEM_CATEGORIES, ITEM_COLORS } from '../../utils/constants';
import { toDatetimeLocalValue } from '../../utils/date';
import {
  fetchOwnItemVerificationAttributes,
  replaceOwnItemVerificationAttributes,
  updateOwnItemReport,
} from '../../lib/itemService';
import type { ItemWithImages } from '../../types/database';

interface Props {
  item: ItemWithImages | null;
  reporterId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function EditReportModal({ item, reporterId, onClose, onSaved }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [color, setColor] = useState('');
  const [itemDatetime, setItemDatetime] = useState('');
  const [location, setLocation] = useState('');
  const [attributes, setAttributes] = useState<AttributeRow[]>([]);
  const [attributesLoading, setAttributesLoading] = useState(false);
  const [attributesLoadFailed, setAttributesLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!item) return () => { active = false; };

    setTitle(item.title);
    setDescription(item.description ?? '');
    setCategory(item.category);
    setColor(item.color ?? '');
    setItemDatetime(toDatetimeLocalValue(new Date(item.item_datetime)));
    setLocation(item.location_name ?? '');
    setAttributes([]);
    setAttributesLoadFailed(false);
    setError(null);

    if (item.report_type === 'FOUND') {
      setAttributesLoading(true);
      void fetchOwnItemVerificationAttributes(item.id).then(({ attributes: rows, error: loadError }) => {
        if (!active) return;
        if (loadError) {
          setAttributesLoadFailed(true);
          setError(`Could not load private verification details: ${loadError}`);
          return;
        }
        setAttributes(rows);
      }).finally(() => {
        if (active) setAttributesLoading(false);
      });
    } else {
      setAttributesLoading(false);
    }

    return () => { active = false; };
  }, [item]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!item) return;
    if (!title.trim() || !category || !location.trim() || !itemDatetime || Number.isNaN(new Date(itemDatetime).getTime())) {
      setError('Complete the title, category, date and location.');
      return;
    }

    const cleanedAttributes = attributes.map(({ key, value }) => ({ key: key.trim(), value: value.trim() }));
    if (item.report_type === 'FOUND') {
      if (attributesLoadFailed) {
        setError('Private details could not be loaded. Close and reopen the report before saving.');
        return;
      }
      if (cleanedAttributes.length < 1 || cleanedAttributes.length > 5
        || cleanedAttributes.some(({ key, value }) => !key || !value)) {
        setError('Add between one and five complete private verification details.');
        return;
      }
      if (new Set(cleanedAttributes.map(({ key }) => key.toLowerCase())).size !== cleanedAttributes.length) {
        setError('Each private verification prompt must be unique.');
        return;
      }
    }

    setSaving(true);
    setError(null);
    const { error: saveError } = await updateOwnItemReport({
      itemId: item.id,
      reporterId,
      title,
      description,
      category,
      color,
      itemDatetime: new Date(itemDatetime).toISOString(),
      locationName: location,
      clearCoordinates: location.trim() !== (item.location_name ?? '').trim(),
    });
    if (saveError) {
      setSaving(false);
      setError(saveError);
      return;
    }

    if (item.report_type === 'FOUND') {
      const { error: attributesError } = await replaceOwnItemVerificationAttributes(item.id, cleanedAttributes);
      if (attributesError) {
        setSaving(false);
        setError(`Report details were saved, but private verification details were not: ${attributesError}`);
        return;
      }
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Modal
      open={Boolean(item)}
      onClose={onClose}
      title="Edit your report"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => (document.getElementById('edit-report-form') as HTMLFormElement | null)?.requestSubmit()}
            loading={saving}
            disabled={attributesLoading || attributesLoadFailed}
          >
            Save changes
          </Button>
        </>
      )}
    >
      {item && (
        <form id="edit-report-form" onSubmit={(event) => void save(event)} className="flex flex-col gap-3">
          <Input label="Item title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required />
          <TextArea label="Description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} />
          <Select
            label="Category"
            options={ITEM_CATEGORIES.includes(category as typeof ITEM_CATEGORIES[number]) ? ITEM_CATEGORIES : [category, ...ITEM_CATEGORIES]}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            required
          />
          <Select
            label="Color"
            options={ITEM_COLORS.includes(color as typeof ITEM_COLORS[number]) ? ITEM_COLORS : color ? [color, ...ITEM_COLORS] : ITEM_COLORS}
            value={color}
            onChange={(event) => setColor(event.target.value)}
            placeholder="No color selected"
          />
          <Input
            label={item.report_type === 'LOST' ? 'Date/time lost' : 'Date/time found'}
            type="datetime-local"
            value={itemDatetime}
            onChange={(event) => setItemDatetime(event.target.value)}
            max={toDatetimeLocalValue()}
            required
          />
          <Input label="Location" value={location} onChange={(event) => setLocation(event.target.value)} maxLength={200} required />
          {location.trim() !== (item.location_name ?? '').trim() && (
            <p className="-mt-2 text-xs text-slate">Changing the place clears the old map coordinates to protect accuracy and privacy. Create a new report to attach updated coordinates.</p>
          )}
          {item.report_type === 'FOUND' && (
            attributesLoading ? (
              <Spinner label="Loading private verification details…" />
            ) : (
              <DistinctiveAttributesEditor rows={attributes} onChange={setAttributes} category={category} />
            )
          )}
          {error && <p className="text-sm text-coral-dark" role="alert">{error}</p>}
          <button type="submit" className="hidden" aria-hidden="true" />
        </form>
      )}
    </Modal>
  );
}
