/**
 * Tests for pdf-extractor — pdftotext opportunistic content extraction utilities.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
	isPdfUrl,
	isPdfContentType,
	buildPdftotextArgs,
	parsePdfOutput,
	formatPdfResults,
	PDF_MAX_CHARS,
} from "../src/pdf-extractor.ts";

// ─── isPdfUrl ───────────────────────────────────────────────────────────────

describe("isPdfUrl", () => {
	test("recognizes .pdf extension", () => {
		assert.equal(isPdfUrl("https://arxiv.org/pdf/2401.12345.pdf"), true);
	});

	test("recognizes .pdf with query string", () => {
		assert.equal(isPdfUrl("https://example.com/doc.pdf?foo=bar"), true);
	});

	test("rejects non-pdf URLs", () => {
		assert.equal(isPdfUrl("https://example.com/page.html"), false);
	});

	test("rejects empty string", () => {
		assert.equal(isPdfUrl(""), false);
	});

	test("recognizes .pdf with fragment", () => {
		assert.equal(isPdfUrl("https://example.com/report.pdf#page=3"), true);
	});

	test("rejects pdf in query param only", () => {
		assert.equal(isPdfUrl("https://example.com/download?file=pdf"), false);
	});
});

// ─── isPdfContentType ───────────────────────────────────────────────────────

describe("isPdfContentType", () => {
	test("matches application/pdf", () => {
		assert.equal(isPdfContentType("application/pdf"), true);
	});

	test("matches application/pdf with charset", () => {
		assert.equal(isPdfContentType("application/pdf; charset=binary"), true);
	});

	test("rejects text/html", () => {
		assert.equal(isPdfContentType("text/html"), false);
	});

	test("rejects empty string", () => {
		assert.equal(isPdfContentType(""), false);
	});

	test("rejects application/octet-stream", () => {
		assert.equal(isPdfContentType("application/octet-stream"), false);
	});
});

// ─── buildPdftotextArgs ─────────────────────────────────────────────────────

describe("buildPdftotextArgs", () => {
	test("produces array starting with input path", () => {
		const args = buildPdftotextArgs("/tmp/test.pdf");
		assert.ok(Array.isArray(args));
		assert.ok(args.length >= 2);
	});

	test("includes dash for stdout output", () => {
		const args = buildPdftotextArgs("/tmp/test.pdf");
		assert.ok(args.includes("-"), "should include '-' for stdout output");
	});

	test("includes input path in args", () => {
		const args = buildPdftotextArgs("/tmp/test.pdf");
		assert.ok(args.includes("/tmp/test.pdf"), "should include the input path");
	});
});

// ─── parsePdfOutput ─────────────────────────────────────────────────────────

describe("parsePdfOutput", () => {
	test("parses short text without truncation", () => {
		const text = "This is a short PDF paragraph.\n\nAnother paragraph here.";
		const result = parsePdfOutput(text);
		assert.equal(result.truncated, false);
		assert.ok(result.snippets.length >= 1);
		assert.equal(result.metadata.charCount, text.length);
	});

	test("handles empty text", () => {
		const result = parsePdfOutput("");
		assert.equal(result.snippets.length, 0);
		assert.equal(result.metadata.charCount, 0);
		assert.equal(result.truncated, false);
	});

	test("truncates long text to maxChars", () => {
		// Generate long text
		const paragraph = "Lorem ipsum dolor sit amet. ".repeat(300); // ~7500 chars
		const text = paragraph;
		const result = parsePdfOutput(text, 6000);
		assert.equal(result.truncated, true);
		assert.ok(result.totalChars <= 6100, `totalChars ${result.totalChars} should be near maxChars`);
	});

	test("respects custom maxChars", () => {
		const text = "A".repeat(500);
		const result = parsePdfOutput(text, 200);
		assert.equal(result.truncated, true);
		assert.ok(result.totalChars <= 250);
	});

	test("splits into paragraph snippets", () => {
		const text = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.";
		const result = parsePdfOutput(text);
		assert.ok(result.snippets.length >= 2, "should have multiple snippets");
	});

	test("returns metadata with charCount", () => {
		const result = parsePdfOutput("Hello world");
		assert.ok("charCount" in result.metadata);
		assert.equal(result.metadata.charCount, 11);
	});

	test("totalChars equals charCount for short text", () => {
		const text = "Short.";
		const result = parsePdfOutput(text);
		assert.equal(result.totalChars, result.metadata.charCount);
	});

	test("handles whitespace-only text", () => {
		const result = parsePdfOutput("   \n\n  \t  \n\n   ");
		assert.equal(result.snippets.length, 0, "whitespace-only should have no snippets");
	});
});

// ─── formatPdfResults ───────────────────────────────────────────────────────

describe("formatPdfResults", () => {
	test("produces evidence-card-style output", () => {
		const parsed = {
			metadata: { charCount: 42, format: "text" },
			snippets: ["First paragraph of the PDF."],
			totalChars: 42,
			truncated: false,
		};
		const output = formatPdfResults(parsed, "https://example.com/paper.pdf");
		assert.ok(output.includes("https://example.com/paper.pdf"), "should include URL");
		assert.ok(output.includes("First paragraph"), "should include snippet content");
	});

	test("includes Source line", () => {
		const parsed = {
			metadata: { charCount: 10 },
			snippets: ["Test."],
			totalChars: 10,
			truncated: false,
		};
		const output = formatPdfResults(parsed, "https://example.com/paper.pdf");
		assert.match(output, /Source:/i);
	});

	test("indicates truncation", () => {
		const parsed = {
			metadata: { charCount: 10000 },
			snippets: ["Truncated content."],
			totalChars: 6000,
			truncated: true,
		};
		const output = formatPdfResults(parsed, "https://example.com/paper.pdf");
		assert.match(output, /truncated/i);
	});

	test("handles empty snippets", () => {
		const parsed = {
			metadata: { charCount: 0 },
			snippets: [],
			totalChars: 0,
			truncated: false,
		};
		const output = formatPdfResults(parsed, "https://example.com/paper.pdf");
		assert.ok(typeof output === "string");
		assert.ok(output.length > 0, "should produce some output even for empty");
	});
});

// ─── PDF_MAX_CHARS ──────────────────────────────────────────────────────────

describe("PDF_MAX_CHARS", () => {
	test("is 6000", () => {
		assert.equal(PDF_MAX_CHARS, 6000);
	});
});
