"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus, Search, Download, Printer, Trash2, Pencil, FileSpreadsheet,
  ArrowLeft, X, Save, Send, LayoutDashboard, BookOpen, Building2,
  ChevronDown, AlertCircle
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import * as XLSX from "xlsx";

/* ---------------------------------------------------------------------
   Kshamadevi Construction Solution Pvt. Ltd. — Purchase Order Portal
   Design language: site-ledger / blueprint. Concrete paper background,
   blueprint-blue ink, ochre "stamp" status badges, mono digits for
   money & PO numbers. Data is stored shared (window.storage, shared:true)
   so the whole team sees the same register.
--------------------------------------------------------------------- */

const COMPANY = {
  name: "KSHAMADEVI CONSTRUCTION SOLUTION PVT. LTD.",
  vat: "601086315",
  address: "Bhaktapur, Nepal",
  email: "construction@kshamadevigroup.com",
};

const CATEGORIES = [
  "Construction Materials", "Equipment / Machinery", "Tools",
  "Electrical", "Plumbing", "Safety Gear", "Services", "Other",
];

const STATUSES = ["Draft", "Issued", "Received", "Closed", "Cancelled"];

const STATUS_COLOR = {
  Draft: "#8A8578",
  Issued: "#2B4C6F",
  Received: "#8A6A1E",
  Closed: "#3F6C4F",
  Cancelled: "#A13D2B",
};

const VAT_RATE = 13;
const MONTHS = ["January","February","March","April","May","June","July",
  "August","September","October","November","December"];

const fmt = (n) => (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const todayISO = () => new Date().toISOString().slice(0, 10);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function blankLine() {
  return { id: uid(), desc: "", unit: "", qty: 1, rate: 0, discount: 0, vatPct: VAT_RATE };
}

function blankPO() {
  return {
    id: uid(),
    poNo: "", // assigned by the server, atomically, when the PO is first saved

    poDate: todayISO(),
    supplier: "",
    supplierPan: "",
    supplierAddress: "",
    contactPerson: "",
    deliveryAddress: "",
    category: CATEGORIES[0],
    project: "",
    paymentTerms: "30 Days",
    expectedDelivery: "",
    currency: "NPR",
    lines: [blankLine()],
    freight: 0,
    otherCharges: 0,
    advancePaid: 0,
    roundOff: 0,
    status: "Draft",
    remarks: "",
    createdAt: Date.now(),
  };
}

function lineCalc(l) {
  const taxable = Math.max(0, (Number(l.qty) || 0) * (Number(l.rate) || 0) - (Number(l.discount) || 0));
  const vat = taxable * ((Number(l.vatPct) || 0) / 100);
  return { taxable, vat, total: taxable + vat };
}

function poTotals(po) {
  const lines = (po.lines || []).map((l) => ({ ...l, ...lineCalc(l) }));
  const taxable = lines.reduce((s, l) => s + l.taxable, 0);
  const vat = lines.reduce((s, l) => s + l.vat, 0);
  const grand =
    taxable + vat + (Number(po.freight) || 0) + (Number(po.otherCharges) || 0) -
    (Number(po.advancePaid) || 0) + (Number(po.roundOff) || 0);
  return { lines, taxable, vat, grand };
}

/* ------------------------------- App -------------------------------- */

export default function PoApp({ role }) {
  const isAdmin = role === "admin";
  const [pos, setPos] = useState(null);
  const [view, setView] = useState("dashboard"); // dashboard | register | form
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState(null);
  const [printPO, setPrintPO] = useState(null);
  const [printRegisterOn, setPrintRegisterOn] = useState(false);
  const printTimer = useRef(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const res = await fetch("/api/pos");
      const data = await res.json();
      setPos(Array.isArray(data) ? data : []);
    } catch {
      setPos([]);
    }
  }

  async function createPO(po) {
    try {
      const res = await fetch("/api/pos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(po),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || "Could not save — try again", true); return null; }
      setPos(data.list);
      return data.list;
    } catch {
      showToast("Could not save — try again", true);
      return null;
    }
  }

  async function updatePO(po) {
    try {
      const res = await fetch(`/api/pos/${po.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(po),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || "Could not save — try again", true); return null; }
      setPos(data.list);
      return data.list;
    } catch {
      showToast("Could not save — try again", true);
      return null;
    }
  }

  async function removePO(id) {
    try {
      const res = await fetch(`/api/pos/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || "Could not delete — try again", true); return; }
      setPos(data.list);
    } catch {
      showToast("Could not delete — try again", true);
    }
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  function showToast(msg, isError) {
    setToast({ msg, isError });
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => setToast(null), 2800);
  }

  function openNew() {
    setEditing(blankPO());
    setView("form");
  }

  function openEdit(po) {
    if (!isAdmin) return; // defense in depth — the API also rejects non-admin edits
    setEditing(JSON.parse(JSON.stringify(po)));
    setView("form");
  }

  async function savePO(po, andPrint) {
    const exists = (pos || []).some((p) => p.id === po.id);
    const list = exists ? await updatePO(po) : await createPO(po);
    if (!list) return;
    showToast(exists ? "Purchase order updated" : "Purchase order saved");
    setView("register");
    if (andPrint) {
      const saved = list.find((p) => p.id === po.id) || po;
      triggerPrint(saved);
    }
  }

  async function deletePO(id) {
    await removePO(id);
    showToast("Purchase order deleted");
  }

  function triggerPrint(po) {
    setPrintPO(po);
    setPrintRegisterOn(false);
    clearTimeout(printTimer.current);
    printTimer.current = setTimeout(() => window.print(), 120);
  }

  function triggerPrintRegister() {
    setPrintRegisterOn(true);
    setPrintPO(null);
    clearTimeout(printTimer.current);
    printTimer.current = setTimeout(() => window.print(), 120);
  }

  if (pos === null) {
    return (
      <Shell>
        <div style={{ padding: 48, textAlign: "center", color: "var(--ink-2)" }}>Loading register…</div>
      </Shell>
    );
  }

  return (
    <Shell>
      <style>{PRINT_CSS}</style>
      <div className="no-print">
        <TopBar view={view} setView={setView} onNew={openNew} role={role} onLogout={logout} />
        <div className="body-area">
          {view === "dashboard" && <Dashboard pos={pos} onNew={openNew} />}
          {view === "register" && (
            <Register pos={pos} onEdit={openEdit} onDelete={deletePO} onNew={openNew} onPrint={triggerPrint} onPrintRegister={triggerPrintRegister} isAdmin={isAdmin} />
          )}
          {view === "form" && (
            <POForm
              po={editing}
              existing={pos}
              onCancel={() => setView("register")}
              onSave={savePO}
            />
          )}
        </div>
        {toast && <div className={`toast ${toast.isError ? "toast-err" : ""}`}>{toast.msg}</div>}
      </div>
      {printPO && <PrintDoc po={printPO} />}
      {printRegisterOn && <PrintRegister pos={pos} />}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="kcs-root">
      <style>{BASE_CSS}</style>
      {children}
    </div>
  );
}

/* ------------------------------ TopBar ------------------------------- */

function TopBar({ view, setView, onNew, role, onLogout }) {
  const tabs = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "register", label: "PO Register", icon: BookOpen },
  ];
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark"><Building2 size={18} strokeWidth={2.2} /></div>
        <div>
          <div className="brand-name">Kshamadevi Construction</div>
          <div className="brand-sub">Purchase Order Portal</div>
        </div>
      </div>
      <nav className="tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`tab ${view === t.key ? "tab-active" : ""}`}
            onClick={() => setView(t.key)}
          >
            <t.icon size={15} strokeWidth={2.2} /> {t.label}
          </button>
        ))}
      </nav>
      <div className="topbar-right">
        <span className="role-pill">{role === "admin" ? "Admin" : "User — entry only"}</span>
        <button className="btn btn-primary" onClick={onNew}>
          <Plus size={16} strokeWidth={2.4} /> New PO
        </button>
        <button className="btn btn-ghost" onClick={onLogout}>Log out</button>
      </div>
    </header>
  );
}

/* ----------------------------- Dashboard ------------------------------ */

function Dashboard({ pos, onNew }) {
  const years = useMemo(() => {
    const set = new Set(pos.map((p) => (p.poDate || "").slice(0, 4)).filter(Boolean));
    const cur = new Date().getFullYear();
    set.add(String(cur));
    return Array.from(set).sort();
  }, [pos]);
  const [year, setYear] = useState(String(new Date().getFullYear()));

  const totals = useMemo(() => {
    let value = 0, issued = 0, closed = 0;
    pos.forEach((p) => {
      value += poTotals(p).grand;
      if (["Issued", "Received"].includes(p.status)) issued++;
      if (p.status === "Closed") closed++;
    });
    return { count: pos.length, value, issued, closed };
  }, [pos]);

  const yearly = useMemo(() => {
    const map = {};
    pos.forEach((p) => {
      const y = (p.poDate || "").slice(0, 4);
      if (!y) return;
      const t = poTotals(p);
      map[y] = map[y] || { count: 0, taxable: 0, vat: 0, other: 0, grand: 0 };
      map[y].count++;
      map[y].taxable += t.taxable;
      map[y].vat += t.vat;
      map[y].other += (Number(p.freight) || 0) + (Number(p.otherCharges) || 0);
      map[y].grand += t.grand;
    });
    return years.map((y) => ({ year: y, ...(map[y] || { count: 0, taxable: 0, vat: 0, other: 0, grand: 0 }) }));
  }, [pos, years]);

  const monthly = useMemo(() => {
    const map = {};
    pos.forEach((p) => {
      if ((p.poDate || "").slice(0, 4) !== year) return;
      const m = parseInt((p.poDate || "").slice(5, 7), 10) - 1;
      if (m < 0) return;
      const t = poTotals(p);
      map[m] = map[m] || { count: 0, grand: 0 };
      map[m].count++;
      map[m].grand += t.grand;
    });
    return MONTHS.map((name, i) => ({ name: name.slice(0, 3), full: name, count: map[i]?.count || 0, grand: map[i]?.grand || 0 }));
  }, [pos, year]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">A live view of every purchase order raised against site procurement.</p>
        </div>
      </div>

      <div className="stat-row">
        <Stat label="Total POs" value={totals.count} />
        <Stat label="Total PO Value (NPR)" value={fmt(totals.value)} mono />
        <Stat label="Issued / Active" value={totals.issued} accent="#2B4C6F" />
        <Stat label="Closed / Received" value={totals.closed} accent="#3F6C4F" />
      </div>

      {pos.length === 0 ? (
        <EmptyState onNew={onNew} />
      ) : (
        <>
          <div className="panel">
            <div className="panel-head">
              <h2>Monthly summary</h2>
              <select className="select" value={year} onChange={(e) => setYear(e.target.value)}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={monthly} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--ink-2)" }} axisLine={{ stroke: "var(--line)" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--ink-2)" }} axisLine={false} tickLine={false} width={44}
                    tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip
                    formatter={(v) => [`NPR ${fmt(v)}`, "Grand total"]}
                    labelFormatter={(_, p) => p?.[0]?.payload?.full}
                    contentStyle={{ fontFamily: "var(--font-body)", fontSize: 12, borderRadius: 4, border: "1px solid var(--line)" }}
                  />
                  <Bar dataKey="grand" fill="var(--blueprint)" radius={[2, 2, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h2>Yearly summary</h2></div>
            <div className="table-wrap">
              <table className="ledger">
                <thead>
                  <tr>
                    <th>Year</th><th>No. of POs</th><th>Taxable (NPR)</th><th>VAT (NPR)</th>
                    <th>Other charges (NPR)</th><th>Grand total (NPR)</th>
                  </tr>
                </thead>
                <tbody>
                  {yearly.map((y) => (
                    <tr key={y.year}>
                      <td>{y.year}</td>
                      <td className="mono">{y.count}</td>
                      <td className="mono">{fmt(y.taxable)}</td>
                      <td className="mono">{fmt(y.vat)}</td>
                      <td className="mono">{fmt(y.other)}</td>
                      <td className="mono strong">{fmt(y.grand)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent, mono }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${mono ? "mono" : ""}`} style={accent ? { color: accent } : undefined}>
        {value}
      </div>
    </div>
  );
}

function EmptyState({ onNew }) {
  return (
    <div className="empty">
      <div className="empty-stamp">EMPTY REGISTER</div>
      <p>No purchase orders have been logged yet. Raise the first one to start the register.</p>
      <button className="btn btn-primary" onClick={onNew}><Plus size={16} /> New purchase order</button>
    </div>
  );
}

/* ------------------------------ Register ------------------------------- */

function Register({ pos, onEdit, onDelete, onNew, onPrint, onPrintRegister, isAdmin }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [confirmId, setConfirmId] = useState(null);

  const filtered = useMemo(() => {
    return pos.filter((p) => {
      if (status !== "All" && p.status !== status) return false;
      if (!q.trim()) return true;
      const hay = `${p.poNo} ${p.supplier} ${p.project} ${p.category} ${p.remarks}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [pos, q, status]);

  function exportExcel() {
    const regRows = pos.map((p) => {
      const t = poTotals(p);
      return {
        "PO No.": p.poNo, "PO Date": p.poDate, "Supplier": p.supplier,
        "Supplier PAN/VAT": p.supplierPan, "Description": (p.lines || []).map(l => l.desc).filter(Boolean).join("; "),
        "Category": p.category, "Project / Site": p.project, "Payment Terms": p.paymentTerms,
        "Expected Delivery": p.expectedDelivery, "Taxable Amount (NPR)": Math.round(t.taxable),
        "VAT (NPR)": Math.round(t.vat), "Other Charges (NPR)": Math.round((Number(p.freight)||0)+(Number(p.otherCharges)||0)),
        "Grand Total (NPR)": Math.round(t.grand), "Status": p.status, "Remarks": p.remarks,
      };
    });
    const wb = XLSX.utils.book_new();
    const wsReg = XLSX.utils.json_to_sheet(regRows);
    wsReg["!cols"] = Object.keys(regRows[0] || { a: 1 }).map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, wsReg, "PO Register");

    const totalValue = pos.reduce((s, p) => s + poTotals(p).grand, 0);
    const issued = pos.filter(p => ["Issued","Received"].includes(p.status)).length;
    const closed = pos.filter(p => p.status === "Closed").length;
    const yearsSet = Array.from(new Set(pos.map(p => (p.poDate||"").slice(0,4)).filter(Boolean))).sort();
    const yearRows = yearsSet.map((y) => {
      const inYear = pos.filter(p => (p.poDate||"").slice(0,4) === y);
      const taxable = inYear.reduce((s,p)=>s+poTotals(p).taxable,0);
      const vat = inYear.reduce((s,p)=>s+poTotals(p).vat,0);
      const other = inYear.reduce((s,p)=> s + (Number(p.freight)||0)+(Number(p.otherCharges)||0),0);
      const grand = inYear.reduce((s,p)=>s+poTotals(p).grand,0);
      return { Year: y, "No. of POs": inYear.length, "Taxable Amount (NPR)": Math.round(taxable),
        "VAT (NPR)": Math.round(vat), "Other Charges (NPR)": Math.round(other), "Grand Total (NPR)": Math.round(grand) };
    });
    const summaryAOA = [
      ["PURCHASE ORDER SUMMARY"], [COMPANY.name], [],
      ["Total POs", pos.length, "", "Total PO Value (NPR)", Math.round(totalValue), "", "Issued/Active", issued, "Closed/Received", closed],
      [],
    ];
    const wsSum = XLSX.utils.aoa_to_sheet(summaryAOA);
    XLSX.utils.sheet_add_json(wsSum, yearRows, { origin: "A6" });
    wsSum["!cols"] = [{wch:20},{wch:14},{wch:20},{wch:14},{wch:20},{wch:18}];
    XLSX.utils.book_append_sheet(wb, wsSum, "Summary");

    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([out], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Kshamadevi-PO-Register-${todayISO()}.xlsx`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>PO Register</h1>
          <p className="muted">{pos.length} purchase order{pos.length === 1 ? "" : "s"} on file.</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-ghost" onClick={exportExcel} disabled={pos.length === 0}>
            <FileSpreadsheet size={16} /> Export Excel
          </button>
          <button className="btn btn-ghost" onClick={onPrintRegister} disabled={pos.length === 0}>
            <Printer size={16} /> Export PDF
          </button>
          <button className="btn btn-primary" onClick={onNew}><Plus size={16} /> New PO</button>
        </div>
      </div>

      <div className="filter-row">
        <div className="search">
          <Search size={15} />
          <input placeholder="Search PO no., supplier, site…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option>All</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {pos.length === 0 ? (
        <EmptyState onNew={onNew} />
      ) : (
        <div className="table-wrap">
          <table className="ledger">
            <thead>
              <tr>
                <th>PO No.</th><th>Date</th><th>Supplier</th><th>Project / Site</th>
                <th>Category</th><th>Grand total (NPR)</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const t = poTotals(p);
                return (
                  <tr key={p.id}>
                    <td className="mono strong">{p.poNo}</td>
                    <td className="mono">{p.poDate || "—"}</td>
                    <td>{p.supplier || <span className="muted">—</span>}</td>
                    <td>{p.project || <span className="muted">—</span>}</td>
                    <td>{p.category}</td>
                    <td className="mono strong">{fmt(t.grand)}</td>
                    <td><StampBadge status={p.status} /></td>
                    <td className="row-actions">
                      {isAdmin && (
                        <button title="Edit" className="icon-btn" onClick={() => onEdit(p)}><Pencil size={14} /></button>
                      )}
                      <button title="Print / PDF" className="icon-btn" onClick={() => onPrint(p)}><Printer size={14} /></button>
                      {isAdmin && (
                        confirmId === p.id ? (
                          <button title="Confirm delete" className="icon-btn icon-danger" onClick={() => { onDelete(p.id); setConfirmId(null); }}>
                            <AlertCircle size={14} />
                          </button>
                        ) : (
                          <button title="Delete" className="icon-btn" onClick={() => setConfirmId(p.id)}><Trash2 size={14} /></button>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="muted" style={{ textAlign: "center", padding: 24 }}>No matching purchase orders.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StampBadge({ status }) {
  const c = STATUS_COLOR[status] || "#8A8578";
  return (
    <span className="stamp" style={{ color: c, borderColor: c }}>{status}</span>
  );
}

/* ------------------------------- POForm --------------------------------- */

function POForm({ po, existing, onCancel, onSave }) {
  const [form, setForm] = useState(po);
  const t = useMemo(() => poTotals(form), [form]);
  const isNew = !existing.some((p) => p.id === form.id);
  const dupNo = !isNew && existing.some((p) => p.id !== form.id && p.poNo === form.poNo);

  // Suggestions drawn from everything typed into previous purchase orders —
  // shown as native browser autocomplete while the user types.
  const suggestions = useMemo(() => {
    const uniq = (arr) => Array.from(new Set(arr.filter((v) => v && String(v).trim())));
    return {
      supplier: uniq(existing.map((p) => p.supplier)),
      supplierPan: uniq(existing.map((p) => p.supplierPan)),
      supplierAddress: uniq(existing.map((p) => p.supplierAddress)),
      contactPerson: uniq(existing.map((p) => p.contactPerson)),
      deliveryAddress: uniq(existing.map((p) => p.deliveryAddress)),
      project: uniq(existing.map((p) => p.project)),
      paymentTerms: uniq(existing.map((p) => p.paymentTerms)),
      desc: uniq(existing.flatMap((p) => (p.lines || []).map((l) => l.desc))),
      unit: uniq(existing.flatMap((p) => (p.lines || []).map((l) => l.unit))),
    };
  }, [existing]);

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })); }
  function setLine(id, field, value) {
    setForm((f) => ({ ...f, lines: f.lines.map((l) => (l.id === id ? { ...l, [field]: value } : l)) }));
  }
  function addLine() { setForm((f) => ({ ...f, lines: [...f.lines, blankLine()] })); }
  function removeLine(id) {
    setForm((f) => ({ ...f, lines: f.lines.length > 1 ? f.lines.filter((l) => l.id !== id) : f.lines }));
  }

  const canSave = form.supplier.trim() && (isNew || form.poNo.trim()) && !dupNo;

  return (
    <div className="page">
      <div className="page-head">
        <div className="form-title">
          <button className="icon-btn" onClick={onCancel}><ArrowLeft size={16} /></button>
          <div>
            <h1>{existing.some(p => p.id === form.id) ? "Edit purchase order" : "New purchase order"}</h1>
            <p className="muted">Fields mirror the printed PO — everything here appears on the exported document.</p>
          </div>
        </div>
      </div>

      <datalist id="dl-supplier">{suggestions.supplier.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-supplierPan">{suggestions.supplierPan.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-supplierAddress">{suggestions.supplierAddress.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-contactPerson">{suggestions.contactPerson.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-deliveryAddress">{suggestions.deliveryAddress.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-project">{suggestions.project.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-paymentTerms">{suggestions.paymentTerms.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-desc">{suggestions.desc.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-unit">{suggestions.unit.map((v) => <option key={v} value={v} />)}</datalist>

      <div className="panel">
        <div className="grid-2">
          <Field label="PO No.">
            {isNew ? (
              <div className="input mono auto-note">Assigned automatically on save</div>
            ) : (
              <input className="input mono" value={form.poNo} onChange={(e) => set("poNo", e.target.value)} />
            )}
            {dupNo && <div className="field-err">This PO number is already used.</div>}
          </Field>
          <Field label="PO Date"><input type="date" className="input mono" value={form.poDate} onChange={(e) => set("poDate", e.target.value)} /></Field>
          <Field label="Supplier / Vendor"><input list="dl-supplier" className="input" value={form.supplier} onChange={(e) => set("supplier", e.target.value)} placeholder="Supplier name" /></Field>
          <Field label="Supplier PAN/VAT"><input list="dl-supplierPan" className="input mono" value={form.supplierPan} onChange={(e) => set("supplierPan", e.target.value)} /></Field>
          <Field label="Supplier address"><input list="dl-supplierAddress" className="input" value={form.supplierAddress} onChange={(e) => set("supplierAddress", e.target.value)} /></Field>
          <Field label="Contact person"><input list="dl-contactPerson" className="input" value={form.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} placeholder="Name / phone" /></Field>
          <Field label="Delivery address"><input list="dl-deliveryAddress" className="input" value={form.deliveryAddress} onChange={(e) => set("deliveryAddress", e.target.value)} /></Field>
          <Field label="Expected delivery"><input type="date" className="input mono" value={form.expectedDelivery} onChange={(e) => set("expectedDelivery", e.target.value)} /></Field>
          <Field label="Project / Site"><input list="dl-project" className="input" value={form.project} onChange={(e) => set("project", e.target.value)} placeholder="Site name" /></Field>
          <Field label="Category">
            <select className="select w-full" value={form.category} onChange={(e) => set("category", e.target.value)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Payment terms"><input list="dl-paymentTerms" className="input" value={form.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)} /></Field>
          <Field label="Status">
            <select className="select w-full" value={form.status} onChange={(e) => set("status", e.target.value)}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h2>Line items</h2></div>
        <div className="table-wrap">
          <table className="ledger line-table">
            <thead>
              <tr>
                <th style={{ width: 28 }}>#</th><th>Description</th><th style={{ width: 70 }}>Unit</th>
                <th style={{ width: 70 }}>Qty</th><th style={{ width: 110 }}>Rate (NPR)</th>
                <th style={{ width: 100 }}>Discount</th><th style={{ width: 70 }}>VAT %</th>
                <th style={{ width: 120 }}>Total (NPR)</th><th style={{ width: 32 }}></th>
              </tr>
            </thead>
            <tbody>
              {t.lines.map((l, i) => (
                <tr key={l.id}>
                  <td className="mono">{i + 1}</td>
                  <td><input list="dl-desc" className="input cell" value={l.desc} onChange={(e) => setLine(l.id, "desc", e.target.value)} placeholder="Item / specification" /></td>
                  <td><input list="dl-unit" className="input cell" value={l.unit} onChange={(e) => setLine(l.id, "unit", e.target.value)} /></td>
                  <td><input type="number" className="input cell mono" value={l.qty} onChange={(e) => setLine(l.id, "qty", e.target.value)} /></td>
                  <td><input type="number" className="input cell mono" value={l.rate} onChange={(e) => setLine(l.id, "rate", e.target.value)} /></td>
                  <td><input type="number" className="input cell mono" value={l.discount} onChange={(e) => setLine(l.id, "discount", e.target.value)} /></td>
                  <td><input type="number" className="input cell mono" value={l.vatPct} onChange={(e) => setLine(l.id, "vatPct", e.target.value)} /></td>
                  <td className="mono strong cell-total">{fmt(l.total)}</td>
                  <td><button className="icon-btn" onClick={() => removeLine(l.id)}><X size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={addLine}><Plus size={14} /> Add line</button>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-head"><h2>Remarks</h2></div>
          <textarea className="input" rows={4} value={form.remarks} onChange={(e) => set("remarks", e.target.value)} placeholder="Notes for this order…" />
        </div>
        <div className="panel">
          <div className="panel-head"><h2>Charges &amp; total</h2></div>
          <div className="charge-row"><span>Taxable amount</span><span className="mono">{fmt(t.taxable)}</span></div>
          <div className="charge-row"><span>VAT</span><span className="mono">{fmt(t.vat)}</span></div>
          <ChargeInput label="Freight / transportation" value={form.freight} onChange={(v) => set("freight", v)} />
          <ChargeInput label="Other charges" value={form.otherCharges} onChange={(v) => set("otherCharges", v)} />
          <ChargeInput label="Advance paid" value={form.advancePaid} onChange={(v) => set("advancePaid", v)} negative />
          <ChargeInput label="Round off" value={form.roundOff} onChange={(v) => set("roundOff", v)} />
          <div className="charge-row grand"><span>Grand total (NPR)</span><span className="mono">{fmt(t.grand)}</span></div>
        </div>
      </div>

      <div className="form-footer">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-secondary" disabled={!canSave} onClick={() => onSave({ ...form, status: form.status === "Draft" ? "Draft" : form.status })}>
          <Save size={16} /> Save
        </button>
        <button className="btn btn-primary" disabled={!canSave} onClick={() => onSave({ ...form, status: form.status === "Draft" ? "Issued" : form.status }, true)}>
          <Send size={16} /> Save, issue &amp; print
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function ChargeInput({ label, value, onChange, negative }) {
  return (
    <div className="charge-row">
      <span>{label}{negative ? " (–)" : ""}</span>
      <input type="number" className="input mono charge-input" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/* ------------------------------ Print doc -------------------------------- */

function PrintDoc({ po }) {
  const t = poTotals(po);
  return (
    <div id="print-root">
      <div className="pd-header">
        <div>
          <div className="pd-company">{COMPANY.name}</div>
          <div className="pd-line">VAT No.: {COMPANY.vat}</div>
          <div className="pd-line">{COMPANY.address} · {COMPANY.email}</div>
        </div>
        <div className="pd-title">PURCHASE ORDER</div>
      </div>

      <div className="pd-meta">
        <div><b>PO No.</b> {po.poNo}</div>
        <div><b>PO Date</b> {po.poDate}</div>
        <div><b>Vendor</b> {po.supplier}</div>
        <div><b>Supplier PAN/VAT</b> {po.supplierPan}</div>
        <div><b>Supplier address</b> {po.supplierAddress}</div>
        <div><b>Contact person</b> {po.contactPerson}</div>
        <div><b>Delivery address</b> {po.deliveryAddress}</div>
        <div><b>Expected delivery</b> {po.expectedDelivery}</div>
        <div><b>Payment terms</b> {po.paymentTerms}</div>
        <div><b>Currency</b> {po.currency}</div>
      </div>

      <table className="pd-table">
        <thead>
          <tr><th>S.N.</th><th>Description</th><th>Unit</th><th>Qty</th><th>Rate</th><th>Discount</th><th>Taxable</th><th>VAT%</th><th>Total</th></tr>
        </thead>
        <tbody>
          {t.lines.map((l, i) => (
            <tr key={l.id}>
              <td>{i + 1}</td><td>{l.desc}</td><td>{l.unit}</td><td>{l.qty}</td>
              <td>{fmt(l.rate)}</td><td>{fmt(l.discount)}</td><td>{fmt(l.taxable)}</td><td>{l.vatPct}</td><td>{fmt(l.total)}</td>
            </tr>
          ))}
          <tr className="pd-subtotal"><td colSpan={6}>SUBTOTAL / TOTALS</td><td>{fmt(t.taxable)}</td><td></td><td>{fmt(t.taxable + t.vat)}</td></tr>
        </tbody>
      </table>

      <div className="pd-charges">
        <div><span>Freight / Transportation</span><span>{fmt(po.freight)}</span></div>
        <div><span>Other charges</span><span>{fmt(po.otherCharges)}</span></div>
        <div><span>Advance paid</span><span>{fmt(po.advancePaid)}</span></div>
        <div><span>Round off</span><span>{fmt(po.roundOff)}</span></div>
        <div className="pd-grand"><span>GRAND TOTAL (NPR)</span><span>{fmt(t.grand)}</span></div>
      </div>

      {po.remarks && <div className="pd-remarks"><b>Remarks:</b> {po.remarks}</div>}

      <div className="pd-terms">
        <b>TERMS &amp; CONDITIONS</b>
        <ol>
          <li>Supplier shall provide goods/materials strictly according to the specifications and quantities stated in this Purchase Order.</li>
          <li>Goods shall be delivered with applicable tax invoice, delivery note and supporting documents.</li>
          <li>Any change in quantity, specification, price or delivery schedule requires prior written approval from {COMPANY.name}.</li>
        </ol>
      </div>
    </div>
  );
}

function PrintRegister({ pos }) {
  const grand = pos.reduce((s, p) => s + poTotals(p).grand, 0);
  return (
    <div id="print-root">
      <div className="pd-header">
        <div>
          <div className="pd-company">{COMPANY.name}</div>
          <div className="pd-line">VAT No.: {COMPANY.vat}</div>
          <div className="pd-line">{COMPANY.address} · {COMPANY.email}</div>
        </div>
        <div className="pd-title">PO REGISTER</div>
      </div>
      <div className="pd-line" style={{ marginBottom: 10 }}>Generated {todayISO()} · {pos.length} purchase order{pos.length === 1 ? "" : "s"}</div>

      <table className="pd-table">
        <thead>
          <tr><th>PO No.</th><th>Date</th><th>Supplier</th><th>Project / Site</th><th>Category</th><th>Grand total (NPR)</th><th>Status</th></tr>
        </thead>
        <tbody>
          {pos.map((p) => (
            <tr key={p.id}>
              <td>{p.poNo}</td><td>{p.poDate}</td><td>{p.supplier}</td><td>{p.project}</td>
              <td>{p.category}</td><td>{fmt(poTotals(p).grand)}</td><td>{p.status}</td>
            </tr>
          ))}
          <tr className="pd-subtotal"><td colSpan={5}>TOTAL</td><td>{fmt(grand)}</td><td></td></tr>
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------- CSS ------------------------------------ */

const BASE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');

.kcs-root {
  --ink: #24211B;
  --ink-2: #6B6559;
  --paper: #E9E4D8;
  --panel: #F6F3EA;
  --blueprint: #2B4C6F;
  --blueprint-dark: #1D3752;
  --ochre: #8A6A1E;
  --rust: #A13D2B;
  --green: #3F6C4F;
  --line: #D3CBB8;
  --font-display: 'Oswald', sans-serif;
  --font-body: 'IBM Plex Sans', sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;

  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-body);
  min-height: 100vh;
  background-image:
    linear-gradient(var(--line) 1px, transparent 1px),
    linear-gradient(90deg, var(--line) 1px, transparent 1px);
  background-size: 32px 32px;
  background-position: -1px -1px;
}
.kcs-root * { box-sizing: border-box; }

.topbar {
  display: flex; align-items: center; gap: 20px;
  padding: 14px 24px; background: var(--panel);
  border-bottom: 2px solid var(--ink);
  flex-wrap: wrap;
}
.brand { display: flex; align-items: center; gap: 10px; margin-right: auto; }
.brand-mark {
  width: 34px; height: 34px; border: 2px solid var(--blueprint);
  color: var(--blueprint); display: flex; align-items: center; justify-content: center;
  transform: rotate(0deg);
}
.brand-name { font-family: var(--font-display); font-weight: 600; font-size: 14px; letter-spacing: .03em; line-height: 1.2; }
.brand-sub { font-size: 11px; color: var(--ink-2); letter-spacing: .04em; text-transform: uppercase; }
.topbar-right { display: flex; align-items: center; gap: 10px; }
.role-pill { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; font-weight: 600; color: var(--ink-2); border: 1px solid var(--line); border-radius: 3px; padding: 5px 10px; background: var(--paper); white-space: nowrap; }
.tabs { display: flex; gap: 4px; }
.tab {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 14px; border: 1px solid transparent; background: transparent;
  font-family: var(--font-body); font-weight: 500; font-size: 13px; color: var(--ink-2);
  cursor: pointer; border-radius: 3px;
}
.tab:hover { color: var(--ink); }
.tab-active { background: var(--paper); border-color: var(--ink); color: var(--ink); }

.btn {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 9px 16px; border-radius: 3px; border: 1.5px solid var(--ink);
  font-family: var(--font-body); font-weight: 600; font-size: 13px; cursor: pointer;
  background: transparent; color: var(--ink); white-space: nowrap;
}
.btn:disabled { opacity: .4; cursor: not-allowed; }
.btn-primary { background: var(--blueprint); border-color: var(--blueprint); color: #fff; }
.btn-primary:hover:not(:disabled) { background: var(--blueprint-dark); }
.btn-secondary { background: var(--panel); }
.btn-ghost { background: transparent; }
.btn-sm { padding: 6px 12px; font-size: 12px; margin-top: 10px; }

.body-area { max-width: 1080px; margin: 0 auto; padding: 22px 24px 60px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; flex-wrap: wrap; }
.page-head h1 { font-family: var(--font-display); font-size: 24px; font-weight: 600; margin: 0 0 4px; letter-spacing: .01em; }
.page-head h2 { font-family: var(--font-display); font-size: 15px; font-weight: 600; margin: 0; letter-spacing: .02em; }
.muted { color: var(--ink-2); font-size: 13px; margin: 0; }
.head-actions { display: flex; gap: 8px; }
.form-title { display: flex; align-items: flex-start; gap: 10px; }

.stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
.stat-card { background: var(--panel); border: 1px solid var(--line); border-radius: 4px; padding: 14px 16px; }
.stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-2); margin-bottom: 6px; }
.stat-value { font-family: var(--font-display); font-size: 22px; font-weight: 600; }

.panel { background: var(--panel); border: 1px solid var(--line); border-radius: 4px; padding: 18px; margin-bottom: 16px; }
.panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }

.table-wrap { overflow-x: auto; }
table.ledger { width: 100%; border-collapse: collapse; font-size: 13px; }
table.ledger th {
  text-align: left; font-family: var(--font-body); font-weight: 600; font-size: 11px;
  text-transform: uppercase; letter-spacing: .04em; color: var(--ink-2);
  border-bottom: 1.5px solid var(--ink); padding: 8px 10px;
}
table.ledger td { padding: 9px 10px; border-bottom: 1px solid var(--line); vertical-align: middle; }
table.ledger tbody tr:hover { background: rgba(43,76,111,0.05); }
.mono { font-family: var(--font-mono); }
.strong { font-weight: 600; }

.filter-row { display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
.search { display: flex; align-items: center; gap: 8px; background: var(--panel); border: 1px solid var(--line); border-radius: 3px; padding: 8px 12px; flex: 1; min-width: 200px; color: var(--ink-2); }
.search input { border: none; background: transparent; outline: none; font-family: var(--font-body); font-size: 13px; color: var(--ink); flex: 1; }
.select { border: 1px solid var(--line); background: var(--panel); border-radius: 3px; padding: 8px 10px; font-family: var(--font-body); font-size: 13px; color: var(--ink); }
.w-full { width: 100%; }

.stamp {
  display: inline-block; font-family: var(--font-display); font-size: 11px; font-weight: 600;
  letter-spacing: .06em; text-transform: uppercase; padding: 3px 9px; border: 1.5px solid; border-radius: 2px;
  transform: rotate(-1.5deg); background: rgba(255,255,255,0.5);
}

.row-actions { display: flex; gap: 4px; }
.icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: 1px solid var(--line); background: var(--panel); border-radius: 3px; cursor: pointer; color: var(--ink-2); }
.icon-btn:hover { color: var(--ink); border-color: var(--ink); }
.icon-danger { color: #fff; background: var(--rust); border-color: var(--rust); }

.empty { text-align: center; padding: 60px 20px; background: var(--panel); border: 1px dashed var(--line); border-radius: 4px; }
.empty-stamp { display: inline-block; font-family: var(--font-display); font-weight: 600; letter-spacing: .08em; font-size: 13px; border: 2px solid var(--rust); color: var(--rust); padding: 6px 14px; transform: rotate(-2deg); margin-bottom: 14px; }
.empty p { color: var(--ink-2); margin-bottom: 18px; }

.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.field-label { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--ink-2); font-weight: 600; }
.field-err { font-size: 11px; color: var(--rust); }
.input { border: 1px solid var(--line); background: #fff; border-radius: 3px; padding: 8px 10px; font-family: var(--font-body); font-size: 13px; color: var(--ink); width: 100%; outline: none; }
.input:focus { border-color: var(--blueprint); }
.auto-note { color: var(--ink-2); background: var(--paper); font-style: italic; font-size: 12.5px; display: flex; align-items: center; }
textarea.input { resize: vertical; }
.cell { padding: 6px 8px; font-size: 12.5px; }
.cell-total { text-align: right; padding-right: 12px; }

.line-table td, .line-table th { padding: 6px 6px; }

.charge-row { display: flex; align-items: center; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid var(--line); font-size: 13px; }
.charge-input { width: 120px; text-align: right; padding: 5px 8px; }
.charge-row.grand { border-bottom: none; border-top: 2px solid var(--ink); margin-top: 4px; padding-top: 10px; font-family: var(--font-display); font-weight: 600; font-size: 15px; }

.form-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }

.toast {
  position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
  background: var(--ink); color: var(--paper); padding: 10px 18px; border-radius: 4px;
  font-family: var(--font-body); font-size: 13px; box-shadow: 0 6px 18px rgba(0,0,0,.25); z-index: 50;
}
.toast-err { background: var(--rust); }

@media (max-width: 720px) {
  .stat-row { grid-template-columns: 1fr 1fr; }
  .grid-2 { grid-template-columns: 1fr; }
  .tabs { order: 3; width: 100%; }
}

#print-root { display: none; }
`;

const PRINT_CSS = `
@media print {
  body * { visibility: hidden; }
  #print-root, #print-root * { visibility: visible; }
  #print-root {
    display: block !important;
    position: absolute; top: 0; left: 0; width: 100%;
    font-family: 'IBM Plex Sans', sans-serif; color: #1a1a1a; padding: 24px;
  }
  .pd-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a1a1a; padding-bottom: 10px; margin-bottom: 14px; }
  .pd-company { font-family: 'Oswald', sans-serif; font-weight: 600; font-size: 15px; }
  .pd-line { font-size: 11px; color: #555; }
  .pd-title { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 20px; letter-spacing: .04em; }
  .pd-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; font-size: 12px; margin-bottom: 14px; }
  .pd-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 12px; }
  .pd-table th, .pd-table td { border: 1px solid #999; padding: 5px 6px; text-align: left; }
  .pd-subtotal td { font-weight: 700; border-top: 2px solid #1a1a1a; }
  .pd-charges { width: 260px; margin-left: auto; font-size: 12px; }
  .pd-charges > div { display: flex; justify-content: space-between; padding: 3px 0; }
  .pd-grand { border-top: 2px solid #1a1a1a; font-weight: 700; font-size: 14px; margin-top: 4px; padding-top: 6px !important; }
  .pd-remarks, .pd-terms { font-size: 11px; margin-top: 14px; }
  .pd-terms ol { margin: 6px 0 0 18px; padding: 0; }
  .pd-terms li { margin-bottom: 3px; }
}
`;
