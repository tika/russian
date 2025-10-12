"use client";

import { AlertCircle, CheckCircle, Download, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { processCSV } from "@/app/conjugator/lib/csv-processor";
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

export default function Home() {
	const [file, setFile] = useState<File | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);
	const [progress, setProgress] = useState(0);
	const [progressMessage, setProgressMessage] = useState<string>("");
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
		setProgressMessage("");
		setError(null);

		try {
			const csvContent = await file.text();

			const processedCSVContent = await processCSV(
				csvContent,
				(message, progressValue) => {
					setProgressMessage(message);
					setProgress(progressValue);
				},
			);

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
		<main className="min-h-screen bg-black text-white p-8">
			<div className="max-w-4xl mx-auto space-y-8">
				{/* Header */}
				<div className="text-center space-y-4">
					<h1 className="text-4xl font-bold tracking-tight">
						Russian Verb Enhancer
					</h1>
					<p className="text-gray-400">
						Upload a CSV of Russian vocabulary and get enhanced conjugations
					</p>
				</div>

				{/* Upload Card */}
				<Card className="bg-black border border-gray-800">
					<CardHeader>
						<CardTitle className="text-white">Upload CSV File</CardTitle>
						<CardDescription className="text-gray-400">
							Select a CSV file with Russian vocabulary in the format:{" "}
							<code className="bg-gray-900 px-2 py-1 rounded text-sm">
								"russian","english"
							</code>
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
								className="flex items-center gap-2 bg-gray-600 border-gray-800 hover:bg-gray-700 text-white hover:text-white"
							>
								<Upload className="h-4 w-4" />
								Choose File
							</Button>
							{file && (
								<Badge
									variant="secondary"
									className="flex items-center gap-1 bg-gray-900 text-white"
								>
									<CheckCircle className="h-3 w-3" />
									{file.name}
								</Badge>
							)}
						</div>

						{file && (
							<Button
								onClick={handleProcess}
								disabled={isProcessing}
								className="w-full bg-white text-black hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{isProcessing ? (
									<div className="flex items-center gap-2">
										<div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent"></div>
										Processing...
									</div>
								) : (
									"Enhance Vocabulary"
								)}
							</Button>
						)}

						{isProcessing && (
							<div className="space-y-3">
								<div className="space-y-2">
									<div className="flex justify-between text-sm text-gray-400">
										<span>{progressMessage || "Processing..."}</span>
										<span>{Math.round(progress)}%</span>
									</div>
									<Progress
										value={progress}
										className="w-full h-2 bg-gray-900"
									/>
								</div>
								<div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
									<div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
									<span>AI is enhancing your vocabulary...</span>
								</div>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Error Alert */}
				{error && (
					<Alert
						variant="destructive"
						className="bg-red-950 border-red-900 text-white"
					>
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{/* Results */}
				{processedCSV && (
					<Card className="bg-black border border-gray-800">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-white">
								<CheckCircle className="h-5 w-5" />
								Enhancement Complete
							</CardTitle>
							<CardDescription className="text-gray-400">
								Successfully enhanced {totalRows} vocabulary entries
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="flex items-center gap-4">
								<Badge
									variant="outline"
									className="px-4 py-2 text-sm font-medium border-gray-800 text-white"
								>
									Total Entries: {totalRows}
								</Badge>
							</div>

							<Button
								onClick={handleDownload}
								className="w-full bg-white text-black hover:bg-gray-200"
							>
								<div className="flex items-center gap-2">
									<Download className="h-4 w-4" />
									Download Enhanced CSV
								</div>
							</Button>
						</CardContent>
					</Card>
				)}

				{/* Example */}
				<Card className="bg-black border border-gray-800">
					<CardHeader>
						<CardTitle className="text-white">Example Input Format</CardTitle>
						<CardDescription className="text-gray-400">
							Your CSV should follow this format:
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
							<pre className="text-sm text-gray-300 overflow-x-auto font-mono leading-relaxed">
								{`"громкий","loud"
"по-другому","differently"
"узнавать/узнать","to find out"
"целовать/поцеловать","to kiss"`}
							</pre>
						</div>
					</CardContent>
				</Card>
			</div>
		</main>
	);
}
