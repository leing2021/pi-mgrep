/**
 * pi-search — Evidence cards output format + details standardization.
 *
 * Thin contract layer for formatting search results as evidence cards
 * with budget-aware truncation and metadata details.
 *
 * Evidence card: { source, locator, snippet, engine, score? }
 * Details: { provider, fallbackUsed, mode, rawBytes?, returnedChars?, truncated?, capabilitiesUsed? }
 *
 * Exports:
 *   - formatCard(card) → single card formatted string
 *   - buildDetails(opts) → details object
 *   - buildEvidenceCards(cards, details?) → formatted text string
 */

/** Mode → char budget mapping */
const BUDGETS = {
	compact: 6000,
	quotes: 10000,
	full: 30000,
} as const;

type Mode = keyof typeof BUDGETS;

export interface EvidenceCard {
	source: string;
	locator: string;
	snippet: string;
	engine: string;
	score?: number;
}

export interface DetailsMeta {
	provider: string;
	fallbackUsed: boolean;
	mode: string;
	rawBytes?: number;
	returnedChars?: number;
	truncated?: boolean;
	capabilitiesUsed?: string[];
}

/**
 * Formats a single evidence card as a readable text block.
 */
export function formatCard(card: EvidenceCard): string {
	const lines: string[] = [
		`Source: ${card.source}`,
		`Locator: ${card.locator}`,
		`Snippet: ${card.snippet}`,
		`Engine: ${card.engine}`,
	];
	if (card.score !== undefined) {
		lines.push(`Score: ${card.score}`);
	}
	return lines.join("\n");
}

/**
 * Builds a details metadata object from options.
 * Provides sensible defaults for optional fields.
 */
export function buildDetails(opts: {
	provider: string;
	fallbackUsed?: boolean;
	mode?: string;
	rawBytes?: number;
	returnedChars?: number;
	truncated?: boolean;
	capabilitiesUsed?: string[];
}): DetailsMeta {
	const details: DetailsMeta = {
		provider: opts.provider,
		fallbackUsed: opts.fallbackUsed ?? false,
		mode: opts.mode ?? "compact",
	};
	if (opts.rawBytes !== undefined) details.rawBytes = opts.rawBytes;
	if (opts.returnedChars !== undefined) details.returnedChars = opts.returnedChars;
	if (opts.truncated !== undefined) details.truncated = opts.truncated;
	if (opts.capabilitiesUsed !== undefined) details.capabilitiesUsed = opts.capabilitiesUsed;
	return details;
}

/**
 * Builds formatted evidence card output text.
 * Respects mode-based char budgets with [truncated] marker.
 * Returns "No results found" for empty card lists.
 */
export function buildEvidenceCards(
	cards: EvidenceCard[],
	details?: DetailsMeta,
): string {
	// Empty results
	if (cards.length === 0) {
		return "No results found";
	}

	const mode = (details?.mode || "compact") as Mode;
	const budget = BUDGETS[mode] ?? BUDGETS.compact;

	// Build header
	const headerLines: string[] = [];
	if (details) {
		headerLines.push(`Provider: ${details.provider}`);
		if (details.fallbackUsed) headerLines.push("Fallback: true");
		headerLines.push(`Mode: ${details.mode}`);
	}
	const header = headerLines.join("\n");

	// Build card sections within budget
	const cardBlocks: string[] = [];
	const headerLen = header.length + (header ? 2 : 0); // +2 for separator newline
	let remaining = budget - headerLen;
	let wasTruncated = false;

	for (const card of cards) {
		const block = formatCard(card);
		if (block.length <= remaining - 2) { // -2 for separator
			cardBlocks.push(block);
			remaining -= block.length + 2;
		} else if (remaining > 40) {
			// Partial card fits — slice to fit
			const sliced = block.slice(0, remaining - 14); // room for [truncated]\n
			cardBlocks.push(sliced + "\n[truncated]");
			wasTruncated = true;
			remaining = 0;
			break;
		} else {
			// No room left
			wasTruncated = true;
			break;
		}
	}

	// Assemble output
	const parts: string[] = [];
	if (header) parts.push(header, "");
	parts.push(cardBlocks.join("\n\n"));

	let output = parts.join("\n");

	// Final truncation safety net
	if (output.length > budget) {
		output = output.slice(0, budget - 12) + "\n[truncated]";
	}

	return output;
}
