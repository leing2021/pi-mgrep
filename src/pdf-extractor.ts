/**
 * pi-search — PDF content extraction utilities for pdftotext.
 *
 * Provides pure utility functions for detecting PDFs, building pdftotext
 * command args, and parsing/formatting pdftotext output. Does NOT execute
 * pdftotext directly — command execution is handled by the caller.
 *
 * Exports:
 *   - isPdfUrl(url) → boolean
 *   - isPdfContentType(contentType) → boolean
 *   - buildPdftotextArgs(inputPath) → string[]
 *   - parsePdfOutput(rawText, maxChars?) → { metadata, snippets, totalChars, truncated }
 *   - formatPdfResults(parsed, url) → string
 *   - PDF_MAX_CHARS → number
 */

/** Default maximum characters to extract from PDF text. */
export const PDF_MAX_CHARS = 6000;

/**
 * Check if a URL points to a PDF file based on its path.
 * Recognizes .pdf extension before query strings and fragments.
 */
export function isPdfUrl(url: string): boolean {
	if (!url) return false;
	try {
		const parsed = new URL(url);
		// Check pathname ends with .pdf
		return parsed.pathname.toLowerCase().endsWith(".pdf");
	} catch {
		// Not a valid URL — check raw string
		const path = url.split("?")[0].split("#")[0];
		return path.toLowerCase().endsWith(".pdf");
	}
}

/**
 * Check if a content-type header indicates a PDF.
 * Handles parameters like charset after the MIME type.
 */
export function isPdfContentType(contentType: string): boolean {
	if (!contentType) return false;
	const mime = contentType.split(";")[0].trim().toLowerCase();
	return mime === "application/pdf";
}

/**
 * Build pdftotext command-line arguments.
 * Uses '-' as output target for stdout, enabling pipe capture.
 */
export function buildPdftotextArgs(inputPath: string): string[] {
	return [
		"-layout",      // maintain original layout
		"-enc", "UTF-8", // force UTF-8 encoding
		inputPath,       // input PDF file
		"-",             // output to stdout
	];
}

/**
 * Parse raw pdftotext output into structured evidence.
 * Splits text into paragraphs, optionally truncates to maxChars.
 */
export function parsePdfOutput(
	rawText: string,
	maxChars: number = PDF_MAX_CHARS,
): {
	metadata: { totalPages?: number; charCount: number; format?: string };
	snippets: string[];
	totalChars: number;
	truncated: boolean;
} {
	const charCount = rawText.length;

	// Split into paragraph snippets by double-newline
	const paragraphs = rawText
		.split(/\n\s*\n/)
		.map((p) => p.trim())
		.filter((p) => p.length > 0);

	// If no meaningful content, return empty
	if (paragraphs.length === 0) {
		return {
			metadata: { charCount: 0, format: "text" },
			snippets: [],
			totalChars: 0,
			truncated: false,
		};
	}

	// Build snippets within maxChars budget
	const snippets: string[] = [];
	let totalChars = 0;
	let truncated = false;

	for (const para of paragraphs) {
		if (totalChars + para.length <= maxChars) {
			snippets.push(para);
			totalChars += para.length;
		} else {
			// Remaining budget — take partial paragraph
			const remaining = maxChars - totalChars;
			if (remaining > 40) {
				snippets.push(para.slice(0, remaining));
				totalChars = maxChars;
			}
			truncated = true;
			break;
		}
	}

	return {
		metadata: { charCount, format: "text" },
		snippets,
		totalChars,
		truncated,
	};
}

/**
 * Format parsed PDF results as evidence-card-style output.
 */
export function formatPdfResults(
	parsed: {
		metadata: { totalPages?: number; charCount: number; format?: string };
		snippets: string[];
		totalChars: number;
		truncated: boolean;
	},
	url: string,
): string {
	const lines: string[] = [];

	lines.push(`Source: ${url}`);
	lines.push(`Engine: pdftotext`);

	if (parsed.metadata.totalPages) {
		lines.push(`Pages: ${parsed.metadata.totalPages}`);
	}
	lines.push(`Chars: ${parsed.metadata.charCount}`);

	if (parsed.truncated) {
		lines.push(`[truncated — ${parsed.totalChars} of ${parsed.metadata.charCount} chars]`);
	}

	lines.push(""); // blank separator

	if (parsed.snippets.length === 0) {
		lines.push("(No extractable text content)");
	} else {
		lines.push(parsed.snippets.join("\n\n"));
	}

	return lines.join("\n");
}
