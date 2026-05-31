import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Button, Input, Label } from '@/components/ui/basic';
import { api, photoSrc } from '@/lib/api';
import type { MemberInput, MemberRow } from '@/types/db';

type SortKey = 'join_desc' | 'join_asc' | 'name_asc' | 'name_desc' | 'code_asc' | 'code_desc';

export default function Members() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkError, setBulkError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sortBy, setSortBy] = useState<SortKey>('join_desc');

  // form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [memberCode, setMemberCode] = useState('');
  const [joinDate, setJoinDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [category, setCategory] = useState<'A' | 'B' | 'C'>('C');
  const [initialInvestment, setInitialInvestment] = useState('');
  const [term, setTerm] = useState('24');
  const [monthlyInstallment, setMonthlyInstallment] = useState('100');
  const [status, setStatus] = useState('active');
  const [address, setAddress] = useState('');
  const [fatherHusbandName, setFatherHusbandName] = useState('');
  const [gender, setGender] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [aadhaarVid, setAadhaarVid] = useState('');
  const [nomineeName, setNomineeName] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    void fetchMembers();
  }, []);

  const fetchMembers = async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await api.listMembers();
      setMembers(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFullName('');
    setPhone('');
    setPhotoUrl('');
    setPhotoFile(null);
    setMemberCode('');
    setJoinDate(format(new Date(), 'yyyy-MM-dd'));
    setCategory('C');
    setInitialInvestment('');
    setTerm('24');
    setMonthlyInstallment('100');
    setStatus('active');
    setError('');
    setAddress('');
    setFatherHusbandName('');
    setGender('');
    setDateOfBirth('');
    setAadhaarVid('');
    setNomineeName('');
  };

  const openAdd = () => {
    resetForm();
    setEditingId(null);
    setIsAddOpen(true);
  };

  const openEdit = (m: MemberRow) => {
    const p = m.profiles;
    setFullName(p?.full_name || '');
    setPhone(p?.phone || '');
    setPhotoUrl(p?.photo_url || '');
    setPhotoFile(null);
    setMemberCode(m.member_code || '');
    setJoinDate(m.join_date || format(new Date(), 'yyyy-MM-dd'));
    setCategory(m.category);
    setInitialInvestment(m.initial_investment?.toString() || '');
    setTerm(m.chosen_term_months?.toString() || '24');
    setMonthlyInstallment(m.monthly_installment?.toString() || '100');
    setStatus(m.status || 'active');
    setAddress(p?.address || '');
    setFatherHusbandName(p?.father_husband_name || '');
    setGender(p?.gender || '');
    setDateOfBirth(p?.date_of_birth || '');
    setAadhaarVid(p?.aadhaar_vid || '');
    setNomineeName(p?.nominee_name || '');
    setEditingId(m.id);
    setIsEditOpen(true);
  };

  const buildInput = async (): Promise<MemberInput> => {
    let finalPhoto = photoUrl;
    if (photoFile) {
      finalPhoto = await api.saveMemberPhoto(photoFile);
    }
    return {
      member_code: memberCode.trim() || null,
      full_name: fullName,
      phone: phone || null,
      photo_url: finalPhoto || null,
      address: address || null,
      father_husband_name: fatherHusbandName || null,
      gender: gender || null,
      date_of_birth: dateOfBirth || null,
      aadhaar_vid: aadhaarVid || null,
      nominee_name: nomineeName || null,
      category,
      status,
      join_date: joinDate,
      initial_investment: category === 'C' ? 0 : Number(initialInvestment || 0),
      monthly_installment:
        category === 'A' ? 1000 : category === 'C' ? Number(monthlyInstallment || 0) : null,
      chosen_term_months: category === 'B' ? 36 : Number(term || 0),
    };
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');
    try {
      const input = await buildInput();
      if (editingId) {
        await api.updateMember(editingId, input);
        setIsEditOpen(false);
        setSuccess('Member updated successfully.');
      } else {
        const m = await api.createMember(input);
        setIsAddOpen(false);
        setSuccess(`Member ${m.member_code} created.`);
      }
      await fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setFormLoading(false);
    }
  };

  const confirmDelete = (id: string) => {
    setDeleteError('');
    setMemberToDelete(id);
  };

  const handleDelete = async () => {
    if (!memberToDelete) return;
    try {
      await api.deleteMember(memberToDelete);
      setMemberToDelete(null);
      setSelectedIds((prev) => {
        if (!prev.has(memberToDelete)) return prev;
        const next = new Set(prev);
        next.delete(memberToDelete);
        return next;
      });
      await fetchMembers();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    setBulkError('');
    try {
      const ids = Array.from(selectedIds);
      await api.bulkDeleteMembers(ids);
      setSelectedIds(new Set());
      setIsBulkOpen(false);
      setSuccess(`${ids.length} member${ids.length === 1 ? '' : 's'} deleted.`);
      await fetchMembers();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : String(err));
    } finally {
      setBulkDeleting(false);
    }
  };

  const filtered = members
    .filter((m) => {
      const matchesSearch =
        (m.profiles?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.member_code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.profiles?.phone || '').includes(searchQuery);
      const matchesCategory = categoryFilter === 'All' || m.category === categoryFilter;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      const nA = (a.profiles?.full_name || '').toLowerCase();
      const nB = (b.profiles?.full_name || '').toLowerCase();
      const cA = a.member_code || '';
      const cB = b.member_code || '';
      const dA = a.join_date || '';
      const dB = b.join_date || '';
      switch (sortBy) {
        case 'name_asc': return nA.localeCompare(nB);
        case 'name_desc': return nB.localeCompare(nA);
        case 'code_asc': return cA.localeCompare(cB);
        case 'code_desc': return cB.localeCompare(cA);
        case 'join_asc': return dA.localeCompare(dB);
        case 'join_desc':
        default: return dB.localeCompare(dA);
      }
    });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h2 className="text-2xl font-bold text-gray-800">Members Directory</h2>
        <div className="flex gap-3">
          <Button onClick={openAdd} className="gap-2">
            <i className="fas fa-user-plus"></i> Add New Member
          </Button>
        </div>
      </div>

      {success && (
        <div className="p-4 rounded-lg border bg-green-50 text-green-700 border-green-200 flex justify-between">
          <p>{success}</p>
          <button onClick={() => setSuccess('')} className="opacity-70 hover:opacity-100">
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}
      {error && !isAddOpen && !isEditOpen && (
        <div className="p-4 rounded-lg border bg-red-50 text-red-700 border-red-200">{error}</div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex-1 relative">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input
            type="text"
            placeholder="Search by name, ID, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1e5a48]"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-full sm:w-48 px-4 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e5a48]"
        >
          <option value="All">All Categories</option>
          <option value="A">Category A</option>
          <option value="B">Category B</option>
          <option value="C">Category C</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="w-full sm:w-56 px-4 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e5a48]"
        >
          <option value="join_desc">Newest first (join date)</option>
          <option value="join_asc">Oldest first (join date)</option>
          <option value="name_asc">Name A → Z</option>
          <option value="name_desc">Name Z → A</option>
          <option value="code_asc">Member ID A → Z</option>
          <option value="code_desc">Member ID Z → A</option>
        </select>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-amber-900">
            <i className="fas fa-check-square text-amber-600"></i>
            <span><strong>{selectedIds.size}</strong> member{selectedIds.size === 1 ? '' : 's'} selected</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
            <Button
              onClick={() => { setBulkError(''); setIsBulkOpen(true); }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Selected
            </Button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4 font-medium w-10">
                  <input
                    type="checkbox"
                    className="w-4 h-4 cursor-pointer accent-[#1e5a48]"
                    ref={(el) => {
                      if (!el) return;
                      const ids = filtered.map((m) => m.id);
                      const all = ids.length > 0 && ids.every((id) => selectedIds.has(id));
                      const some = ids.some((id) => selectedIds.has(id));
                      el.checked = all;
                      el.indeterminate = !all && some;
                    }}
                    onChange={(e) => {
                      const ids = filtered.map((m) => m.id);
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) ids.forEach((id) => next.add(id));
                        else ids.forEach((id) => next.delete(id));
                        return next;
                      });
                    }}
                  />
                </th>
                <th className="p-4 font-medium">Member</th>
                <th className="p-4 font-medium">Category</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-500">Loading members…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-500">No members yet. Click <strong>Add New Member</strong> to get started.</td></tr>
              ) : (
                filtered.map((m) => {
                  const isSelected = selectedIds.has(m.id);
                  return (
                    <tr key={m.id} className={`transition-colors ${isSelected ? 'bg-amber-50/60' : 'hover:bg-gray-50'}`}>
                      <td className="p-4 w-10">
                        <input
                          type="checkbox"
                          className="w-4 h-4 cursor-pointer accent-[#1e5a48]"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(m.id)}
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#1e5a48]/10 flex items-center justify-center text-[#1e5a48] overflow-hidden border border-[#1e5a48]/10">
                            {m.profiles?.photo_url ? (
                              <img src={photoSrc(m.profiles.photo_url)} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <i className="fas fa-user"></i>
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-gray-800">{m.profiles?.full_name}</p>
                            <p className="text-xs font-mono text-[#1e5a48]">{m.member_code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          m.category === 'A' ? 'bg-purple-100 text-purple-700' :
                          m.category === 'B' ? 'bg-blue-100 text-blue-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          Cat {m.category}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="bg-green-50 text-green-600 px-2 py-1 rounded text-xs font-medium border border-green-200">
                          {m.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-3">
                        <button onClick={() => openEdit(m)} className="text-[#f7b05e] hover:text-[#e09d3e]" title="Edit">
                          <i className="fas fa-edit"></i>
                        </button>
                        <button onClick={() => confirmDelete(m.id)} className="text-red-500 hover:text-red-700" title="Delete">
                          <i className="fas fa-trash"></i>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(isAddOpen || isEditOpen) && (
        <Modal title={editingId ? 'Edit Member' : 'Add New Member'} onClose={() => { setIsAddOpen(false); setIsEditOpen(false); }}>
          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{error}</div>}
          <form onSubmit={handleSave} className="space-y-4">
            <Field label="Member ID (Optional)">
              <Input value={memberCode} onChange={(e) => setMemberCode(e.target.value)} placeholder="Leave blank to auto-generate" />
            </Field>
            <Field label="Join Date">
              <Input type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} required />
            </Field>
            <Field label="Full Name">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="e.g. Rahul Sharma" />
            </Field>
            <Field label="Mobile Number (Optional)">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} pattern="[0-9]{10}" placeholder="10 digit number" />
            </Field>
            <Field label="Father / Husband Name (Optional)">
              <Input value={fatherHusbandName} onChange={(e) => setFatherHusbandName(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Gender (Optional)">
                <select className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="">-- Select --</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </Field>
              <Field label="Date of Birth (Optional)">
                <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
              </Field>
            </div>
            <Field label="Address (Optional)">
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm resize-none" />
            </Field>
            <Field label="Aadhaar / VID No. (Optional)">
              <Input
                value={aadhaarVid}
                onChange={(e) => setAadhaarVid(e.target.value.replace(/[\s-]/g, ''))}
                pattern="[0-9]{12}"
                maxLength={12}
                placeholder="12-digit Aadhaar / VID"
              />
            </Field>
            <Field label="Nominee Name (Optional)">
              <Input value={nomineeName} onChange={(e) => setNomineeName(e.target.value)} />
            </Field>

            <Field label="Profile Picture (Optional)">
              <div className="flex items-center gap-4 p-3 border rounded-lg bg-gray-50/50">
                <div className="w-16 h-16 rounded-full bg-white border-2 border-[#1e5a48]/20 flex items-center justify-center overflow-hidden">
                  {photoFile ? (
                    <img src={URL.createObjectURL(photoFile)} className="w-full h-full object-cover" alt="" />
                  ) : photoUrl ? (
                    <img src={photoSrc(photoUrl)} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <i className="fas fa-user text-gray-300 text-2xl"></i>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#1e5a48] file:text-white"
                />
              </div>
            </Field>

            <Field label="Category">
              <select className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value as 'A' | 'B' | 'C')}>
                <option value="C">Category C (Public — ₹100/mo)</option>
                <option value="B">Category B (Investor — One time)</option>
                <option value="A">Category A (Founder — ₹1000/mo)</option>
              </select>
            </Field>

            {(category === 'A' || category === 'B') && (
              <Field label="Initial Investment (₹)">
                <Input type="number" value={initialInvestment} onChange={(e) => setInitialInvestment(e.target.value)} required min="0" placeholder="e.g. 10000" />
              </Field>
            )}

            {category === 'C' && (
              <>
                <Field label="Term Duration">
                  <select className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" value={term} onChange={(e) => setTerm(e.target.value)}>
                    <option value="24">24 Months (16% ROI)</option>
                    <option value="36">36 Months (27% ROI)</option>
                  </select>
                </Field>
                <Field label="Monthly Installment (₹)">
                  <Input type="number" value={monthlyInstallment} onChange={(e) => setMonthlyInstallment(e.target.value)} required min="100" step="100" />
                </Field>
              </>
            )}

            {category === 'A' && (
              <Field label="Term Duration">
                <select className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" value={term} onChange={(e) => setTerm(e.target.value)}>
                  <option value="36">36 Months</option>
                  <option value="0">No Fixed Term</option>
                </select>
              </Field>
            )}

            {editingId && (
              <Field label="Status">
                <select className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="matured">Matured</option>
                  <option value="withdrawn">Withdrawn</option>
                  <option value="closed">Closed</option>
                </select>
              </Field>
            )}

            <div className="pt-4">
              <Button type="submit" className="w-full" disabled={formLoading}>
                {formLoading ? 'Saving…' : editingId ? 'Update Member' : 'Create Member'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {memberToDelete && (
        <Modal title="Confirm Deletion" tone="danger" onClose={() => setMemberToDelete(null)}>
          <p className="text-gray-700 mb-4">Delete this member? Their profile and all related rows will be permanently removed.</p>
          {deleteError && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{deleteError}</div>}
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setMemberToDelete(null)}>Cancel</Button>
            <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">Delete Member</Button>
          </div>
        </Modal>
      )}

      {isBulkOpen && (
        <Modal title={`Delete ${selectedIds.size} Members?`} tone="danger" onClose={() => setIsBulkOpen(false)}>
          <p className="text-gray-700 mb-4">
            Permanently delete <strong>{selectedIds.size}</strong> selected member{selectedIds.size === 1 ? '' : 's'}? This cannot be undone.
          </p>
          {bulkError && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{bulkError}</div>}
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setIsBulkOpen(false)} disabled={bulkDeleting}>Cancel</Button>
            <Button onClick={handleBulkDelete} disabled={bulkDeleting} className="bg-red-600 hover:bg-red-700 text-white">
              {bulkDeleting ? 'Deleting…' : `Delete ${selectedIds.size} Members`}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Modal({
  title,
  tone,
  children,
  onClose,
}: {
  title: string;
  tone?: 'danger';
  children: React.ReactNode;
  onClose: () => void;
}) {
  const headerCls = tone === 'danger' ? 'bg-red-50 text-red-800' : 'bg-[#0b3b2f] text-white';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className={`p-5 border-b flex justify-between items-center ${headerCls}`}>
          <h3 className="font-bold text-lg">{title}</h3>
          <button onClick={onClose} className="opacity-70 hover:opacity-100">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
