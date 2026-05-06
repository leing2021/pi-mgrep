/**
 * pi-search — Research search helpers (v0.4.1)
 *
 * Provides LLM config, verification status, evidence pack, and
 * research claim verification for the research_search tool.
 *
 * Zero external dependencies. Pure ESM.
 *
 * Config env vars:
 *   PI_SEARCH_LLM_ENABLED=never|ask|always  (default: never)
 *   PI_SEARCH_LLM_PROVIDER=openai|anthropic|local-openai
 *   PI_SEARCH_LLM_MODEL=...
 *   PI_SEARCH_LLM_BASE_URL=...
 *   PI_SEARCH_LLM_API_KEY_ENV=<env var name containing key>
 *
 * Exports:
 *   - getLlmConfig(options)
 *   - getResearchSearchStatus(options)
 *   - buildEvidencePack(options)
 *   - verifyResearchClaim(claim, evidence, options)
 */

// ── LLM Configuration ────────────────────────────────────

/**
 * Returns LLM configuration derived from environment.
 * Never exposes the actual API key value.
 */
export function getLlmConfig(options = {}) {
	const enabled = process.env.PI_SEARCH_LLM_ENABLED || "never";
	const provider = process.env.PI_SEARCH_LLM_PROVIDER || null;
	const model = process.env.PI_SEARCH_LLM_MODEL || null;
	const baseUrl = process.env.PI_SEARCH_LLM_BASE_URL || null;
	const apiKeyEnv = process.env.PI_SEARCH_LLM_API_KEY_ENV || options.apiKeyEnv || null;

	// Determine if LLM is actually usable
	let llmUsed = false;
	if (enabled === "always" && provider && apiKeyEnv && process.env[apiKeyEnv]) {
		llmUsed = true;
	}
	// "ask" is treated as disabled in non-interactive tool context
	// "never" is always disabled

	return {
		enabled,
		provider: llmUsed ? provider : null,
		model: llmUsed ? model : null,
		baseUrl: llmUsed ? baseUrl : null,
		llmUsed,
		// apiKey is NEVER exposed
	};
}

// ── Verification Status ──────────────────────────────────

/**
 * Returns the research search verification status text and metadata.
 */
export function getResearchSearchStatus(options = {}) {
	const config = getLlmConfig();

	if (options.error) {
		return {
			text: `[VERIFICATION FAILED: ${options.error}]`,
			verificationStatus: "failed",
			reason: options.error,
		};
	}

	if (!config.llmUsed) {
		const reason = config.enabled === "never"
			? `PI_SEARCH_LLM_ENABLED=${config.enabled}`
			: "missing provider or API key";
		return {
			text: `[VERIFICATION DISABLED]\nReason: ${reason}`,
			verificationStatus: "disabled",
			reason,
		};
	}

	return {
		text: "[VERIFICATION ENABLED]",
		verificationStatus: "enabled",
		reason: null,
	};
}

// ── Evidence Pack ─────────────────────────────────────────

/**
 * Creates an evidence pack container for research search.
 * Sources are added during the evidence collection phase.
 */
export function buildEvidencePack(options = {}) {
	const maxSources = Math.min(5, Math.max(1, options.maxSources ?? 3));
	const maxChars = Math.min(12000, Math.max(1000, options.maxChars ?? 6000));

	return {
		sources: [],
		totalChars: 0,
		maxSources,
		maxChars,
	};
}

/**
 * Adds a fetched source to the evidence pack.
 * Returns the updated pack.
 */
export function addSourceToPack(pack, source) {
	if (pack.sources.length >= pack.maxSources) return pack;
	const snippet = (source.snippet || "").slice(0, Math.floor(pack.maxChars / pack.maxSources));
	const entry = {
		id: source.id ?? String(pack.sources.length + 1),
		url: source.url,
		finalUrl: source.finalUrl || source.url,
		snippet,
		charCount: snippet.length,
		riskFlags: source.riskFlags || [],
		statusCode: source.statusCode || null,
		contentType: source.contentType || null,
		fetched: source.fetched !== false,
	};
	pack.sources.push(entry);
	pack.totalChars = pack.sources.reduce((sum, s) => sum + s.charCount, 0);
	return pack;
}

/**
 * Collects evidence from a list of URLs using safeFetchText.
 * Fetches up to maxSources, clips each to budget, records failures.
 */
export async function collectEvidence(urls, options = {}) {
	const { safeFetchText } = await import("./security.ts");
	const pack = buildEvidencePack(options);
	const fetchResults = [];

	for (const url of urls.slice(0, pack.maxSources)) {
		if (pack.sources.length >= pack.maxSources) break;

		try {
			const result = await safeFetchText(url, {
				mode: "compact",
				maxChars: Math.floor(pack.maxChars / pack.maxSources),
				_dnsLookup: options._dnsLookup,
			});

			addSourceToPack(pack, {
				url,
				finalUrl: result.finalUrl,
				snippet: result.text,
				riskFlags: result.riskFlags || [],
				statusCode: result.statusCode,
				contentType: result.contentType,
				fetched: true,
			});

			fetchResults.push({ url, success: true });
		} catch (err) {
			addSourceToPack(pack, {
				url,
				snippet: `[Fetch failed: ${err.message}]`,
				riskFlags: [],
				fetched: false,
			});

			fetchResults.push({ url, success: false, error: err.message });
		}
	}

	return { pack, fetchResults };
}

// ── Verify Research Claim ────────────────────────────────

/**
 * Verifies a research claim using the provided provider function.
 * Returns structured result with verification status.
 *
 * @param {string} claim - The claim to verify
 * @param {Array} evidence - Evidence sources
 * @param {object} options - { provider: async fn, timeout: ms }
 */
export async function verifyResearchClaim(claim, evidence = [], options = {}) {
	const status = getResearchSearchStatus();

	// If verification is not enabled, return disabled status
	if (status.verificationStatus !== "enabled" && !options.provider) {
		return {
			...status,
			answer: null,
			citations: [],
			inputChars: 0,
			outputChars: 0,
		};
	}

	// Use mock provider for testing or real provider for production
	const provider = options.provider;
	if (!provider) {
		return {
			...status,
			answer: null,
			citations: [],
			inputChars: 0,
			outputChars: 0,
		};
	}

	const timeout = options.timeout ?? 30000;

	// Build input payload from evidence (clipped, sanitized)
	const inputPayload = evidence
		.map((e) => `[${e.id}] ${e.snippet || ""}`)
		.join("\n")
		.slice(0, 10000);
	const inputChars = inputPayload.length;

	try {
		const result = await Promise.race([
			provider(claim, inputPayload),
			new Promise((_, reject) =>
				setTimeout(() => reject(new Error("timeout")), timeout),
			),
		]);

		return {
			text: "[VERIFICATION ENABLED]",
			verificationStatus: "enabled",
			answer: result.answer || "",
			citations: result.citations || [],
			inputChars,
			outputChars: (result.answer || "").length,
		};
	} catch (err) {
		return {
			text: `[VERIFICATION FAILED: ${err.message}]`,
			verificationStatus: "failed",
			reason: err.message,
			answer: null,
			citations: [],
			inputChars,
			outputChars: 0,
		};
	}
}
