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

		// Create input for AI processing
		const vocabularyList = rows
			.map((row: any) => `"${row.russian}" (${row.english})`)
			.join(", ");

		const { text } = await generateText({
			model: google("gemini-2.5-flash"),
			prompt: `You are a Russian language expert. Process the following Russian vocabulary list and generate enhanced flashcards.

INPUT VOCABULARY: ${vocabularyList}

INSTRUCTIONS:
1. For each word, determine if it's a verb or not
2. For NON-VERBS: Keep as-is (just remove accent marks)
3. For VERBS: Generate 6-12 conjugated forms with natural, realistic sentences

VERB CONJUGATION RULES:
- Parse case requirements from input: (кому), (что), (кого), (с кем), etc.
- If (кому) - use PERSON nouns: друг, мама, человек
- If (что) - use OBJECT nouns: дом, работа, дело, место, окно
- If both (кому/что) - alternate between people and objects
- Generate NATURAL sentences that sound like native speakers would say
- Use proper grammatical case agreement
- Avoid nonsensical combinations

EXAMPLES:
GOOD: "я читаю новую книгу" (I read a new book)
BAD: "я читаю нового друга" (I read a new friend)

GOOD: "я изменяю старому другу" (I cheat on an old friend)
BAD: "я изменяю старому дому" (I cheat on an old house)

ALLOWED VOCABULARY:
People: друг, мама, человек + хороший, старый, молодой, красивый, русский
Objects: дом, работа, дело, место, окно, слово, время + большой, новый, маленький, хороший, белый, чёрный

OUTPUT FORMAT:
Return ONLY the final CSV content in this exact format:
"russian_text","english_translation"
"russian_text","english_translation"
...

Process ALL vocabulary and return the complete enhanced CSV.`,
		});

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
