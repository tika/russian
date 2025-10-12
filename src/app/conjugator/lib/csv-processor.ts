export async function processCSV(csvContent: string): Promise<string> {
	try {
		const response = await fetch("/conjugator/api/process-csv", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ csvContent }),
		});

		if (!response.ok) {
			throw new Error("Failed to process CSV");
		}

		const { csvContent: processedCSV } = await response.json();
		return processedCSV;
	} catch (error) {
		console.error("Error processing CSV:", error);
		throw error;
	}
}
