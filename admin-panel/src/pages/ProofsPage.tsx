import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.ts";

// ── Types ──────────────────────────────────────────────────
type ProofStatus = "pending" | "approved" | "rejected" | "revision_requested";

interface ProofVersion {
  id: string;
  proof_id: string;
  version_number: number;
  file_url: string;
  file_name: string | null;
  file_type: string | null;
  uploaded_by: string;
  uploaded_by_name: string | null;
  comment: string | null;
  uploaded_at: string;
}

interface Proof {
  id: string;
  tenant_id: string;
  job_id: string;
  status: ProofStatus;
  notes: string | null;
  actioned_by: string | null;
  actioned_by_name: string | null;
  actioned_at: string | null;
  created_at: string;
  updated_at: string;
  versions: ProofVersion[];
}

interface Job {
  id: string;
  job_number: number;
  title: string;
}

interface PagedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ── Style constants ────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 20,
  marginBottom: 16,
};

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid #ddd",
  borderRadius: 6,
  fontSize: 14,
  boxSizing: "border-box",
};

const btnBase: React.CSSProperties = {
  padding: "7px 14px",
  borderRadius: 6,
  border: "none",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 500,
};

const STATUS_COLOR: Record<ProofStatus, { bg: string; color: string; label: string }> = {
  pending: { bg: "#fef3c7", color: "#92400e", label: "Pending" },
  approved: { bg: "#d1fae5", color: "#065f46", label: "Approved" },
  rejected: { bg: "#fee2e2", color: "#991b1b", label: "Rejected" },
  revision_requested: { bg: "#dbeafe", color: "#1e40af", label: "Revision Requested" },
};

function StatusBadge({ status }: { status: ProofStatus }) {
  const s = STATUS_COLOR[status] ?? STATUS_COLOR.pending;
  return (
    <span style={{
      background: s.bg,
      color: s.color,
      borderRadius: 6,
      padding: "2px 10px",
      fontSize: 12,
      fontWeight: 600,
    }}>
      {s.label}
    </span>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Main Component ─────────────────────────────────────────
export default function ProofsPage() {
  const qc = useQueryClient();

  // Job filter
  const [selectedJobId, setSelectedJobId] = useState<string>("");

  // New Proof modal
  const [showNewProof, setShowNewProof] = useState(false);
  const [newJobId, setNewJobId] = useState<string>("");
  const [newNotes, setNewNotes] = useState<string>("");

  // Upload version state per proof
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [uploadComment, setUploadComment] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Action confirmation
  const [actionTarget, setActionTarget] = useState<{ proofId: string; action: "approved" | "rejected" | "revision_requested"; notes: string } | null>(null);

  // ── Fetch jobs for dropdown ──────────────────────────────
  const { data: jobsResult } = useQuery<PagedResult<Job>>({
    queryKey: ["jobs-list"],
    queryFn: () => api.get("/admin/jobs", { params: { limit: 200 } }).then((r) => r.data),
  });
  const jobs: Job[] = jobsResult?.data ?? [];

  // ── Fetch proofs for selected job ───────────────────────
  const { data: proofs = [], isLoading: proofsLoading } = useQuery<Proof[]>({
    queryKey: ["proofs", selectedJobId],
    queryFn: () => api.get(`/admin/proofs?jobId=${selectedJobId}`).then((r) => r.data),
    enabled: !!selectedJobId,
  });

  // ── Mutations ────────────────────────────────────────────
  const createProof = useMutation({
    mutationFn: (body: { jobId: string; notes?: string }) => api.post("/admin/proofs", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proofs", newJobId] });
      if (newJobId === selectedJobId) qc.invalidateQueries({ queryKey: ["proofs", selectedJobId] });
      setShowNewProof(false);
      setNewJobId("");
      setNewNotes("");
    },
  });

  const actionProof = useMutation({
    mutationFn: ({ proofId, action, notes }: { proofId: string; action: string; notes: string }) =>
      api.patch(`/admin/proofs/${proofId}/action`, { action, notes: notes || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proofs", selectedJobId] });
      setActionTarget(null);
    },
  });

  const uploadVersion = useMutation({
    mutationFn: ({ proofId, file, comment }: { proofId: string; file: File; comment: string }) => {
      const fd = new FormData();
      fd.append("file", file);
      if (comment) fd.append("comment", comment);
      return api.post(`/admin/proofs/${proofId}/versions`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proofs", selectedJobId] });
      setUploadingFor(null);
      setUploadComment("");
    },
  });

  async function handleView(proofId: string, versionId: string) {
    const res = await api.get(`/admin/proofs/file/${proofId}/${versionId}`);
    window.open(res.data.url, "_blank");
  }

  async function handleDownload(proofId: string, versionId: string, fileName: string | null) {
    const res = await api.get(`/admin/proofs/file/${proofId}/${versionId}`);
    const a = document.createElement("a");
    a.href = res.data.url;
    a.download = fileName ?? "proof-file";
    a.click();
  }

  function handleFileUpload(proofId: string) {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    uploadVersion.mutate({ proofId, file, comment: uploadComment });
  }

  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  return (
    <div style={{ maxWidth: 900 }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#111827" }}>Proof Approval</h2>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>
            Upload artwork proofs, track versions, and record approval status.
          </p>
        </div>
        <button
          onClick={() => setShowNewProof(true)}
          style={{ ...btnBase, background: "#7c3aed", color: "#fff" }}
        >
          + New Proof
        </button>
      </div>

      {/* ── Job filter ── */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>Filter by Job</label>
        <select
          value={selectedJobId}
          onChange={(e) => setSelectedJobId(e.target.value)}
          style={{ ...inputStyle, width: 320, marginLeft: 12 }}
        >
          <option value="">— Select a job —</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              #{j.job_number} — {j.title}
            </option>
          ))}
        </select>
      </div>

      {/* ── Content ── */}
      {!selectedJobId && (
        <div style={{ ...cardStyle, color: "#6b7280", fontSize: 14, textAlign: "center", padding: 40 }}>
          Select a job above to view its proofs.
        </div>
      )}

      {selectedJobId && proofsLoading && (
        <div style={{ color: "#6b7280", fontSize: 14 }}>Loading proofs…</div>
      )}

      {selectedJobId && !proofsLoading && proofs.length === 0 && (
        <div style={{ ...cardStyle, color: "#6b7280", fontSize: 14, textAlign: "center", padding: 40 }}>
          No proofs found for this job. Click "+ New Proof" to create one.
        </div>
      )}

      {proofs.map((proof) => (
        <div key={proof.id} style={cardStyle}>
          {/* Card header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: 15, color: "#111827" }}>
                {selectedJob ? `Job #${selectedJob.job_number} — ${selectedJob.title}` : `Job`}
              </span>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                Created: {fmtDate(proof.created_at)}
              </div>
            </div>
            <StatusBadge status={proof.status} />
          </div>

          {/* Versions */}
          {proof.versions.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Versions
              </div>
              {proof.versions.map((v) => (
                <div key={v.id} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "6px 10px",
                  background: "#f9fafb",
                  borderRadius: 6,
                  marginBottom: 4,
                  fontSize: 13,
                }}>
                  <span style={{ fontWeight: 600, color: "#7c3aed", minWidth: 28 }}>v{v.version_number}</span>
                  <span style={{ flex: 1, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {v.file_name ?? v.file_url}
                  </span>
                  {v.uploaded_by_name && (
                    <span style={{ color: "#9ca3af", fontSize: 11 }}>{v.uploaded_by_name}</span>
                  )}
                  <span style={{ color: "#9ca3af", fontSize: 11 }}>{fmtDate(v.uploaded_at)}</span>
                  <button
                    onClick={() => handleView(proof.id, v.id)}
                    style={{ ...btnBase, padding: "4px 10px", background: "#ede9fe", color: "#5b21b6", fontSize: 12 }}
                  >
                    View
                  </button>
                  <button
                    onClick={() => handleDownload(proof.id, v.id, v.file_name)}
                    style={{ ...btnBase, padding: "4px 10px", background: "#f3f4f6", color: "#374151", fontSize: 12 }}
                  >
                    Download
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Upload new version */}
          {uploadingFor === proof.id ? (
            <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Upload New Version</div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.ai,.eps,.psd"
                style={{ marginBottom: 8, fontSize: 13 }}
              />
              <textarea
                placeholder="Comment (optional)"
                value={uploadComment}
                onChange={(e) => setUploadComment(e.target.value)}
                style={{ ...inputStyle, width: "100%", resize: "vertical", minHeight: 60, marginBottom: 8 }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => handleFileUpload(proof.id)}
                  disabled={uploadVersion.isPending}
                  style={{ ...btnBase, background: "#7c3aed", color: "#fff" }}
                >
                  {uploadVersion.isPending ? "Uploading…" : "Upload"}
                </button>
                <button
                  onClick={() => { setUploadingFor(null); setUploadComment(""); }}
                  style={{ ...btnBase, background: "#f3f4f6", color: "#374151" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setUploadingFor(proof.id)}
              style={{ ...btnBase, background: "#f3f4f6", color: "#374151", marginBottom: 14, fontSize: 12 }}
            >
              Upload New Version
            </button>
          )}

          {/* Notes */}
          {proof.notes && (
            <div style={{ fontSize: 13, color: "#4b5563", marginBottom: 12 }}>
              <span style={{ fontWeight: 600 }}>Notes: </span>{proof.notes}
            </div>
          )}

          {/* Actioned by */}
          {proof.status !== "pending" && proof.actioned_by_name && (
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
              {STATUS_COLOR[proof.status]?.label} by {proof.actioned_by_name}
              {proof.actioned_at ? ` on ${fmtDate(proof.actioned_at)}` : ""}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => setActionTarget({ proofId: proof.id, action: "approved", notes: proof.notes ?? "" })}
              style={{ ...btnBase, background: "#d1fae5", color: "#065f46" }}
            >
              ✓ Approve
            </button>
            <button
              onClick={() => setActionTarget({ proofId: proof.id, action: "rejected", notes: proof.notes ?? "" })}
              style={{ ...btnBase, background: "#fee2e2", color: "#991b1b" }}
            >
              ✗ Reject
            </button>
            <button
              onClick={() => setActionTarget({ proofId: proof.id, action: "revision_requested", notes: proof.notes ?? "" })}
              style={{ ...btnBase, background: "#dbeafe", color: "#1e40af" }}
            >
              ↩ Request Revision
            </button>
          </div>
        </div>
      ))}

      {/* ── New Proof Modal ── */}
      {showNewProof && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <h3 style={{ margin: "0 0 18px", fontSize: 17, fontWeight: 700 }}>New Proof</h3>

            <label style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>Job *</label>
            <select
              value={newJobId}
              onChange={(e) => setNewJobId(e.target.value)}
              style={{ ...inputStyle, width: "100%", marginBottom: 14, marginTop: 4 }}
            >
              <option value="">— Select a job —</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  #{j.job_number} — {j.title}
                </option>
              ))}
            </select>

            <label style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>Notes</label>
            <textarea
              placeholder="Optional notes…"
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              style={{ ...inputStyle, width: "100%", resize: "vertical", minHeight: 80, marginBottom: 18, marginTop: 4 }}
            />

            {createProof.isError && (
              <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>Failed to create proof. Please try again.</div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setShowNewProof(false); setNewJobId(""); setNewNotes(""); }}
                style={{ ...btnBase, background: "#f3f4f6", color: "#374151" }}
              >
                Cancel
              </button>
              <button
                disabled={!newJobId || createProof.isPending}
                onClick={() => createProof.mutate({ jobId: newJobId, notes: newNotes || undefined })}
                style={{ ...btnBase, background: "#7c3aed", color: "#fff", opacity: !newJobId ? 0.5 : 1 }}
              >
                {createProof.isPending ? "Creating…" : "Create Proof"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Action Confirmation Modal ── */}
      {actionTarget && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 700 }}>
              {actionTarget.action === "approved" ? "Approve Proof" :
               actionTarget.action === "rejected" ? "Reject Proof" : "Request Revision"}
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6b7280" }}>
              {actionTarget.action === "approved"
                ? "Mark this proof as approved and ready for print."
                : actionTarget.action === "rejected"
                ? "Mark this proof as rejected. This cannot be undone automatically."
                : "Request the client or operator to revise the artwork."}
            </p>

            <label style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>Notes (optional)</label>
            <textarea
              placeholder="Add a note…"
              value={actionTarget.notes}
              onChange={(e) => setActionTarget({ ...actionTarget, notes: e.target.value })}
              style={{ ...inputStyle, width: "100%", resize: "vertical", minHeight: 72, marginBottom: 18, marginTop: 4 }}
            />

            {actionProof.isError && (
              <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>Action failed. Please try again.</div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setActionTarget(null)}
                style={{ ...btnBase, background: "#f3f4f6", color: "#374151" }}
              >
                Cancel
              </button>
              <button
                disabled={actionProof.isPending}
                onClick={() => actionProof.mutate(actionTarget)}
                style={{
                  ...btnBase,
                  background: actionTarget.action === "approved" ? "#059669"
                    : actionTarget.action === "rejected" ? "#dc2626" : "#2563eb",
                  color: "#fff",
                }}
              >
                {actionProof.isPending ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
