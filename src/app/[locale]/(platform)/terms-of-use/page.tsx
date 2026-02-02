import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: `Terms of Use for ${process.env.NEXT_PUBLIC_SITE_NAME?.trim() ?? 'this site'}`,
}

export default async function TermsOfUsePage({ params }: PageProps<'/[locale]/terms-of-use'>) {
  const { locale } = await params
  setRequestLocale(locale)

  const siteName = process.env.NEXT_PUBLIC_SITE_NAME?.trim() ?? 'this site'
  const siteNameUpper = siteName.toUpperCase()
  const siteUrl = (process.env.SITE_URL?.trim()?.replace(/\/$/, '') ?? '') || undefined

  return (
    <main className="container mx-auto max-w-4xl space-y-10 py-12 leading-relaxed text-foreground dark:text-foreground">
      <header className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">
          {siteName}
          {' '}
          Terms of Use
        </h1>
        <p className="text-muted-foreground">
          These Terms of Use ("Terms") govern your access to and use of the Interfaces and Features offered by
          {' '}
          {siteName}
          .
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">Introduction</h2>
        <p>
          These Terms of Use ("Terms") govern how you, whether personally or on behalf of an entity, may access, use, or
          otherwise interact with the interfaces, websites, applications, and related features made available through
          {' '}
          {siteUrl}
          .
          The Terms include any policies or documents that expressly incorporate these Terms by reference, as well as our
          Privacy Policy (collectively, the "Agreement"). By accessing or using any interface, website, or feature provided
          by
          {' '}
          {siteName}
          {' '}
          (collectively, the "Interfaces" and "Features"), you agree to be bound by this Agreement.
        </p>
        <p className="font-medium">
          NOTICE: PLEASE READ THESE TERMS CAREFULLY. BY ACCESSING OR USING ANY INTERFACE OR FEATURE (INCLUDING CONNECTING A
          SELF-HOSTED WALLET OR CREATING AN IDENTIFIER), YOU REPRESENT THAT YOU CAN ENTER INTO A BINDING AGREEMENT AND THAT
          YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY THESE TERMS, INCLUDING THE BINDING ARBITRATION AND CLASS
          ACTION WAIVER BELOW. IF YOU DO NOT AGREE, DO NOT ACCESS OR USE THE INTERFACES OR FEATURES.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">Scope and Description of the Interfaces and Features</h2>
        <ul className="ml-6 list-disc space-y-2">
          <li>
            Content Features (optional): Some Interfaces may provide informational content, data, or commentary on markets,
            events, or other topics ("Content Features"). Such information is provided for general informational purposes
            only and does not constitute financial, legal, tax, or other professional advice.
          </li>
          <li>
            Technology Features: Some Interfaces may allow you to connect a self-hosted cryptocurrency wallet ("Wallet") to
            broadcast transactions to supported blockchain networks to interact with event-based contracts or similar on-chain
            mechanisms ("Contracts") in a non-custodial manner (together with any related user interface components, the
            "Technology Features").
          </li>
        </ul>
        <p>
          You acknowledge that
          {' '}
          {siteName}
          {' '}
          does not operate a centralized exchange, does not provide trade execution or clearing
          services, does not take possession or custody of your assets, and does not act on your behalf. Pricing or market
          data displayed via the Interfaces is informational and not an offer, solicitation, recommendation, or advice.
        </p>
        <p>When you choose to connect a Wallet, you understand and agree that:</p>
        <ul className="ml-6 list-disc space-y-2">
          <li>You control your Wallet and are solely responsible for safeguarding private keys, seed phrases, passwords, and security settings.</li>
          <li>
            {siteName}
            {' '}
            cannot access your private keys, cannot reverse transactions, and cannot control, guarantee, or ensure the success or outcome of any transaction you initiate.
          </li>
          <li>Transactions may require non-refundable network fees, which are solely your responsibility.</li>
          <li>
            Blockchain networks and any contracts or protocols you interact with are operated by third parties;
            {' '}
            {siteName}
            {' '}
            does not own or control them and makes no promises about their availability, security, or performance.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">Eligibility; Sanctions; Restricted Jurisdictions</h2>
        <p>
          You represent and warrant that you are at least 18 years old (or the age of majority in your jurisdiction) and have
          the authority to enter into this Agreement. You further represent and warrant that you are not:
        </p>
        <ul className="ml-6 list-disc space-y-2">
          <li>The subject of economic or trade sanctions, and that you comply with applicable anti-money laundering and counter-terrorist financing laws.</li>
          <li>
            Accessing, using, or attempting to use the Technology Features (including trading Contracts) from any jurisdiction
            in which such activity is prohibited ("Restricted Jurisdictions"). Without limiting the foregoing, use of
            Technology Features for trading is not permitted by persons or entities who reside in, are located in, are
            incorporated in, have a registered office in, or have their principal place of business in the United States of
            America, the United Kingdom, France, Ontario (Canada), Singapore, Poland, Thailand, Australia, Belgium, Taiwan, any
            comprehensively sanctioned country or region (including, without limitation, Iran, Syria, Cuba, North Korea, and
            the Crimea, Donetsk, or Luhansk regions), or in any other jurisdiction where applicable law prohibits such use.
          </li>
        </ul>
        <p>You also represent and warrant that you will not use VPNs or similar tools to circumvent geoblocking or other access controls.</p>
        <p>If any of the above becomes untrue, you must immediately stop accessing the Technology Features.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">Your Acknowledgements; Risks</h2>
        <ul className="ml-6 list-disc space-y-2">
          <li>Information Only. Content Features are for informational purposes only; you should independently verify information before relying on it.</li>
          <li>No Advice or Fiduciary Duty. Nothing on the Interfaces or via the Features constitutes investment, legal, tax, accounting, or other professional advice, and no fiduciary duties are created by your use of the Interfaces or Features. Seek independent professional advice before making decisions.</li>
          <li>Experimental or Risky Technology. Interacting with blockchain technology involves significant risks, including smart-contract vulnerabilities, UI or UX bugs, hacks, phishing, social-engineering attacks, volatility, and irreversible transactions. You may lose some or all of the assets you use in connection with Contracts.</li>
          <li>
            Third-Party Infrastructure.
            {' '}
            {siteName}
            {' '}
            does not control blockchain networks, validators, oracles, bridges, indexers, RPC providers, or other third-party services. Outages, congestion, reorganizations, forks, or other issues may impact availability or functionality.
          </li>
          <li>
            Contract Resolution. Resolution of Contracts (if applicable) occurs solely per the market-specific rules and any third-party oracle or dispute mechanism referenced in the relevant market terms.
            {' '}
            {siteName}
            {' '}
            is not responsible for resolution outcomes or disputes between market participants.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">Modifications to the Terms and to the Interfaces or Features</h2>
        <p>
          We may update these Terms and modify, suspend, or discontinue any Interface or Feature (in whole or in part) at our
          discretion, with or without notice, including restricting access (for example, placing Features in a close-only mode).
          Your continued use after changes become effective constitutes your acceptance of the updated Terms. If you do not agree,
          you must stop using the Interfaces and Features.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">Your Responsibilities and Prohibited Conduct</h2>
        <p>You agree to use the Interfaces and Features lawfully and appropriately. Without limitation, you must not:</p>
        <ul className="ml-6 list-disc space-y-2">
          <li>Violate any applicable law, regulation, or order.</li>
          <li>Use the Technology Features from a Restricted Jurisdiction or for or on behalf of a restricted person.</li>
          <li>Use VPNs or similar tools to circumvent geoblocking or access controls.</li>
          <li>Provide false, inaccurate, or misleading information.</li>
          <li>Interfere with or disrupt the Interfaces or Features, introduce malware, or attempt unauthorized access.</li>
          <li>Scrape, harvest, or use automated tools (including bots or crawlers) to extract data except as expressly permitted.</li>
          <li>Reverse engineer or decompile software except to the limited extent required by applicable law.</li>
          <li>Sublicense, sell, or commercially exploit the Interfaces or Features except as expressly allowed.</li>
          <li>Engage in abusive or manipulative market behavior, including spoofing, layering, wash trading, pre-arranged trades, cornering, or other deceptive or disruptive practices.</li>
          <li>Infringe or misappropriate the intellectual property or other rights of any person.</li>
        </ul>
        <p>We may investigate suspected violations and take any action we deem appropriate, including suspending or terminating access and cooperating with law enforcement.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">Additional Information; Verification</h2>
        <p>
          We or compliance vendors acting on our behalf may request information to confirm your eligibility (for example, that
          you are not a restricted person). Failure to provide satisfactory information may result in denial or loss of access to
          some or all Features.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">Ownership; License; Your Feedback and Content</h2>
        <ul className="ml-6 list-disc space-y-2">
          <li>
            Ownership. Except for rights expressly granted to you,
            {' '}
            {siteName}
            {' '}
            and its licensors retain all right, title, and interest in and to the Interfaces and Features, including all associated intellectual property.
          </li>
          <li>
            Limited License to You. Subject to these Terms,
            {' '}
            {siteName}
            {' '}
            grants you a personal, revocable, non-exclusive, non-transferable, non-sublicensable license to access and use the Interfaces and Features as provided to you.
          </li>
          <li>
            Your Feedback and Content. If you submit feedback, suggestions, support requests, or content ("Feedback/Content"), you grant
            {' '}
            {siteName}
            {' '}
            a worldwide, royalty-free, transferable, sublicensable, irrevocable, perpetual license to use, host, reproduce, modify, adapt, publish, display, create derivative works from, and otherwise exploit such Feedback/Content for business purposes (including providing and improving the Interfaces and Features). You represent and warrant that you own or control the necessary rights to grant this license and that your Feedback/Content does not infringe others' rights.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">Third-Party Services and Links</h2>
        <p>
          The Interfaces and Features may integrate with or link to third-party sites, applications, services, protocols, or
          content ("Third-Party Services"). Your use of Third-Party Services is at your sole risk and is subject to their terms
          and privacy policies.
          {' '}
          {siteName}
          {' '}
          does not control, endorse, or assume responsibility for Third-Party Services and is not
          liable for any damages arising from your use of them.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">Indemnification</h2>
        <p>
          You agree to defend, indemnify, and hold harmless
          {' '}
          {siteName}
          , its licensors, and their respective officers, directors,
          employees, and representatives (collectively, the "Protected Parties") from and against any and all claims, demands,
          actions, investigations, damages, losses, liabilities, costs, and expenses (including reasonable attorneys' fees) arising
          out of or relating to: (i) your use or misuse of the Interfaces or Features; (ii) your violation of these Terms or
          applicable law; (iii) your disputes with any third party; (iv) your actual or alleged infringement or misappropriation
          of any third-party rights; or (v) your Feedback/Content. If we receive a subpoena or compulsory order related to the
          foregoing, you will reimburse reasonable time, materials, and legal expenses incurred in responding.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">Disclaimers</h2>
        <p>
          THE INTERFACES AND FEATURES ARE PROVIDED "AS IS" AND "AS AVAILABLE." TO THE MAXIMUM EXTENT PERMITTED BY LAW,
          {' '}
          {siteNameUpper}
          {' '}
          AND ITS LICENSORS DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, ACCURACY, QUIET ENJOYMENT, AND ANY WARRANTIES ARISING FROM COURSE OF DEALING OR USAGE OF TRADE. WE DO NOT WARRANT THAT THE INTERFACES OR FEATURES WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR VIRUS-FREE, OR THAT ANY CONTENT OR DATA WILL BE ACCURATE OR RELIABLE.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">Limitation of Liability</h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW: (A) IN NO EVENT WILL
          {' '}
          {siteNameUpper}
          {' '}
          OR ITS SERVICE PROVIDERS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, GOODWILL, DATA, OR OTHER INTANGIBLE LOSSES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES; AND (B)
          {' '}
          {siteNameUpper}
          'S AGGREGATE LIABILITY FOR ALL CLAIMS RELATING TO THE INTERFACES OR FEATURES WILL NOT EXCEED USD $100. THESE LIMITATIONS APPLY TO ALL CAUSES OF ACTION, WHETHER IN CONTRACT, TORT (INCLUDING NEGLIGENCE), STRICT LIABILITY, OR OTHERWISE.
        </p>
        <p>
          Some jurisdictions do not allow certain exclusions or limitations of liability; in such cases, the above will apply to the fullest extent permitted by applicable law.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">Governing Law; Dispute Resolution; Class Action Waiver</h2>
        <ul className="ml-6 list-disc space-y-2">
          <li>
            Governing Law. These Terms and any dispute or claim arising out of or relating to them or the Interfaces or Features will be governed by the laws of the jurisdiction where
            {' '}
            {siteName}
            {' '}
            is organized or primarily conducts business, without regard to conflict-of-laws rules.
          </li>
          <li>Informal Resolution. Before starting arbitration or litigation, the aggrieved party must send a written notice describing the claim and desired relief. The parties will attempt in good faith to resolve the dispute within 45 days of notice.</li>
          <li>
            Mandatory Arbitration. Any dispute, claim, or controversy that is not resolved informally shall be finally resolved by binding arbitration before a single arbitrator administered by a reputable arbitration institution in the governing-law jurisdiction, under its rules in effect when the claim is filed. Either party may seek provisional remedies in aid of arbitration from a court of competent jurisdiction. You and
            {' '}
            {siteName}
            {' '}
            waive any right to a jury trial.
          </li>
          <li>Class Action Waiver. All proceedings must be brought in the parties' individual capacities, not as a plaintiff or class member in any purported class, collective, consolidated, or representative action. The arbitrator may not consolidate claims or preside over any form of class or representative proceeding.</li>
        </ul>
        <p>If a court finds the class action waiver unenforceable, then the entirety of the arbitration agreement shall be null and void, and the dispute will proceed in court.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">Taxes</h2>
        <p>You are solely responsible for determining and fulfilling any tax obligations arising from your activities via the Interfaces or Features and for complying with applicable tax laws and reporting requirements.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">Termination</h2>
        <p>
          We may suspend or terminate your access to some or all Interfaces or Features at any time for any reason, including if
          we believe you have violated these Terms or applicable law. Upon termination, your right to use the Interfaces or
          Features ceases immediately. Sections intended to survive (including Ownership, Indemnification, Disclaimers, Limitation
          of Liability, Governing Law or Dispute Resolution, and General Terms) shall survive termination.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">General Terms</h2>
        <ul className="ml-6 list-disc space-y-2">
          <li>
            Entire Agreement. These Terms (including documents incorporated by reference) are the entire agreement between you and
            {' '}
            {siteName}
            {' '}
            regarding the subject matter and supersede all prior or contemporaneous understandings.
          </li>
          <li>
            No Agency. Nothing in these Terms creates any partnership, joint venture, employment, or agency relationship between you and
            {' '}
            {siteName}
            .
          </li>
          <li>Assignment. You may not assign or transfer these Terms or any rights hereunder without our prior written consent. We may assign or transfer these Terms without restriction.</li>
          <li>Severability; Waiver. If any provision is held invalid or unenforceable, the remaining provisions remain in full force and effect. Our failure to enforce any provision is not a waiver of our right to do so later.</li>
          <li>Remedies. Our rights and remedies are cumulative and in addition to any rights and remedies available at law or in equity.</li>
          <li>Contact. Questions, complaints, or claims regarding the Interfaces or Features should be directed via the contact method provided within the Interface.</li>
        </ul>
      </section>
    </main>
  )
}
