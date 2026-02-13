'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getCampaignsList, type Campaign } from '@/lib/api';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import WoodButton from '@/components/ui/WoodButton';
import CandleLoader from '@/components/ui/CandleLoader';
import { EmptyStateFromPreset } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';

interface GalleryItem {
  item_id: string; campaign_id: string; player_id: string; type: string;
  title: string; description: string; image_url: string; upvotes: number;
  created_at: string; player_name?: string;
}

const BASE = process.env.NEXT_PUBLIC_API_URL || '';
async function fetchJson<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, { credentials: 'include', ...opts, headers: { 'Content-Type': 'application/json', ...opts?.headers } });
  return res.json();
}

export default function GalleryPage() {
  usePageTitle('Gallery');
  const { isLoggedIn } = useAuth();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', imageUrl: '', campaignId: '' });

  useEffect(() => { getCampaignsList().then(setCampaigns); }, []);

  useEffect(() => {
    setLoading(true);
    fetchJson<GalleryItem[]>(`/api/gallery${selectedCampaign ? `?campaignId=${selectedCampaign}` : ''}`)
      .then(setItems).finally(() => setLoading(false));
  }, [selectedCampaign]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.imageUrl) { toast('Image URL required', 'error'); return; }
    try {
      await fetchJson('/api/me/gallery', { method: 'POST', body: JSON.stringify(form) });
      toast('Art submitted!', 'success');
      setShowUpload(false);
      setForm({ title: '', description: '', imageUrl: '', campaignId: '' });
      fetchJson<GalleryItem[]>(`/api/gallery${selectedCampaign ? `?campaignId=${selectedCampaign}` : ''}`).then(setItems);
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); }
  };

  const handleUpvote = async (itemId: string) => {
    try {
      await fetchJson(`/api/gallery/${itemId}/upvote`, { method: 'POST' });
      setItems(prev => prev.map(i => i.item_id === itemId ? { ...i, upvotes: i.upvotes + 1 } : i));
    } catch {}
  };

  if (loading) return <CandleLoader text="Loading gallery..." />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h1 className="font-[var(--font-heading)] text-2xl text-[var(--gold)]">🎨 Art Gallery</h1>
        <div className="flex gap-2">
          <select className="tavern-input max-w-[160px]" value={selectedCampaign} onChange={e => setSelectedCampaign(e.target.value)}>
            <option value="">All Campaigns</option>
            {campaigns.map(c => <option key={c.campaign_id} value={c.campaign_id}>{c.name}</option>)}
          </select>
          {isLoggedIn && <WoodButton onClick={() => setShowUpload(!showUpload)}>{showUpload ? 'Cancel' : '+ Upload Art'}</WoodButton>}
        </div>
      </div>

      {showUpload && (
        <ParchmentPanel title="Submit Art">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="col-span-full">
              <label className="block text-xs font-bold mb-1">Image URL *</label>
              <input required className="tavern-input" value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Title</label>
              <input className="tavern-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Campaign</label>
              <select className="tavern-input" value={form.campaignId} onChange={e => setForm({ ...form, campaignId: e.target.value })}>
                <option value="">General</option>
                {campaigns.map(c => <option key={c.campaign_id} value={c.campaign_id}>{c.name}</option>)}
              </select>
            </div>
            <div className="col-span-full">
              <label className="block text-xs font-bold mb-1">Description</label>
              <textarea className="tavern-input h-16" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="col-span-full flex justify-end">
              <WoodButton variant="primary" type="submit">Submit Art</WoodButton>
            </div>
          </form>
        </ParchmentPanel>
      )}

      {items.length === 0 ? (
        <div className="parchment p-10 text-center">
          <div className="text-5xl mb-4 opacity-60">🎨</div>
          <h2 className="font-[var(--font-heading)] text-xl text-[var(--ink)] mb-2">The gallery awaits your art</h2>
          <p className="text-[var(--ink-faded)] italic">Upload character portraits, scene illustrations, or anything D&D-related!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => (
            <div key={item.item_id} className="parchment overflow-hidden card-enter">
              <img src={item.image_url} alt={item.title || 'Gallery art'} className="w-full h-48 object-cover" />
              <div className="p-3">
                {item.title && <h3 className="font-[var(--font-heading)] text-sm text-[var(--ink)]">{item.title}</h3>}
                {item.description && <p className="text-xs text-[var(--ink-faded)] mt-1">{item.description}</p>}
                <div className="flex justify-between items-center mt-2">
                  <span className="text-[10px] text-[var(--ink-faded)]">{item.player_name || 'Anonymous'}</span>
                  <button onClick={() => handleUpvote(item.item_id)} className="flex items-center gap-1 text-xs bg-transparent border-none cursor-pointer hover:text-[var(--gold)] transition-colors">
                    ❤️ {item.upvotes}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
