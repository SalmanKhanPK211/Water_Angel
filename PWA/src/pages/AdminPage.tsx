import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useAuth } from '@/hooks/useAuth';
import AdminAuthPage from './AdminAuthPage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ShieldCheck, Search, Plus, Upload, Pencil, Trash2, ArrowLeft, Cpu } from 'lucide-react';
import * as XLSX from 'xlsx';

type DeviceRow = {
  id: string;
  system_key: string;
  device_name: string | null;
  user_id: string | null;
  created_at: string;
};

const AdminPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [authVersion, setAuthVersion] = useState(0); // bump to re-check after register/login
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add/Edit dialog
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DeviceRow | null>(null);
  const [formKey, setFormKey] = useState('');
  const [formName, setFormName] = useState('');
  const [saving, setSaving] = useState(false);

  // Bulk import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const fetchDevices = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('devices')
      .select('id, system_key, device_name, user_id, created_at')
      .order('created_at', { ascending: false })
      .limit(5000);
    if (error) {
      toast.error('Failed to load devices: ' + error.message);
    } else {
      setDevices((data as DeviceRow[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchDevices();
  }, [isAdmin]);

  if (authLoading || adminLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  }
  // Not signed in, or signed in but not admin → show admin auth (register first time, login after)
  if (!user || !isAdmin) {
    return <AdminAuthPage key={authVersion} onAuthed={() => setAuthVersion(v => v + 1)} />;
  }

  const filtered = devices.filter(d => {
    const s = search.trim().toLowerCase();
    if (!s) return true;
    return (
      d.system_key.toLowerCase().includes(s) ||
      (d.device_name || '').toLowerCase().includes(s) ||
      (d.user_id || '').toLowerCase().includes(s)
    );
  });

  const openAdd = () => {
    setEditing(null);
    setFormKey('');
    setFormName('');
    setShowForm(true);
  };
  const openEdit = (d: DeviceRow) => {
    setEditing(d);
    setFormKey(d.system_key);
    setFormName(d.device_name || '');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formKey.trim()) {
      toast.error('System key is required');
      return;
    }
    setSaving(true);
    if (editing) {
      const { error } = await supabase
        .from('devices')
        .update({ system_key: formKey.trim(), device_name: formName.trim() || 'My Water Angel' })
        .eq('id', editing.id);
      if (error) toast.error(error.message); else toast.success('Device updated');
    } else {
      const { error } = await supabase
        .from('devices')
        .insert({ system_key: formKey.trim(), device_name: formName.trim() || 'My Water Angel' });
      if (error) toast.error(error.message); else toast.success('Device added');
    }
    setSaving(false);
    setShowForm(false);
    fetchDevices();
  };

  const handleDelete = async (d: DeviceRow) => {
    if (!confirm(`Delete device ${d.system_key}? This cannot be undone.`)) return;
    const { error } = await supabase.from('devices').delete().eq('id', d.id);
    if (error) toast.error(error.message); else {
      toast.success('Device deleted');
      fetchDevices();
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

      const records = rows
        .map(r => {
          const key = String(r.system_key ?? r.System_Key ?? r['System Key'] ?? r.key ?? '').trim();
          const name = String(r.device_name ?? r['Device Name'] ?? r.name ?? '').trim() || 'My Water Angel';
          return key ? { system_key: key, device_name: name } : null;
        })
        .filter((x): x is { system_key: string; device_name: string } => !!x);

      if (records.length === 0) {
        toast.error('No valid rows. Make sure column "system_key" exists.');
      } else {
        // Insert in chunks of 500
        let inserted = 0;
        let failed = 0;
        for (let i = 0; i < records.length; i += 500) {
          const chunk = records.slice(i, i + 500);
          const { error } = await supabase.from('devices').insert(chunk);
          if (error) failed += chunk.length; else inserted += chunk.length;
        }
        toast.success(`Imported ${inserted} devices` + (failed ? `, ${failed} failed (likely duplicate keys)` : ''));
        fetchDevices();
      }
    } catch (err: any) {
      toast.error('Failed to read file: ' + err.message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-card border-b border-border px-4 py-4 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/profile')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Admin · Devices
          </h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* Stats */}
        <div className="water-card flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Total devices</p>
            <p className="text-2xl font-bold text-foreground">{devices.length}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Paired</p>
            <p className="text-2xl font-bold text-foreground">
              {devices.filter(d => d.user_id).length}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Unpaired</p>
            <p className="text-2xl font-bold text-foreground">
              {devices.filter(d => !d.user_id).length}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <Button onClick={openAdd} size="sm"><Plus className="h-4 w-4 mr-1" /> Add Device</Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            <Upload className="h-4 w-4 mr-1" /> {importing ? 'Importing...' : 'Bulk Import (Excel)'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFile}
          />
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by key, name, or user id..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* List */}
        <div className="water-card divide-y divide-border">
          {loading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No devices found</p>
          ) : (
            filtered.map(d => (
              <div key={d.id} className="py-3 flex items-center gap-3">
                <Cpu className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono text-foreground truncate">{d.system_key}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {d.device_name} · {d.user_id ? 'Paired' : 'Unpaired'}
                  </p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => openEdit(d)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(d)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Tip: Excel file should have a column named <code>system_key</code> (and optionally <code>device_name</code>).
        </p>
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Device' : 'Add Device'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update this device record.' : 'Register a new device that customers can pair.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">System Key</label>
              <Input value={formKey} onChange={e => setFormKey(e.target.value)} placeholder="WA-XXXX-XXXX" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Device Name (optional)</label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="My Water Angel" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPage;
