import { getAcmpProfile } from "@/lib/acmp";
import { ProfileDashboard, ProfileSearch } from "@/components/ProductAnalytics";

export const dynamic = "force-dynamic";

export default async function Home({searchParams}:{searchParams:Promise<{profile?:string}>}) {
  const {profile:id}=await searchParams; let profile=null; let error="";
  if(id && /^\d+$/.test(id) && id!=="0"){try{profile=await getAcmpProfile(id)}catch(e){error=e instanceof Error?e.message:"Could not analyze this profile."}}
  return <main className="product-shell">
    <header className="product-nav"><a className="product-brand" href="/"><span>A/</span><b>ACMP Visualizer</b></a><nav><a href="#analyze">Analyze</a><a href="/standings">Leaderboard</a><a href="https://acmp.ru/index.asp?main=tasks" target="_blank" rel="noreferrer">Problems</a><a href="#about">About</a></nav><div className="nav-actions"><a href="https://github.com/KNagaKZ/acmp" target="_blank" rel="noreferrer">GitHub ↗</a><a className="nav-login" href="/login">Coach login</a></div></header>
    {!profile?<>
      <section className="product-hero" id="analyze"><span className="hero-badge">Competitive Programming Analytics</span><h1>Understand your<br/><em>ACMP progress.</em></h1><p>Analyze solved problems, discover your strongest topics, identify development areas, and turn raw ACMP statistics into a practical training direction.</p><ProfileSearch/>{error&&<div className="hero-error"><b>Profile not found</b><span>{error} Check the ID and try again.</span></div>}</section>
      <section className="value-strip" id="about"><div><span>01</span><b>See your level</b><p>Readable metrics instead of a wall of raw statistics.</p></div><div><span>02</span><b>Find your strengths</b><p>Topic coverage shows where your experience is concentrated.</p></div><div><span>03</span><b>Choose what is next</b><p>Recommendations are derived from your real profile data.</p></div></section>
    </>:<section className="product-results"><div className="results-toolbar"><a href="/">← New analysis</a><ProfileSearch compact/></div><ProfileDashboard profile={profile}/></section>}
  </main>;
}
