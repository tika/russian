import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import Papa from "papaparse";

// Function to remove accent marks (stress marks) from Russian text
function removeAccentMarks(text: string): string {
	return text.replace(/[́̀]/g, "");
}

// Rate limiter to enforce API rate limits
class RateLimiter {
	private timestamps: number[] = [];

	constructor(
		private maxRequests: number,
		private windowMs: number,
	) {}

	async waitForSlot(): Promise<void> {
		const now = Date.now();
		// Remove timestamps outside the window
		this.timestamps = this.timestamps.filter((ts) => now - ts < this.windowMs);

		if (this.timestamps.length >= this.maxRequests) {
			const oldestTimestamp = this.timestamps[0];
			const waitTime = this.windowMs - (now - oldestTimestamp);
			if (waitTime > 0) {
				await new Promise((resolve) => setTimeout(resolve, waitTime));
				return this.waitForSlot(); // Retry after waiting
			}
		}

		this.timestamps.push(Date.now());
	}
}

export async function POST(request: Request) {
	try {
		const { csvContent } = await request.json();

		if (!csvContent) {
			return Response.json(
				{ error: "CSV content is required" },
				{ status: 400 },
			);
		}

		// Create SSE stream
		const encoder = new TextEncoder();
		const stream = new ReadableStream({
			async start(controller) {
				const sendProgress = (message: string, progress: number) => {
					const data = JSON.stringify({ message, progress });
					controller.enqueue(encoder.encode(`data: ${data}\n\n`));
				};

				try {
					// Parse CSV
					sendProgress("Parsing CSV file...", 10);
					const result = Papa.parse(csvContent, {
						header: false,
						skipEmptyLines: true,
					});

					const rows = result.data.map((row: unknown) => {
						const rowArray = row as string[];
						return {
							russian: rowArray[0]?.replace(/"/g, "") || "",
							english: rowArray[1]?.replace(/"/g, "") || "",
						};
					});

					if (rows.length === 0) {
						throw new Error("No data found in CSV");
					}

					// For each row, if the English contains "to ", then it must be a verb
					const verbRows = rows.filter((row) => row.english.includes("to "));
					const nonVerbRows = rows.filter(
						(row) => !row.english.includes("to "),
					);

					sendProgress(`Found ${verbRows.length} verbs to conjugate...`, 20);

					// Initialize rate limiter (10 requests per minute)
					const rateLimiter = new RateLimiter(10, 60000);

					// Process verbs in parallel batches for speed
					const BATCH_SIZE = 8;
					const batches: (typeof verbRows)[] = [];

					for (let i = 0; i < verbRows.length; i += BATCH_SIZE) {
						batches.push(verbRows.slice(i, i + BATCH_SIZE));
					}

					let conjugatedResponses: string[] = [];

					for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
						const batch = batches[batchIndex];
						const progress = 20 + ((batchIndex + 1) / batches.length) * 70;

						sendProgress(
							`Processing batch ${batchIndex + 1} of ${batches.length}...`,
							progress,
						);

						// Process all verbs in the batch in parallel
						const batchPromises = batch.map(async (row) => {
							await rateLimiter.waitForSlot();
							return generateText({
								model: google("gemini-2.5-flash"),
								prompt: `
                  You are a Russian language expert. Process the following Russian infinitive form of a verb (and English translation) and generate a new list of the conjugations of the verb. Your goal is to conjugate the verb (perhaps including both perfective and imperfective forms if provided) and add an appropriate adjective and noun after the verb (in the correct form).

                  INFINITIVE FORM: ${row.russian} (translation: ${row.english})

                  INSTRUCTIONS: Generate "I", "you", "he", "we", "you (plural)", "they" conjugated forms with a natural, realistic adjective and noun after the verb. Make sure to note (pf) if perfective and (impf) if imperfective.

                  ---
                  **STRICT RULES:**

                  1.  **VOCABULARY:** You **MUST ONLY** use nouns and adjectives from the "APPROVED VOCABULARY LISTS" provided below. Do not use *any* word that is not on these lists.
                  2.  **CASE:** You must obey the case requirements from the infinitive (e.g., (кому), (что), (кого)).
                      * If (кому) or (кого) -> Use a noun from the **APPROVED PEOPLE** list.
                      * If (что) -> Use a noun from the **APPROVED OBJECTS & CONCEPTS** list.
                  3.  **AGREEMENT:** You must use proper grammatical case and gender agreement for the noun and its adjective.
                  4.  **VARIETY:** You **MUST** use a *different* adjective/noun combination for each of the 6 conjugation lines. Do not repeat the same phrase.
                  5.  **SENSE:** Do not generate nonsensical combinations.

                  ---
                  **APPROVED VOCABULARY LISTS:**

                  **APPROVED PEOPLE (for кому, кого, etc.):**
                  * Nouns: друг, мама, человек, брат, сестра, учитель, студент, врач
                  * Adjectives: хороший, старый, молодой, красивый, русский, новый, добрый, умный

                  **APPROVED OBJECTS & CONCEPTS (for что, etc.):**
                  * Nouns: дом, работа, дело, место, окно, слово, время, книга, письмо, машина, стол, стул, комната
                  * Adjectives: большой, новый, маленький, хороший, белый, чёрный, интересный, важный, последний, старый, красивый

                  ---
                  **EXAMPLES (Demonstrating the rules):**

                  * Input: "читать (что)"
                  * GOOD: "я читаю новую книгу" (Uses "новый" and "книга" from the approved lists for "что")
                  * BAD: "я читаю нового друга" (Uses a "PERSON" noun for "что")
                  * BAD: "я читаю интересную статью" (BAD because "статья" is *not* on the approved list)

                    * Input: "изменять (кому)"
                  * GOOD: "я изменяю старому другу" (Uses "старый" and "друг" from the approved lists for "кому")
                  * BAD: "я изменяю старому дому" (Uses an "OBJECT" noun for "кому")

                  ---
                  **OUTPUT FORMAT:**
                  **Return ONLY the final CSV conten-t.** Your response **MUST** start immediately with the first CSV line (e.g., "я...").
                  Do not include *any* introductory text, preamble, or markdown formatting.
                  Return ONLY the final CSV content.
                  "russian_text","english_translation"
                  "russian_text","english_translation"
                  ...
              `,
							});
						});

						const batchResults = await Promise.all(batchPromises);
						conjugatedResponses.push(
							...batchResults.map((result) => result.text),
						);
					}

					sendProgress("Processing AI responses...", 90);

					conjugatedResponses = conjugatedResponses.filter(
						(response) => !response.includes("russian_text"), // Ensure we only get the CSV content
					);

					// Parse all AI responses to extract CSV content
					const allLines: string[] = [];

					conjugatedResponses.forEach((responseText) => {
						const lines = responseText
							.split("\n")
							.filter((line) => line.trim() && line.includes('","'))
							.map((line) => {
								// Clean up the line and remove accent marks
								const cleanedLine = line.trim();
								const match = cleanedLine.match(/^"([^"]+)","([^"]+)"$/);
								if (match) {
									return `"${removeAccentMarks(match[1])}","${match[2]}"`;
								}
								return cleanedLine;
							})
							.filter((line) => line.includes('","'));

						allLines.push(...lines);
					});

					// Add non-verb rows (remove accent marks)
					const nonVerbLines = nonVerbRows.map(
						(row) => `"${removeAccentMarks(row.russian)}","${row.english}"`,
					);

					// Combine all lines
					const finalCSV = [...nonVerbLines, ...allLines].join("\n");

					sendProgress("Finalizing enhanced vocabulary...", 95);

					// Send final result
					const finalData = JSON.stringify({
						message: "Processing complete!",
						progress: 100,
						csvContent: finalCSV,
					});
					controller.enqueue(encoder.encode(`data: ${finalData}\n\n`));

					controller.close();
				} catch (error) {
					console.error("Error processing CSV:", error);
					const errorData = JSON.stringify({
						message: "Error processing CSV",
						progress: 0,
						error: error instanceof Error ? error.message : "Unknown error",
					});
					controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
					controller.close();
				}
			},
		});

		return new Response(stream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			},
		});
	} catch (error) {
		console.error("Error processing CSV:", error);
		return Response.json({ error: "Failed to process CSV" }, { status: 500 });
	}
}
