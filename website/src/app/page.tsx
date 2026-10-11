import { Audience } from '@/components/Audience'
import { FinalCta, Footer } from '@/components/Closing'
import { Download } from '@/components/Download'
import { Faq } from '@/components/Faq'
import { FeatureTour } from '@/components/FeatureTour'
import { Hero } from '@/components/Hero'
import { Marquee } from '@/components/Marquee'
import { Nav } from '@/components/Nav'
import { Pricing } from '@/components/Pricing'
import { Reliability } from '@/components/Reliability'
import { ScriptureDemo } from '@/components/ScriptureDemo'
import { Steps } from '@/components/Steps'

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Marquee />
        <ScriptureDemo />
        <Audience />
        <FeatureTour />
        <Reliability />
        <Steps />
        <Pricing />
        <Download />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  )
}
