import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Label } from '@/components/ui/basic';
import { api, photoSrc } from '@/lib/api';
import { safeFormatDate } from '@/lib/utils';
import type { EmiCustomer, EmiCustomerInput } from '@/types/db';

type SortKey = 'created_desc' | 'created_asc' | 'name_asc' | 'name_desc' | 'code_asc' | 'code_desc';

export default function EmiCustomers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<EmiCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('created_desc');
  const [success, setSuccess] = useState('');

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [fatherHusbandName, setFatherHusbandName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [aadhaarVid, setAadhaarVid] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [occupation, setOccupation] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [nomineeName, setNomineeName] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const [toDelete, setToDelete] = useState<EmiCustomer | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { void fetchCustomers(); }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      setCustomers(await api.listEmiCustomers());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFullName(''); setPhone(''); setAddress(''); setFatherHusbandName('');
    setDateOfBirth(''); setAadhaarVid(''); setPanNumber('');
    setOccupation(''); setMonthlyIncome(''); setNomineeName('');
    setNotes(''); setPhotoUrl(''); setPhotoFile(null); setFormError('');
  };

  const openAdd = () => { reset(); setEditingId(null); setIsOpen(true); };
  const openEdit = (c: EmiCustomer) => {
    reset();
    setEditingId(c.id);
    setFullName(c.full_name);
    setPhone(c.phone || ''); setAddress(c.address || '');
    setFatherHusbandName(c.father_husband_name || '');
    setDateOfBirth(c.date_of_birth || ''); setAadhaarVid(c.aadhaar_vid || '');
    setPanNumber(c.pan_number || ''); setOccupation(c.occupation || '');
    setMonthlyIncome(c.monthly_income?.toString() || '');
    setNomineeName(c.nominee_name || ''); setNotes(c.notes || '');
    setPhotoUrl(c.photo_url || '');
    setIsOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true); setFormError('');
    try {
      if (!fullName.trim()) throw new Error('Customer name is required');
      let finalPhoto = photoUrl;
      if (photoFile) finalPhoto = await api.saveEmiCustomerPhoto(photoFile);
      const input: EmiCustomerInput = {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        father_husband_name: fatherHusbandName.trim() || null,
        date_of_birth: dateOfBirth || null,
        aadhaar_vid: aadhaarVid.trim() || null,
        pan_number: panNumber.trim().toUpperCase() || null,
        occupation: occupation.trim() || null,
        monthly_income: monthlyIncome ? Number(monthlyIncome) : null,
        nominee_name: nomineeName.trim() || null,
        photo_url: finalPhoto || null,
        notes: notes.trim() || null,
      };
      if (editingId) {
        await api.updateEmiCustomer(editingId, input);
        setSuccess('Customer updated.');
      } else {
        const c = await api.createEmiCustomer(input);
        setSuccess(`Customer ${c.customer_code} created.`);
      }
      setIsOpen(false);
      await fetchCustomers();
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
      await api.deleteEmiCustomer(toDelete.id);
      setToDelete(null);
      await fetchCustomers();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  };

  const filtered = customers
    .filter((c) => {
      const q = searchQuery.toLowerCase();
      return (
        c.full_name.toLowerCase().includes(q) ||
        (c.customer_code || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(searchQuery)
      );
    })
    .sort((a, b) => {
      const nA = a.full_name.toLowerCase(); const nB = b.full_name.toLowerCase();
      const cA = a.customer_code || ''; const cB = b.customer_code || '';
      switch (sortBy) {
        case 'name_asc': return nA.localeCompare(nB);
        case 'name_desc': return nB.localeCompare(nA);
        case 'code_asc': return cA.localeCompare(cB);
        case 'code_desc': return cB.localeCompare(cA);
        case 'created_asc': return a.created_at.localeCompare(b.created_at);
        case 'created_desc':
        default: return b.created_at.localeCompare(a.created_at);
      }
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h2 className="text-xl font-bold text-gray-800">EMI Customers ({customers.length})</h2>
        <Button onClick={openAdd} className="gap-2">
          <i className="fas fa-user-plus"></i> Add Customer
        </Button>
      </div>

      {success && (
        <div className="p-3 rounded-lg border bg-green-50 text-green-700 border-green-200 flex justify-between">
          <p>{success}</p>
          <button onClick={() => setSuccess('')}><i className="fas fa-times"></i></button>
        </div>
      )}
      {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{error}</div>}

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input
            type="text"
            placeholder="Search by name, code, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1e5a48]"
          />
        </div>
        <select
          className="px-4 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e5a48]"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
        >
          <option value="created_desc">Newest first</option>
          <option value="created_asc">Oldest first</option>
          <option value="name_asc">Name A → Z</option>
          <option value="name_desc">Name Z → A</option>
          <option value="code_asc">Code A → Z</option>
          <option value="code_desc">Code Z → A</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4 font-medium">Customer</th>
                <th className="p-4 font-medium">Phone</th>
                <th className="p-4 font-medium">Joined</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={4} className="p-8 text-center text-gray-500">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-gray-500">
                  {customers.length === 0 ? 'No customers yet. Click "Add Customer".' : 'No customers match your search.'}
                </td></tr>
              ) : (
                filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/admin/emi/customers/${c.id}`)}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#1e5a48]/10 flex items-center justify-center text-[#1e5a48] overflow-hidden border border-[#1e5a48]/10 shrink-0">
                          {c.photo_url ? (
                            <img src={photoSrc(c.photo_url)} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <i className="fas fa-user"></i>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-gray-800">{c.full_name}</p>
                          <p className="text-xs font-mono text-[#1e5a48]">{c.customer_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-gray-600">{c.phone || '-'}</td>
                    <td className="p-4 text-gray-600">{safeFormatDate(c.created_at)}</td>
                    <td className="p-4 text-right space-x-3" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => openEdit(c)} className="text-[#f7b05e] hover:text-[#e09d3e]" title="Edit">
                        <i className="fas fa-edit"></i>
                      </button>
                      <button onClick={() => { setDeleteError(''); setToDelete(c); }} className="text-red-500 hover:text-red-700" title="Delete">
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

      {isOpen && (
        <CustomerModal
          title={editingId ? 'Edit Customer' : 'Add Customer'}
          onClose={() => setIsOpen(false)}
          onSubmit={handleSave}
          formError={formError}
          formLoading={formLoading}
          editing={!!editingId}
          state={{
            fullName, setFullName, phone, setPhone, address, setAddress,
            fatherHusbandName, setFatherHusbandName, dateOfBirth, setDateOfBirth,
            aadhaarVid, setAadhaarVid, panNumber, setPanNumber,
            occupation, setOccupation, monthlyIncome, setMonthlyIncome,
            nomineeName, setNomineeName, notes, setNotes,
            photoUrl, photoFile, setPhotoFile,
          }}
        />
      )}

      {toDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b bg-red-50 text-red-800 flex items-center gap-3">
              <i className="fas fa-exclamation-triangle text-xl"></i>
              <h3 className="font-bold text-lg">Delete Customer?</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                Delete <strong>{toDelete.full_name}</strong> ({toDelete.customer_code})? You cannot delete a customer that has EMI loans linked.
              </p>
              {deleteError && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{deleteError}</div>}
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setToDelete(null)} disabled={deleting}>Cancel</Button>
                <Button onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white">
                  {deleting ? 'Deleting…' : 'Delete'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type ModalState = {
  fullName: string; setFullName: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  address: string; setAddress: (v: string) => void;
  fatherHusbandName: string; setFatherHusbandName: (v: string) => void;
  dateOfBirth: string; setDateOfBirth: (v: string) => void;
  aadhaarVid: string; setAadhaarVid: (v: string) => void;
  panNumber: string; setPanNumber: (v: string) => void;
  occupation: string; setOccupation: (v: string) => void;
  monthlyIncome: string; setMonthlyIncome: (v: string) => void;
  nomineeName: string; setNomineeName: (v: string) => void;
  notes: string; setNotes: (v: string) => void;
  photoUrl: string;
  photoFile: File | null;
  setPhotoFile: (f: File | null) => void;
};

function CustomerModal({
  title, onClose, onSubmit, formError, formLoading, editing, state,
}: {
  title: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  formError: string;
  formLoading: boolean;
  editing: boolean;
  state: ModalState;
}) {
  void editing;
  const s = state;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b flex justify-between items-center bg-[#0b3b2f] text-white">
          <h3 className="font-bold text-lg">{title}</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          {formError && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{formError}</div>}
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name <span className="text-red-500">*</span></Label>
              <Input value={s.fullName} onChange={(e) => s.setFullName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={s.phone} onChange={(e) => s.setPhone(e.target.value)} pattern="[0-9]{10}" />
              </div>
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Input type="date" value={s.dateOfBirth} onChange={(e) => s.setDateOfBirth(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <textarea value={s.address} onChange={(e) => s.setAddress(e.target.value)} rows={2} className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm resize-none" />
            </div>
            <div className="space-y-2">
              <Label>Father / Husband Name</Label>
              <Input value={s.fatherHusbandName} onChange={(e) => s.setFatherHusbandName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Aadhaar / VID</Label>
                <Input value={s.aadhaarVid} onChange={(e) => s.setAadhaarVid(e.target.value.replace(/[\s-]/g, ''))} maxLength={12} />
              </div>
              <div className="space-y-2">
                <Label>PAN</Label>
                <Input value={s.panNumber} onChange={(e) => s.setPanNumber(e.target.value.toUpperCase())} maxLength={10} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Occupation</Label>
                <Input value={s.occupation} onChange={(e) => s.setOccupation(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Monthly Income (₹)</Label>
                <Input type="number" value={s.monthlyIncome} onChange={(e) => s.setMonthlyIncome(e.target.value)} min="0" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nominee Name</Label>
              <Input value={s.nomineeName} onChange={(e) => s.setNomineeName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <textarea value={s.notes} onChange={(e) => s.setNotes(e.target.value)} rows={2} className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm resize-none" />
            </div>
            <div className="space-y-2">
              <Label>Photo</Label>
              <div className="flex items-center gap-4 p-3 border rounded-lg bg-gray-50/50">
                <div className="w-16 h-16 rounded-full bg-white border-2 border-[#1e5a48]/20 flex items-center justify-center overflow-hidden">
                  {s.photoFile ? (
                    <img src={URL.createObjectURL(s.photoFile)} className="w-full h-full object-cover" alt="" />
                  ) : s.photoUrl ? (
                    <img src={photoSrc(s.photoUrl)} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <i className="fas fa-user text-gray-300 text-2xl"></i>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => s.setPhotoFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#1e5a48] file:text-white"
                />
              </div>
            </div>

            <div className="pt-4">
              <Button type="submit" className="w-full" disabled={formLoading}>
                {formLoading ? 'Saving…' : 'Save Customer'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
