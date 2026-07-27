import "server-only";
import { createHash } from "crypto";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { IntakeDocument } from "@/db/schema";
import { SIGNING_CONSENT } from "@/lib/esign";
import {
  downloadDocumentFile,
  uploadDocumentBytes,
} from "@/lib/documents-storage";

const PAGE_WIDTH = 612; // US Letter
const PAGE_HEIGHT = 792;
const MARGIN = 54;
const INK = rgb(0.1, 0.11, 0.14);
const MUTED = rgb(0.36, 0.39, 0.45);
const RULE = rgb(0.85, 0.82, 0.75);
const AMBER = rgb(0.85, 0.47, 0.02);

export type FinalizeResult = {
  signedStoragePath: string;
  originalHash: string;
  signedHash: string;
};

function sha256(input: Uint8Array | string): string {
  return createHash("sha256").update(input).digest("hex");
}

function fmtSignedAt(dt: Date): string {
  // Long date + time including the timezone name for court-readable proof.
  return dt.toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "long",
  });
}

/** Split text into lines that fit within maxWidth at the given font size. */
function wrapLines(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const words = rawLine.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        // A single word longer than the line: hard-split it.
        if (font.widthOfTextAtSize(word, size) > maxWidth) {
          let chunk = "";
          for (const ch of word) {
            if (font.widthOfTextAtSize(chunk + ch, size) <= maxWidth) {
              chunk += ch;
            } else {
              lines.push(chunk);
              chunk = ch;
            }
          }
          current = chunk;
        } else {
          current = word;
        }
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

/** Render plain-text document body across as many Letter pages as needed. */
function renderTextBody(
  pdf: PDFDocument,
  font: PDFFont,
  bold: PDFFont,
  title: string,
  body: string,
) {
  const size = 11;
  const lineHeight = 16;
  const maxWidth = PAGE_WIDTH - MARGIN * 2;
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  page.drawText(title, { x: MARGIN, y, size: 16, font: bold, color: INK });
  y -= 28;

  for (const line of wrapLines(body, font, size, maxWidth)) {
    if (y < MARGIN + lineHeight) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
    if (line) {
      page.drawText(line, { x: MARGIN, y, size, font, color: INK });
    }
    y -= lineHeight;
  }
}

/** Stamp a small signature footer at the bottom of every page. */
function stampFooter(pdf: PDFDocument, font: PDFFont, text: string) {
  for (const page of pdf.getPages()) {
    const { width } = page.getSize();
    const size = 7;
    const w = font.widthOfTextAtSize(text, size);
    const x = Math.max(MARGIN, (width - w) / 2);
    // Faint background bar so the stamp stays legible over content.
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height: 22,
      color: rgb(1, 1, 1),
      opacity: 0.85,
    });
    page.drawText(text, { x, y: 8, size, font, color: MUTED });
  }
}

/** Append a DocuSign-style Certificate of Completion page. */
function appendCertificate(
  pdf: PDFDocument,
  font: PDFFont,
  bold: PDFFont,
  fields: {
    orgName: string;
    docTitle: string;
    fileName: string | null;
    docId: string;
    signedName: string;
    signedAt: Date;
    ip: string | null;
    userAgent: string | null;
    originalHash: string;
  },
) {
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const maxWidth = PAGE_WIDTH - MARGIN * 2;
  let y = PAGE_HEIGHT - MARGIN;

  page.drawText("Certificate of Completion", {
    x: MARGIN,
    y,
    size: 20,
    font: bold,
    color: INK,
  });
  y -= 22;
  page.drawText(fields.orgName, { x: MARGIN, y, size: 11, font, color: MUTED });
  y -= 18;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 2,
    color: AMBER,
  });
  y -= 26;

  const intro =
    "This certifies that the document identified below was electronically " +
    "signed. The signature is legally binding under the U.S. ESIGN Act and " +
    "applicable state law (UETA).";
  for (const line of wrapLines(intro, font, 10, maxWidth)) {
    page.drawText(line, { x: MARGIN, y, size: 10, font, color: INK });
    y -= 14;
  }
  y -= 12;

  const row = (label: string, value: string) => {
    const labelX = MARGIN;
    const valueX = MARGIN + 150;
    const valueWidth = PAGE_WIDTH - MARGIN - valueX;
    page.drawText(label, { x: labelX, y, size: 9, font: bold, color: MUTED });
    const lines = wrapLines(value || "—", font, 10, valueWidth);
    for (let i = 0; i < lines.length; i++) {
      page.drawText(lines[i], {
        x: valueX,
        y: y - i * 13,
        size: 10,
        font,
        color: INK,
      });
    }
    y -= Math.max(18, lines.length * 13 + 5);
  };

  row("Document", fields.docTitle);
  row("File", fields.fileName ?? "—");
  row("Document ID", fields.docId);
  row("Signer", fields.signedName);
  row("Signed", fmtSignedAt(fields.signedAt));
  row("IP address", fields.ip ?? "—");
  row("Device / browser", fields.userAgent ?? "—");

  y -= 6;
  page.drawText("Consent agreed to", {
    x: MARGIN,
    y,
    size: 9,
    font: bold,
    color: MUTED,
  });
  y -= 15;
  for (const line of wrapLines(`"${SIGNING_CONSENT}"`, font, 9, maxWidth)) {
    page.drawText(line, { x: MARGIN, y, size: 9, font, color: INK });
    y -= 12;
  }

  y -= 14;
  page.drawText("Document integrity (SHA-256)", {
    x: MARGIN,
    y,
    size: 9,
    font: bold,
    color: MUTED,
  });
  y -= 15;
  const hashNote =
    "The fingerprint below uniquely identifies the exact document that was " +
    "signed. Any later change to the document would produce a different value.";
  for (const line of wrapLines(hashNote, font, 8, maxWidth)) {
    page.drawText(line, { x: MARGIN, y, size: 8, font, color: MUTED });
    y -= 11;
  }
  y -= 4;
  for (const line of wrapLines(fields.originalHash, font, 9, maxWidth)) {
    page.drawText(line, { x: MARGIN, y, size: 9, font, color: INK });
    y -= 12;
  }
}

/**
 * Build a court-provable signed copy of an intake document: the original
 * content stamped with the signature footer plus an appended Certificate of
 * Completion. Uploads it and returns storage path + integrity hashes.
 */
export async function finalizeSignedDocument(opts: {
  doc: IntakeDocument;
  orgName: string;
  signedName: string;
  signedAt: Date;
  ip: string | null;
  userAgent: string | null;
}): Promise<FinalizeResult> {
  const { doc, orgName, signedName, signedAt, ip, userAgent } = opts;

  let pdf: PDFDocument;
  let originalHash: string;

  if (doc.storagePath) {
    const bytes = await downloadDocumentFile(doc.storagePath);
    originalHash = sha256(bytes);
    pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  } else {
    const body = doc.body ?? "";
    originalHash = sha256(body);
    pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    renderTextBody(pdf, font, bold, doc.title, body);
  }

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const footer = `Electronically signed by ${signedName} on ${fmtSignedAt(
    signedAt,
  )}  ·  Document ID ${doc.id}`;
  stampFooter(pdf, font, footer);

  appendCertificate(pdf, font, bold, {
    orgName,
    docTitle: doc.title,
    fileName: doc.fileName,
    docId: doc.id,
    signedName,
    signedAt,
    ip,
    userAgent,
    originalHash,
  });

  const out = await pdf.save();
  const signedHash = sha256(out);
  const signedStoragePath = `${doc.orgId}/signed/${doc.id}.pdf`;
  await uploadDocumentBytes(signedStoragePath, out, true);

  return { signedStoragePath, originalHash, signedHash };
}
