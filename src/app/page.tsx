import Link from "next/link";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export default function Home() {
	return (
		<main className="min-h-screen flex pt-40 justify-start">
			<div className="max-w-2xl mx-auto px-6 space-y-8">
				<h1 className="text-5xl sm:text-6xl font-bold tracking-tight">
					Tika's Russian 🇷🇺
				</h1>
				<p className="text-lg text-gray-400">
					A list of tools I've made to make my Russian learning journey easier.{" "}
					<br />
					Feel free to use them to help you!
				</p>
				<div className="space-y-4">
					<Link href="/conjugator">
						<Card className="hover:bg-gray-100 transition-colors duration-300">
							<CardHeader>
								<CardTitle>Conjugator (Make Better Flashcards)</CardTitle>
								<CardDescription>
									Upload a CSV file of Russian verbs and get the conjugations
									with appropriate adjectives and nouns.
								</CardDescription>
							</CardHeader>
						</Card>
					</Link>
				</div>
			</div>
		</main>
	);
}
