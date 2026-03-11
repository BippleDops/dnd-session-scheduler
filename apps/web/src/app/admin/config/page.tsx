'use client';
import { useApi } from '@/hooks/useApi';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getAdminConfig, saveAdminConfig } from '@/lib/api';
import CandleLoader from '@/components/ui/CandleLoader';
import ParchmentPanel from '@/components/ui/ParchmentPanel';
import WoodButton from '@/components/ui/WoodButton';
import { useToast } from '@/components/ui/Toast';

export default function AdminConfigPage() {
  usePageTitle('Configuration');
  const { data: config, loading } = useApi(getAdminConfig);
  const { toast } = useToast();

  if (loading) return <CandleLoader text="Reading the arcane scrolls..." />;

  return (
    <div>
      <h1 className="scroll-heading text-3xl mb-6">⚙️ Configuration</h1>
      <ParchmentPanel>
        <table className="w-full text-sm text-[var(--ink)]">
          <thead><tr className="border-b-2 border-[var(--parchment-dark)]"><th className="text-left p-2">Key</th><th className="text-left p-2">Value</th><th className="text-left p-2">Description</th><th className="p-2"></th></tr></thead>
          <tbody>
            {(config || []).map((c, idx) => (
              <tr key={c.key} className="border-b border-[rgba(0,0,0,0.05)]">
                <td className="p-2"><code className="bg-[var(--parchment-dark)] px-1 rounded text-xs">{c.key}</code></td>
                <td className="p-2"><input defaultValue={c.value} id={`cfg-${idx}`} className="tavern-input text-sm" /></td>
                <td className="p-2 text-xs text-[var(--ink-faded)]">{c.description}</td>
                <td className="p-2"><WoodButton variant="sm" onClick={async () => {
                  const val = (document.getElementById(`cfg-${idx}`) as HTMLInputElement).value;
                  await saveAdminConfig(c.key, val);
                  toast(`${c.key} saved`, 'success');
                }}>Save</WoodButton></td>
              </tr>
            ))}
          </tbody>
        </table>
      </ParchmentPanel>
    </div>
  );
}

