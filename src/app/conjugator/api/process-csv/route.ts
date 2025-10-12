import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import Papa from "papaparse";

// Function to remove accent marks (stress marks) from Russian text
function removeAccentMarks(text: string): string {
	return text.replace(/[́̀]/g, "");
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

					// Process verbs in parallel batches for speed
					const BATCH_SIZE = 8;
					const batches: (typeof verbRows)[] = [];

					for (let i = 0; i < verbRows.length; i += BATCH_SIZE) {
						batches.push(verbRows.slice(i, i + BATCH_SIZE));
					}

					const conjugatedResponses: string[] = [];

					for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
						const batch = batches[batchIndex];
						const progress = 20 + ((batchIndex + 1) / batches.length) * 70;

						sendProgress(
							`Processing batch ${batchIndex + 1} of ${batches.length}...`,
							progress,
						);

						// Process all verbs in the batch in parallel
						const batchPromises = batch.map((row) =>
							generateText({
								model: google("gemini-2.5-flash"),
								prompt: `You are a Russian language expert. Process the following Russian infinitive form of a verb (and English translation) and generate a new list of the conjugations of the verb. Your goal is to conjugate the verb (perhaps including both perfective and imperfective forms if provided) and add an appropriate adjective and noun after the verb (in the correct form).

          INFINITIVE FORM: ${row.russian} (translation: ${row.english})

          INSTRUCTIONS: Generate "I", "you", "he", "we", "you (plural)", "they" conjugated forms with a natural, realistic adjective and noun after the verb. Make sure to note (pf) if perfective and (impf) if imperfective.

          VERB CONJUGATION RULES:
          - Parse case requirements from input: (кому), (что), (кого), (с кем), etc.
          - Make sure you use nouns that are appropriate for the case requirements
            - E.g. If (кому) - use PERSON nouns: друг, мама, человек
            - E.g. If (что) - use OBJECT nouns: дом, работа, дело, место, окно
            - E.g. If both (кому/что) - alternate between people and objects
          - Generate NATURAL nouns and adjectives matching the verb that sound like native speakers would say
          - Use proper grammatical case agreement
          - Avoid nonsensical combinations
          - You should use a range of nouns (in all genders) and adjectives (make sure not to use the same for each conjugation)
          - You should use basic nouns and adjectives that are appropriate for the verb, do not use anything too complex or obscure

          EXAMPLES:
          GOOD: "я читаю новую книгу" (I read a new book)
          BAD: "я читаю нового друга" (I read a new friend)

          GOOD: "я изменяю старому другу" (I cheat on an old friend)
          BAD: "я изменяю старому дому" (I cheat on an old house)

          GOOD EXAMPLES OF NOUNS AND ADJECTIVES (not exhaustive):
          People: друг, мама, человек + хороший, старый, молодой, красивый, русский
          Objects: дом, работа, дело, место, окно, слово, время + большой, новый, маленький, хороший, белый, чёрный

          OUTPUT FORMAT:
          Return ONLY the final CSV content in this exact format:
          "russian_text","english_translation"
          "russian_text","english_translation"
          ...
          `,
							}),
						);

						const batchResults = await Promise.all(batchPromises);
						conjugatedResponses.push(
							...batchResults.map((result) => result.text),
						);
					}

					sendProgress("Processing AI responses...", 90);

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
