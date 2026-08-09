import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import db from "../db/knex.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { requireTenant } from "../middleware/tenantScope.js";
import { writeAuditLog } from "../middleware/auditLog.js";
import * as Minio from "minio";

const router = Router();
router.use(requireTenant);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT ?? "minio",
  port: parseInt(process.env.MINIO_PORT ?? "9000"),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY ?? "motipaper",
  secretKey: process.env.MINIO_SECRET_KEY ?? "motipaper123",
});

const BUCKET = "proofs";

async function ensureBucket() {
  try {
    const exists = await minioClient.bucketExists(BUCKET);
    if (!exists) await minioClient.makeBucket(BUCKET, "us-east-1");
  } catch (e) {
    console.error("MinIO bucket init error:", e);
  }
}
ensureBucket();

// ── GET /proofs?jobId= ────────────────────────────────────
router.get("/", requirePermission("jobs.view"), async (req, res) => {
  const { jobId } = req.query as { jobId: string };
  if (!jobId) { res.status(400).json({ error: "jobId required" }); return; }

  const proofs = await db("proofs")
    .where({ job_id: jobId, tenant_id: req.user.tenantId! })
    .leftJoin("users as actioned_user", "proofs.actioned_by", "actioned_user.id")
    .select("proofs.*", "actioned_user.name as actioned_by_name")
    .orderBy("proofs.created_at", "desc");

  const proofIds = proofs.map((p: { id: string }) => p.id);
  const versions = proofIds.length > 0
    ? await db("proof_versions")
        .whereIn("proof_id", proofIds)
        .leftJoin("users as uploader", "proof_versions.uploaded_by", "uploader.id")
        .select("proof_versions.*", "uploader.name as uploaded_by_name")
        .orderBy("proof_versions.version_number", "asc")
    : [];

  const result = proofs.map((p: Record<string, unknown>) => ({
    ...p,
    versions: versions.filter((v: Record<string, unknown>) => v.proof_id === p.id),
  }));
  res.json(result);
});

// ── POST /proofs ──────────────────────────────────────────
router.post("/", requirePermission("jobs.create"), async (req, res) => {
  const { jobId, notes } = req.body as { jobId: string; notes?: string };
  if (!jobId) { res.status(400).json({ error: "jobId required" }); return; }

  const [proof] = await db("proofs").insert({
    tenant_id: req.user.tenantId!,
    job_id: jobId,
    status: "pending",
    notes: notes ?? null,
  }).returning("*");

  res.status(201).json(proof);
});

// ── POST /proofs/:id/versions ─────────────────────────────
router.post("/:id/versions", requirePermission("jobs.create"), upload.single("file"), async (req, res) => {
  const proof = await db("proofs")
    .where({ id: req.params.id, tenant_id: req.user.tenantId! })
    .first();
  if (!proof) { res.status(404).json({ error: "Proof not found" }); return; }
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

  const [lastVersion] = await db("proof_versions")
    .where({ proof_id: proof.id })
    .orderBy("version_number", "desc")
    .select("version_number")
    .limit(1);
  const nextVersion = (lastVersion?.version_number ?? 0) + 1;

  const ext = req.file.originalname.split(".").pop() ?? "bin";
  const fileKey = `${req.user.tenantId}/${proof.job_id}/${proof.id}/v${nextVersion}.${ext}`;

  await minioClient.putObject(BUCKET, fileKey, req.file.buffer, req.file.size, {
    "Content-Type": req.file.mimetype,
  });

  const comment = (req.body as { comment?: string }).comment;
  const [version] = await db("proof_versions").insert({
    proof_id: proof.id,
    version_number: nextVersion,
    file_url: fileKey,
    file_name: req.file.originalname,
    file_type: ext,
    uploaded_by: req.user.id,
    comment: comment ?? null,
  }).returning("*");

  res.status(201).json(version);
});

// ── GET /proofs/file/:proofId/:versionId ──────────────────
router.get("/file/:proofId/:versionId", requirePermission("jobs.view"), async (req, res) => {
  const version = await db("proof_versions")
    .join("proofs", "proof_versions.proof_id", "proofs.id")
    .where({
      "proof_versions.id": req.params.versionId,
      "proofs.tenant_id": req.user.tenantId!,
    })
    .select("proof_versions.file_url")
    .first();
  if (!version) { res.status(404).json({ error: "Not found" }); return; }

  const url = await minioClient.presignedGetObject(BUCKET, version.file_url, 60 * 60); // 1hr
  res.json({ url });
});

// ── PATCH /proofs/:id/action ──────────────────────────────
const ActionSchema = z.object({
  action: z.enum(["approved", "rejected", "revision_requested"]),
  notes: z.string().optional(),
});

router.patch("/:id/action", requirePermission("jobs.edit"), async (req, res) => {
  const parsed = ActionSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const existing = await db("proofs")
    .where({ id: req.params.id, tenant_id: req.user.tenantId! })
    .first();
  if (!existing) { res.status(404).json({ error: "Proof not found" }); return; }

  const [updated] = await db("proofs")
    .where({ id: req.params.id })
    .update({
      status: parsed.data.action,
      notes: parsed.data.notes ?? existing.notes,
      actioned_by: req.user.id,
      actioned_at: new Date(),
      updated_at: new Date(),
    })
    .returning("*");

  await writeAuditLog(req, "proof.actioned", "proof", req.params.id, existing, updated);
  res.json(updated);
});

export default router;
