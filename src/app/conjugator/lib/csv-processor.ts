export async function processCSV(
	csvContent: string,
	onProgress?: (message: string, progress: number) => void,
): Promise<string> {
	try {
		const response = await fetch("/conjugator/api/process-csv", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ csvContent }),
		});

		if (!response.ok) {
			throw new Error("Failed to process CSV");
		}

		if (!response.body) {
			throw new Error("No response body");
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let finalCSV = "";

		try {
			while (true) {
				const { done, value } = await reader.read();

				if (done) break;

				const chunk = decoder.decode(value);
				const lines = chunk.split("\n");

				for (const line of lines) {
					if (line.startsWith("data: ")) {
						try {
							const data = JSON.parse(line.slice(6));

							if (onProgress) {
								onProgress(data.message, data.progress);
							}

							if (data.csvContent) {
								finalCSV = data.csvContent;
							}

							if (data.error) {
								throw new Error(data.error);
							}
						} catch (parseError) {
							console.warn("Failed to parse SSE data:", parseError);
						}
					}
				}
			}
		} finally {
			reader.releaseLock();
		}

		if (!finalCSV) {
			throw new Error("No CSV content received");
		}

		return finalCSV;
	} catch (error) {
		console.error("Error processing CSV:", error);
		throw error;
	}
}
