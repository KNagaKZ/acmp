import { PublicStandings } from "@/components/PublicStandings";

export default async function StandingsPage({ params }: { params: Promise<{ slug: string }> }) { return <PublicStandings slug={(await params).slug} />; }
