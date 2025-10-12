import Link from "next/link";

export default function Home() {
	return (
		<div>
			<h1>Tika's Russian</h1>
			<h2>Tools for learning the Russian language</h2>
			<div>
				<Link href="/conjugator">Conjugator</Link>
			</div>
		</div>
	);
}
