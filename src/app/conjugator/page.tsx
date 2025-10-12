"use client";

import {
	AlertCircle,
	CheckCircle,
	Download,
	FileText,
	Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { processCSV } from "@/app/conjugator/lib/csv-processor";

export default function Home() {
	const [file, setFile] = useState<File | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);
	const [progress, setProgress] = useState(0);
	const [processedCSV, setProcessedCSV] = useState<string>("");
	const [error, setError] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		const selectedFile = event.target.files?.[0];
		if (selectedFile && selectedFile.type === "text/csv") {
			setFile(selectedFile);
			setError(null);
			setProcessedCSV("");
		} else {
			setError("Please select a valid CSV file");
		}
	};

	const handleProcess = async () => {
		if (!file) return;

		setIsProcessing(true);
		setProgress(0);
		setError(null);

		try {
			const csvContent = await file.text();

			// Update progress to show we're starting
			setProgress(10);

			const processedCSVContent = await processCSV(csvContent);

			// Update progress to show we're done
			setProgress(100);
			setProcessedCSV(processedCSVContent);
		} catch (err) {
			setError("Failed to process CSV file");
			console.error("Processing error:", err);
		} finally {
			setIsProcessing(false);
		}
	};

	const handleDownload = () => {
		if (!processedCSV) return;

		const blob = new Blob([processedCSV], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "enhanced-russian-vocabulary.csv";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	const totalRows = processedCSV
		? processedCSV.split("\n").filter((line) => line.trim()).length
		: 0;

	return (
		<main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
			<div className="max-w-4xl mx-auto space-y-8">
				{/* Header */}
				<div className="text-center space-y-4">
					<h1 className="text-4xl font-bold text-gray-900 dark:text-white">
						Russian Verb Enhancer
					</h1>
					<p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
						Upload a CSV of Russian vocabulary and get enhanced conjugations
						with contextual examples
					</p>
				</div>

				{/* Upload Card */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<FileText className="h-5 w-5" />
							Upload CSV File
						</CardTitle>
						<CardDescription>
							Select a CSV file with Russian vocabulary in the format:
							"russian","english"
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="flex items-center gap-4">
							<input
								ref={fileInputRef}
								type="file"
								accept=".csv"
								onChange={handleFileUpload}
								className="hidden"
							/>
							<Button
								onClick={() => fileInputRef.current?.click()}
								variant="outline"
								className="flex items-center gap-2"
							>
								<Upload className="h-4 w-4" />
								Choose File
							</Button>
							{file && (
								<Badge variant="secondary" className="flex items-center gap-1">
									<CheckCircle className="h-3 w-3" />
									{file.name}
								</Badge>
							)}
						</div>

						{file && (
							<Button
								onClick={handleProcess}
								disabled={isProcessing}
								className="w-full"
							>
								{isProcessing ? "Processing..." : "Process File"}
							</Button>
						)}

						{isProcessing && (
							<div className="space-y-2">
								<Progress value={progress} className="w-full" />
								<p className="text-sm text-gray-600 dark:text-gray-400 text-center">
									Processing vocabulary in batches for faster results...
								</p>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Error Alert */}
				{error && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{/* Results */}
				{processedCSV && (
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<CheckCircle className="h-5 w-5 text-green-600" />
								Processing Complete
							</CardTitle>
							<CardDescription>
								Enhanced {totalRows} vocabulary entries
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex items-center gap-4">
								<Badge variant="outline">Total Entries: {totalRows}</Badge>
							</div>

							<Button
								onClick={handleDownload}
								className="w-full flex items-center gap-2"
							>
								<Download className="h-4 w-4" />
								Download Enhanced CSV
							</Button>
						</CardContent>
					</Card>
				)}

				{/* Example */}
				<Card>
					<CardHeader>
						<CardTitle>Example Input Format</CardTitle>
						<CardDescription>
							Your CSV should follow this format:
						</CardDescription>
					</CardHeader>
					<CardContent>
						<pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-sm overflow-x-auto">
							{`"громкий","loud"
"по-другому","differently"
"узнавать/узнать","to find out"
"целовать/поцеловать","to kiss"`}
						</pre>
					</CardContent>
				</Card>
			</div>
		</main>
	);
}
