import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { TextArea } from '../ui/TextArea';
import { ImageUpload } from './ImageUpload';
import { DistinctiveAttributesEditor, type AttributeRow } from './DistinctiveAttributesEditor';
import { ITEM_CATEGORIES, ITEM_COLORS } from '../../utils/constants';
import { validateReportForm } from '../../utils/validation';
import { toDatetimeLocalValue } from '../../utils/date';
import { createItemReport, findSimilarReports, type SimilarReport } from '../../lib/itemService';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import type { ReportType } from '../../types/database';

export function ReportForm() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const prefillType = searchParams.get('type');
  const prefillCategory = searchParams.get('category');

  const [reportType, setReportType] = useState<ReportType>(prefillType === 'FOUND' ? 'FOUND' : 'LOST');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(prefillCategory ?? '');
  const [color, setColor] = useState('');
  const [itemDatetime, setItemDatetime] = useState(toDatetimeLocalValue());
  const [locationName, setLocationName] = useState('');
  const [useMyLocation, setUseMyLocation] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [attributes, setAttributes] = useState<AttributeRow[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [similarReports, setSimilarReports] = useState<SimilarReport[]>([]);

  useEffect(() => {
    if (!user || !category || title.trim().length < 4) { setSimilarReports([]); return; }
    let current = true;
    const timer = window.setTimeout(() => {
      void findSimilarReports({ title, description, category, reportType, reporterId: user.id })
        .then((rows) => { if (current) setSimilarReports(rows); });
    }, 450);
    return () => { current = false; window.clearTimeout(timer); };
  }, [user, title, description, category, reportType]);

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not available in this browser.', 'error');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setUseMyLocation(true);
        setLocating(false);
        showToast('Current location captured.', 'success');
      },
      () => {
        setLocating(false);
        showToast('Could not access your location. You can still type it manually.', 'error');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const result = validateReportForm({
      reportType,
      title,
      description,
      category,
      color,
      itemDatetime,
      locationName,
    });
    const nextErrors = { ...result.errors };
    const hasPrivateFoundDetail = attributes.some((attribute) => attribute.key.trim() && attribute.value.trim());
    if (reportType === 'FOUND' && !hasPrivateFoundDetail) {
      nextErrors.verificationAttributes = 'Add at least one private detail so a claimant can prove ownership.';
    }
    setErrors(nextErrors);
    if (!result.valid || (reportType === 'FOUND' && !hasPrivateFoundDetail)) return;

    setSubmitting(true);
    const { itemId, error, matchesFound } = await createItemReport({
      reporterId: user.id,
      reportType,
      title,
      description,
      category,
      color,
      itemDatetime: new Date(itemDatetime).toISOString(),
      latitude: useMyLocation ? coords?.lat ?? null : null,
      longitude: useMyLocation ? coords?.lng ?? null : null,
      locationName,
      image,
      distinctiveAttributes: attributes,
    });
    setSubmitting(false);

    if (error && !itemId) {
      showToast(error, 'error');
      return;
    }
    if (error) {
      // Partial success (e.g. image upload failed) — report was still created.
      showToast(error, 'error');
    } else if (matchesFound && matchesFound > 0) {
      showToast(
        `Report saved — found ${matchesFound} potential match${matchesFound === 1 ? '' : 'es'}!`,
        'success'
      );
      navigate('/matches');
      return;
    } else {
      showToast(
        reportType === 'LOST' ? 'Lost item reported. We\u2019ll watch for matches.' : 'Found item reported. Thank you!',
        'success'
      );
    }
    navigate('/dashboard');
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      {prefillCategory && (
        <div className="rounded-lg border border-signal/30 bg-signal/5 px-3 py-2 text-xs text-signal-dark">
          Pre-filled from a scanned recovery code — double check the details before submitting.
        </div>
      )}
      <div>
        <span className="text-sm font-medium text-ink">Report type</span>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setReportType('LOST')}
            className={`rounded-xl border-2 px-4 py-3 text-left transition-colors ${
              reportType === 'LOST'
                ? 'border-signal bg-signal/5'
                : 'border-border bg-white hover:border-signal/40'
            }`}
          >
            <span className="font-display font-semibold text-ink">LOST</span>
            <p className="text-xs text-slate mt-0.5">I lost something on campus</p>
          </button>
          <button
            type="button"
            onClick={() => setReportType('FOUND')}
            className={`rounded-xl border-2 px-4 py-3 text-left transition-colors ${
              reportType === 'FOUND'
                ? 'border-beacon bg-beacon/10'
                : 'border-border bg-white hover:border-beacon/50'
            }`}
          >
            <span className="font-display font-semibold text-ink">FOUND</span>
            <p className="text-xs text-slate mt-0.5">I found something on campus</p>
          </button>
        </div>
      </div>

      <Input
        label="Item title"
        placeholder="e.g. Black North Face backpack"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        error={errors.title}
        maxLength={100}
        required
      />

      {similarReports.length > 0 && (
        <aside className="-mt-4 rounded-xl border border-beacon/40 bg-beacon/10 p-4" aria-live="polite">
          <h2 className="text-sm font-semibold text-ink">Similar active reports</h2>
          <p className="mt-1 text-xs text-slate">Check these first in case someone already reported the same item. This hint is not a match decision, and you can still submit.</p>
          <ul className="mt-3 space-y-2">
            {similarReports.map((report) => (
              <li key={report.id} className="rounded-lg bg-white/70 px-3 py-2 text-sm">
                <span className="font-semibold text-ink">{report.title}</span>
                <span className="text-slate"> · {report.category} · {report.location_name || 'Campus'} · {new Date(report.item_datetime).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </aside>
      )}

      <TextArea
        label="Description"
        placeholder="General appearance, brand, notable features visible from the outside…"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        error={errors.description}
        maxLength={1000}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="Category"
          options={ITEM_CATEGORIES}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          error={errors.category}
          required
        />
        <Select
          label="Color"
          options={ITEM_COLORS}
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label={reportType === 'LOST' ? 'Date/time lost' : 'Date/time found'}
          type="datetime-local"
          value={itemDatetime}
          onChange={(e) => setItemDatetime(e.target.value)}
          error={errors.itemDatetime}
          max={toDatetimeLocalValue()}
          required
        />
        <Input
          label="Location"
          placeholder="e.g. Library, 2nd floor"
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
          error={errors.locationName}
          required
        />
      </div>

      <div>
        <button
          type="button"
          onClick={handleUseLocation}
          disabled={locating}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-signal hover:text-signal-dark disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
            <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M12 21c3.5-4 6-7.4 6-10.4A6 6 0 0 0 6 10.6C6 13.6 8.5 17 12 21Z" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          {locating ? 'Getting your location…' : useMyLocation ? 'Location attached' : 'Attach my current location (optional)'}
        </button>
        <p className="text-xs text-slate mt-1">
          Only used to improve matching accuracy. Never shown publicly as exact coordinates.
        </p>
      </div>

      <ImageUpload file={image} onChange={setImage} />

      {reportType === 'FOUND' ? (
        <>
          <DistinctiveAttributesEditor rows={attributes} onChange={setAttributes} category={category} />
          {errors.verificationAttributes && (
            <p className="-mt-4 text-sm text-coral-dark">{errors.verificationAttributes}</p>
          )}
        </>
      ) : (
        <div className="rounded-card border border-border bg-paper/60 p-4 text-sm text-slate">
          Ownership questions are based on private details recorded by the person who reports the item as found.
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" loading={submitting} size="lg">
          Submit {reportType === 'LOST' ? 'lost' : 'found'} report
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={() => navigate(-1)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
