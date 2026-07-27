import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export const DOCUMENTS_BUCKET = "documents";

/** Upload a PDF to the private documents bucket. Returns the storage path. */
export async function uploadDocumentFile(
  path: string,
  file: File,
): Promise<string> {
  const supabase = createAdminClient();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, bytes, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return path;
}

/** Create a short-lived signed URL to view a stored document. */
export async function signedDocumentUrl(
  path: string,
  expiresInSeconds = 60 * 10,
): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}

/** Download the raw bytes of a stored document. */
export async function downloadDocumentFile(
  path: string,
): Promise<Uint8Array> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .download(path);
  if (error || !data) {
    throw new Error(`Download failed: ${error?.message ?? "no data"}`);
  }
  return new Uint8Array(await data.arrayBuffer());
}

/** Upload raw PDF bytes (used for generated signed copies). */
export async function uploadDocumentBytes(
  path: string,
  bytes: Uint8Array,
  upsert = true,
): Promise<string> {
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, bytes, { contentType: "application/pdf", upsert });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return path;
}

/** Remove a stored document file (best-effort). */
export async function deleteDocumentFile(path: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
}
