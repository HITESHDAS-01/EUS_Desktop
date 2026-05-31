import { useEffect, useState } from 'react';
import { Button, Input, Label } from '@/components/ui/basic';
import { api } from '@/lib/api';
import type { Vendor } from '@/types/db';

export default function Vendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const [toDelete, setToDelete] = useState<Vendor | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { void fetchVendors(); }, []);

  const fetchVendors = async () => {
    setLoading(true);
    try {
      setVendors(await api.listVendors());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditingId(null); setName(''); setAddress(''); setFormError('');
    setIsModalOpen(true);
  };
  const openEdit = (v: Vendor) => {
    setEditingId(v.id); setName(v.name); setAddress(v.address || ''); setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true); setFormError('');
    try {
      const input = { name: name.trim(), address: address.trim() || null };
      if (editingId) await api.updateVendor(editingId, input);
      else await api.createVendor(input);
      setIsModalOpen(false);
      await fetchVendors();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true); setDeleteError('');
    try {
      await api.deleteVendor(toDelete.id);
      setToDelete(null);
      await fetchVendors();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  };

  const filtered = vendors.filter(
    (v) =>
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.address || '').toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h2 className="text-xl font-bold text-gray-800">Vendors ({vendors.length})</h2>
        <Button onClick={openAdd} className="gap-2">
          <i className="fas fa-plus"></i> Add Vendor
        </Button>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{error}</div>}

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="relative">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input
            type="text"
            placeholder="Search by name or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1e5a48]"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4 font-medium">Name</th>
                <th className="p-4 font-medium">Address</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={3} className="p-8 text-center text-gray-500">Loading vendors…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={3} className="p-8 text-center text-gray-500">
                  {vendors.length === 0 ? 'No vendors yet. Click "Add Vendor" to get started.' : 'No vendors match your search.'}
                </td></tr>
              ) : (
                filtered.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#1e5a48]/10 flex items-center justify-center text-[#1e5a48]">
                          <i className="fas fa-store"></i>
                        </div>
                        <p className="font-bold text-gray-800">{v.name}</p>
                      </div>
                    </td>
                    <td className="p-4 text-gray-600">{v.address || <span className="text-gray-400 italic">—</span>}</td>
                    <td className="p-4 text-right space-x-3">
                      <button onClick={() => openEdit(v)} className="text-[#f7b05e] hover:text-[#e09d3e]" title="Edit">
                        <i className="fas fa-edit"></i>
                      </button>
                      <button onClick={() => { setDeleteError(''); setToDelete(v); }} className="text-red-500 hover:text-red-700" title="Delete">
                        <i className="fas fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <Modal title={editingId ? 'Edit Vendor' : 'Add Vendor'} onClose={() => setIsModalOpen(false)}>
          {formError && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{formError}</div>}
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Name <span className="text-red-500">*</span></Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Bajaj Electronics" />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm resize-none"
                placeholder="Shop address (optional)"
              />
            </div>
            <Button type="submit" className="w-full" disabled={formLoading}>
              {formLoading ? 'Saving…' : editingId ? 'Update Vendor' : 'Add Vendor'}
            </Button>
          </form>
        </Modal>
      )}

      {toDelete && (
        <Modal title="Delete Vendor?" tone="danger" onClose={() => setToDelete(null)}>
          <p className="text-gray-700 mb-4">
            Delete <strong>{toDelete.name}</strong>? You cannot delete a vendor that has EMI loans linked to it.
          </p>
          {deleteError && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{deleteError}</div>}
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setToDelete(null)} disabled={deleting}>Cancel</Button>
            <Button onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white">
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, tone, children, onClose }: { title: string; tone?: 'danger'; children: React.ReactNode; onClose: () => void }) {
  const headerCls = tone === 'danger' ? 'bg-red-50 text-red-800' : 'bg-[#0b3b2f] text-white';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className={`p-5 border-b flex justify-between items-center ${headerCls}`}>
          <h3 className="font-bold text-lg">{title}</h3>
          <button onClick={onClose} className="opacity-70 hover:opacity-100">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
