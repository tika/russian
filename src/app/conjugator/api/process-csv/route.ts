import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import Papa from "papaparse";

// Function to remove accent marks (stress marks) from Russian text
function removeAccentMarks(text: string): string {
	return text.replace(/[́̀]/g, "");
}

// Semantic vocabulary organized by context
const VOCABULARY_BY_CONTEXT = {
	people: {
		nouns: ["друг", "мама", "человек"],
		adjectives: ["хороший", "старый", "молодой", "красивый", "русский"],
	},
	objects: {
		nouns: ["дом", "работа", "дело", "место", "окно", "слово", "время"],
		adjectives: ["большой", "новый", "маленький", "хороший", "белый", "чёрный"],
	},
};

export async function POST(request: Request) {
	try {
		const { csvContent } = await request.json();

		if (!csvContent) {
			return Response.json(
				{ error: "CSV content is required" },
				{ status: 400 },
			);
		}

		// Parse CSV
		const result = Papa.parse(csvContent, {
			header: false,
			skipEmptyLines: true,
		});

		const rows = result.data.map((row: string[]) => ({
			russian: row[0]?.replace(/"/g, "") || "",
			english: row[1]?.replace(/"/g, "") || "",
		}));

		if (rows.length === 0) {
			return Response.json({ error: "No data found in CSV" }, { status: 400 });
		}

		// For each row, if the English contains "to ", then it must be a verb
		const verbRows = rows.filter((row) => row.english.includes("to "));
		const nonVerbRows = rows.filter((row) => !row.english.includes("to "));

		// For each of these verbs, run an LLM call
		const conjugatedRows = await Promise.all(
			verbRows.map(async (row) => {
				const { text } = await generateText({
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
          - You should use a range of nouns (in all genders) and adjectives (make sure not to use the smae for each conjugation)
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
				});
			}),
		);

		// Parse the AI response to extract CSV content
		const lines = text
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

		// Join lines with newlines
		const finalCSV = lines.join("\n");

		return Response.json({ csvContent: finalCSV });
	} catch (error) {
		console.error("Error processing CSV:", error);
		return Response.json({ error: "Failed to process CSV" }, { status: 500 });
	}
}
