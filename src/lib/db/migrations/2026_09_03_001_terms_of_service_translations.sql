CREATE TABLE terms_of_service_translations
(
  locale     TEXT        PRIMARY KEY,
  content    TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 250000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (locale IN ('en', 'de', 'es', 'pt', 'fr', 'zh', 'ja', 'ar', 'ru', 'it', 'pl', 'ko'))
);

ALTER TABLE terms_of_service_translations
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_terms_of_service_translations"
  ON "terms_of_service_translations"
  AS PERMISSIVE
  FOR ALL
  TO "service_role"
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE TRIGGER set_terms_of_service_translations_updated_at
  BEFORE UPDATE
  ON terms_of_service_translations
  FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

INSERT INTO terms_of_service_translations (locale, content)
VALUES
  ('en', $tos_en$
# {{siteName}} Terms of Use

These Terms of Use ("Terms") govern your access to and use of the Interfaces and Features offered by {{siteName}}.

## Introduction

These Terms of Use ("Terms") govern how you, whether personally or on behalf of an entity, may access, use, or otherwise interact with the interfaces, websites, applications, and related features made available through {{siteUrl}}. The Terms include any policies or documents that expressly incorporate these Terms by reference, as well as our Privacy Policy (collectively, the "Agreement"). By accessing or using any interface, website, or feature provided by {{siteName}} (collectively, the "Interfaces" and "Features"), you agree to be bound by this Agreement.

**NOTICE: PLEASE READ THESE TERMS CAREFULLY. BY ACCESSING OR USING ANY INTERFACE OR FEATURE (INCLUDING CONNECTING A SELF-HOSTED WALLET OR CREATING AN IDENTIFIER), YOU REPRESENT THAT YOU CAN ENTER INTO A BINDING AGREEMENT AND THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY THESE TERMS, INCLUDING THE BINDING ARBITRATION AND CLASS ACTION WAIVER BELOW. IF YOU DO NOT AGREE, DO NOT ACCESS OR USE THE INTERFACES OR FEATURES.**

## Scope and Description of the Interfaces and Features

- **Content Features (optional):** Some Interfaces may provide informational content, data, or commentary on markets, events, or other topics ("Content Features"). Such information is provided for general informational purposes only and does not constitute financial, legal, tax, or other professional advice.
- **Technology Features:** Some Interfaces may allow you to connect a self-hosted cryptocurrency wallet ("Wallet") to broadcast transactions to supported blockchain networks to interact with event-based contracts or similar on-chain mechanisms ("Contracts") in a non-custodial manner (together with any related user interface components, the "Technology Features").

You acknowledge that {{siteName}} does not operate a centralized exchange, does not provide trade execution or clearing services, does not take possession or custody of your assets, and does not act on your behalf. Pricing or market data displayed via the Interfaces is informational and not an offer, solicitation, recommendation, or advice.

When you choose to connect a Wallet, you understand and agree that:

- You control your Wallet and are solely responsible for safeguarding private keys, seed phrases, passwords, and security settings.
- {{siteName}} cannot access your private keys, cannot reverse transactions, and cannot control, guarantee, or ensure the success or outcome of any transaction you initiate.
- Transactions may require non-refundable network fees, which are solely your responsibility.
- Blockchain networks and any contracts or protocols you interact with are operated by third parties; {{siteName}} does not own or control them and makes no promises about their availability, security, or performance.

## Eligibility; Sanctions; Restricted Jurisdictions

You represent and warrant that you are at least 18 years old (or the age of majority in your jurisdiction) and have the authority to enter into this Agreement. You further represent and warrant that you are not:

- The subject of economic or trade sanctions, and that you comply with applicable anti-money laundering and counter-terrorist financing laws.
- Accessing, using, or attempting to use the Technology Features (including trading Contracts) from any jurisdiction in which such activity is prohibited ("Restricted Jurisdictions"). Without limiting the foregoing, use of Technology Features for trading is not permitted by persons or entities who reside in, are located in, are incorporated in, have a registered office in, or have their principal place of business in any jurisdiction where applicable law prohibits such use.

You also represent and warrant that you will not use VPNs or similar tools to circumvent geoblocking or other access controls.

If any of the above becomes untrue, you must immediately stop accessing the Technology Features.

## Your Acknowledgements; Risks

- **Information Only.** Content Features are for informational purposes only; you should independently verify information before relying on it.
- **No Advice or Fiduciary Duty.** Nothing on the Interfaces or via the Features constitutes investment, legal, tax, accounting, or other professional advice, and no fiduciary duties are created by your use of the Interfaces or Features. Seek independent professional advice before making decisions.
- **Experimental or Risky Technology.** Interacting with blockchain technology involves significant risks, including smart-contract vulnerabilities, UI or UX bugs, hacks, phishing, social-engineering attacks, volatility, and irreversible transactions. You may lose some or all of the assets you use in connection with Contracts.
- **Third-Party Infrastructure.** {{siteName}} does not control blockchain networks, validators, oracles, bridges, indexers, RPC providers, or other third-party services. Outages, congestion, reorganizations, forks, or other issues may impact availability or functionality.
- **Contract Resolution.** Resolution of Contracts (if applicable) occurs solely per the market-specific rules and any third-party oracle or dispute mechanism referenced in the relevant market terms. {{siteName}} is not responsible for resolution outcomes or disputes between market participants.

## Modifications to the Terms and to the Interfaces or Features

We may update these Terms and modify, suspend, or discontinue any Interface or Feature (in whole or in part) at our discretion, with or without notice, including restricting access (for example, placing Features in a close-only mode). Your continued use after changes become effective constitutes your acceptance of the updated Terms. If you do not agree, you must stop using the Interfaces and Features.

## Your Responsibilities and Prohibited Conduct

You agree to use the Interfaces and Features lawfully and appropriately. Without limitation, you must not:

- Violate any applicable law, regulation, or order.
- Use the Technology Features from a Restricted Jurisdiction or for or on behalf of a restricted person.
- Use VPNs or similar tools to circumvent geoblocking or access controls.
- Provide false, inaccurate, or misleading information.
- Interfere with or disrupt the Interfaces or Features, introduce malware, or attempt unauthorized access.
- Scrape, harvest, or use automated tools (including bots or crawlers) to extract data except as expressly permitted.
- Reverse engineer or decompile software except to the limited extent required by applicable law.
- Sublicense, sell, or commercially exploit the Interfaces or Features except as expressly allowed.
- Engage in abusive or manipulative market behavior, including spoofing, layering, wash trading, pre-arranged trades, cornering, or other deceptive or disruptive practices.
- Infringe or misappropriate the intellectual property or other rights of any person.

We may investigate suspected violations and take any action we deem appropriate, including suspending or terminating access and cooperating with law enforcement.

## Additional Information; Verification

We or compliance vendors acting on our behalf may request information to confirm your eligibility (for example, that you are not a restricted person). Failure to provide satisfactory information may result in denial or loss of access to some or all Features.

## Ownership; License; Your Feedback and Content

- **Ownership.** Except for rights expressly granted to you, {{siteName}} and its licensors retain all right, title, and interest in and to the Interfaces and Features, including all associated intellectual property.
- **Limited License to You.** Subject to these Terms, {{siteName}} grants you a personal, revocable, non-exclusive, non-transferable, non-sublicensable license to access and use the Interfaces and Features as provided to you.
- **Your Feedback and Content.** If you submit feedback, suggestions, support requests, or content ("Feedback/Content"), you grant {{siteName}} a worldwide, royalty-free, transferable, sublicensable, irrevocable, perpetual license to use, host, reproduce, modify, adapt, publish, display, create derivative works from, and otherwise exploit such Feedback/Content for business purposes (including providing and improving the Interfaces and Features). You represent and warrant that you own or control the necessary rights to grant this license and that your Feedback/Content does not infringe others' rights.

## Third-Party Services and Links

The Interfaces and Features may integrate with or link to third-party sites, applications, services, protocols, or content ("Third-Party Services"). Your use of Third-Party Services is at your sole risk and is subject to their terms and privacy policies. {{siteName}} does not control, endorse, or assume responsibility for Third-Party Services and is not liable for any damages arising from your use of them.

## Indemnification

You agree to defend, indemnify, and hold harmless {{siteName}}, its licensors, and their respective officers, directors, employees, and representatives (collectively, the "Protected Parties") from and against any and all claims, demands, actions, investigations, damages, losses, liabilities, costs, and expenses (including reasonable attorneys' fees) arising out of or relating to: (i) your use or misuse of the Interfaces or Features; (ii) your violation of these Terms or applicable law; (iii) your disputes with any third party; (iv) your actual or alleged infringement or misappropriation of any third-party rights; or (v) your Feedback/Content. If we receive a subpoena or compulsory order related to the foregoing, you will reimburse reasonable time, materials, and legal expenses incurred in responding.

## Disclaimers

THE INTERFACES AND FEATURES ARE PROVIDED "AS IS" AND "AS AVAILABLE." TO THE MAXIMUM EXTENT PERMITTED BY LAW, {{siteNameUpper}} AND ITS LICENSORS DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, ACCURACY, QUIET ENJOYMENT, AND ANY WARRANTIES ARISING FROM COURSE OF DEALING OR USAGE OF TRADE. WE DO NOT WARRANT THAT THE INTERFACES OR FEATURES WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR VIRUS-FREE, OR THAT ANY CONTENT OR DATA WILL BE ACCURATE OR RELIABLE.

## Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW: (A) IN NO EVENT WILL {{siteNameUpper}} OR ITS SERVICE PROVIDERS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, GOODWILL, DATA, OR OTHER INTANGIBLE LOSSES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES; AND (B) {{siteNameUpper}}'S AGGREGATE LIABILITY FOR ALL CLAIMS RELATING TO THE INTERFACES OR FEATURES WILL NOT EXCEED USD $100. THESE LIMITATIONS APPLY TO ALL CAUSES OF ACTION, WHETHER IN CONTRACT, TORT (INCLUDING NEGLIGENCE), STRICT LIABILITY, OR OTHERWISE.

Some jurisdictions do not allow certain exclusions or limitations of liability; in such cases, the above will apply to the fullest extent permitted by applicable law.

## Governing Law; Dispute Resolution; Class Action Waiver

- **Governing Law.** These Terms and any dispute or claim arising out of or relating to them or the Interfaces or Features will be governed by the laws of the jurisdiction where {{siteName}} is organized or primarily conducts business, without regard to conflict-of-laws rules.
- **Informal Resolution.** Before starting arbitration or litigation, the aggrieved party must send a written notice describing the claim and desired relief. The parties will attempt in good faith to resolve the dispute within 45 days of notice.
- **Mandatory Arbitration.** Any dispute, claim, or controversy that is not resolved informally shall be finally resolved by binding arbitration before a single arbitrator administered by a reputable arbitration institution in the governing-law jurisdiction, under its rules in effect when the claim is filed. Either party may seek provisional remedies in aid of arbitration from a court of competent jurisdiction. You and {{siteName}} waive any right to a jury trial.
- **Class Action Waiver.** All proceedings must be brought in the parties' individual capacities, not as a plaintiff or class member in any purported class, collective, consolidated, or representative action. The arbitrator may not consolidate claims or preside over any form of class or representative proceeding.

If a court finds the class action waiver unenforceable, then the entirety of the arbitration agreement shall be null and void, and the dispute will proceed in court.

## Taxes

You are solely responsible for determining and fulfilling any tax obligations arising from your activities via the Interfaces or Features and for complying with applicable tax laws and reporting requirements.

## Termination

We may suspend or terminate your access to some or all Interfaces or Features at any time for any reason, including if we believe you have violated these Terms or applicable law. Upon termination, your right to use the Interfaces or Features ceases immediately. Sections intended to survive (including Ownership, Indemnification, Disclaimers, Limitation of Liability, Governing Law or Dispute Resolution, and General Terms) shall survive termination.

## General Terms

- **Entire Agreement.** These Terms (including documents incorporated by reference) are the entire agreement between you and {{siteName}} regarding the subject matter and supersede all prior or contemporaneous understandings.
- **No Agency.** Nothing in these Terms creates any partnership, joint venture, employment, or agency relationship between you and {{siteName}}.
- **Assignment.** You may not assign or transfer these Terms or any rights hereunder without our prior written consent. We may assign or transfer these Terms without restriction.
- **Severability; Waiver.** If any provision is held invalid or unenforceable, the remaining provisions remain in full force and effect. Our failure to enforce any provision is not a waiver of our right to do so later.
- **Remedies.** Our rights and remedies are cumulative and in addition to any rights and remedies available at law or in equity.
- **Contact.** Questions, complaints, or claims regarding the Interfaces or Features should be directed via the contact method provided within the Interface.
$tos_en$),
  ('de', $tos_de$
# {{siteName}} Nutzungsbedingungen

Diese Nutzungsbedingungen ("Bedingungen") regeln Ihren Zugang zu den von {{siteName}} angebotenen Schnittstellen und Funktionen sowie deren Nutzung.

## Einleitung

Diese Nutzungsbedingungen ("Bedingungen") regeln, wie Sie persönlich oder im Namen eines Unternehmens auf die über {{siteUrl}} bereitgestellten Schnittstellen, Websites, Anwendungen und zugehörigen Funktionen zugreifen, sie nutzen oder anderweitig mit ihnen interagieren dürfen. Die Bedingungen umfassen alle Richtlinien oder Dokumente, die ausdrücklich durch Verweis Bestandteil dieser Bedingungen werden, sowie unsere Datenschutzrichtlinie (zusammen die "Vereinbarung"). Durch den Zugriff auf oder die Nutzung einer von {{siteName}} bereitgestellten Schnittstelle, Website oder Funktion (zusammen die "Schnittstellen" und "Funktionen") erklären Sie sich mit dieser Vereinbarung einverstanden.

**HINWEIS: LESEN SIE DIESE BEDINGUNGEN SORGFÄLTIG. DURCH DEN ZUGRIFF AUF ODER DIE NUTZUNG EINER SCHNITTSTELLE ODER FUNKTION (EINSCHLIESSLICH DER VERBINDUNG EINER NICHT VERWAHRTEN WALLET ODER DER ERSTELLUNG EINER IDENTITÄT) VERSICHERN SIE, DASS SIE EINEN VERBINDLICHEN VERTRAG SCHLIESSEN KÖNNEN UND DIESE BEDINGUNGEN, EINSCHLIESSLICH DER NACHSTEHENDEN VERBINDLICHEN SCHIEDSGERICHTSBARKEIT UND DES VERZICHTS AUF SAMMELKLAGEN, GELESEN, VERSTANDEN UND AKZEPTIERT HABEN. WENN SIE NICHT EINVERSTANDEN SIND, GREIFEN SIE NICHT AUF DIE SCHNITTSTELLEN ODER FUNKTIONEN ZU UND NUTZEN SIE DIESE NICHT.**

## Geltungsbereich und Beschreibung der Schnittstellen und Funktionen

- **Inhaltsfunktionen (optional):** Einige Schnittstellen können informative Inhalte, Daten oder Kommentare zu Märkten, Ereignissen oder anderen Themen bereitstellen ("Inhaltsfunktionen"). Diese Informationen dienen ausschließlich allgemeinen Informationszwecken und stellen keine Finanz-, Rechts-, Steuer- oder sonstige professionelle Beratung dar.
- **Technologiefunktionen:** Einige Schnittstellen können Ihnen ermöglichen, eine selbst verwaltete Kryptowährungs-Wallet ("Wallet") zu verbinden, um Transaktionen an unterstützte Blockchain-Netzwerke zu senden und ereignisbasierte Verträge oder ähnliche On-Chain-Mechanismen ("Verträge") nicht verwahrt zu nutzen (zusammen mit den zugehörigen Benutzeroberflächenkomponenten die "Technologiefunktionen").

Sie erkennen an, dass {{siteName}} keine zentralisierte Börse betreibt, keine Handelsausführung oder Clearing-Dienste anbietet, Ihre Vermögenswerte weder in Besitz noch in Verwahrung nimmt und nicht in Ihrem Namen handelt. Über die Schnittstellen angezeigte Preis- oder Marktdaten dienen nur zu Informationszwecken und sind kein Angebot, keine Aufforderung, Empfehlung oder Beratung.

Wenn Sie eine Wallet verbinden, verstehen Sie und stimmen Sie zu, dass:

- Sie Ihre Wallet kontrollieren und allein für den Schutz privater Schlüssel, Seed-Phrasen, Passwörter und Sicherheitseinstellungen verantwortlich sind.
- {{siteName}} nicht auf Ihre privaten Schlüssel zugreifen, Transaktionen nicht rückgängig machen und den Erfolg oder Ausgang einer von Ihnen initiierten Transaktion weder kontrollieren noch garantieren kann.
- Für Transaktionen nicht erstattungsfähige Netzwerkgebühren anfallen können, für die allein Sie verantwortlich sind.
- Blockchain-Netzwerke sowie Verträge oder Protokolle, mit denen Sie interagieren, von Dritten betrieben werden; {{siteName}} besitzt oder kontrolliert sie nicht und macht keine Zusagen zu ihrer Verfügbarkeit, Sicherheit oder Leistung.

## Berechtigung; Sanktionen; Beschränkte Rechtsordnungen

Sie versichern und gewährleisten, dass Sie mindestens 18 Jahre alt (oder in Ihrer Rechtsordnung volljährig) sind und die Befugnis haben, diese Vereinbarung zu schließen. Sie versichern und gewährleisten außerdem, dass Sie nicht:

- Gegenstand wirtschaftlicher oder handelspolitischer Sanktionen sind und die geltenden Gesetze zur Bekämpfung von Geldwäsche und Terrorismusfinanzierung einhalten.
- Auf die Technologiefunktionen (einschließlich des Handels mit Verträgen) aus einer Rechtsordnung zugreifen, sie nutzen oder zu nutzen versuchen, in der diese Tätigkeit verboten ist ("Beschränkte Rechtsordnungen"). Unbeschadet des Vorstehenden dürfen Personen oder Unternehmen, die in einer Rechtsordnung wohnen, sich befinden, gegründet sind, einen eingetragenen Sitz oder ihren Hauptgeschäftssitz haben, in der das geltende Recht eine solche Nutzung verbietet, die Technologiefunktionen nicht zum Handeln nutzen.

Sie versichern und gewährleisten außerdem, dass Sie keine VPNs oder ähnlichen Tools verwenden, um Geoblocking oder andere Zugriffskontrollen zu umgehen.

Wenn eine der vorstehenden Aussagen unwahr wird, müssen Sie den Zugriff auf die Technologiefunktionen unverzüglich einstellen.

## Ihre Bestätigungen; Risiken

- **Nur Informationen.** Inhaltsfunktionen dienen ausschließlich Informationszwecken; Sie sollten Informationen selbstständig überprüfen, bevor Sie sich darauf verlassen.
- **Keine Beratung oder Treuepflicht.** Nichts auf den Schnittstellen oder über die Funktionen stellt eine Anlage-, Rechts-, Steuer-, Buchhaltungs- oder sonstige professionelle Beratung dar, und durch Ihre Nutzung entstehen keine Treuepflichten. Holen Sie vor Entscheidungen unabhängigen professionellen Rat ein.
- **Experimentelle oder riskante Technologie.** Die Interaktion mit Blockchain-Technologie birgt erhebliche Risiken, darunter Schwachstellen intelligenter Verträge, Fehler der Benutzeroberfläche oder Benutzererfahrung, Hacks, Phishing, Social-Engineering-Angriffe, Volatilität und irreversible Transaktionen. Sie können einige oder alle im Zusammenhang mit Verträgen eingesetzten Vermögenswerte verlieren.
- **Infrastruktur Dritter.** {{siteName}} kontrolliert keine Blockchain-Netzwerke, Validatoren, Orakel, Bridges, Indexer, RPC-Anbieter oder sonstigen Dienste Dritter. Ausfälle, Überlastung, Reorganisationen, Forks oder andere Probleme können Verfügbarkeit oder Funktionalität beeinträchtigen.
- **Vertragsauflösung.** Die Auflösung von Verträgen (falls zutreffend) erfolgt ausschließlich nach den marktspezifischen Regeln und einem im jeweiligen Marktbegriff genannten Orakel oder Streitbeilegungsmechanismus eines Dritten. {{siteName}} ist nicht für Auflösungsergebnisse oder Streitigkeiten zwischen Marktteilnehmern verantwortlich.

## Änderungen der Bedingungen sowie der Schnittstellen oder Funktionen

Wir können diese Bedingungen aktualisieren und jede Schnittstelle oder Funktion nach eigenem Ermessen ganz oder teilweise ändern, aussetzen oder einstellen, mit oder ohne vorherige Ankündigung, einschließlich der Einschränkung des Zugangs (beispielsweise durch einen Nur-Schließen-Modus). Ihre fortgesetzte Nutzung nach Inkrafttreten von Änderungen gilt als Annahme der aktualisierten Bedingungen. Wenn Sie nicht einverstanden sind, müssen Sie die Nutzung der Schnittstellen und Funktionen einstellen.

## Ihre Pflichten und untersagtes Verhalten

Sie verpflichten sich, die Schnittstellen und Funktionen rechtmäßig und angemessen zu nutzen. Insbesondere dürfen Sie nicht:

- geltende Gesetze, Vorschriften oder Anordnungen verletzen;
- die Technologiefunktionen aus einer beschränkten Rechtsordnung oder für eine beschränkte Person nutzen;
- VPNs oder ähnliche Tools verwenden, um Geoblocking oder Zugriffskontrollen zu umgehen;
- falsche, ungenaue oder irreführende Angaben machen;
- Schnittstellen oder Funktionen stören oder beeinträchtigen, Schadsoftware einführen oder unbefugten Zugriff versuchen;
- Daten durch Scraping, Harvesting oder automatisierte Tools (einschließlich Bots oder Crawler) extrahieren, außer soweit ausdrücklich gestattet;
- Software zurückentwickeln oder dekompilieren, außer in dem nach geltendem Recht zwingend erforderlichen begrenzten Umfang;
- Schnittstellen oder Funktionen unterlizenzieren, verkaufen oder kommerziell verwerten, außer soweit ausdrücklich erlaubt;
- missbräuchliches oder manipulierendes Marktverhalten ausüben, einschließlich Spoofing, Layering, Wash-Trading, abgesprochener Geschäfte, Marktverengung oder anderer täuschender oder störender Praktiken;
- geistiges Eigentum oder sonstige Rechte einer Person verletzen oder unrechtmäßig verwenden.

Wir können vermutete Verstöße untersuchen und alle Maßnahmen ergreifen, die wir für angemessen halten, einschließlich der Aussetzung oder Beendigung des Zugangs und der Zusammenarbeit mit Strafverfolgungsbehörden.

## Weitere Informationen; Überprüfung

Wir oder in unserem Auftrag tätige Compliance-Anbieter können Informationen anfordern, um Ihre Berechtigung zu bestätigen (beispielsweise, dass Sie keine beschränkte Person sind). Werden zufriedenstellende Informationen nicht bereitgestellt, kann dies zur Verweigerung oder zum Verlust des Zugangs zu einigen oder allen Funktionen führen.

## Eigentum; Lizenz; Ihr Feedback und Ihre Inhalte

- **Eigentum.** Mit Ausnahme der Ihnen ausdrücklich eingeräumten Rechte behalten {{siteName}} und seine Lizenzgeber alle Rechte, Eigentumsrechte und Ansprüche an den Schnittstellen und Funktionen einschließlich des damit verbundenen geistigen Eigentums.
- **Beschränkte Lizenz für Sie.** Vorbehaltlich dieser Bedingungen gewährt {{siteName}} Ihnen eine persönliche, widerrufliche, nicht exklusive, nicht übertragbare und nicht unterlizenzierbare Lizenz für den Zugriff auf und die Nutzung der Ihnen bereitgestellten Schnittstellen und Funktionen.
- **Ihr Feedback und Ihre Inhalte.** Wenn Sie Feedback, Vorschläge, Supportanfragen oder Inhalte ("Feedback/Inhalte") übermitteln, gewähren Sie {{siteName}} eine weltweite, gebührenfreie, übertragbare, unterlizenzierbare, unwiderrufliche und unbefristete Lizenz, dieses Feedback bzw. diese Inhalte für Geschäftszwecke zu nutzen, zu hosten, zu vervielfältigen, zu ändern, anzupassen, zu veröffentlichen, anzuzeigen, daraus abgeleitete Werke zu erstellen und anderweitig zu verwerten (einschließlich der Bereitstellung und Verbesserung der Schnittstellen und Funktionen). Sie versichern und gewährleisten, dass Sie die erforderlichen Rechte zur Erteilung dieser Lizenz besitzen oder kontrollieren und dass Ihr Feedback/Ihre Inhalte keine Rechte Dritter verletzen.

## Dienste und Links Dritter

Die Schnittstellen und Funktionen können Websites, Anwendungen, Dienste, Protokolle oder Inhalte Dritter integrieren oder auf diese verlinken ("Dienste Dritter"). Die Nutzung von Diensten Dritter erfolgt auf Ihr eigenes Risiko und unterliegt deren Bedingungen und Datenschutzrichtlinien. {{siteName}} kontrolliert Dienste Dritter nicht, befürwortet sie nicht und übernimmt keine Verantwortung für sie; ebenso haftet {{siteName}} nicht für Schäden aus Ihrer Nutzung.

## Freistellung

Sie verpflichten sich, {{siteName}}, seine Lizenzgeber sowie deren jeweilige leitende Angestellte, Geschäftsführer, Mitarbeiter und Vertreter (zusammen die "Geschützten Parteien") gegen sämtliche Ansprüche, Forderungen, Klagen, Untersuchungen, Schäden, Verluste, Verbindlichkeiten, Kosten und Aufwendungen (einschließlich angemessener Anwaltskosten) zu verteidigen, freizustellen und schadlos zu halten, die aus oder im Zusammenhang mit (i) Ihrer Nutzung oder Ihrem Missbrauch der Schnittstellen oder Funktionen, (ii) Ihrem Verstoß gegen diese Bedingungen oder geltendes Recht, (iii) Ihren Streitigkeiten mit Dritten, (iv) Ihrer tatsächlichen oder behaupteten Verletzung oder unrechtmäßigen Verwendung von Rechten Dritter oder (v) Ihrem Feedback/Ihren Inhalten entstehen. Wenn wir eine Vorladung oder verbindliche Anordnung hierzu erhalten, erstatten Sie uns die angemessenen Zeit-, Sach- und Rechtskosten der Beantwortung.

## Haftungsausschlüsse

DIE SCHNITTSTELLEN UND FUNKTIONEN WERDEN "WIE BESEHEN" UND "WIE VERFÜGBAR" BEREITGESTELLT. IM MAXIMAL GESETZLICH ZULÄSSIGEN UMFANG SCHLIESSEN {{siteNameUpper}} UND SEINE LIZENZGEBER ALLE AUSDRÜCKLICHEN ODER STILLSCHWEIGENDEN GARANTIEN AUS, EINSCHLIESSLICH MARKTGÄNGIGKEIT, EIGNUNG FÜR EINEN BESTIMMTEN ZWECK, NICHTVERLETZUNG, RICHTIGKEIT, UNGESTÖRTE NUTZUNG UND ALLER GARANTIEN AUS GESCHÄFTSBEZIEHUNGEN ODER HANDELSBRAUCH. WIR GARANTIEREN NICHT, DASS DIE SCHNITTSTELLEN ODER FUNKTIONEN UNUNTERBROCHEN, FEHLERFREI, SICHER ODER VIRUSFREI SIND ODER DASS INHALTE ODER DATEN RICHTIG ODER ZUVERLÄSSIG SIND.

## Haftungsbeschränkung

IM MAXIMAL GESETZLICH ZULÄSSIGEN UMFANG GILT: (A) {{siteNameUpper}} ODER SEINE DIENSTLEISTER HAFTEN IN KEINEM FALL FÜR INDIREKTE, ZUFÄLLIGE, BESONDERE, FOLGE-, EXEMPLARISCHE ODER STRAFSCHÄDEN ODER FÜR DEN VERLUST VON GEWINNEN, EINNAHMEN, GOODWILL, DATEN ODER ANDEREN IMMATERIELLEN VERLUSTEN, SELBST WENN AUF DIE MÖGLICHKEIT SOLCHER SCHÄDEN HINGEWIESEN WURDE; UND (B) DIE GESAMTHAFTUNG VON {{siteNameUpper}} FÜR ALLE ANSPRÜCHE IM ZUSAMMENHANG MIT DEN SCHNITTSTELLEN ODER FUNKTIONEN ÜBERSTEIGT NICHT 100 USD. DIESE BESCHRÄNKUNGEN GELTEN FÜR ALLE ANSPRUCHSGRUNDLAGEN, OB VERTRAG, unerlaubte Handlung (EINSCHLIESSLICH FAHRLÄSSIGKEIT), GEFÄHRDUNGSHAFTUNG ODER ANDERWEITIG.

Einige Rechtsordnungen erlauben bestimmte Ausschlüsse oder Haftungsbeschränkungen nicht; in diesem Fall gilt das Vorstehende im gesetzlich zulässigen größtmöglichen Umfang.

## Anwendbares Recht; Streitbeilegung; Verzicht auf Sammelklagen

- **Anwendbares Recht.** Diese Bedingungen sowie alle daraus oder aus den Schnittstellen oder Funktionen entstehenden Streitigkeiten oder Ansprüche unterliegen dem Recht der Rechtsordnung, in der {{siteName}} organisiert ist oder hauptsächlich Geschäfte betreibt, ohne Berücksichtigung kollisionsrechtlicher Vorschriften.
- **Informelle Beilegung.** Vor Beginn eines Schieds- oder Gerichtsverfahrens muss die beschwerte Partei eine schriftliche Mitteilung mit Beschreibung des Anspruchs und der gewünschten Abhilfe senden. Die Parteien bemühen sich nach Treu und Glauben, die Streitigkeit innerhalb von 45 Tagen nach der Mitteilung beizulegen.
- **Verbindliche Schiedsgerichtsbarkeit.** Jede nicht informell beigelegte Streitigkeit, jeder Anspruch oder jede Kontroverse wird endgültig durch ein verbindliches Schiedsverfahren vor einem einzigen Schiedsrichter gelöst, das von einer anerkannten Schiedsinstitution in der für das anwendbare Recht maßgeblichen Rechtsordnung nach deren bei Einreichung geltenden Regeln durchgeführt wird. Jede Partei kann bei einem zuständigen Gericht vorläufige Maßnahmen zur Unterstützung des Schiedsverfahrens beantragen. Sie und {{siteName}} verzichten auf das Recht auf ein Geschworenenverfahren.
- **Verzicht auf Sammelklagen.** Alle Verfahren müssen in der individuellen Eigenschaft der Parteien geführt werden, nicht als Kläger oder Mitglied einer angeblichen Sammel-, Gruppen-, verbundenen oder Vertreterklage. Der Schiedsrichter darf Ansprüche nicht verbinden und kein Sammel- oder Vertreterverfahren leiten.

Stellt ein Gericht fest, dass der Verzicht auf Sammelklagen nicht durchsetzbar ist, ist die Schiedsvereinbarung insgesamt nichtig und die Streitigkeit wird vor Gericht geführt.

## Steuern

Sie sind allein dafür verantwortlich, alle Steuerpflichten zu ermitteln und zu erfüllen, die sich aus Ihren Aktivitäten über die Schnittstellen oder Funktionen ergeben, sowie die geltenden Steuergesetze und Meldepflichten einzuhalten.

## Beendigung

Wir können Ihren Zugang zu einigen oder allen Schnittstellen oder Funktionen jederzeit aus beliebigem Grund aussetzen oder beenden, auch wenn wir annehmen, dass Sie gegen diese Bedingungen oder geltendes Recht verstoßen haben. Mit der Beendigung erlischt Ihr Recht zur Nutzung der Schnittstellen oder Funktionen sofort. Bestimmungen, die ihrer Natur nach fortbestehen sollen (einschließlich Eigentum, Freistellung, Haftungsausschlüsse, Haftungsbeschränkung, anwendbares Recht oder Streitbeilegung sowie Allgemeine Bedingungen), bleiben nach der Beendigung bestehen.

## Allgemeine Bedingungen

- **Gesamte Vereinbarung.** Diese Bedingungen (einschließlich durch Verweis einbezogener Dokumente) bilden die gesamte Vereinbarung zwischen Ihnen und {{siteName}} zum Gegenstand und ersetzen alle früheren oder gleichzeitig getroffenen Vereinbarungen.
- **Keine Vertretung.** Nichts in diesen Bedingungen begründet eine Partnerschaft, ein Joint Venture, ein Arbeits- oder Agenturverhältnis zwischen Ihnen und {{siteName}}.
- **Abtretung.** Sie dürfen diese Bedingungen oder Rechte daraus ohne unsere vorherige schriftliche Zustimmung nicht abtreten oder übertragen. Wir dürfen diese Bedingungen uneingeschränkt abtreten oder übertragen.
- **Salvatorische Klausel; Verzicht.** Wird eine Bestimmung für unwirksam oder nicht durchsetzbar erklärt, bleiben die übrigen Bestimmungen vollständig wirksam. Die Nichtdurchsetzung einer Bestimmung stellt keinen Verzicht auf unser Recht dar, dies später zu tun.
- **Rechtsbehelfe.** Unsere Rechte und Rechtsbehelfe bestehen kumulativ und zusätzlich zu allen gesetzlich oder nach Billigkeitsrecht verfügbaren Rechten und Rechtsbehelfen.
- **Kontakt.** Fragen, Beschwerden oder Ansprüche bezüglich der Schnittstellen oder Funktionen sind über die in der Schnittstelle angegebene Kontaktmöglichkeit zu richten.
$tos_de$),
  ('es', $tos_es$
# Términos de uso de {{siteName}}

Estos Términos de uso (los "Términos") regulan su acceso y uso de las Interfaces y Funciones ofrecidas por {{siteName}}.

## Introducción

Estos Términos de uso (los "Términos") regulan cómo usted, personalmente o en nombre de una entidad, puede acceder, usar o interactuar de otro modo con las interfaces, sitios web, aplicaciones y funciones relacionadas disponibles a través de {{siteUrl}}. Los Términos incluyen las políticas o documentos que incorporen expresamente estos Términos por referencia, así como nuestra Política de privacidad (en conjunto, el "Acuerdo"). Al acceder o usar cualquier interfaz, sitio web o función proporcionada por {{siteName}} (en conjunto, las "Interfaces" y las "Funciones"), usted acepta quedar obligado por este Acuerdo.

**AVISO: LEA ESTOS TÉRMINOS DETENIDAMENTE. AL ACCEDER O USAR CUALQUIER INTERFAZ O FUNCIÓN (INCLUIDA LA CONEXIÓN DE UNA BILLETERA AUTOCUSTODIADA O LA CREACIÓN DE UN IDENTIFICADOR), USTED DECLARA QUE PUEDE CELEBRAR UN ACUERDO VINCULANTE Y QUE HA LEÍDO, ENTENDIDO Y ACEPTA ESTAR OBLIGADO POR ESTOS TÉRMINOS, INCLUIDOS EL ARBITRAJE VINCULANTE Y LA RENUNCIA A ACCIONES COLECTIVAS QUE SE INDICAN A CONTINUACIÓN. SI NO ESTÁ DE ACUERDO, NO ACCEDA NI USE LAS INTERFACES O FUNCIONES.**

## Alcance y descripción de las Interfaces y Funciones

- **Funciones de contenido (opcionales):** Algunas Interfaces pueden ofrecer contenido informativo, datos o comentarios sobre mercados, eventos u otros temas (las "Funciones de contenido"). Esta información se proporciona únicamente con fines informativos generales y no constituye asesoramiento financiero, legal, fiscal ni profesional de otro tipo.
- **Funciones tecnológicas:** Algunas Interfaces pueden permitirle conectar una billetera de criptomonedas autocustodiada (la "Billetera") para transmitir transacciones a redes de cadena de bloques compatibles e interactuar de forma no custodiada con contratos basados en eventos u otros mecanismos similares en cadena (los "Contratos") (junto con los componentes relacionados de la interfaz, las "Funciones tecnológicas").

Usted reconoce que {{siteName}} no opera un exchange centralizado, no proporciona servicios de ejecución ni compensación de operaciones, no toma posesión ni custodia de sus activos y no actúa en su nombre. Los precios o datos de mercado mostrados mediante las Interfaces son informativos y no constituyen una oferta, solicitud, recomendación ni asesoramiento.

Cuando elige conectar una Billetera, entiende y acepta que:

- Usted controla su Billetera y es el único responsable de proteger las claves privadas, frases semilla, contraseñas y configuraciones de seguridad.
- {{siteName}} no puede acceder a sus claves privadas, revertir transacciones ni controlar, garantizar o asegurar el éxito o resultado de ninguna transacción que inicie.
- Las transacciones pueden requerir comisiones de red no reembolsables, que son exclusivamente su responsabilidad.
- Las redes de cadena de bloques y cualquier contrato o protocolo con el que interactúe son operados por terceros; {{siteName}} no los posee ni controla y no promete nada sobre su disponibilidad, seguridad o rendimiento.

## Elegibilidad; sanciones; jurisdicciones restringidas

Usted declara y garantiza que tiene al menos 18 años (o la mayoría de edad en su jurisdicción) y autoridad para celebrar este Acuerdo. También declara y garantiza que no es:

- Una persona sujeta a sanciones económicas o comerciales y que cumple las leyes aplicables contra el blanqueo de capitales y la financiación del terrorismo.
- Alguien que accede, usa o intenta usar las Funciones tecnológicas (incluido el trading de Contratos) desde una jurisdicción donde dicha actividad está prohibida (las "Jurisdicciones restringidas"). Sin limitar lo anterior, las personas o entidades que residan, se encuentren, estén constituidas, tengan una oficina registrada o tengan su principal lugar de negocios en una jurisdicción donde la ley aplicable prohíba dicho uso no pueden utilizar las Funciones tecnológicas para operar.

También declara y garantiza que no utilizará VPN ni herramientas similares para eludir el geobloqueo u otros controles de acceso.

Si alguna de las afirmaciones anteriores deja de ser cierta, debe dejar de acceder inmediatamente a las Funciones tecnológicas.

## Sus reconocimientos; riesgos

- **Solo información.** Las Funciones de contenido tienen únicamente fines informativos; debe verificar la información de forma independiente antes de confiar en ella.
- **Sin asesoramiento ni deber fiduciario.** Nada en las Interfaces o a través de las Funciones constituye asesoramiento de inversión, legal, fiscal, contable o profesional de otro tipo, y su uso no crea deberes fiduciarios. Busque asesoramiento profesional independiente antes de tomar decisiones.
- **Tecnología experimental o arriesgada.** Interactuar con tecnología de cadena de bloques implica riesgos importantes, incluidas vulnerabilidades de contratos inteligentes, errores de UI o UX, hackeos, phishing, ataques de ingeniería social, volatilidad y transacciones irreversibles. Puede perder parte o la totalidad de los activos que utilice en relación con los Contratos.
- **Infraestructura de terceros.** {{siteName}} no controla las redes de cadena de bloques, validadores, oráculos, puentes, indexadores, proveedores RPC ni otros servicios de terceros. Las interrupciones, congestión, reorganizaciones, bifurcaciones u otros problemas pueden afectar la disponibilidad o funcionalidad.
- **Resolución de Contratos.** La resolución de los Contratos (si corresponde) se produce únicamente conforme a las reglas específicas del mercado y cualquier oráculo de terceros o mecanismo de disputa mencionado en los términos del mercado correspondiente. {{siteName}} no es responsable de los resultados de resolución ni de las disputas entre participantes del mercado.

## Modificaciones de los Términos y de las Interfaces o Funciones

Podemos actualizar estos Términos y modificar, suspender o discontinuar cualquier Interfaz o Función, total o parcialmente, a nuestra discreción, con o sin aviso, incluida la restricción del acceso (por ejemplo, colocando Funciones en modo de solo cierre). Su uso continuado después de que los cambios entren en vigor constituye su aceptación de los Términos actualizados. Si no está de acuerdo, debe dejar de usar las Interfaces y Funciones.

## Sus responsabilidades y conducta prohibida

Usted acepta usar las Interfaces y Funciones de forma lícita y adecuada. Sin limitación, no debe:

- infringir ninguna ley, regulación u orden aplicable;
- usar las Funciones tecnológicas desde una Jurisdicción restringida o para una persona restringida o en su nombre;
- usar VPN o herramientas similares para eludir el geobloqueo o los controles de acceso;
- proporcionar información falsa, inexacta o engañosa;
- interferir con las Interfaces o Funciones, introducir malware o intentar obtener acceso no autorizado;
- extraer datos mediante scraping, recopilación o herramientas automatizadas (incluidos bots o rastreadores), salvo que esté expresamente permitido;
- aplicar ingeniería inversa o descompilar software, salvo en la medida limitada exigida por la ley aplicable;
- sublicenciar, vender o explotar comercialmente las Interfaces o Funciones, salvo que esté expresamente permitido;
- participar en conductas de mercado abusivas o manipuladoras, incluidos spoofing, layering, wash trading, operaciones concertadas, acaparamiento u otras prácticas engañosas o disruptivas;
- infringir o apropiarse indebidamente de la propiedad intelectual u otros derechos de cualquier persona.

Podemos investigar presuntas infracciones y tomar las medidas que consideremos apropiadas, incluida la suspensión o terminación del acceso y la cooperación con las autoridades.

## Información adicional; verificación

Nosotros o los proveedores de cumplimiento que actúen en nuestro nombre podemos solicitar información para confirmar su elegibilidad (por ejemplo, que no sea una persona restringida). No proporcionar información satisfactoria puede provocar la denegación o pérdida del acceso a algunas o todas las Funciones.

## Propiedad; licencia; sus comentarios y contenidos

- **Propiedad.** Salvo por los derechos que se le concedan expresamente, {{siteName}} y sus licenciantes conservan todos los derechos, títulos e intereses sobre las Interfaces y Funciones, incluida toda la propiedad intelectual asociada.
- **Licencia limitada para usted.** Sujeto a estos Términos, {{siteName}} le concede una licencia personal, revocable, no exclusiva, intransferible y no sublicenciable para acceder y usar las Interfaces y Funciones que se le proporcionen.
- **Sus comentarios y contenidos.** Si envía comentarios, sugerencias, solicitudes de soporte o contenido (los "Comentarios/Contenidos"), concede a {{siteName}} una licencia mundial, libre de regalías, transferible, sublicenciable, irrevocable y perpetua para usar, alojar, reproducir, modificar, adaptar, publicar, mostrar, crear obras derivadas y explotar de otro modo dichos Comentarios/Contenidos con fines comerciales (incluido proporcionar y mejorar las Interfaces y Funciones). Declara y garantiza que posee o controla los derechos necesarios para conceder esta licencia y que sus Comentarios/Contenidos no infringen derechos de terceros.

## Servicios y enlaces de terceros

Las Interfaces y Funciones pueden integrarse con sitios, aplicaciones, servicios, protocolos o contenidos de terceros, o enlazar a ellos (los "Servicios de terceros"). Usa los Servicios de terceros bajo su propio riesgo y sujeto a sus términos y políticas de privacidad. {{siteName}} no controla, respalda ni asume responsabilidad por los Servicios de terceros y no será responsable de daños derivados de su uso.

## Indemnización

Usted acepta defender, indemnizar y mantener indemne a {{siteName}}, sus licenciantes y sus respectivos directivos, administradores, empleados y representantes (en conjunto, las "Partes protegidas") frente a todas las reclamaciones, demandas, acciones, investigaciones, daños, pérdidas, responsabilidades, costes y gastos (incluidos honorarios razonables de abogados) que surjan de o estén relacionados con: (i) su uso o uso indebido de las Interfaces o Funciones; (ii) su incumplimiento de estos Términos o de la ley aplicable; (iii) sus disputas con terceros; (iv) la infracción o apropiación indebida real o alegada de derechos de terceros; o (v) sus Comentarios/Contenidos. Si recibimos una citación u orden obligatoria relacionada con lo anterior, usted reembolsará el tiempo, materiales y gastos legales razonables incurridos al responder.

## Renuncias de responsabilidad

LAS INTERFACES Y FUNCIONES SE PROPORCIONAN "TAL CUAL" Y "SEGÚN DISPONIBILIDAD". EN LA MÁXIMA MEDIDA PERMITIDA POR LA LEY, {{siteNameUpper}} Y SUS LICENCIANTES RENUNCIAN A TODAS LAS GARANTÍAS, EXPRESAS O IMPLÍCITAS, INCLUIDAS COMERCIABILIDAD, IDONEIDAD PARA UN FIN DETERMINADO, NO INFRACCIÓN, EXACTITUD, DISFRUTE PACÍFICO Y CUALQUIER GARANTÍA DERIVADA DEL CURSO DE LAS RELACIONES O DEL USO COMERCIAL. NO GARANTIZAMOS QUE LAS INTERFACES O FUNCIONES SEAN ININTERRUMPIDAS, LIBRES DE ERRORES, SEGURAS O LIBRES DE VIRUS, NI QUE CUALQUIER CONTENIDO O DATO SEA EXACTO O FIABLE.

## Limitación de responsabilidad

EN LA MÁXIMA MEDIDA PERMITIDA POR LA LEY: (A) EN NINGÚN CASO {{siteNameUpper}} NI SUS PROVEEDORES DE SERVICIOS SERÁN RESPONSABLES DE DAÑOS INDIRECTOS, INCIDENTALES, ESPECIALES, CONSECUENTES, EJEMPLARES O PUNITIVOS, NI DE PÉRDIDAS DE BENEFICIOS, INGRESOS, FONDO DE COMERCIO, DATOS U OTRAS PÉRDIDAS INTANGIBLES, INCLUSO SI SE LES ADVIRTIÓ DE LA POSIBILIDAD DE DICHOS DAÑOS; Y (B) LA RESPONSABILIDAD TOTAL DE {{siteNameUpper}} POR TODAS LAS RECLAMACIONES RELACIONADAS CON LAS INTERFACES O FUNCIONES NO SUPERARÁ LOS 100 USD. ESTAS LIMITACIONES SE APLICAN A TODAS LAS CAUSAS DE ACCIÓN, YA SEAN CONTRACTUALES, EXTRACONTRACTUALES (INCLUIDA NEGLIGENCIA), DE RESPONSABILIDAD OBJETIVA O DE OTRO TIPO.

Algunas jurisdicciones no permiten determinadas exclusiones o limitaciones de responsabilidad; en esos casos, lo anterior se aplicará en la máxima medida permitida por la ley aplicable.

## Ley aplicable; resolución de disputas; renuncia a acciones colectivas

- **Ley aplicable.** Estos Términos y cualquier disputa o reclamación que surja de ellos o de las Interfaces o Funciones se regirán por las leyes de la jurisdicción donde {{siteName}} esté organizado o lleve a cabo principalmente sus negocios, sin tener en cuenta las normas sobre conflicto de leyes.
- **Resolución informal.** Antes de iniciar un arbitraje o litigio, la parte agraviada debe enviar una notificación escrita que describa la reclamación y la reparación solicitada. Las partes intentarán resolver la disputa de buena fe dentro de los 45 días siguientes a la notificación.
- **Arbitraje obligatorio.** Cualquier disputa, reclamación o controversia que no se resuelva informalmente se resolverá definitivamente mediante arbitraje vinculante ante un único árbitro, administrado por una institución arbitral reconocida en la jurisdicción aplicable, conforme a sus reglas vigentes al presentar la reclamación. Cualquiera de las partes puede solicitar medidas provisionales de apoyo al arbitraje ante un tribunal competente. Usted y {{siteName}} renuncian a cualquier derecho a un juicio con jurado.
- **Renuncia a acciones colectivas.** Todos los procedimientos deben iniciarse a título individual de las partes, no como demandante o miembro de una supuesta acción colectiva, grupal, consolidada o representativa. El árbitro no puede consolidar reclamaciones ni presidir ningún procedimiento colectivo o representativo.

Si un tribunal determina que la renuncia a acciones colectivas no es aplicable, la totalidad del acuerdo de arbitraje será nula y la disputa continuará ante los tribunales.

## Impuestos

Usted es el único responsable de determinar y cumplir cualquier obligación fiscal derivada de sus actividades a través de las Interfaces o Funciones y de cumplir las leyes fiscales y obligaciones de declaración aplicables.

## Terminación

Podemos suspender o terminar su acceso a algunas o todas las Interfaces o Funciones en cualquier momento y por cualquier motivo, incluso si creemos que ha infringido estos Términos o la ley aplicable. Tras la terminación, su derecho a usar las Interfaces o Funciones cesa inmediatamente. Las secciones destinadas a sobrevivir (incluidas Propiedad, Indemnización, Renuncias de responsabilidad, Limitación de responsabilidad, Ley aplicable o Resolución de disputas y Términos generales) sobrevivirán a la terminación.

## Términos generales

- **Acuerdo completo.** Estos Términos (incluidos los documentos incorporados por referencia) constituyen el acuerdo completo entre usted y {{siteName}} sobre el objeto y sustituyen todos los entendimientos anteriores o contemporáneos.
- **Sin agencia.** Nada de estos Términos crea una sociedad, empresa conjunta, relación laboral o de agencia entre usted y {{siteName}}.
- **Cesión.** No puede ceder ni transferir estos Términos ni ningún derecho derivado de ellos sin nuestro consentimiento previo por escrito. Podemos ceder o transferir estos Términos sin restricciones.
- **Divisibilidad; renuncia.** Si alguna disposición se considera inválida o inaplicable, las restantes continuarán plenamente vigentes. No hacer cumplir una disposición no constituye una renuncia a nuestro derecho de hacerlo posteriormente.
- **Recursos.** Nuestros derechos y recursos son acumulativos y se suman a todos los derechos y recursos disponibles por ley o equidad.
- **Contacto.** Las preguntas, quejas o reclamaciones relacionadas con las Interfaces o Funciones deben dirigirse mediante el método de contacto proporcionado dentro de la Interfaz.
$tos_es$),
  ('pt', $tos_pt$
# Termos de Uso da {{siteName}}

Estes Termos de Uso (os "Termos") regem seu acesso e uso das Interfaces e Funcionalidades oferecidas pela {{siteName}}.

## Introdução

Estes Termos de Uso (os "Termos") regem como você, pessoalmente ou em nome de uma entidade, pode acessar, usar ou interagir de outra forma com as interfaces, sites, aplicativos e funcionalidades relacionadas disponibilizados por meio de {{siteUrl}}. Os Termos incluem quaisquer políticas ou documentos que incorporem expressamente estes Termos por referência, bem como nossa Política de Privacidade (em conjunto, o "Acordo"). Ao acessar ou usar qualquer interface, site ou funcionalidade fornecida pela {{siteName}} (em conjunto, as "Interfaces" e "Funcionalidades"), você concorda em ficar vinculado a este Acordo.

**AVISO: LEIA ESTES TERMOS COM ATENÇÃO. AO ACESSAR OU USAR QUALQUER INTERFACE OU FUNCIONALIDADE (INCLUINDO CONECTAR UMA CARTEIRA AUTOCUSTODIADA OU CRIAR UM IDENTIFICADOR), VOCÊ DECLARA QUE PODE CELEBRAR UM ACORDO VINCULANTE E QUE LEU, ENTENDEU E CONCORDA EM FICAR VINCULADO A ESTES TERMOS, INCLUINDO A ARBITRAGEM VINCULANTE E A RENÚNCIA A AÇÕES COLETIVAS ABAIXO. SE NÃO CONCORDAR, NÃO ACESSE NEM USE AS INTERFACES OU FUNCIONALIDADES.**

## Escopo e descrição das Interfaces e Funcionalidades

- **Funcionalidades de conteúdo (opcionais):** Algumas Interfaces podem oferecer conteúdo informativo, dados ou comentários sobre mercados, eventos ou outros assuntos (as "Funcionalidades de conteúdo"). Essas informações são fornecidas apenas para fins informativos gerais e não constituem aconselhamento financeiro, jurídico, tributário ou profissional de qualquer outra natureza.
- **Funcionalidades tecnológicas:** Algumas Interfaces podem permitir que você conecte uma carteira de criptomoedas autocustodiada (a "Carteira") para transmitir transações a redes blockchain compatíveis e interagir, sem custódia, com contratos baseados em eventos ou mecanismos semelhantes on-chain (os "Contratos") (juntamente com os componentes relacionados da interface, as "Funcionalidades tecnológicas").

Você reconhece que a {{siteName}} não opera uma exchange centralizada, não fornece serviços de execução ou compensação de operações, não toma posse nem custodia seus ativos e não atua em seu nome. Os preços ou dados de mercado exibidos pelas Interfaces são informativos e não constituem oferta, solicitação, recomendação ou aconselhamento.

Ao escolher conectar uma Carteira, você entende e concorda que:

- Você controla sua Carteira e é o único responsável por proteger chaves privadas, frases-semente, senhas e configurações de segurança.
- A {{siteName}} não pode acessar suas chaves privadas, reverter transações nem controlar, garantir ou assegurar o sucesso ou resultado de qualquer transação iniciada por você.
- As transações podem exigir taxas de rede não reembolsáveis, que são exclusivamente de sua responsabilidade.
- As redes blockchain e quaisquer contratos ou protocolos com os quais você interaja são operados por terceiros; a {{siteName}} não os possui nem controla e não faz promessas sobre sua disponibilidade, segurança ou desempenho.

## Elegibilidade; sanções; jurisdições restritas

Você declara e garante que tem pelo menos 18 anos (ou a maioridade em sua jurisdição) e autoridade para celebrar este Acordo. Você também declara e garante que não é:

- Alvo de sanções econômicas ou comerciais e que cumpre as leis aplicáveis de combate à lavagem de dinheiro e ao financiamento do terrorismo.
- Alguém que acessa, usa ou tenta usar as Funcionalidades tecnológicas (incluindo negociar Contratos) de uma jurisdição onde essa atividade é proibida (as "Jurisdições restritas"). Sem limitar o exposto acima, pessoas ou entidades que residam, estejam localizadas, sejam constituídas, tenham escritório registrado ou tenham seu principal local de negócios em uma jurisdição onde a lei aplicável proíba esse uso não podem utilizar as Funcionalidades tecnológicas para negociação.

Você também declara e garante que não usará VPNs ou ferramentas semelhantes para contornar geoblocking ou outros controles de acesso.

Se qualquer declaração acima deixar de ser verdadeira, você deverá interromper imediatamente o acesso às Funcionalidades tecnológicas.

## Seus reconhecimentos; riscos

- **Apenas informações.** As Funcionalidades de conteúdo são apenas para fins informativos; você deve verificar as informações de forma independente antes de confiar nelas.
- **Sem aconselhamento ou dever fiduciário.** Nada nas Interfaces ou por meio das Funcionalidades constitui aconselhamento de investimento, jurídico, tributário, contábil ou profissional de outra natureza, e seu uso não cria deveres fiduciários. Procure aconselhamento profissional independente antes de tomar decisões.
- **Tecnologia experimental ou arriscada.** Interagir com tecnologia blockchain envolve riscos significativos, incluindo vulnerabilidades de contratos inteligentes, bugs de UI ou UX, ataques, phishing, engenharia social, volatilidade e transações irreversíveis. Você pode perder parte ou todos os ativos usados em conexão com os Contratos.
- **Infraestrutura de terceiros.** A {{siteName}} não controla redes blockchain, validadores, oráculos, bridges, indexadores, provedores RPC ou outros serviços de terceiros. Indisponibilidades, congestionamentos, reorganizações, forks ou outros problemas podem afetar a disponibilidade ou funcionalidade.
- **Resolução de Contratos.** A resolução dos Contratos (se aplicável) ocorre exclusivamente conforme as regras específicas do mercado e qualquer oráculo de terceiros ou mecanismo de disputa mencionado nos termos do mercado relevante. A {{siteName}} não é responsável pelos resultados da resolução ou por disputas entre participantes do mercado.

## Alterações dos Termos e das Interfaces ou Funcionalidades

Podemos atualizar estes Termos e modificar, suspender ou descontinuar qualquer Interface ou Funcionalidade, total ou parcialmente, a nosso critério, com ou sem aviso, inclusive restringindo o acesso (por exemplo, colocando Funcionalidades em modo somente fechamento). Seu uso contínuo após a entrada em vigor das alterações constitui aceitação dos Termos atualizados. Se não concordar, você deverá parar de usar as Interfaces e Funcionalidades.

## Suas responsabilidades e condutas proibidas

Você concorda em usar as Interfaces e Funcionalidades de forma lícita e adequada. Sem limitação, você não deve:

- violar qualquer lei, regulamento ou ordem aplicável;
- usar as Funcionalidades tecnológicas de uma Jurisdição restrita ou para ou em nome de uma pessoa restrita;
- usar VPNs ou ferramentas semelhantes para contornar geoblocking ou controles de acesso;
- fornecer informações falsas, imprecisas ou enganosas;
- interferir ou interromper as Interfaces ou Funcionalidades, introduzir malware ou tentar acesso não autorizado;
- fazer scraping, coletar ou usar ferramentas automatizadas (incluindo bots ou crawlers) para extrair dados, exceto quando expressamente permitido;
- fazer engenharia reversa ou descompilar software, exceto na medida limitada exigida pela lei aplicável;
- sublicenciar, vender ou explorar comercialmente as Interfaces ou Funcionalidades, exceto quando expressamente permitido;
- participar de comportamento de mercado abusivo ou manipulador, incluindo spoofing, layering, wash trading, operações pré-arranjadas, cornering ou outras práticas enganosas ou disruptivas;
- infringir ou apropriar-se indevidamente da propriedade intelectual ou de outros direitos de qualquer pessoa.

Podemos investigar suspeitas de violações e tomar qualquer medida que consideremos apropriada, incluindo suspender ou encerrar o acesso e cooperar com autoridades policiais.

## Informações adicionais; verificação

Nós ou fornecedores de compliance que atuem em nosso nome podemos solicitar informações para confirmar sua elegibilidade (por exemplo, que você não é uma pessoa restrita). A falta de informações satisfatórias pode resultar na recusa ou perda de acesso a algumas ou todas as Funcionalidades.

## Propriedade; licença; seus comentários e conteúdos

- **Propriedade.** Exceto pelos direitos expressamente concedidos a você, a {{siteName}} e seus licenciadores mantêm todos os direitos, títulos e interesses sobre as Interfaces e Funcionalidades, incluindo toda a propriedade intelectual associada.
- **Licença limitada para você.** Sujeita a estes Termos, a {{siteName}} concede a você uma licença pessoal, revogável, não exclusiva, intransferível e não sublicenciável para acessar e usar as Interfaces e Funcionalidades conforme disponibilizadas.
- **Seus comentários e conteúdos.** Se você enviar comentários, sugestões, solicitações de suporte ou conteúdo ("Comentários/Conteúdo"), concederá à {{siteName}} uma licença mundial, livre de royalties, transferível, sublicenciável, irrevogável e perpétua para usar, hospedar, reproduzir, modificar, adaptar, publicar, exibir, criar trabalhos derivados e explorar de outra forma esses Comentários/Conteúdo para fins comerciais (incluindo fornecer e melhorar as Interfaces e Funcionalidades). Você declara e garante que possui ou controla os direitos necessários para conceder essa licença e que seus Comentários/Conteúdo não infringem direitos de terceiros.

## Serviços e links de terceiros

As Interfaces e Funcionalidades podem integrar ou conter links para sites, aplicativos, serviços, protocolos ou conteúdos de terceiros (os "Serviços de terceiros"). O uso de Serviços de terceiros ocorre por sua conta e risco e está sujeito aos termos e políticas de privacidade deles. A {{siteName}} não controla, endossa nem assume responsabilidade pelos Serviços de terceiros e não é responsável por danos decorrentes do seu uso.

## Indenização

Você concorda em defender, indenizar e isentar de responsabilidade a {{siteName}}, seus licenciadores e seus respectivos executivos, diretores, funcionários e representantes (em conjunto, as "Partes protegidas") contra todas e quaisquer reivindicações, demandas, ações, investigações, danos, perdas, responsabilidades, custos e despesas (incluindo honorários advocatícios razoáveis) decorrentes de ou relacionados a: (i) seu uso ou mau uso das Interfaces ou Funcionalidades; (ii) sua violação destes Termos ou da lei aplicável; (iii) suas disputas com terceiros; (iv) sua infração ou apropriação indevida real ou alegada de direitos de terceiros; ou (v) seus Comentários/Conteúdo. Se recebermos uma intimação ou ordem compulsória relacionada ao exposto acima, você reembolsará o tempo, materiais e despesas jurídicas razoáveis incorridos na resposta.

## Isenções de responsabilidade

AS INTERFACES E FUNCIONALIDADES SÃO FORNECIDAS "NO ESTADO EM QUE SE ENCONTRAM" E "CONFORME DISPONÍVEIS". NA MÁXIMA EXTENSÃO PERMITIDA PELA LEI, A {{siteNameUpper}} E SEUS LICENCIADORES REJEITAM TODAS AS GARANTIAS, EXPRESSAS OU IMPLÍCITAS, INCLUINDO COMERCIALIZAÇÃO, ADEQUAÇÃO A UMA FINALIDADE ESPECÍFICA, NÃO VIOLAÇÃO, PRECISÃO, USO TRANQUILO E QUAISQUER GARANTIAS DECORRENTES DE PRÁTICAS COMERCIAIS OU USO DO COMÉRCIO. NÃO GARANTIMOS QUE AS INTERFACES OU FUNCIONALIDADES SERÃO ININTERRUPTAS, LIVRES DE ERROS, SEGURAS OU LIVRES DE VÍRUS, OU QUE QUALQUER CONTEÚDO OU DADO SERÁ PRECISO OU CONFIÁVEL.

## Limitação de responsabilidade

NA MÁXIMA EXTENSÃO PERMITIDA PELA LEI: (A) EM NENHUMA HIPÓTESE A {{siteNameUpper}} OU SEUS PRESTADORES DE SERVIÇO SERÃO RESPONSÁVEIS POR DANOS INDIRETOS, INCIDENTAIS, ESPECIAIS, CONSEQUENCIAIS, EXEMPLARES OU PUNITIVOS, OU POR QUALQUER PERDA DE LUCROS, RECEITA, REPUTAÇÃO, DADOS OU OUTRAS PERDAS INTANGÍVEIS, MESMO SE AVISADOS DA POSSIBILIDADE DE TAIS DANOS; E (B) A RESPONSABILIDADE AGREGADA DA {{siteNameUpper}} POR TODAS AS REIVINDICAÇÕES RELACIONADAS ÀS INTERFACES OU FUNCIONALIDADES NÃO EXCEDERÁ US$ 100. ESTAS LIMITAÇÕES SE APLICAM A TODAS AS CAUSAS DE PEDIR, SEJAM CONTRATUAIS, EXTRACONTRATUAIS (INCLUINDO NEGLIGÊNCIA), DE RESPONSABILIDADE OBJETIVA OU DE OUTRA NATUREZA.

Algumas jurisdições não permitem certas exclusões ou limitações de responsabilidade; nesses casos, o exposto acima se aplicará na máxima extensão permitida pela lei aplicável.

## Lei aplicável; resolução de disputas; renúncia a ações coletivas

- **Lei aplicável.** Estes Termos e qualquer disputa ou reivindicação decorrente deles ou das Interfaces ou Funcionalidades serão regidos pelas leis da jurisdição onde a {{siteName}} está organizada ou conduz principalmente seus negócios, sem considerar regras de conflito de leis.
- **Resolução informal.** Antes de iniciar arbitragem ou litígio, a parte prejudicada deverá enviar uma notificação escrita descrevendo a reivindicação e a reparação desejada. As partes tentarão resolver a disputa de boa-fé no prazo de 45 dias após a notificação.
- **Arbitragem obrigatória.** Qualquer disputa, reivindicação ou controvérsia que não seja resolvida informalmente será finalmente resolvida por arbitragem vinculante perante um único árbitro, administrada por uma instituição arbitral reconhecida na jurisdição aplicável, sob suas regras vigentes quando a reivindicação for apresentada. Qualquer parte poderá solicitar medidas provisórias de apoio à arbitragem a um tribunal competente. Você e a {{siteName}} renunciam a qualquer direito a julgamento por júri.
- **Renúncia a ações coletivas.** Todos os procedimentos devem ser iniciados pelas partes em sua capacidade individual, e não como autor ou membro de qualquer ação coletiva, conjunta, consolidada ou representativa. O árbitro não poderá consolidar reivindicações nem presidir qualquer procedimento coletivo ou representativo.

Se um tribunal considerar inexequível a renúncia a ações coletivas, todo o acordo de arbitragem será nulo e a disputa prosseguirá no tribunal.

## Impostos

Você é o único responsável por determinar e cumprir quaisquer obrigações fiscais decorrentes de suas atividades por meio das Interfaces ou Funcionalidades e por cumprir as leis tributárias e exigências de declaração aplicáveis.

## Rescisão

Podemos suspender ou encerrar seu acesso a algumas ou todas as Interfaces ou Funcionalidades a qualquer momento e por qualquer motivo, inclusive se acreditarmos que você violou estes Termos ou a lei aplicável. Após o encerramento, seu direito de usar as Interfaces ou Funcionalidades cessa imediatamente. As seções destinadas a sobreviver (incluindo Propriedade, Indenização, Isenções de responsabilidade, Limitação de responsabilidade, Lei aplicável ou Resolução de disputas e Termos gerais) continuarão vigentes.

## Termos gerais

- **Acordo integral.** Estes Termos (incluindo documentos incorporados por referência) constituem o acordo integral entre você e a {{siteName}} sobre o assunto e substituem todos os entendimentos anteriores ou contemporâneos.
- **Ausência de agência.** Nada nestes Termos cria qualquer relação de sociedade, joint venture, emprego ou agência entre você e a {{siteName}}.
- **Cessão.** Você não poderá ceder ou transferir estes Termos ou quaisquer direitos deles decorrentes sem nosso consentimento prévio por escrito. Podemos ceder ou transferir estes Termos sem restrições.
- **Divisibilidade; renúncia.** Se qualquer disposição for considerada inválida ou inexequível, as disposições restantes continuarão plenamente vigentes. Nossa falha em exigir o cumprimento de qualquer disposição não constitui renúncia ao nosso direito de fazê-lo posteriormente.
- **Medidas.** Nossos direitos e medidas são cumulativos e adicionais a todos os direitos e medidas disponíveis por lei ou equidade.
- **Contato.** Perguntas, reclamações ou reivindicações sobre as Interfaces ou Funcionalidades devem ser encaminhadas pelo método de contato fornecido na Interface.
$tos_pt$),
  ('fr', $tos_fr$
# Conditions d'utilisation de {{siteName}}

Les présentes Conditions d'utilisation (les « Conditions ») régissent votre accès aux Interfaces et Fonctionnalités proposées par {{siteName}} et leur utilisation.

## Introduction

Les présentes Conditions d'utilisation (les « Conditions ») régissent la manière dont vous pouvez, à titre personnel ou au nom d'une entité, accéder aux interfaces, sites web, applications et fonctionnalités connexes disponibles via {{siteUrl}}, les utiliser ou interagir avec eux. Les Conditions comprennent toutes les politiques ou tous les documents qui les incorporent expressément par référence, ainsi que notre Politique de confidentialité (collectivement, l'« Accord »). En accédant à une interface, un site web ou une fonctionnalité fourni par {{siteName}}, ou en l'utilisant (collectivement, les « Interfaces » et « Fonctionnalités »), vous acceptez d'être lié par le présent Accord.

**AVIS : VEUILLEZ LIRE ATTENTIVEMENT CES CONDITIONS. EN ACCÉDANT À UNE INTERFACE OU FONCTIONNALITÉ, OU EN L'UTILISANT (Y COMPRIS EN CONNECTANT UN PORTEFEUILLE AUTO-HÉBERGÉ OU EN CRÉANT UN IDENTIFIANT), VOUS DÉCLAREZ ÊTRE EN MESURE DE CONCLURE UN ACCORD CONTRAIGNANT ET AVOIR LU, COMPRIS ET ACCEPTÉ D'ÊTRE LIÉ PAR CES CONDITIONS, Y COMPRIS L'ARBITRAGE CONTRAIGNANT ET LA RENONCIATION AUX ACTIONS COLLECTIVES CI-DESSOUS. SI VOUS N'ÊTES PAS D'ACCORD, N'ACCÉDEZ PAS AUX INTERFACES OU FONCTIONNALITÉS ET NE LES UTILISEZ PAS.**

## Champ d'application et description des Interfaces et Fonctionnalités

- **Fonctionnalités de contenu (facultatives) :** Certaines Interfaces peuvent fournir du contenu informatif, des données ou des commentaires sur des marchés, événements ou autres sujets (les « Fonctionnalités de contenu »). Ces informations sont fournies uniquement à titre informatif général et ne constituent pas un conseil financier, juridique, fiscal ou professionnel.
- **Fonctionnalités technologiques :** Certaines Interfaces peuvent vous permettre de connecter un portefeuille de cryptomonnaies auto-hébergé (le « Portefeuille ») afin de diffuser des transactions vers des réseaux blockchain pris en charge et d'interagir sans dépositaire avec des contrats liés à des événements ou des mécanismes similaires en chaîne (les « Contrats ») (avec les composants d'interface associés, les « Fonctionnalités technologiques »).

Vous reconnaissez que {{siteName}} n'exploite pas de plateforme d'échange centralisée, ne fournit pas de services d'exécution ou de compensation, ne prend pas possession de vos actifs et n'en assure pas la garde, et n'agit pas en votre nom. Les prix ou données de marché affichés par les Interfaces sont fournis à titre informatif et ne constituent ni une offre, ni une sollicitation, ni une recommandation, ni un conseil.

Lorsque vous choisissez de connecter un Portefeuille, vous comprenez et acceptez que :

- Vous contrôlez votre Portefeuille et êtes seul responsable de la protection de vos clés privées, phrases de récupération, mots de passe et paramètres de sécurité.
- {{siteName}} ne peut pas accéder à vos clés privées, annuler des transactions, ni contrôler, garantir ou assurer le succès ou le résultat d'une transaction que vous initiez.
- Les transactions peuvent nécessiter des frais de réseau non remboursables, dont vous êtes seul responsable.
- Les réseaux blockchain ainsi que les contrats ou protocoles avec lesquels vous interagissez sont exploités par des tiers ; {{siteName}} ne les possède ni ne les contrôle et ne fait aucune promesse concernant leur disponibilité, leur sécurité ou leurs performances.

## Éligibilité ; sanctions ; juridictions restreintes

Vous déclarez et garantissez avoir au moins 18 ans (ou l'âge de la majorité dans votre juridiction) et être habilité à conclure le présent Accord. Vous déclarez et garantissez également ne pas être :

- soumis à des sanctions économiques ou commerciales et respecter les lois applicables en matière de lutte contre le blanchiment d'argent et le financement du terrorisme ;
- en train d'accéder aux Fonctionnalités technologiques (y compris de négocier des Contrats), de les utiliser ou de tenter de les utiliser depuis une juridiction où cette activité est interdite (les « Juridictions restreintes »). Sans limiter ce qui précède, les personnes ou entités qui résident, se trouvent, sont constituées, ont un siège social ou exercent principalement leurs activités dans une juridiction où la loi applicable interdit cette utilisation ne sont pas autorisées à utiliser les Fonctionnalités technologiques pour négocier.

Vous déclarez et garantissez également ne pas utiliser de VPN ou d'outils similaires pour contourner le géoblocage ou d'autres contrôles d'accès.

Si l'une des déclarations ci-dessus devient inexacte, vous devez immédiatement cesser d'accéder aux Fonctionnalités technologiques.

## Vos reconnaissances ; risques

- **Informations uniquement.** Les Fonctionnalités de contenu sont fournies uniquement à titre informatif ; vous devez vérifier les informations de manière indépendante avant de vous y fier.
- **Aucun conseil ni devoir fiduciaire.** Rien dans les Interfaces ou les Fonctionnalités ne constitue un conseil en investissement, juridique, fiscal, comptable ou professionnel, et votre utilisation ne crée aucun devoir fiduciaire. Demandez un conseil professionnel indépendant avant de prendre une décision.
- **Technologie expérimentale ou risquée.** L'interaction avec la technologie blockchain comporte des risques importants, notamment des vulnérabilités de contrats intelligents, des bugs d'interface ou d'expérience utilisateur, des piratages, de l'hameçonnage, des attaques d'ingénierie sociale, de la volatilité et des transactions irréversibles. Vous pouvez perdre tout ou partie des actifs utilisés en relation avec les Contrats.
- **Infrastructure de tiers.** {{siteName}} ne contrôle pas les réseaux blockchain, validateurs, oracles, ponts, indexeurs, fournisseurs RPC ou autres services tiers. Les pannes, congestions, réorganisations, forks ou autres problèmes peuvent affecter la disponibilité ou les fonctionnalités.
- **Résolution des Contrats.** La résolution des Contrats (le cas échéant) intervient uniquement conformément aux règles propres au marché et à tout oracle tiers ou mécanisme de contestation mentionné dans les conditions du marché concerné. {{siteName}} n'est pas responsable des résultats de résolution ni des litiges entre participants au marché.

## Modifications des Conditions et des Interfaces ou Fonctionnalités

Nous pouvons mettre à jour les présentes Conditions et modifier, suspendre ou interrompre toute Interface ou Fonctionnalité, en tout ou partie, à notre discrétion, avec ou sans préavis, notamment en limitant l'accès (par exemple en plaçant les Fonctionnalités en mode clôture uniquement). Votre utilisation continue après l'entrée en vigueur des changements constitue votre acceptation des Conditions mises à jour. Si vous n'êtes pas d'accord, vous devez cesser d'utiliser les Interfaces et Fonctionnalités.

## Vos responsabilités et comportements interdits

Vous acceptez d'utiliser les Interfaces et Fonctionnalités de manière légale et appropriée. Vous ne devez notamment pas :

- enfreindre une loi, réglementation ou ordonnance applicable ;
- utiliser les Fonctionnalités technologiques depuis une Juridiction restreinte ou pour une personne restreinte ou au nom de celle-ci ;
- utiliser des VPN ou outils similaires pour contourner le géoblocage ou les contrôles d'accès ;
- fournir des informations fausses, inexactes ou trompeuses ;
- perturber les Interfaces ou Fonctionnalités, introduire des logiciels malveillants ou tenter un accès non autorisé ;
- extraire des données par scraping, collecte ou outils automatisés (y compris bots ou robots d'exploration), sauf autorisation expresse ;
- effectuer de l'ingénierie inverse ou décompiler un logiciel, sauf dans la mesure limitée requise par la loi applicable ;
- concéder en sous-licence, vendre ou exploiter commercialement les Interfaces ou Fonctionnalités, sauf autorisation expresse ;
- adopter un comportement de marché abusif ou manipulateur, notamment spoofing, layering, wash trading, transactions préarrangées, accaparement ou autres pratiques trompeuses ou perturbatrices ;
- porter atteinte aux droits de propriété intellectuelle ou autres droits d'une personne, ou se les approprier indûment.

Nous pouvons enquêter sur les violations présumées et prendre toute mesure que nous jugeons appropriée, notamment suspendre ou résilier l'accès et coopérer avec les autorités chargées de l'application de la loi.

## Informations complémentaires ; vérification

Nous-mêmes ou des prestataires de conformité agissant pour notre compte pouvons demander des informations afin de confirmer votre éligibilité (par exemple, que vous n'êtes pas une personne restreinte). L'absence d'informations satisfaisantes peut entraîner le refus ou la perte de l'accès à tout ou partie des Fonctionnalités.

## Propriété ; licence ; vos commentaires et contenus

- **Propriété.** À l'exception des droits qui vous sont expressément accordés, {{siteName}} et ses concédants conservent tous les droits, titres et intérêts relatifs aux Interfaces et Fonctionnalités, y compris toute la propriété intellectuelle associée.
- **Licence limitée qui vous est accordée.** Sous réserve des présentes Conditions, {{siteName}} vous accorde une licence personnelle, révocable, non exclusive, non transférable et non sous-licenciable pour accéder aux Interfaces et Fonctionnalités qui vous sont fournies et les utiliser.
- **Vos commentaires et contenus.** Si vous envoyez des commentaires, suggestions, demandes d'assistance ou contenus (les « Commentaires/Contenus »), vous accordez à {{siteName}} une licence mondiale, libre de redevances, transférable, sous-licenciable, irrévocable et perpétuelle pour utiliser, héberger, reproduire, modifier, adapter, publier, afficher, créer des œuvres dérivées à partir de ces Commentaires/Contenus et les exploiter de toute autre manière à des fins commerciales (notamment pour fournir et améliorer les Interfaces et Fonctionnalités). Vous déclarez et garantissez détenir ou contrôler les droits nécessaires pour accorder cette licence et que vos Commentaires/Contenus ne portent pas atteinte aux droits d'autrui.

## Services et liens de tiers

Les Interfaces et Fonctionnalités peuvent intégrer des sites, applications, services, protocoles ou contenus tiers, ou y renvoyer (les « Services tiers »). Vous utilisez les Services tiers à vos propres risques et êtes soumis à leurs conditions et politiques de confidentialité. {{siteName}} ne contrôle pas les Services tiers, ne les approuve pas et n'en assume pas la responsabilité ; {{siteName}} ne peut être tenu responsable des dommages résultant de leur utilisation.

## Indemnisation

Vous acceptez de défendre, d'indemniser et de dégager de toute responsabilité {{siteName}}, ses concédants, ainsi que leurs dirigeants, administrateurs, employés et représentants respectifs (collectivement, les « Parties protégées ») contre toute réclamation, demande, action, enquête, dommage, perte, responsabilité, coût et dépense (y compris les honoraires raisonnables d'avocat) découlant de ou liés à : (i) votre utilisation ou mauvaise utilisation des Interfaces ou Fonctionnalités ; (ii) votre violation des présentes Conditions ou de la loi applicable ; (iii) vos litiges avec un tiers ; (iv) votre atteinte réelle ou alléguée aux droits d'un tiers ou votre appropriation indue de ces droits ; ou (v) vos Commentaires/Contenus. Si nous recevons une assignation ou une ordonnance obligatoire liée à ce qui précède, vous nous rembourserez le temps, les frais matériels et les frais juridiques raisonnables engagés pour y répondre.

## Exclusions de garantie

LES INTERFACES ET FONCTIONNALITÉS SONT FOURNIES « EN L'ÉTAT » ET « SELON DISPONIBILITÉ ». DANS TOUTE LA MESURE PERMISE PAR LA LOI, {{siteNameUpper}} ET SES CONCÉDANTS EXCLUENT TOUTE GARANTIE, EXPRESSE OU IMPLICITE, Y COMPRIS DE QUALITÉ MARCHANDE, D'ADÉQUATION À UN USAGE PARTICULIER, DE NON-VIOLATION, D'EXACTITUDE, DE JOUISSANCE PAISIBLE ET TOUTE GARANTIE DÉCOULANT DES PRATIQUES COMMERCIALES OU DES USAGES DU COMMERCE. NOUS NE GARANTISSONS PAS QUE LES INTERFACES OU FONCTIONNALITÉS SERONT ININTERROMPUES, EXEMPTES D'ERREUR, SÉCURISÉES OU EXEMPTES DE VIRUS, NI QUE LE CONTENU OU LES DONNÉES SERONT EXACTS OU FIABLES.

## Limitation de responsabilité

DANS TOUTE LA MESURE PERMISE PAR LA LOI : (A) {{siteNameUpper}} OU SES PRESTATAIRES DE SERVICES NE POURRONT EN AUCUN CAS ÊTRE TENUS RESPONSABLES DE DOMMAGES INDIRECTS, ACCESSOIRES, SPÉCIAUX, CONSÉCUTIFS, EXEMPLAIRES OU PUNITIFS, NI DE TOUTE PERTE DE BÉNÉFICES, REVENUS, CLIENTÈLE, DONNÉES OU AUTRES PERTES INCORPORELLES, MÊME S'ILS ONT ÉTÉ INFORMÉS DE LA POSSIBILITÉ DE TELS DOMMAGES ; ET (B) LA RESPONSABILITÉ TOTALE DE {{siteNameUpper}} POUR TOUTE RÉCLAMATION LIÉE AUX INTERFACES OU FONCTIONNALITÉS NE DÉPASSERA PAS 100 USD. CES LIMITATIONS S'APPLIQUENT À TOUTES LES CAUSES D'ACTION, QU'ELLES SOIENT CONTRACTUELLES, DÉLICTUELLES (Y COMPRIS LA NÉGLIGENCE), FONDÉES SUR LA RESPONSABILITÉ STRICTE OU AUTRES.

Certaines juridictions n'autorisent pas certaines exclusions ou limitations de responsabilité ; dans ce cas, ce qui précède s'appliquera dans toute la mesure permise par la loi applicable.

## Droit applicable ; règlement des litiges ; renonciation aux actions collectives

- **Droit applicable.** Les présentes Conditions et tout litige ou toute réclamation qui en découle ou est lié aux Interfaces ou Fonctionnalités seront régis par les lois de la juridiction où {{siteName}} est organisé ou exerce principalement son activité, sans égard aux règles de conflit de lois.
- **Règlement informel.** Avant d'engager un arbitrage ou une procédure judiciaire, la partie lésée doit envoyer une notification écrite décrivant la réclamation et la réparation demandée. Les parties tenteront de bonne foi de résoudre le litige dans les 45 jours suivant la notification.
- **Arbitrage obligatoire.** Tout litige, réclamation ou controverse non résolu de manière informelle sera définitivement tranché par un arbitrage contraignant devant un arbitre unique, administré par une institution d'arbitrage reconnue dans la juridiction applicable, selon ses règles en vigueur au dépôt de la réclamation. Chaque partie peut demander à un tribunal compétent des mesures provisoires en soutien de l'arbitrage. Vous et {{siteName}} renoncez à tout droit à un procès devant jury.
- **Renonciation aux actions collectives.** Toute procédure doit être engagée à titre individuel par les parties, et non en tant que demandeur ou membre d'une action collective, groupée, consolidée ou représentative présumée. L'arbitre ne peut pas regrouper les réclamations ni présider une procédure collective ou représentative.

Si un tribunal juge la renonciation aux actions collectives inapplicable, l'intégralité de la convention d'arbitrage sera nulle et le litige sera porté devant les tribunaux.

## Impôts

Vous êtes seul responsable de la détermination et de l'acquittement de toute obligation fiscale découlant de vos activités via les Interfaces ou Fonctionnalités et du respect des lois fiscales et obligations déclaratives applicables.

## Résiliation

Nous pouvons suspendre ou résilier votre accès à tout ou partie des Interfaces ou Fonctionnalités à tout moment et pour quelque raison que ce soit, notamment si nous estimons que vous avez violé les présentes Conditions ou la loi applicable. À la résiliation, votre droit d'utiliser les Interfaces ou Fonctionnalités cesse immédiatement. Les sections destinées à survivre (notamment Propriété, Indemnisation, Exclusions de garantie, Limitation de responsabilité, Droit applicable ou Règlement des litiges et Conditions générales) survivront à la résiliation.

## Conditions générales

- **Accord intégral.** Les présentes Conditions (y compris les documents incorporés par référence) constituent l'intégralité de l'accord entre vous et {{siteName}} concernant leur objet et remplacent toutes les ententes antérieures ou contemporaines.
- **Absence de mandat.** Rien dans ces Conditions ne crée de partenariat, coentreprise, relation de travail ou mandat entre vous et {{siteName}}.
- **Cession.** Vous ne pouvez pas céder ou transférer ces Conditions ou tout droit qui en découle sans notre consentement écrit préalable. Nous pouvons céder ou transférer ces Conditions sans restriction.
- **Divisibilité ; renonciation.** Si une disposition est jugée invalide ou inapplicable, les autres dispositions restent pleinement en vigueur. Le fait de ne pas faire respecter une disposition ne constitue pas une renonciation à notre droit de le faire ultérieurement.
- **Recours.** Nos droits et recours sont cumulatifs et s'ajoutent à tous les droits et recours disponibles en droit ou en équité.
- **Contact.** Les questions, plaintes ou réclamations concernant les Interfaces ou Fonctionnalités doivent être adressées par le moyen de contact indiqué dans l'Interface.
$tos_fr$),
  ('zh', $tos_zh$
# {{siteName}} 使用条款

本使用条款（以下简称“条款”）规定您访问和使用 {{siteName}} 提供的界面和功能的条件。

## 简介

本使用条款（以下简称“条款”）规定您以个人身份或代表某实体访问、使用或以其他方式与通过 {{siteUrl}} 提供的界面、网站、应用程序及相关功能进行互动的方式。条款包括明确通过引用纳入本条款的任何政策或文件，以及我们的隐私政策（统称“协议”）。访问或使用 {{siteName}} 提供的任何界面、网站或功能（统称“界面”和“功能”）即表示您同意受本协议约束。

**注意：请仔细阅读本条款。访问或使用任何界面或功能（包括连接自托管钱包或创建标识符）即表示您声明自己有能力订立具有约束力的协议，并且已阅读、理解并同意受本条款约束，包括下方的有约束力仲裁和集体诉讼放弃条款。如果您不同意，请勿访问或使用界面或功能。**

## 界面和功能的范围与说明

- **内容功能（可选）：**部分界面可能提供有关市场、事件或其他主题的信息内容、数据或评论（“内容功能”）。此类信息仅用于一般信息目的，不构成财务、法律、税务或其他专业建议。
- **技术功能：**部分界面可能允许您连接自托管加密货币钱包（“钱包”），向受支持的区块链网络广播交易，以非托管方式与基于事件的合约或类似链上机制（“合约”）互动（连同相关用户界面组件，统称“技术功能”）。

您确认 {{siteName}} 不运营中心化交易所，不提供交易执行或清算服务，不占有或托管您的资产，也不代表您行事。界面显示的价格或市场数据仅供参考，不构成要约、招揽、建议或意见。

当您选择连接钱包时，您理解并同意：

- 您控制自己的钱包，并独自负责保护私钥、助记词、密码和安全设置。
- {{siteName}} 无法访问您的私钥、撤销交易，也无法控制、保证或确保您发起的任何交易的成功或结果。
- 交易可能需要不可退款的网络费用，该费用完全由您承担。
- 您互动的区块链网络以及任何合约或协议均由第三方运营；{{siteName}} 不拥有或控制它们，也不对其可用性、安全性或性能作出承诺。

## 资格；制裁；受限司法管辖区

您声明并保证自己已年满18岁（或达到您所在司法管辖区的法定成年年龄），并有权订立本协议。您还声明并保证自己不是：

- 受到经济或贸易制裁的对象，并且遵守适用的反洗钱和反恐怖融资法律；
- 从禁止此类活动的任何司法管辖区访问、使用或试图使用技术功能（包括交易合约）（“受限司法管辖区”）。在不限制前述内容的情况下，居住于、位于、注册于、设有注册办事处或主要营业地点位于适用法律禁止此类使用的司法管辖区的个人或实体，不得使用技术功能进行交易。

您还声明并保证不会使用VPN或类似工具规避地理封锁或其他访问控制。

如果上述任何内容不再真实，您必须立即停止访问技术功能。

## 您的确认；风险

- **仅供参考。**内容功能仅用于提供信息；在依赖相关信息之前，您应自行核实。
- **无建议或信托义务。**界面或功能中的任何内容均不构成投资、法律、税务、会计或其他专业建议，您使用界面或功能也不会产生任何信托义务。作出决定前请寻求独立的专业建议。
- **实验性或高风险技术。**与区块链技术互动涉及重大风险，包括智能合约漏洞、用户界面或用户体验错误、黑客攻击、网络钓鱼、社会工程攻击、波动性和不可逆交易。您可能损失与合约相关使用的部分或全部资产。
- **第三方基础设施。**{{siteName}} 不控制区块链网络、验证者、预言机、跨链桥、索引器、RPC服务商或其他第三方服务。宕机、拥堵、重组、分叉或其他问题可能影响可用性或功能。
- **合约结算。**合约的结算（如适用）完全依据特定市场规则以及相关市场条款中提及的任何第三方预言机或争议机制进行。{{siteName}} 不对结算结果或市场参与者之间的争议负责。

## 条款以及界面或功能的修改

我们可以自行决定更新本条款并修改、暂停或终止任何界面或功能（全部或部分），无论是否另行通知，包括限制访问（例如将功能置于仅允许平仓模式）。变更生效后您继续使用即表示接受更新后的条款。如果您不同意，必须停止使用界面和功能。

## 您的责任和禁止行为

您同意合法、适当地使用界面和功能。在不限制前述内容的情况下，您不得：

- 违反任何适用的法律、法规或命令；
- 从受限司法管辖区使用技术功能，或为受限人士或代表其使用技术功能；
- 使用VPN或类似工具规避地理封锁或访问控制；
- 提供虚假、不准确或误导性信息；
- 干扰或破坏界面或功能、引入恶意软件或尝试未经授权的访问；
- 除非明确允许，否则通过抓取、收集或使用自动化工具（包括机器人或爬虫）提取数据；
- 除非适用法律有限度地要求，否则对软件进行逆向工程或反编译；
- 除非明确允许，否则对界面或功能进行再许可、出售或商业利用；
- 从事滥用或操纵市场的行为，包括欺骗挂单、分层挂单、对倒交易、预先安排的交易、操纵市场或其他欺骗性或扰乱性行为；
- 侵犯或不当占有任何人的知识产权或其他权利。

我们可以调查涉嫌的违规行为并采取我们认为适当的任何措施，包括暂停或终止访问以及配合执法部门。

## 其他信息；验证

我们或代表我们行事的合规服务商可能要求提供信息，以确认您的资格（例如确认您不是受限人士）。未能提供令人满意的信息可能导致拒绝或失去对部分或全部功能的访问权限。

## 所有权；许可；您的反馈和内容

- **所有权。**除明确授予您的权利外，{{siteName}} 及其许可方保留对界面和功能的所有权利、所有权和利益，包括相关的全部知识产权。
- **授予您的有限许可。**在遵守本条款的前提下，{{siteName}} 授予您个人的、可撤销的、非排他的、不可转让且不可再许可的许可，以访问和使用向您提供的界面和功能。
- **您的反馈和内容。**如果您提交反馈、建议、支持请求或内容（“反馈/内容”），您授予 {{siteName}} 全球范围内、免版税、可转让、可再许可、不可撤销且永久的许可，以出于商业目的使用、托管、复制、修改、改编、发布、展示、创作衍生作品以及以其他方式利用该反馈/内容（包括提供和改进界面和功能）。您声明并保证拥有或控制授予该许可所需的权利，并且您的反馈/内容不侵犯他人的权利。

## 第三方服务和链接

界面和功能可能集成第三方网站、应用程序、服务、协议或内容，或链接至这些第三方资源（“第三方服务”）。您自行承担使用第三方服务的风险，并受其条款和隐私政策约束。{{siteName}} 不控制、认可或负责第三方服务，也不对因您使用第三方服务而产生的任何损害负责。

## 赔偿

您同意为 {{siteName}}、其许可方及其各自的高级职员、董事、员工和代表（统称“受保护方”）进行抗辩、赔偿并使其免受任何及所有索赔、要求、诉讼、调查、损害、损失、责任、成本和费用（包括合理的律师费）的损害；这些事项因以下原因产生或与其相关：(i)您使用或滥用界面或功能；(ii)您违反本条款或适用法律；(iii)您与任何第三方之间的争议；(iv)您实际或被指控侵犯或不当占有第三方权利；或(v)您的反馈/内容。如果我们收到与上述事项有关的传票或强制命令，您应偿还我们为回应而产生的合理时间、材料和法律费用。

## 免责声明

界面和功能按“现状”和“可用”提供。在法律允许的最大范围内，{{siteNameUpper}} 及其许可方不承担任何明示或默示保证，包括适销性、特定用途适用性、不侵权、准确性、安静享有以及因交易过程或商业惯例产生的任何保证。我们不保证界面或功能不会中断、无错误、安全或无病毒，也不保证任何内容或数据准确或可靠。

## 责任限制

在法律允许的最大范围内：(A){{siteNameUpper}} 或其服务提供商在任何情况下均不对任何间接、附带、特殊、后果性、示范性或惩罚性损害，或利润、收入、商誉、数据或其他无形损失承担责任，即使已被告知可能发生此类损害；以及(B){{siteNameUpper}} 就所有与界面或功能有关的索赔承担的总责任不超过100美元。这些限制适用于所有诉因，无论是合同、侵权（包括过失）、严格责任还是其他原因。

某些司法管辖区不允许排除或限制某些责任；在此情况下，前述内容将在适用法律允许的最大范围内适用。

## 适用法律；争议解决；集体诉讼放弃

- **适用法律。**本条款以及因本条款或界面、功能产生或与之相关的任何争议或索赔，均受 {{siteName}} 注册成立或主要开展业务所在司法管辖区的法律管辖，不考虑法律冲突规则。
- **非正式解决。**在开始仲裁或诉讼之前，受损方必须发送书面通知，说明索赔和所要求的救济。双方将善意地尝试在通知后45天内解决争议。
- **强制仲裁。**任何未通过非正式方式解决的争议、索赔或纠纷，应由适用司法管辖区内信誉良好的仲裁机构按照提交索赔时有效的规则，由一名仲裁员进行具有约束力的最终仲裁。任何一方均可向有管辖权的法院申请协助仲裁的临时救济。您和 {{siteName}} 放弃接受陪审团审判的任何权利。
- **集体诉讼放弃。**所有程序必须由双方以个人身份提起，不得作为任何声称的集体、联合、合并或代表性诉讼的原告或成员提起。仲裁员不得合并索赔，也不得主持任何形式的集体或代表性程序。

如果法院认定集体诉讼放弃不可执行，则整个仲裁协议无效，争议将在法院审理。

## 税务

您独自负责确定并履行因通过界面或功能开展活动而产生的任何税务义务，并遵守适用的税法和申报要求。

## 终止

我们可以基于任何理由随时暂停或终止您访问部分或全部界面或功能的权限，包括我们认为您违反本条款或适用法律的情况。终止后，您使用界面或功能的权利立即停止。旨在终止后继续有效的条款（包括所有权、赔偿、免责声明、责任限制、适用法律或争议解决以及一般条款）在终止后继续有效。

## 一般条款

- **完整协议。**本条款（包括通过引用纳入的文件）构成您与 {{siteName}} 就相关事项达成的完整协议，并取代所有先前或同期的理解。
- **无代理关系。**本条款不建立您与 {{siteName}} 之间的合伙、合资、雇佣或代理关系。
- **转让。**未经我们事先书面同意，您不得转让本条款或其项下任何权利。我们可以不受限制地转让本条款。
- **可分割性；弃权。**如果任何条款被认定无效或不可执行，其余条款仍完全有效。我们未执行任何条款不代表放弃日后执行该条款的权利。
- **救济。**我们的权利和救济是累积的，并且是法律或衡平法提供的任何权利和救济之外的补充。
- **联系方式。**有关界面或功能的问题、投诉或索赔，应通过界面内提供的联系方式提出。
$tos_zh$),
  ('ja', $tos_ja$
# {{siteName}} 利用規約

本利用規約（以下「本規約」）は、{{siteName}} が提供するインターフェースおよび機能へのアクセスとその利用を規定します。

## はじめに

本利用規約（以下「本規約」）は、個人として、または法人等を代表して、{{siteUrl}} を通じて提供されるインターフェース、ウェブサイト、アプリケーションおよび関連機能にアクセスし、利用し、その他の方法で関わる方法を規定します。本規約には、本規約を明示的に参照して組み込むポリシーまたは文書、および当社のプライバシーポリシー（総称して「本契約」）が含まれます。{{siteName}} が提供するインターフェース、ウェブサイトまたは機能（総称して「インターフェース」および「機能」）にアクセスまたは利用することで、あなたは本契約に拘束されることに同意します。

**注意：本規約を注意深くお読みください。インターフェースまたは機能（セルフホスト型ウォレットへの接続または識別子の作成を含みます）にアクセスまたは利用することで、あなたは拘束力のある契約を締結でき、本規約を読み、理解し、これに拘束されることに同意したことを表明します。これには、以下の拘束力のある仲裁および集団訴訟の放棄が含まれます。同意しない場合、インターフェースまたは機能にアクセスまたは利用しないでください。**

## インターフェースおよび機能の範囲と説明

- **コンテンツ機能（任意）：**一部のインターフェースでは、市場、イベントその他のトピックに関する情報コンテンツ、データまたはコメント（「コンテンツ機能」）を提供する場合があります。これらの情報は一般的な情報提供のみを目的としており、金融、法律、税務その他の専門的助言ではありません。
- **技術機能：**一部のインターフェースでは、セルフホスト型暗号資産ウォレット（「ウォレット」）を接続し、対応するブロックチェーンネットワークに取引を送信して、イベントベースのコントラクトまたは類似のオンチェーン機構（「コントラクト」）と非カストディ方式でやり取りできる場合があります（関連するユーザーインターフェース要素と併せて「技術機能」）。

{{siteName}} は中央集権型取引所を運営せず、取引執行または清算サービスを提供せず、あなたの資産を占有または保管せず、あなたに代わって行動しないことをあなたは認めます。インターフェースに表示される価格または市場データは情報提供のみを目的とし、申込み、勧誘、推奨または助言ではありません。

ウォレットを接続する場合、あなたは次の事項を理解し、同意します。

- あなたは自分のウォレットを管理し、秘密鍵、シードフレーズ、パスワードおよびセキュリティ設定の保護について単独で責任を負います。
- {{siteName}} は秘密鍵にアクセスできず、取引を取り消すことができず、あなたが開始した取引の成功または結果を管理、保証または確保できません。
- 取引には返金不可のネットワーク手数料が必要となる場合があり、その責任はすべてあなたが負います。
- ブロックチェーンネットワークおよびあなたがやり取りするコントラクトやプロトコルは第三者が運営します。{{siteName}} はそれらを所有または管理せず、可用性、安全性または性能について何ら保証しません。

## 利用資格、制裁、制限対象地域

あなたは、18歳以上（または管轄地域における成人年齢以上）であり、本契約を締結する権限を有することを表明し、保証します。また、次のいずれにも該当しないことを表明し、保証します。

- 経済制裁または貿易制裁の対象者でなく、適用されるマネーロンダリング防止法およびテロ資金供与対策法を遵守していること。
- 当該活動が禁止されている地域（「制限対象地域」）から技術機能（コントラクトの取引を含む）にアクセス、利用または利用を試みていないこと。前記を制限することなく、適用法がその利用を禁止する地域に居住、所在、設立され、登記上の事務所または主たる事業所を有する個人または法人は、取引目的で技術機能を利用できません。

また、ジオブロッキングその他のアクセス制御を回避するためにVPNその他の類似ツールを使用しないことを表明し、保証します。

上記のいずれかが真実でなくなった場合、直ちに技術機能へのアクセスを停止しなければなりません。

## あなたの確認事項とリスク

- **情報提供のみ。**コンテンツ機能は情報提供のみを目的とします。情報を信頼する前に、あなた自身で確認してください。
- **助言および受託者義務の不存在。**インターフェースまたは機能上のいかなる内容も、投資、法律、税務、会計その他の専門的助言を構成せず、利用によって受託者義務が生じることもありません。判断を行う前に、独立した専門家の助言を求めてください。
- **実験的またはリスクのある技術。**ブロックチェーン技術とのやり取りには、スマートコントラクトの脆弱性、UIまたはUXのバグ、ハッキング、フィッシング、ソーシャルエンジニアリング攻撃、価格変動および取り消せない取引などの重大なリスクがあります。コントラクトに関連して使用する資産の一部または全部を失う可能性があります。
- **第三者インフラ。**{{siteName}} は、ブロックチェーンネットワーク、バリデーター、オラクル、ブリッジ、インデクサー、RPCプロバイダーその他の第三者サービスを管理しません。停止、混雑、再編成、フォークその他の問題により、可用性または機能が影響を受ける場合があります。
- **コントラクトの解決。**コントラクトの解決（該当する場合）は、関連する市場規約に記載された市場固有のルールおよび第三者オラクルや紛争メカニズムにのみ従って行われます。{{siteName}} は解決結果または市場参加者間の紛争について責任を負いません。

## 本規約およびインターフェース・機能の変更

当社は、通知の有無を問わず、当社の裁量で本規約を更新し、インターフェースまたは機能の全部または一部を変更、一時停止または終了できます。これにはアクセスの制限（例えば機能を決済専用モードにすること）が含まれます。変更の効力発生後も利用を続けた場合、更新された本規約を承諾したものとみなされます。同意しない場合は、インターフェースおよび機能の利用を停止してください。

## あなたの責任と禁止行為

あなたはインターフェースおよび機能を合法かつ適切に利用することに同意します。特に、次の行為をしてはなりません。

- 適用される法律、規則または命令に違反すること。
- 制限対象地域から、または制限対象者のために、もしくはその代理として技術機能を利用すること。
- ジオブロッキングまたはアクセス制御を回避するためにVPNその他の類似ツールを利用すること。
- 虚偽、不正確または誤解を招く情報を提供すること。
- インターフェースまたは機能を妨害もしくは混乱させ、マルウェアを持ち込み、または不正アクセスを試みること。
- 明示的に許可されている場合を除き、スクレイピング、収集または自動化ツール（ボットやクローラーを含む）を使用してデータを抽出すること。
- 適用法で限定的に必要とされる場合を除き、ソフトウェアをリバースエンジニアリングまたは逆コンパイルすること。
- 明示的に許可されている場合を除き、インターフェースまたは機能を再許諾、販売または商業的に利用すること。
- スプーフィング、レイヤリング、ウォッシュトレード、談合取引、買い占めその他の欺瞞的または妨害的行為を含む、濫用的または市場操作的な行為をすること。
- いかなる者の知的財産その他の権利も侵害または不正流用すること。

当社は、違反の疑いを調査し、アクセスの停止または終了、法執行機関との協力を含む、適切と判断する措置を講じることができます。

## 追加情報と確認

当社または当社に代わって行動するコンプライアンス事業者は、利用資格（例えば制限対象者でないこと）を確認するために情報を求めることがあります。十分な情報を提供しない場合、機能の一部または全部へのアクセスを拒否または失うことがあります。

## 所有権、ライセンス、あなたのフィードバックとコンテンツ

- **所有権。**あなたに明示的に付与された権利を除き、{{siteName}} およびそのライセンサーは、関連するすべての知的財産を含むインターフェースおよび機能に関する一切の権利、権原および利益を保持します。
- **あなたへの限定ライセンス。**本規約に従うことを条件として、{{siteName}} は、提供されたインターフェースおよび機能にアクセスし利用するための、個人的、取消可能、非独占的、譲渡不可かつ再許諾不可のライセンスを付与します。
- **あなたのフィードバックとコンテンツ。**フィードバック、提案、サポート依頼またはコンテンツ（「フィードバック／コンテンツ」）を提出した場合、あなたは {{siteName}} に対し、事業目的（インターフェースおよび機能の提供・改善を含む）のために、当該フィードバック／コンテンツを使用、ホスト、複製、変更、翻案、公開、表示、派生物の作成その他の方法で利用する、全世界的、ロイヤリティフリー、譲渡可能、再許諾可能、取消不能かつ永久のライセンスを付与します。あなたは、このライセンスを付与するために必要な権利を所有または管理し、フィードバック／コンテンツが他者の権利を侵害しないことを表明し、保証します。

## 第三者サービスとリンク

インターフェースおよび機能は、第三者のサイト、アプリケーション、サービス、プロトコルまたはコンテンツ（「第三者サービス」）と統合され、またはそれらへのリンクを含む場合があります。第三者サービスの利用はあなた自身のリスクで行い、その利用には第三者の規約およびプライバシーポリシーが適用されます。{{siteName}} は第三者サービスを管理、推奨または責任を負わず、利用から生じる損害についても責任を負いません。

## 補償

あなたは、{{siteName}}、そのライセンサーおよびそれぞれの役員、取締役、従業員、代表者（総称して「保護対象当事者」）を、(i)インターフェースまたは機能の利用もしくは誤用、(ii)本規約または適用法への違反、(iii)第三者との紛争、(iv)第三者の権利の実際のまたは申し立てられた侵害もしくは不正流用、または(v)フィードバック／コンテンツから生じる、または関連する一切の請求、要求、訴訟、調査、損害、損失、責任、費用および支出（合理的な弁護士費用を含む）について、防御し、補償し、免責することに同意します。上記に関する召喚状または強制命令を当社が受けた場合、対応に要した合理的な時間、資料および法的費用をあなたが償還します。

## 免責事項

インターフェースおよび機能は「現状有姿」かつ「利用可能な範囲」で提供されます。法律で認められる最大限の範囲で、{{siteNameUpper}} およびそのライセンサーは、商品性、特定目的への適合性、権利非侵害、正確性、平穏な享有、取引過程または商慣習から生じる保証を含む、明示または黙示のすべての保証を否認します。インターフェースまたは機能が中断されず、エラーなく、安全で、ウイルスに感染していないこと、またはコンテンツやデータが正確もしくは信頼できることを保証しません。

## 責任の制限

法律で認められる最大限の範囲で、(A){{siteNameUpper}} またはそのサービス提供者は、利益、収益、信用、データその他の無形損失の喪失を含む、間接的、付随的、特別、結果的、例示的または懲罰的損害について、その可能性を知らされていた場合でも一切責任を負わず、(B)インターフェースまたは機能に関連するすべての請求についての {{siteNameUpper}} の総責任は100米ドルを超えないものとします。これらの制限は、契約、不法行為（過失を含む）、厳格責任その他のいずれであるかを問わず、すべての請求原因に適用されます。

一部の法域では特定の責任免除または制限が認められません。その場合、上記は適用法で認められる最大限の範囲で適用されます。

## 準拠法、紛争解決、集団訴訟の放棄

- **準拠法。**本規約および本規約またはインターフェース、機能から生じる、またはそれらに関連する紛争や請求は、{{siteName}} が組織され、または主に事業を行う法域の法律に準拠し、抵触法の規則は考慮しません。
- **非公式の解決。**仲裁または訴訟を開始する前に、被害を受けた当事者は、請求内容と求める救済を記載した書面による通知を送付しなければなりません。当事者は、通知から45日以内に誠実に紛争解決を試みます。
- **強制仲裁。**非公式に解決されない紛争、請求または争いは、請求提出時に有効な規則に基づき、適用法域の信頼できる仲裁機関が管理する単独仲裁人による拘束力のある仲裁で最終的に解決されます。いずれの当事者も、管轄権を有する裁判所に仲裁を補助する暫定救済を求めることができます。あなたと {{siteName}} は陪審裁判を受ける権利を放棄します。
- **集団訴訟の放棄。**すべての手続は、当事者が個人として提起し、原告または集団、共同、併合もしくは代表訴訟の構成員として提起してはなりません。仲裁人は請求を併合したり、集団または代表手続を主宰したりできません。

裁判所が集団訴訟の放棄を執行不能と判断した場合、仲裁合意全体が無効となり、紛争は裁判所で進められます。

## 税金

あなたは、インターフェースまたは機能を通じた活動から生じる税務上の義務を判断して履行し、適用される税法および申告要件を遵守する単独の責任を負います。

## 終了

当社は、本規約または適用法への違反を当社が疑う場合を含め、いかなる理由でも、いつでもインターフェースまたは機能の一部または全部へのアクセスを停止または終了できます。終了時、インターフェースまたは機能を利用する権利は直ちに消滅します。終了後も存続することが意図された条項（所有権、補償、免責事項、責任の制限、準拠法または紛争解決、一般条項を含む）は終了後も存続します。

## 一般条項

- **完全合意。**本規約（参照により組み込まれる文書を含む）は、その対象事項に関するあなたと {{siteName}} 間の完全な合意であり、以前または同時期の理解に優先します。
- **代理関係なし。**本規約は、あなたと {{siteName}} の間にパートナーシップ、合弁事業、雇用または代理関係を生じさせません。
- **譲渡。**当社の事前の書面による同意なく、本規約または本規約上の権利を譲渡または移転できません。当社は本規約を制限なく譲渡または移転できます。
- **可分性、権利放棄。**いずれかの条項が無効または執行不能とされた場合も、残りの条項は完全に効力を維持します。当社が条項を執行しなかったことは、後に執行する権利の放棄ではありません。
- **救済。**当社の権利および救済は累積的であり、法律または衡平法上利用できる権利および救済に加えて適用されます。
- **連絡先。**インターフェースまたは機能に関する質問、苦情または請求は、インターフェース内に記載された連絡方法で行ってください。
$tos_ja$),
  ('ar', $tos_ar$
# شروط استخدام {{siteName}}

تحكم شروط الاستخدام هذه ("الشروط") وصولك إلى الواجهات والميزات التي تقدمها {{siteName}} واستخدامك لها.

## مقدمة

تحكم شروط الاستخدام هذه ("الشروط") كيفية وصولك، بصفتك الشخصية أو نيابة عن كيان، إلى الواجهات والمواقع والتطبيقات والميزات ذات الصلة المتاحة عبر {{siteUrl}} واستخدامها أو التفاعل معها بأي طريقة أخرى. تشمل الشروط أي سياسات أو مستندات تدمج هذه الشروط صراحةً بالإحالة، بالإضافة إلى سياسة الخصوصية الخاصة بنا (ويُشار إليها مجتمعةً باسم "الاتفاقية"). من خلال الوصول إلى أي واجهة أو موقع أو ميزة توفرها {{siteName}} أو استخدامها (ويُشار إليها مجتمعةً باسم "الواجهات" و"الميزات")، فإنك توافق على الالتزام بهذه الاتفاقية.

**تنبيه: يرجى قراءة هذه الشروط بعناية. من خلال الوصول إلى أي واجهة أو ميزة أو استخدامها (بما في ذلك ربط محفظة مستضافة ذاتياً أو إنشاء معرّف)، فإنك تقر بأنك قادر على إبرام اتفاقية ملزمة، وأنك قرأت هذه الشروط وفهمتها وتوافق على الالتزام بها، بما في ذلك التحكيم الملزم والتنازل عن الدعاوى الجماعية أدناه. إذا لم توافق، فلا تدخل إلى الواجهات أو الميزات ولا تستخدمها.**

## نطاق الواجهات والميزات ووصفها

- **ميزات المحتوى (اختيارية):** قد توفر بعض الواجهات محتوى معلوماتياً أو بيانات أو تعليقات حول الأسواق أو الأحداث أو موضوعات أخرى ("ميزات المحتوى"). تُقدَّم هذه المعلومات لأغراض معلوماتية عامة فقط ولا تشكل مشورة مالية أو قانونية أو ضريبية أو مهنية أخرى.
- **الميزات التقنية:** قد تتيح لك بعض الواجهات ربط محفظة عملات مشفرة مستضافة ذاتياً ("المحفظة") لبث المعاملات إلى شبكات بلوكتشين مدعومة والتفاعل، دون حفظ أو وصاية، مع العقود القائمة على الأحداث أو الآليات المماثلة على السلسلة ("العقود") (وتُسمى مع مكونات واجهة المستخدم ذات الصلة "الميزات التقنية").

أنت تقر بأن {{siteName}} لا تدير بورصة مركزية، ولا تقدم خدمات تنفيذ أو مقاصة التداول، ولا تستولي على أصولك أو تحفظها، ولا تتصرف نيابة عنك. وتُعد الأسعار أو بيانات السوق المعروضة عبر الواجهات معلوماتية ولا تمثل عرضاً أو طلباً أو توصية أو نصيحة.

عندما تختار ربط محفظة، فإنك تفهم وتوافق على ما يلي:

- أنت تتحكم في محفظتك وتتحمل وحدك مسؤولية حماية المفاتيح الخاصة وعبارات الاسترداد وكلمات المرور وإعدادات الأمان.
- لا تستطيع {{siteName}} الوصول إلى مفاتيحك الخاصة أو عكس المعاملات أو التحكم في نجاح أو نتيجة أي معاملة تبدأها أو ضمانهما أو تأكيدهما.
- قد تتطلب المعاملات رسوم شبكة غير قابلة للاسترداد، وتتحمل أنت وحدك مسؤوليتها.
- تدير أطراف ثالثة شبكات البلوكتشين وأي عقود أو بروتوكولات تتفاعل معها؛ لا تملك {{siteName}} هذه الجهات أو تتحكم فيها ولا تقدم أي وعود بشأن توافرها أو أمنها أو أدائها.

## الأهلية والعقوبات والولايات القضائية المحظورة

تقر وتضمن أن عمرك لا يقل عن 18 عاماً (أو سن الرشد في ولايتك القضائية) وأن لديك السلطة لإبرام هذه الاتفاقية. كما تقر وتضمن أنك لست:

- خاضعاً لعقوبات اقتصادية أو تجارية، وأنك تمتثل للقوانين المعمول بها لمكافحة غسل الأموال وتمويل الإرهاب.
- يصل إلى الميزات التقنية (بما في ذلك تداول العقود) أو يستخدمها أو يحاول استخدامها من ولاية قضائية يحظر فيها هذا النشاط ("الولايات القضائية المحظورة"). ودون تقييد ما سبق، لا يُسمح للأشخاص أو الكيانات المقيمين أو الموجودين أو المؤسسين أو الذين لديهم مكتب مسجل أو مقر أعمال رئيسي في ولاية قضائية يحظر قانونها المعمول به هذا الاستخدام، باستخدام الميزات التقنية للتداول.

كما تقر وتضمن أنك لن تستخدم شبكات VPN أو أدوات مماثلة للتحايل على الحجب الجغرافي أو ضوابط الوصول الأخرى.

إذا أصبحت أي من البيانات السابقة غير صحيحة، فيجب عليك التوقف فوراً عن الوصول إلى الميزات التقنية.

## إقراراتك ومخاطرك

- **معلومات فقط.** ميزات المحتوى لأغراض معلوماتية فقط؛ وينبغي لك التحقق من المعلومات بشكل مستقل قبل الاعتماد عليها.
- **لا نصيحة ولا واجب ائتماني.** لا يشكل أي شيء في الواجهات أو عبر الميزات نصيحة استثمارية أو قانونية أو ضريبية أو محاسبية أو مهنية أخرى، ولا ينشئ استخدامك للواجهات أو الميزات أي واجبات ائتمانية. اطلب مشورة مهنية مستقلة قبل اتخاذ القرارات.
- **تقنية تجريبية أو محفوفة بالمخاطر.** ينطوي التفاعل مع تقنية البلوكتشين على مخاطر كبيرة، بما في ذلك ثغرات العقود الذكية وأخطاء واجهة المستخدم أو تجربة المستخدم والاختراق والتصيد الاحتيالي وهجمات الهندسة الاجتماعية والتقلب والمعاملات غير القابلة للعكس. وقد تفقد بعض الأصول التي تستخدمها فيما يتصل بالعقود أو كلها.
- **بنية تحتية تابعة لجهات خارجية.** لا تتحكم {{siteName}} في شبكات البلوكتشين أو المدققين أو الأوراكل أو الجسور أو المفهرسين أو موفري RPC أو الخدمات الأخرى التابعة لجهات خارجية. وقد يؤثر التعطل أو الازدحام أو إعادة التنظيم أو الانقسامات أو غير ذلك في التوافر أو الوظائف.
- **حل العقود.** يتم حل العقود (إن أمكن) حصراً وفق قواعد السوق الخاصة وأي أوراكل تابع لجهة خارجية أو آلية نزاع مشار إليها في شروط السوق ذات الصلة. ولا تتحمل {{siteName}} مسؤولية نتائج الحل أو النزاعات بين المشاركين في السوق.

## التعديلات على الشروط والواجهات أو الميزات

يجوز لنا تحديث هذه الشروط وتعديل أي واجهة أو ميزة أو تعليقها أو إيقافها، كلياً أو جزئياً، وفقاً لتقديرنا، مع إشعار أو بدونه، بما في ذلك تقييد الوصول (على سبيل المثال، وضع الميزات في وضع الإغلاق فقط). ويُعد استمرارك في الاستخدام بعد سريان التغييرات قبولاً منك للشروط المحدثة. إذا لم توافق، فيجب عليك التوقف عن استخدام الواجهات والميزات.

## مسؤولياتك والسلوك المحظور

توافق على استخدام الواجهات والميزات بشكل قانوني ومناسب. ودون حصر، لا يجوز لك:

- انتهاك أي قانون أو لائحة أو أمر معمول به؛
- استخدام الميزات التقنية من ولاية قضائية محظورة أو لصالح شخص محظور أو نيابة عنه؛
- استخدام شبكات VPN أو أدوات مماثلة للتحايل على الحجب الجغرافي أو ضوابط الوصول؛
- تقديم معلومات كاذبة أو غير دقيقة أو مضللة؛
- التدخل في الواجهات أو الميزات أو تعطيلها أو إدخال برمجيات ضارة أو محاولة الوصول غير المصرح به؛
- استخراج البيانات عن طريق الكشط أو الجمع أو استخدام أدوات آلية (بما في ذلك الروبوتات أو برامج الزحف) إلا إذا كان ذلك مسموحاً به صراحةً؛
- إجراء هندسة عكسية للبرمجيات أو فك ترجمتها إلا بالقدر المحدود الذي يقتضيه القانون المعمول به؛
- منح ترخيص من الباطن للواجهات أو الميزات أو بيعها أو استغلالها تجارياً إلا إذا كان ذلك مسموحاً به صراحةً؛
- الانخراط في سلوك سوقي مسيء أو تلاعبي، بما في ذلك أوامر الخداع أو التطبقات أو التداول الوهمي أو الصفقات المرتبة مسبقاً أو السيطرة على السوق أو غيرها من الممارسات الخادعة أو المعطلة؛
- انتهاك حقوق الملكية الفكرية أو الحقوق الأخرى لأي شخص أو الاستيلاء عليها بشكل غير مشروع.

يجوز لنا التحقيق في الانتهاكات المشتبه بها واتخاذ أي إجراء نراه مناسباً، بما في ذلك تعليق الوصول أو إنهاؤه والتعاون مع جهات إنفاذ القانون.

## معلومات إضافية والتحقق

يجوز لنا أو لموردي الامتثال الذين يعملون نيابةً عنا طلب معلومات لتأكيد أهليتك (على سبيل المثال، أنك لست شخصاً محظوراً). وقد يؤدي عدم تقديم معلومات مرضية إلى رفض أو فقدان الوصول إلى بعض الميزات أو كلها.

## الملكية والترخيص وملاحظاتك ومحتواك

- **الملكية.** باستثناء الحقوق الممنوحة لك صراحةً، تحتفظ {{siteName}} والجهات المرخصة لها بجميع الحقوق والملكية والمصالح في الواجهات والميزات، بما في ذلك جميع حقوق الملكية الفكرية المرتبطة بها.
- **ترخيص محدود لك.** وفقاً لهذه الشروط، تمنحك {{siteName}} ترخيصاً شخصياً وقابلاً للإلغاء وغير حصري وغير قابل للتحويل أو لمنح ترخيص من الباطن للوصول إلى الواجهات والميزات المقدمة لك واستخدامها.
- **ملاحظاتك ومحتواك.** إذا قدمت ملاحظات أو اقتراحات أو طلبات دعم أو محتوى ("الملاحظات/المحتوى")، فإنك تمنح {{siteName}} ترخيصاً عالمياً وخالياً من حقوق الملكية وقابلاً للتحويل ولمنح تراخيص من الباطن وغير قابل للإلغاء ودائماً لاستخدام هذه الملاحظات/المحتوى واستضافتها ونسخها وتعديلها وتكييفها ونشرها وعرضها وإنشاء أعمال مشتقة منها واستغلالها بأي طريقة أخرى لأغراض تجارية (بما في ذلك تقديم الواجهات والميزات وتحسينها). وتقر وتضمن أنك تملك أو تتحكم في الحقوق اللازمة لمنح هذا الترخيص وأن ملاحظاتك/محتواك لا ينتهكان حقوق الآخرين.

## خدمات وروابط الجهات الخارجية

قد تتكامل الواجهات والميزات مع مواقع أو تطبيقات أو خدمات أو بروتوكولات أو محتوى تابع لجهات خارجية أو ترتبط بها ("خدمات الجهات الخارجية"). ويكون استخدامك لخدمات الجهات الخارجية على مسؤوليتك وحدك ويخضع لشروطها وسياسات الخصوصية الخاصة بها. ولا تتحكم {{siteName}} في خدمات الجهات الخارجية ولا تؤيدها أو تتحمل مسؤوليتها، كما لا تكون مسؤولة عن أي أضرار تنشأ عن استخدامك لها.

## التعويض

توافق على الدفاع عن {{siteName}} والجهات المرخصة لها ومسؤوليها ومديريها وموظفيها وممثليها (ويُشار إليهم مجتمعين باسم "الأطراف المحمية") وتعويضهم وإبراء ذمتهم من أي وجميع المطالبات والطلبات والدعاوى والتحقيقات والأضرار والخسائر والالتزامات والتكاليف والمصروفات (بما في ذلك أتعاب المحامين المعقولة) الناشئة عن أو المتعلقة بـ: (1) استخدامك للواجهات أو الميزات أو إساءة استخدامها؛ (2) انتهاكك لهذه الشروط أو للقانون المعمول به؛ (3) نزاعاتك مع أي طرف ثالث؛ (4) انتهاكك الفعلي أو المزعوم لحقوق أي طرف ثالث أو الاستيلاء عليها؛ أو (5) ملاحظاتك/محتواك. وإذا تلقينا مذكرة استدعاء أو أمراً إلزامياً يتعلق بما سبق، فسوف تسدد الوقت والمواد والمصروفات القانونية المعقولة التي تكبدناها للرد.

## إخلاء المسؤولية

تُقدَّم الواجهات والميزات "كما هي" و"حسب التوافر". وإلى أقصى حد يسمح به القانون، تخلي {{siteNameUpper}} والجهات المرخصة لها مسؤوليتها عن جميع الضمانات الصريحة أو الضمنية، بما في ذلك القابلية للتسويق والملاءمة لغرض معين وعدم الانتهاك والدقة والتمتع الهادئ وأي ضمانات ناشئة عن التعامل أو العرف التجاري. ولا نضمن أن تكون الواجهات أو الميزات دون انقطاع أو أخطاء أو آمنة أو خالية من الفيروسات، أو أن يكون أي محتوى أو بيانات دقيقاً أو موثوقاً.

## تحديد المسؤولية

إلى أقصى حد يسمح به القانون: (أ) لن تكون {{siteNameUpper}} أو مقدمو خدماتها بأي حال مسؤولين عن أي أضرار غير مباشرة أو عرضية أو خاصة أو تبعية أو نموذجية أو عقابية، أو عن أي خسارة في الأرباح أو الإيرادات أو السمعة أو البيانات أو غيرها من الخسائر غير الملموسة، حتى إذا تم إخطارهم بإمكانية حدوث تلك الأضرار؛ و(ب) لن تتجاوز المسؤولية الإجمالية لـ {{siteNameUpper}} عن جميع المطالبات المتعلقة بالواجهات أو الميزات 100 دولار أمريكي. وتسري هذه القيود على جميع أسباب الدعوى، سواء كانت تعاقدية أو تقصيرية (بما في ذلك الإهمال) أو قائمة على المسؤولية الصارمة أو غير ذلك.

لا تسمح بعض الولايات القضائية باستثناءات أو قيود معينة على المسؤولية؛ وفي هذه الحالات، يسري ما سبق إلى أقصى حد يسمح به القانون المعمول به.

## القانون الحاكم وتسوية المنازعات والتنازل عن الدعاوى الجماعية

- **القانون الحاكم.** تخضع هذه الشروط وأي نزاع أو مطالبة ناشئة عنها أو عن الواجهات أو الميزات أو متعلقة بها لقوانين الولاية القضائية التي تأسست فيها {{siteName}} أو تمارس فيها أعمالها الرئيسية، دون اعتبار لقواعد تنازع القوانين.
- **التسوية غير الرسمية.** قبل بدء التحكيم أو التقاضي، يجب على الطرف المتضرر إرسال إشعار كتابي يصف المطالبة وسبل الانتصاف المطلوبة. وسيحاول الطرفان بحسن نية حل النزاع خلال 45 يوماً من الإشعار.
- **التحكيم الإلزامي.** تتم تسوية أي نزاع أو مطالبة أو خلاف لم تتم تسويته بشكل غير رسمي نهائياً عن طريق تحكيم ملزم أمام محكم واحد تديره مؤسسة تحكيم ذات سمعة في الولاية القضائية الحاكمة وبموجب قواعدها السارية عند تقديم المطالبة. ويجوز لأي طرف طلب تدابير مؤقتة مساعدة للتحكيم من محكمة مختصة. وتتنازل أنت و{{siteName}} عن أي حق في المحاكمة أمام هيئة محلفين.
- **التنازل عن الدعاوى الجماعية.** يجب رفع جميع الإجراءات بصفتها الفردية للأطراف، وليس بصفتها مدعياً أو عضواً في أي دعوى جماعية أو مشتركة أو موحدة أو تمثيلية مزعومة. ولا يجوز للمحكم توحيد المطالبات أو ترؤس أي إجراء جماعي أو تمثيلي.

إذا وجدت محكمة أن التنازل عن الدعوى الجماعية غير قابل للإنفاذ، فسيصبح اتفاق التحكيم بأكمله باطلاً، وستستمر المنازعة أمام المحكمة.

## الضرائب

أنت وحدك مسؤول عن تحديد والوفاء بأي التزامات ضريبية ناشئة عن أنشطتك عبر الواجهات أو الميزات وعن الامتثال لقوانين الضرائب ومتطلبات الإبلاغ المعمول بها.

## الإنهاء

يجوز لنا تعليق أو إنهاء وصولك إلى بعض الواجهات أو الميزات أو كلها في أي وقت ولأي سبب، بما في ذلك إذا اعتقدنا أنك انتهكت هذه الشروط أو القانون المعمول به. عند الإنهاء، ينتهي فوراً حقك في استخدام الواجهات أو الميزات. وتستمر بعد الإنهاء الأقسام المقصود استمرارها (بما في ذلك الملكية والتعويض وإخلاءات المسؤولية وتحديد المسؤولية والقانون الحاكم أو تسوية المنازعات والشروط العامة).

## الشروط العامة

- **الاتفاق الكامل.** تشكل هذه الشروط (بما في ذلك المستندات المدمجة بالإحالة) الاتفاق الكامل بينك وبين {{siteName}} بشأن موضوعها وتحل محل جميع التفاهمات السابقة أو المتزامنة.
- **عدم وجود وكالة.** لا تنشئ هذه الشروط أي شراكة أو مشروع مشترك أو علاقة عمل أو وكالة بينك وبين {{siteName}}.
- **التنازل.** لا يجوز لك التنازل عن هذه الشروط أو نقلها أو عن أي حقوق بموجبها دون موافقتنا الكتابية المسبقة. ويجوز لنا التنازل عن هذه الشروط أو نقلها دون قيود.
- **قابلية الفصل والتنازل.** إذا اعتبر أي حكم باطلاً أو غير قابل للإنفاذ، تظل الأحكام المتبقية سارية بالكامل. ولا يُعد عدم إنفاذنا لأي حكم تنازلاً عن حقنا في إنفاذه لاحقاً.
- **سبل الانتصاف.** حقوقنا وسبل انتصافنا تراكمية وتضاف إلى جميع الحقوق وسبل الانتصاف المتاحة بموجب القانون أو الإنصاف.
- **الاتصال.** يجب توجيه الأسئلة أو الشكاوى أو المطالبات المتعلقة بالواجهات أو الميزات عبر وسيلة الاتصال المتاحة داخل الواجهة.
$tos_ar$),
  ('ru', $tos_ru$
# Условия использования {{siteName}}

Настоящие Условия использования («Условия») регулируют ваш доступ к интерфейсам и функциям, предоставляемым {{siteName}}, и их использование.

## Введение

Настоящие Условия использования («Условия») определяют, каким образом вы лично или от имени организации можете получать доступ к интерфейсам, веб-сайтам, приложениям и связанным функциям, доступным через {{siteUrl}}, использовать их или иным образом взаимодействовать с ними. Условия включают любые политики или документы, прямо включающие настоящие Условия посредством ссылки, а также нашу Политику конфиденциальности (совместно — «Соглашение»). Получая доступ к любой интерфейсной части, веб-сайту или функции, предоставляемой {{siteName}}, либо используя их (совместно — «Интерфейсы» и «Функции»), вы соглашаетесь соблюдать это Соглашение.

**ВНИМАНИЕ: ВНИМАТЕЛЬНО ПРОЧИТАЙТЕ ЭТИ УСЛОВИЯ. ПОЛУЧАЯ ДОСТУП К ЛЮБОМУ ИНТЕРФЕЙСУ ИЛИ ФУНКЦИИ ИЛИ ИСПОЛЬЗУЯ ИХ (ВКЛЮЧАЯ ПОДКЛЮЧЕНИЕ КОШЕЛЬКА ПОД ВАШИМ КОНТРОЛЕМ ИЛИ СОЗДАНИЕ ИДЕНТИФИКАТОРА), ВЫ ЗАЯВЛЯЕТЕ, ЧТО МОЖЕТЕ ЗАКЛЮЧИТЬ ОБЯЗАТЕЛЬНОЕ СОГЛАШЕНИЕ, А ТАКЖЕ ПРОЧИТАЛИ, ПОНЯЛИ И СОГЛАСНЫ СОБЛЮДАТЬ ЭТИ УСЛОВИЯ, ВКЛЮЧАЯ ПРИВЕДЁННЫЕ НИЖЕ ОБЯЗАТЕЛЬНЫЙ АРБИТРАЖ И ОТКАЗ ОТ КОЛЛЕКТИВНЫХ ИСКОВ. ЕСЛИ ВЫ НЕ СОГЛАСНЫ, НЕ ПОЛУЧАЙТЕ ДОСТУП К ИНТЕРФЕЙСАМ И ФУНКЦИЯМ И НЕ ИСПОЛЬЗУЙТЕ ИХ.**

## Область действия и описание Интерфейсов и Функций

- **Контентные функции (необязательно):** некоторые Интерфейсы могут предоставлять информационные материалы, данные или комментарии о рынках, событиях или других темах («Контентные функции»). Такая информация предоставляется исключительно в общих информационных целях и не является финансовой, юридической, налоговой или иной профессиональной консультацией.
- **Технологические функции:** некоторые Интерфейсы могут позволять подключить криптовалютный кошелёк под вашим контролем («Кошелёк») для передачи транзакций в поддерживаемые блокчейн-сети и некастодиального взаимодействия с контрактами, основанными на событиях, или аналогичными механизмами в блокчейне («Контракты») (вместе с соответствующими компонентами интерфейса — «Технологические функции»).

Вы признаёте, что {{siteName}} не управляет централизованной биржей, не предоставляет услуги исполнения или клиринга сделок, не принимает ваши активы во владение или на хранение и не действует от вашего имени. Цены и рыночные данные, отображаемые в Интерфейсах, носят информационный характер и не являются предложением, приглашением, рекомендацией или советом.

Если вы подключаете Кошелёк, вы понимаете и соглашаетесь, что:

- вы контролируете свой Кошелёк и несёте исключительную ответственность за защиту приватных ключей, seed-фраз, паролей и настроек безопасности;
- {{siteName}} не может получить доступ к вашим приватным ключам, отменить транзакции, контролировать, гарантировать или обеспечить успех либо результат инициированной вами транзакции;
- для транзакций могут требоваться невозвратные сетевые комиссии, за которые отвечаете только вы;
- блокчейн-сети, а также любые контракты или протоколы, с которыми вы взаимодействуете, управляются третьими лицами; {{siteName}} не владеет ими и не контролирует их и не даёт обещаний относительно их доступности, безопасности или производительности.

## Право на использование; санкции; ограниченные юрисдикции

Вы заявляете и гарантируете, что вам исполнилось 18 лет (или вы достигли совершеннолетия в вашей юрисдикции) и вы имеете полномочия заключить это Соглашение. Вы также заявляете и гарантируете, что вы не:

- являетесь объектом экономических или торговых санкций и соблюдаете применимые законы о противодействии отмыванию денег и финансированию терроризма;
- получаете доступ к Технологическим функциям (включая торговлю Контрактами), используете их или пытаетесь использовать из юрисдикции, где такая деятельность запрещена («Ограниченные юрисдикции»). В частности, лица или организации, проживающие, находящиеся, зарегистрированные, имеющие зарегистрированный офис или основное место деятельности в юрисдикции, где применимое право запрещает такое использование, не вправе использовать Технологические функции для торговли.

Вы также заявляете и гарантируете, что не будете использовать VPN или аналогичные инструменты для обхода геоблокировки или иных средств контроля доступа.

Если какое-либо из приведённых выше утверждений перестанет быть верным, вы должны немедленно прекратить доступ к Технологическим функциям.

## Ваши подтверждения; риски

- **Только информация.** Контентные функции предназначены только для информационных целей; прежде чем полагаться на информацию, вы должны самостоятельно её проверить.
- **Нет консультаций или фидуциарных обязанностей.** Ничто в Интерфейсах или Функциях не является инвестиционной, юридической, налоговой, бухгалтерской или иной профессиональной консультацией, а использование Интерфейсов или Функций не создаёт фидуциарных обязанностей. Перед принятием решений обратитесь за независимой профессиональной консультацией.
- **Экспериментальная или рискованная технология.** Взаимодействие с блокчейн-технологиями сопряжено со значительными рисками, включая уязвимости смарт-контрактов, ошибки интерфейса или пользовательского опыта, взломы, фишинг, атаки социальной инженерии, волатильность и необратимые транзакции. Вы можете потерять часть или все активы, используемые в связи с Контрактами.
- **Инфраструктура третьих лиц.** {{siteName}} не контролирует блокчейн-сети, валидаторов, оракулы, мосты, индексаторы, RPC-провайдеров и другие сторонние сервисы. Сбои, перегрузки, реорганизации, форки и другие проблемы могут повлиять на доступность или функциональность.
- **Разрешение Контрактов.** Разрешение Контрактов (если применимо) осуществляется исключительно по правилам конкретного рынка и с использованием стороннего оракула или механизма разрешения споров, указанного в соответствующих условиях рынка. {{siteName}} не отвечает за результаты разрешения или споры между участниками рынка.

## Изменения Условий, Интерфейсов или Функций

Мы можем по своему усмотрению обновлять настоящие Условия, изменять, приостанавливать или прекращать работу любого Интерфейса или Функции полностью или частично, с уведомлением или без него, включая ограничение доступа (например, перевод Функций в режим только закрытия). Продолжение использования после вступления изменений в силу означает принятие обновлённых Условий. Если вы не согласны, вы должны прекратить использование Интерфейсов и Функций.

## Ваши обязанности и запрещённое поведение

Вы соглашаетесь использовать Интерфейсы и Функции законно и надлежащим образом. В частности, вы не должны:

- нарушать применимое законодательство, нормативные акты или распоряжения;
- использовать Технологические функции из Ограниченной юрисдикции либо для ограниченного лица или от его имени;
- использовать VPN или аналогичные средства для обхода геоблокировки или контроля доступа;
- предоставлять ложную, неточную или вводящую в заблуждение информацию;
- мешать работе Интерфейсов или Функций, внедрять вредоносные программы или пытаться получить несанкционированный доступ;
- собирать или извлекать данные с помощью скрейпинга или автоматизированных средств (включая ботов и краулеров), кроме случаев, прямо разрешённых;
- осуществлять обратную разработку или декомпиляцию программного обеспечения, кроме ограниченной степени, требуемой применимым правом;
- сублицензировать, продавать или коммерчески использовать Интерфейсы или Функции, кроме случаев, прямо разрешённых;
- заниматься злоупотребляющим или манипулятивным поведением на рынке, включая spoofing, layering, wash trading, заранее согласованные сделки, cornering и иные обманные или деструктивные практики;
- нарушать или незаконно присваивать интеллектуальную собственность или иные права любого лица.

Мы можем расследовать предполагаемые нарушения и принимать любые меры, которые сочтём уместными, включая приостановку или прекращение доступа и сотрудничество с правоохранительными органами.

## Дополнительная информация; проверка

Мы или действующие от нашего имени поставщики услуг по соблюдению требований можем запрашивать информацию для подтверждения вашей правоспособности (например, что вы не являетесь ограниченным лицом). Непредоставление удовлетворительной информации может привести к отказу или потере доступа к некоторым или всем Функциям.

## Право собственности; лицензия; ваши отзывы и контент

- **Право собственности.** За исключением прямо предоставленных вам прав, {{siteName}} и его лицензиары сохраняют все права, титулы и интересы в отношении Интерфейсов и Функций, включая связанную с ними интеллектуальную собственность.
- **Ограниченная лицензия для вас.** С учётом настоящих Условий {{siteName}} предоставляет вам личную, отзывную, неисключительную, непередаваемую и не подлежащую сублицензированию лицензию на доступ к предоставленным вам Интерфейсам и Функциям и их использование.
- **Ваши отзывы и контент.** Если вы направляете отзывы, предложения, обращения в поддержку или контент («Отзывы/Контент»), вы предоставляете {{siteName}} всемирную, безвозмездную, передаваемую, сублицензируемую, безотзывную и бессрочную лицензию использовать, размещать, воспроизводить, изменять, адаптировать, публиковать, отображать, создавать производные произведения и иным образом использовать такие Отзывы/Контент в коммерческих целях (включая предоставление и улучшение Интерфейсов и Функций). Вы заявляете и гарантируете, что владеете необходимыми правами или контролируете их для предоставления этой лицензии и что ваши Отзывы/Контент не нарушают права других лиц.

## Сторонние сервисы и ссылки

Интерфейсы и Функции могут интегрироваться со сторонними сайтами, приложениями, сервисами, протоколами или контентом либо ссылаться на них («Сторонние сервисы»). Вы используете Сторонние сервисы на свой риск и в соответствии с их условиями и политиками конфиденциальности. {{siteName}} не контролирует и не одобряет Сторонние сервисы, не несёт за них ответственности и не отвечает за ущерб, возникший в результате их использования.

## Возмещение убытков

Вы соглашаетесь защищать, возмещать ущерб и ограждать от ответственности {{siteName}}, его лицензиаров, а также их соответствующих должностных лиц, директоров, сотрудников и представителей (совместно — «Защищённые стороны») от любых претензий, требований, исков, расследований, ущерба, потерь, обязательств, расходов и затрат (включая разумные гонорары адвокатов), возникающих из или в связи с: (i) использованием или неправильным использованием вами Интерфейсов или Функций; (ii) нарушением вами настоящих Условий или применимого права; (iii) вашими спорами с третьими лицами; (iv) фактическим или предполагаемым нарушением либо незаконным присвоением прав третьих лиц; или (v) вашими Отзывами/Контентом. Если мы получим повестку или обязательное распоряжение по указанным вопросам, вы возместите разумные затраты времени, материалов и юридические расходы на ответ.

## Отказ от гарантий

ИНТЕРФЕЙСЫ И ФУНКЦИИ ПРЕДОСТАВЛЯЮТСЯ «КАК ЕСТЬ» И «ПО МЕРЕ ДОСТУПНОСТИ». В МАКСИМАЛЬНОЙ СТЕПЕНИ, ДОПУСТИМОЙ ЗАКОНОМ, {{siteNameUpper}} И ЕГО ЛИЦЕНЗИАРЫ ОТКАЗЫВАЮТСЯ ОТ ВСЕХ ЯВНЫХ ИЛИ ПОДРАЗУМЕВАЕМЫХ ГАРАНТИЙ, ВКЛЮЧАЯ ТОВАРНУЮ ПРИГОДНОСТЬ, ПРИГОДНОСТЬ ДЛЯ КОНКРЕТНОЙ ЦЕЛИ, НЕНАРУШЕНИЕ ПРАВ, ТОЧНОСТЬ, СПОКОЙНОЕ ПОЛЬЗОВАНИЕ И ЛЮБЫЕ ГАРАНТИИ, ВОЗНИКАЮЩИЕ ИЗ ДЕЛОВЫХ ОТНОШЕНИЙ ИЛИ ТОРГОВОЙ ПРАКТИКИ. МЫ НЕ ГАРАНТИРУЕМ, ЧТО ИНТЕРФЕЙСЫ ИЛИ ФУНКЦИИ БУДУТ БЕСПЕРЕБОЙНЫМИ, БЕЗОШИБОЧНЫМИ, БЕЗОПАСНЫМИ ИЛИ НЕЗАРАЖЁННЫМИ ВИРУСАМИ, А ТАКЖЕ ЧТО ЛЮБОЙ КОНТЕНТ ИЛИ ДАННЫЕ БУДУТ ТОЧНЫМИ ИЛИ НАДЁЖНЫМИ.

## Ограничение ответственности

В МАКСИМАЛЬНОЙ СТЕПЕНИ, ДОПУСТИМОЙ ЗАКОНОМ: (A) {{siteNameUpper}} ИЛИ ЕГО ПОСТАВЩИКИ УСЛУГ НИ ПРИ КАКИХ ОБСТОЯТЕЛЬСТВАХ НЕ НЕСУТ ОТВЕТСТВЕННОСТИ ЗА КОСВЕННЫЕ, СЛУЧАЙНЫЕ, ОСОБЫЕ, ПОСЛЕДУЮЩИЕ, ПРИМЕРНЫЕ ИЛИ ШТРАФНЫЕ УБЫТКИ, А ТАКЖЕ ЗА УТРАТУ ПРИБЫЛИ, ДОХОДА, ДЕЛОВОЙ РЕПУТАЦИИ, ДАННЫХ ИЛИ ИНЫЕ НЕМАТЕРИАЛЬНЫЕ ПОТЕРИ, ДАЖЕ ЕСЛИ О ВОЗМОЖНОСТИ ТАКИХ УБЫТКОВ БЫЛО СООБЩЕНО; И (B) СОВОКУПНАЯ ОТВЕТСТВЕННОСТЬ {{siteNameUpper}} ПО ВСЕМ ПРЕТЕНЗИЯМ, СВЯЗАННЫМ С ИНТЕРФЕЙСАМИ ИЛИ ФУНКЦИЯМИ, НЕ ПРЕВЫШАЕТ 100 ДОЛЛАРОВ США. ЭТИ ОГРАНИЧЕНИЯ ПРИМЕНЯЮТСЯ КО ВСЕМ ОСНОВАНИЯМ ИСКА, БУДЬ ТО ДОГОВОР, ДЕЛИКТ (ВКЛЮЧАЯ НЕБРЕЖНОСТЬ), СТРОГАЯ ОТВЕТСТВЕННОСТЬ ИЛИ ИНОЕ.

Некоторые юрисдикции не допускают определённых исключений или ограничений ответственности; в таких случаях приведённое выше применяется в максимально допустимой применимым правом степени.

## Применимое право; разрешение споров; отказ от коллективных исков

- **Применимое право.** Настоящие Условия и любые споры или претензии, возникающие из них или из Интерфейсов и Функций либо связанные с ними, регулируются законодательством юрисдикции, в которой зарегистрирован {{siteName}} или где он преимущественно ведёт деятельность, без учёта коллизионных норм.
- **Неформальное разрешение.** До начала арбитража или судебного разбирательства потерпевшая сторона должна направить письменное уведомление с описанием претензии и желаемого способа защиты. Стороны добросовестно попытаются разрешить спор в течение 45 дней с даты уведомления.
- **Обязательный арбитраж.** Любой спор, претензия или разногласие, не разрешённые неформально, окончательно разрешаются обязательным арбитражем перед одним арбитром, организованным авторитетным арбитражным учреждением в применимой юрисдикции по его правилам, действующим на момент подачи претензии. Любая сторона может обратиться в компетентный суд за временными мерами в поддержку арбитража. Вы и {{siteName}} отказываетесь от права на суд присяжных.
- **Отказ от коллективных исков.** Все производства должны возбуждаться сторонами в индивидуальном качестве, а не в качестве истца или участника предполагаемого коллективного, группового, объединённого или представительского иска. Арбитр не может объединять претензии или председательствовать в коллективном либо представительском производстве.

Если суд признает отказ от коллективного иска неисполнимым, арбитражное соглашение полностью утрачивает силу, и спор рассматривается в суде.

## Налоги

Вы несёте исключительную ответственность за определение и исполнение любых налоговых обязательств, возникающих в связи с вашей деятельностью через Интерфейсы или Функции, а также за соблюдение применимого налогового законодательства и требований к отчётности.

## Прекращение действия

Мы можем в любое время и по любой причине приостановить или прекратить ваш доступ к некоторым или всем Интерфейсам или Функциям, в том числе если считаем, что вы нарушили настоящие Условия или применимое право. После прекращения ваше право использовать Интерфейсы или Функции немедленно прекращается. Положения, которые должны сохранять действие (включая Право собственности, Возмещение убытков, Отказ от гарантий, Ограничение ответственности, Применимое право или Разрешение споров и Общие условия), сохраняют силу.

## Общие условия

- **Полное соглашение.** Настоящие Условия (включая документы, включённые посредством ссылки) представляют собой полное соглашение между вами и {{siteName}} по предмету и заменяют все предыдущие или одновременные договорённости.
- **Отсутствие агентских отношений.** Ничто в настоящих Условиях не создаёт партнёрства, совместного предприятия, трудовых или агентских отношений между вами и {{siteName}}.
- **Передача.** Вы не можете передавать или уступать настоящие Условия или любые права по ним без нашего предварительного письменного согласия. Мы можем передавать или уступать настоящие Условия без ограничений.
- **Делимость; отказ от права.** Если какое-либо положение признано недействительным или неисполнимым, остальные положения сохраняют полную силу. Неприменение нами какого-либо положения не означает отказа от права применить его позднее.
- **Средства защиты.** Наши права и средства защиты являются совокупными и дополняют все права и средства защиты, доступные по закону или праву справедливости.
- **Контакты.** Вопросы, жалобы или претензии в отношении Интерфейсов или Функций следует направлять через способ связи, указанный в Интерфейсе.
$tos_ru$),
  ('it', $tos_it$
# Termini di utilizzo di {{siteName}}

I presenti Termini di utilizzo (i "Termini") regolano l'accesso e l'utilizzo delle Interfacce e delle Funzionalità offerte da {{siteName}}.

## Introduzione

I presenti Termini di utilizzo (i "Termini") regolano il modo in cui l'utente, personalmente o per conto di un'entità, può accedere, utilizzare o interagire in altro modo con le interfacce, i siti web, le applicazioni e le funzionalità correlate rese disponibili tramite {{siteUrl}}. I Termini includono qualsiasi politica o documento che incorpori espressamente i presenti Termini mediante riferimento, nonché la nostra Informativa sulla privacy (collettivamente, l'"Accordo"). Accedendo a qualsiasi interfaccia, sito web o funzionalità forniti da {{siteName}}, o utilizzandoli (collettivamente, le "Interfacce" e le "Funzionalità"), l'utente accetta di essere vincolato dal presente Accordo.

**AVVISO: LEGGERE ATTENTAMENTE I PRESENTI TERMINI. ACCEDENDO A QUALSIASI INTERFACCIA O FUNZIONALITÀ, O UTILIZZANDOLA (INCLUSO IL COLLEGAMENTO DI UN WALLET AUTOGESTITO O LA CREAZIONE DI UN IDENTIFICATIVO), L'UTENTE DICHIARA DI POTER CONCLUDERE UN ACCORDO VINCOLANTE E DI AVER LETTO, COMPRESO E ACCETTATO DI ESSERE VINCOLATO DAI PRESENTI TERMINI, INCLUSI L'ARBITRATO VINCOLANTE E LA RINUNCIA ALLE AZIONI COLLETTIVE RIPORTATI DI SEGUITO. SE NON ACCETTA, NON ACCEDA ALLE INTERFACCE O FUNZIONALITÀ E NON LE UTILIZZI.**

## Ambito e descrizione delle Interfacce e delle Funzionalità

- **Funzionalità di contenuto (facoltative):** alcune Interfacce possono fornire contenuti informativi, dati o commenti su mercati, eventi o altri argomenti (le "Funzionalità di contenuto"). Tali informazioni sono fornite esclusivamente a fini informativi generali e non costituiscono consulenza finanziaria, legale, fiscale o di altro tipo professionale.
- **Funzionalità tecnologiche:** alcune Interfacce possono consentire di collegare un wallet di criptovalute autogestito (il "Wallet") per trasmettere transazioni a reti blockchain supportate e interagire in modalità non custodial con contratti basati su eventi o meccanismi on-chain simili (i "Contratti") (insieme ai relativi componenti dell'interfaccia utente, le "Funzionalità tecnologiche").

L'utente riconosce che {{siteName}} non gestisce un exchange centralizzato, non fornisce servizi di esecuzione o compensazione delle operazioni, non prende possesso né custodia dei suoi asset e non agisce per suo conto. I prezzi o i dati di mercato visualizzati tramite le Interfacce hanno carattere informativo e non costituiscono un'offerta, una sollecitazione, una raccomandazione o una consulenza.

Quando sceglie di collegare un Wallet, comprende e accetta che:

- controlla il proprio Wallet ed è l'unico responsabile della protezione delle chiavi private, delle frasi seed, delle password e delle impostazioni di sicurezza;
- {{siteName}} non può accedere alle chiavi private, annullare le transazioni né controllare, garantire o assicurare il successo o l'esito di una transazione avviata dall'utente;
- le transazioni possono richiedere commissioni di rete non rimborsabili, che sono esclusivamente a suo carico;
- le reti blockchain e qualsiasi contratto o protocollo con cui interagisce sono gestiti da terze parti; {{siteName}} non li possiede né li controlla e non offre garanzie sulla loro disponibilità, sicurezza o prestazioni.

## Idoneità; sanzioni; giurisdizioni soggette a restrizioni

L'utente dichiara e garantisce di avere almeno 18 anni (o di aver raggiunto la maggiore età nella propria giurisdizione) e di avere l'autorità per concludere il presente Accordo. Dichiara e garantisce inoltre di non essere:

- soggetto a sanzioni economiche o commerciali e di rispettare le leggi applicabili contro il riciclaggio di denaro e il finanziamento del terrorismo;
- una persona che accede, utilizza o tenta di utilizzare le Funzionalità tecnologiche (incluso il trading di Contratti) da una giurisdizione in cui tale attività è vietata (le "Giurisdizioni soggette a restrizioni"). Fatto salvo quanto sopra, le persone o entità residenti, situate, costituite, con sede legale o principale luogo di attività in una giurisdizione in cui la legge applicabile vieta tale utilizzo non possono usare le Funzionalità tecnologiche per fare trading.

L'utente dichiara e garantisce inoltre che non utilizzerà VPN o strumenti simili per eludere il geoblocking o altri controlli di accesso.

Se una delle dichiarazioni precedenti diventa falsa, deve interrompere immediatamente l'accesso alle Funzionalità tecnologiche.

## Riconoscimenti e rischi

- **Solo informazioni.** Le Funzionalità di contenuto hanno esclusivamente finalità informative; è necessario verificare autonomamente le informazioni prima di farvi affidamento.
- **Nessuna consulenza o responsabilità fiduciaria.** Nulla nelle Interfacce o nelle Funzionalità costituisce consulenza in materia di investimenti, diritto, tasse, contabilità o altro ambito professionale, e il loro utilizzo non crea obblighi fiduciari. Prima di prendere decisioni, rivolgersi a un professionista indipendente.
- **Tecnologia sperimentale o rischiosa.** L'interazione con la tecnologia blockchain comporta rischi significativi, tra cui vulnerabilità degli smart contract, bug dell'interfaccia o dell'esperienza utente, attacchi informatici, phishing, attacchi di ingegneria sociale, volatilità e transazioni irreversibili. È possibile perdere parte o tutti gli asset utilizzati in relazione ai Contratti.
- **Infrastruttura di terze parti.** {{siteName}} non controlla reti blockchain, validatori, oracoli, bridge, indicizzatori, fornitori RPC o altri servizi di terze parti. Interruzioni, congestione, riorganizzazioni, fork o altri problemi possono influire sulla disponibilità o sulle funzionalità.
- **Risoluzione dei Contratti.** La risoluzione dei Contratti (se applicabile) avviene esclusivamente secondo le regole specifiche del mercato e qualsiasi oracolo di terze parti o meccanismo di controversia indicato nei termini del mercato pertinente. {{siteName}} non è responsabile degli esiti della risoluzione né delle controversie tra i partecipanti al mercato.

## Modifiche ai Termini e alle Interfacce o Funzionalità

Possiamo aggiornare i presenti Termini e modificare, sospendere o interrompere qualsiasi Interfaccia o Funzionalità, in tutto o in parte, a nostra discrezione, con o senza preavviso, inclusa la limitazione dell'accesso (ad esempio mettendo le Funzionalità in modalità di sola chiusura). Il continuo utilizzo dopo l'entrata in vigore delle modifiche costituisce accettazione dei Termini aggiornati. Se non accetta, deve smettere di utilizzare le Interfacce e le Funzionalità.

## Responsabilità dell'utente e condotte vietate

L'utente accetta di utilizzare le Interfacce e le Funzionalità in modo lecito e appropriato. In particolare, non deve:

- violare leggi, regolamenti o ordini applicabili;
- utilizzare le Funzionalità tecnologiche da una Giurisdizione soggetta a restrizioni o per conto di una persona soggetta a restrizioni;
- utilizzare VPN o strumenti simili per eludere il geoblocking o i controlli di accesso;
- fornire informazioni false, inesatte o fuorvianti;
- interferire con le Interfacce o le Funzionalità, introdurre malware o tentare di ottenere accesso non autorizzato;
- raccogliere o estrarre dati tramite scraping, harvesting o strumenti automatizzati (inclusi bot o crawler), salvo espressa autorizzazione;
- effettuare reverse engineering o decompilare software, salvo nella misura limitata richiesta dalla legge applicabile;
- concedere in sublicenza, vendere o sfruttare commercialmente le Interfacce o le Funzionalità, salvo espressa autorizzazione;
- porre in essere comportamenti di mercato abusivi o manipolativi, inclusi spoofing, layering, wash trading, operazioni preordinate, cornering o altre pratiche ingannevoli o destabilizzanti;
- violare o appropriarsi indebitamente della proprietà intellettuale o di altri diritti di chiunque.

Possiamo indagare sulle violazioni sospette e adottare qualsiasi provvedimento ritenuto appropriato, inclusa la sospensione o cessazione dell'accesso e la collaborazione con le autorità.

## Informazioni aggiuntive e verifica

Noi o i fornitori di servizi di compliance che agiscono per nostro conto possiamo richiedere informazioni per confermare l'idoneità dell'utente (ad esempio, che non sia una persona soggetta a restrizioni). La mancata fornitura di informazioni soddisfacenti può comportare il rifiuto o la perdita dell'accesso ad alcune o tutte le Funzionalità.

## Proprietà, licenza, feedback e contenuti dell'utente

- **Proprietà.** Fatti salvi i diritti espressamente concessi, {{siteName}} e i suoi licenzianti mantengono ogni diritto, titolo e interesse sulle Interfacce e sulle Funzionalità, inclusa tutta la proprietà intellettuale associata.
- **Licenza limitata all'utente.** Nel rispetto dei presenti Termini, {{siteName}} concede una licenza personale, revocabile, non esclusiva, non trasferibile e non sublicenziabile per accedere alle Interfacce e alle Funzionalità fornite e utilizzarle.
- **Feedback e contenuti dell'utente.** Se invia feedback, suggerimenti, richieste di supporto o contenuti ("Feedback/Contenuti"), concede a {{siteName}} una licenza mondiale, gratuita, trasferibile, sublicenziabile, irrevocabile e perpetua per utilizzare, ospitare, riprodurre, modificare, adattare, pubblicare, visualizzare, creare opere derivate e sfruttare altrimenti tali Feedback/Contenuti per finalità aziendali (inclusa la fornitura e il miglioramento delle Interfacce e delle Funzionalità). Dichiara e garantisce di possedere o controllare i diritti necessari a concedere questa licenza e che i Feedback/Contenuti non violano i diritti altrui.

## Servizi e link di terze parti

Le Interfacce e le Funzionalità possono integrare o collegarsi a siti, applicazioni, servizi, protocolli o contenuti di terze parti (i "Servizi di terze parti"). L'utilizzo dei Servizi di terze parti avviene a proprio rischio ed è soggetto ai relativi termini e alle politiche sulla privacy. {{siteName}} non controlla, approva o assume responsabilità per i Servizi di terze parti e non è responsabile dei danni derivanti dal loro utilizzo.

## Manleva

L'utente accetta di difendere, manlevare e tenere indenni {{siteName}}, i suoi licenzianti e i rispettivi funzionari, amministratori, dipendenti e rappresentanti (collettivamente, le "Parti protette") da qualsiasi reclamo, richiesta, azione, indagine, danno, perdita, responsabilità, costo e spesa (incluse ragionevoli spese legali) derivanti da o relativi a: (i) utilizzo o uso improprio delle Interfacce o Funzionalità; (ii) violazione dei presenti Termini o della legge applicabile; (iii) controversie con terzi; (iv) violazione o appropriazione effettiva o presunta dei diritti di terzi; o (v) Feedback/Contenuti. Se riceviamo una citazione o un ordine obbligatorio relativo a quanto sopra, l'utente rimborserà il tempo, i materiali e le spese legali ragionevoli sostenute per rispondere.

## Esclusioni di garanzia

LE INTERFACCE E LE FUNZIONALITÀ SONO FORNITE "COSÌ COME SONO" E "COME DISPONIBILI". NELLA MASSIMA MISURA CONSENTITA DALLA LEGGE, {{siteNameUpper}} E I SUOI LICENZIANTI ESCLUDONO TUTTE LE GARANZIE, ESPRESSE O IMPLICITE, INCLUSE COMMERCIABILITÀ, IDONEITÀ A UNO SCOPO SPECIFICO, NON VIOLAZIONE, ACCURATEZZA, PACIFICO GODIMENTO E QUALSIASI GARANZIA DERIVANTE DA RAPPORTI COMMERCIALI O USI DEL COMMERCIO. NON GARANTIAMO CHE LE INTERFACCE O LE FUNZIONALITÀ SIANO ININTERROTTE, PRIVE DI ERRORI, SICURE O PRIVE DI VIRUS, O CHE QUALSIASI CONTENUTO O DATO SIA ACCURATO O AFFIDABILE.

## Limitazione di responsabilità

NELLA MASSIMA MISURA CONSENTITA DALLA LEGGE: (A) {{siteNameUpper}} O I SUOI FORNITORI DI SERVIZI NON SARANNO IN ALCUN CASO RESPONSABILI DI DANNI INDIRETTI, INCIDENTALI, SPECIALI, CONSEQUENZIALI, ESEMPLARI O PUNITIVI, O DI PERDITE DI PROFITTI, RICAVI, AVVIAMENTO, DATI O ALTRE PERDITE IMMATERIALI, ANCHE SE INFORMATI DELLA POSSIBILITÀ DI TALI DANNI; E (B) LA RESPONSABILITÀ AGGREGATA DI {{siteNameUpper}} PER TUTTI I RECLAMI RELATIVI ALLE INTERFACCE O ALLE FUNZIONALITÀ NON SUPERERÀ 100 USD. TALI LIMITAZIONI SI APPLICANO A TUTTE LE CAUSE DI AZIONE, CONTRATTUALI, EXTRACONTRATTUALI (INCLUSA LA NEGLIGENZA), DI RESPONSABILITÀ OGGETTIVA O DI ALTRO TIPO.

Alcune giurisdizioni non consentono determinate esclusioni o limitazioni di responsabilità; in tali casi, quanto sopra si applicherà nella massima misura consentita dalla legge applicabile.

## Legge applicabile, risoluzione delle controversie e rinuncia alle azioni collettive

- **Legge applicabile.** I presenti Termini e qualsiasi controversia o reclamo derivante da essi o dalle Interfacce o Funzionalità, o a essi relativo, saranno disciplinati dalle leggi della giurisdizione in cui {{siteName}} è organizzata o svolge principalmente la propria attività, senza tener conto delle norme sul conflitto di leggi.
- **Risoluzione informale.** Prima di avviare un arbitrato o un contenzioso, la parte lesa deve inviare una comunicazione scritta che descriva il reclamo e il rimedio richiesto. Le parti tenteranno in buona fede di risolvere la controversia entro 45 giorni dalla comunicazione.
- **Arbitrato obbligatorio.** Qualsiasi controversia, reclamo o contestazione non risolta informalmente sarà risolta in via definitiva mediante arbitrato vincolante davanti a un arbitro unico, amministrato da un istituto arbitrale affidabile nella giurisdizione competente secondo le regole in vigore al momento del deposito. Ciascuna parte può chiedere a un tribunale competente provvedimenti provvisori a supporto dell'arbitrato. L'utente e {{siteName}} rinunciano a qualsiasi diritto a un processo con giuria.
- **Rinuncia alle azioni collettive.** Tutti i procedimenti devono essere avviati a titolo individuale dalle parti, non come attore o membro di un'azione collettiva, comune, consolidata o rappresentativa. L'arbitro non può consolidare i reclami né presiedere procedimenti collettivi o rappresentativi.

Se un tribunale ritiene inapplicabile la rinuncia alle azioni collettive, l'intero accordo arbitrale sarà nullo e la controversia procederà in tribunale.

## Imposte

L'utente è il solo responsabile della determinazione e dell'adempimento di qualsiasi obbligo fiscale derivante dalle proprie attività tramite le Interfacce o le Funzionalità e del rispetto delle leggi fiscali e degli obblighi di dichiarazione applicabili.

## Risoluzione

Possiamo sospendere o terminare l'accesso dell'utente ad alcune o tutte le Interfacce o Funzionalità in qualsiasi momento e per qualsiasi motivo, anche se riteniamo che abbia violato i presenti Termini o la legge applicabile. Alla cessazione, il diritto di utilizzare le Interfacce o le Funzionalità termina immediatamente. Le sezioni destinate a sopravvivere (incluse Proprietà, Manleva, Esclusioni di garanzia, Limitazione di responsabilità, Legge applicabile o Risoluzione delle controversie e Termini generali) sopravvivranno alla cessazione.

## Termini generali

- **Accordo completo.** I presenti Termini (inclusi i documenti incorporati per riferimento) costituiscono l'intero accordo tra l'utente e {{siteName}} sull'oggetto e sostituiscono ogni intesa precedente o contemporanea.
- **Nessuna agenzia.** Nulla nei presenti Termini crea un rapporto di società, joint venture, lavoro o agenzia tra l'utente e {{siteName}}.
- **Cessione.** L'utente non può cedere o trasferire i presenti Termini o qualsiasi diritto qui previsto senza il nostro previo consenso scritto. Possiamo cedere o trasferire i presenti Termini senza restrizioni.
- **Separabilità e rinuncia.** Se una disposizione è ritenuta invalida o inapplicabile, le restanti disposizioni rimangono pienamente valide. Il mancato rispetto di una disposizione non costituisce rinuncia al nostro diritto di farla rispettare in seguito.
- **Rimedi.** I nostri diritti e rimedi sono cumulativi e si aggiungono a tutti i diritti e rimedi disponibili per legge o secondo equità.
- **Contatti.** Domande, reclami o richieste relativi alle Interfacce o alle Funzionalità devono essere indirizzati tramite il metodo di contatto indicato nell'Interfaccia.
$tos_it$),
  ('pl', $tos_pl$
# Warunki korzystania z {{siteName}}

Niniejsze Warunki korzystania („Warunki”) regulują dostęp użytkownika do interfejsów i funkcji oferowanych przez {{siteName}} oraz ich używanie.

## Wprowadzenie

Niniejsze Warunki korzystania („Warunki”) określają, w jaki sposób użytkownik, osobiście lub w imieniu podmiotu, może uzyskiwać dostęp do interfejsów, stron internetowych, aplikacji i powiązanych funkcji udostępnianych za pośrednictwem {{siteUrl}}, korzystać z nich lub wchodzić z nimi w interakcje w inny sposób. Warunki obejmują wszelkie zasady lub dokumenty, które wyraźnie włączają niniejsze Warunki poprzez odesłanie, a także naszą Politykę prywatności (łącznie „Umowa”). Uzyskując dostęp do dowolnego interfejsu, serwisu lub funkcji udostępnionych przez {{siteName}} lub korzystając z nich (łącznie „Interfejsy” i „Funkcje”), użytkownik zgadza się przestrzegać niniejszej Umowy.

**UWAGA: NALEŻY UWAŻNIE PRZECZYTAĆ NINIEJSZE WARUNKI. UZYSKUJĄC DOSTĘP DO DOWOLNEGO INTERFEJSU LUB FUNKCJI LUB KORZYSTAJĄC Z NICH (W TYM PODŁĄCZAJĄC SAMODZIELNIE ZARZĄDZANY PORTFEL LUB TWORZĄC IDENTYFIKATOR), UŻYTKOWNIK OŚWIADCZA, ŻE MOŻE ZAWRZEĆ WIĄŻĄCĄ UMOWĘ ORAZ ŻE PRZECZYTAŁ, ZROZUMIAŁ I ZGADZA SIĘ PRZESTRZEGAĆ NINIEJSZYCH WARUNKÓW, W TYM PONIŻSZEGO WIĄŻĄCEGO ARBITRAŻU I ZRZECZENIA SIĘ POZWÓW ZBIOROWYCH. JEŚLI UŻYTKOWNIK NIE WYRAŻA ZGODY, NIE POWINIEN UZYSKIWAĆ DOSTĘPU DO INTERFEJSÓW ANI FUNKCJI ANI Z NICH KORZYSTAĆ.**

## Zakres i opis Interfejsów i Funkcji

- **Funkcje treści (opcjonalne):** niektóre Interfejsy mogą udostępniać treści informacyjne, dane lub komentarze dotyczące rynków, wydarzeń lub innych tematów („Funkcje treści”). Informacje te służą wyłącznie ogólnym celom informacyjnym i nie stanowią porady finansowej, prawnej, podatkowej ani innej porady profesjonalnej.
- **Funkcje technologiczne:** niektóre Interfejsy mogą umożliwiać podłączenie samodzielnie zarządzanego portfela kryptowalut („Portfel”) w celu przesyłania transakcji do obsługiwanych sieci blockchain i niepowierniczego korzystania z kontraktów związanych z wydarzeniami lub podobnych mechanizmów on-chain („Kontrakty”) (wraz z powiązanymi elementami interfejsu użytkownika „Funkcje technologiczne”).

Użytkownik przyjmuje do wiadomości, że {{siteName}} nie prowadzi scentralizowanej giełdy, nie świadczy usług realizacji ani rozliczania transakcji, nie przejmuje posiadania ani pieczy nad aktywami użytkownika i nie działa w jego imieniu. Ceny lub dane rynkowe wyświetlane w Interfejsach mają charakter informacyjny i nie stanowią oferty, nakłaniania, rekomendacji ani porady.

Po podłączeniu Portfela użytkownik rozumie i zgadza się, że:

- kontroluje swój Portfel i ponosi wyłączną odpowiedzialność za ochronę kluczy prywatnych, fraz seed, haseł i ustawień bezpieczeństwa;
- {{siteName}} nie może uzyskać dostępu do kluczy prywatnych użytkownika, cofnąć transakcji ani kontrolować, zagwarantować lub zapewnić powodzenia lub wyniku transakcji zainicjowanej przez użytkownika;
- transakcje mogą wymagać bezzwrotnych opłat sieciowych, za które wyłączną odpowiedzialność ponosi użytkownik;
- sieci blockchain oraz wszelkie kontrakty lub protokoły, z którymi użytkownik wchodzi w interakcję, są obsługiwane przez osoby trzecie; {{siteName}} nie jest ich właścicielem ani ich nie kontroluje i nie składa obietnic dotyczących ich dostępności, bezpieczeństwa lub działania.

## Kwalifikowalność; sankcje; jurysdykcje objęte ograniczeniami

Użytkownik oświadcza i gwarantuje, że ma co najmniej 18 lat (lub osiągnął wiek pełnoletności w swojej jurysdykcji) i ma uprawnienia do zawarcia niniejszej Umowy. Ponadto oświadcza i gwarantuje, że nie jest:

- objęty sankcjami gospodarczymi lub handlowymi oraz przestrzega obowiązujących przepisów dotyczących przeciwdziałania praniu pieniędzy i finansowaniu terroryzmu;
- osobą uzyskującą dostęp do Funkcji technologicznych (w tym handlu Kontraktami), korzystającą z nich lub próbującą z nich korzystać z jurysdykcji, w której taka działalność jest zabroniona („Jurysdykcje objęte ograniczeniami”). Bez ograniczania powyższego osoby lub podmioty zamieszkałe, znajdujące się, zarejestrowane, posiadające siedzibę lub główne miejsce prowadzenia działalności w jurysdykcji, w której obowiązujące prawo zabrania takiego użycia, nie mogą używać Funkcji technologicznych do handlu.

Użytkownik oświadcza i gwarantuje również, że nie będzie korzystać z VPN ani podobnych narzędzi w celu obejścia geoblokady lub innych kontroli dostępu.

Jeśli którekolwiek z powyższych stwierdzeń przestanie być prawdziwe, użytkownik musi natychmiast zaprzestać dostępu do Funkcji technologicznych.

## Potwierdzenia użytkownika; ryzyko

- **Wyłącznie informacje.** Funkcje treści służą wyłącznie celom informacyjnym; przed poleganiem na informacjach użytkownik powinien niezależnie je zweryfikować.
- **Brak porad lub obowiązku powierniczego.** Żadne treści w Interfejsach ani za pośrednictwem Funkcji nie stanowią porady inwestycyjnej, prawnej, podatkowej, księgowej ani innej porady profesjonalnej, a korzystanie z Interfejsów lub Funkcji nie tworzy obowiązków powierniczych. Przed podjęciem decyzji należy zasięgnąć niezależnej porady profesjonalnej.
- **Technologia eksperymentalna lub ryzykowna.** Korzystanie z technologii blockchain wiąże się ze znacznym ryzykiem, w tym z podatnością inteligentnych kontraktów, błędami interfejsu lub doświadczenia użytkownika, włamaniami, phishingiem, atakami socjotechnicznymi, zmiennością i nieodwracalnymi transakcjami. Użytkownik może stracić część lub całość aktywów używanych w związku z Kontraktami.
- **Infrastruktura osób trzecich.** {{siteName}} nie kontroluje sieci blockchain, walidatorów, wyroczni, mostów, indeksatorów, dostawców RPC ani innych usług osób trzecich. Awarie, przeciążenia, reorganizacje, forki lub inne problemy mogą wpływać na dostępność lub funkcjonalność.
- **Rozstrzyganie Kontraktów.** Rozstrzyganie Kontraktów (jeśli dotyczy) odbywa się wyłącznie zgodnie z zasadami właściwymi dla danego rynku oraz wszelkimi wyroczniami osób trzecich lub mechanizmami rozstrzygania sporów wskazanymi w warunkach danego rynku. {{siteName}} nie ponosi odpowiedzialności za wyniki rozstrzygnięć ani spory między uczestnikami rynku.

## Zmiany Warunków oraz Interfejsów lub Funkcji

Możemy aktualizować niniejsze Warunki oraz według własnego uznania modyfikować, zawieszać lub wycofywać dowolny Interfejs lub Funkcję, w całości lub w części, z powiadomieniem lub bez, w tym ograniczać dostęp (na przykład umieszczając Funkcje w trybie wyłącznie zamykania). Dalsze korzystanie po wejściu zmian w życie oznacza akceptację zaktualizowanych Warunków. Jeśli użytkownik nie wyraża zgody, musi zaprzestać korzystania z Interfejsów i Funkcji.

## Obowiązki użytkownika i zabronione zachowanie

Użytkownik zgadza się korzystać z Interfejsów i Funkcji zgodnie z prawem i w odpowiedni sposób. W szczególności nie wolno:

- naruszać obowiązujących przepisów, regulacji lub nakazów;
- korzystać z Funkcji technologicznych z Jurysdykcji objętej ograniczeniami lub dla osoby objętej ograniczeniami albo w jej imieniu;
- używać VPN lub podobnych narzędzi w celu obejścia geoblokady lub kontroli dostępu;
- podawać fałszywych, niedokładnych lub wprowadzających w błąd informacji;
- zakłócać działania Interfejsów lub Funkcji, wprowadzać złośliwego oprogramowania ani próbować uzyskiwać nieautoryzowanego dostępu;
- skrobać, gromadzić ani używać narzędzi automatycznych (w tym botów lub crawlerów) do wydobywania danych, chyba że jest to wyraźnie dozwolone;
- dokonywać inżynierii wstecznej lub dekompilować oprogramowania, z wyjątkiem ograniczonego zakresu wymaganego przez obowiązujące prawo;
- udzielać sublicencji, sprzedawać ani wykorzystywać komercyjnie Interfejsów lub Funkcji, z wyjątkiem przypadków wyraźnie dozwolonych;
- podejmować nadużywających lub manipulacyjnych działań rynkowych, w tym spoofingu, layering, wash tradingu, transakcji uzgodnionych z góry, corneringu lub innych praktyk wprowadzających w błąd albo zakłócających rynek;
- naruszać lub przywłaszczać sobie własności intelektualnej lub innych praw jakiejkolwiek osoby.

Możemy badać podejrzewane naruszenia i podejmować działania, które uznamy za właściwe, w tym zawieszać lub kończyć dostęp oraz współpracować z organami ścigania.

## Dodatkowe informacje; weryfikacja

My lub dostawcy usług compliance działający w naszym imieniu możemy żądać informacji w celu potwierdzenia kwalifikowalności użytkownika (na przykład że nie jest osobą objętą ograniczeniami). Nieudzielenie wystarczających informacji może skutkować odmową lub utratą dostępu do części lub wszystkich Funkcji.

## Własność; licencja; opinie i treści użytkownika

- **Własność.** Z wyjątkiem praw wyraźnie przyznanych użytkownikowi {{siteName}} i jego licencjodawcy zachowują wszelkie prawa, tytuły i interesy dotyczące Interfejsów i Funkcji, w tym związanej z nimi własności intelektualnej.
- **Ograniczona licencja dla użytkownika.** Z zastrzeżeniem niniejszych Warunków {{siteName}} udziela użytkownikowi osobistej, odwołalnej, niewyłącznej, niezbywalnej i niepodlegającej sublicencjonowaniu licencji na dostęp do udostępnionych Interfejsów i Funkcji oraz korzystanie z nich.
- **Opinie i treści użytkownika.** Jeśli użytkownik prześle opinie, sugestie, prośby o wsparcie lub treści („Opinie/Treści”), udziela {{siteName}} ogólnoświatowej, nieodpłatnej, zbywalnej, podlegającej sublicencjonowaniu, nieodwołalnej i wieczystej licencji na używanie, hostowanie, powielanie, modyfikowanie, adaptowanie, publikowanie, wyświetlanie, tworzenie dzieł zależnych i inne wykorzystywanie takich Opinii/Treści do celów biznesowych (w tym dostarczania i ulepszania Interfejsów i Funkcji). Użytkownik oświadcza i gwarantuje, że posiada lub kontroluje niezbędne prawa do udzielenia tej licencji oraz że jego Opinie/Treści nie naruszają praw innych osób.

## Usługi i linki osób trzecich

Interfejsy i Funkcje mogą integrować się z witrynami, aplikacjami, usługami, protokołami lub treściami osób trzecich lub zawierać do nich linki („Usługi osób trzecich”). Użytkownik korzysta z Usług osób trzecich na własne ryzyko i zgodnie z ich warunkami oraz politykami prywatności. {{siteName}} nie kontroluje, nie popiera ani nie przyjmuje odpowiedzialności za Usługi osób trzecich i nie odpowiada za szkody wynikające z ich użycia.

## Zwolnienie z odpowiedzialności

Użytkownik zgadza się bronić {{siteName}}, jego licencjodawców oraz ich odpowiednich członków kadry kierowniczej, dyrektorów, pracowników i przedstawicieli (łącznie „Strony chronione”), zwolnić ich z odpowiedzialności i zabezpieczyć przed wszelkimi roszczeniami, żądaniami, działaniami, dochodzeniami, szkodami, stratami, zobowiązaniami, kosztami i wydatkami (w tym uzasadnionymi honorariami adwokackimi) wynikającymi z lub związanymi z: (i) korzystaniem z Interfejsów lub Funkcji albo ich niewłaściwym użyciem; (ii) naruszeniem niniejszych Warunków lub obowiązującego prawa; (iii) sporami z osobami trzecimi; (iv) faktycznym lub zarzucanym naruszeniem albo przywłaszczeniem praw osób trzecich; lub (v) Opiniami/Treściami użytkownika. Jeśli otrzymamy wezwanie lub nakaz dotyczący powyższych kwestii, użytkownik zwróci uzasadnione koszty czasu, materiałów i pomocy prawnej poniesione w odpowiedzi.

## Wyłączenia gwarancji

INTERFEJSY I FUNKCJE SĄ DOSTARCZANE „W STANIE, W JAKIM SIĘ ZNAJDUJĄ” ORAZ „W MIARĘ DOSTĘPNOŚCI”. W MAKSYMALNYM ZAKRESIE DOZWOLONYM PRAWEM {{siteNameUpper}} I JEGO LICENCJODAWCY WYŁĄCZAJĄ WSZELKIE GWARANCJE, WYRAŹNE LUB DOROZUMIANE, W TYM DOTYCZĄCE WARTOŚCI HANDLOWEJ, PRZYDATNOŚCI DO OKREŚLONEGO CELU, NIENARUSZANIA PRAW, DOKŁADNOŚCI, NIEZAKŁÓCONEGO KORZYSTANIA ORAZ GWARANCJE WYNIKAJĄCE Z DOTYCHCZASOWYCH RELACJI LUB ZWYCZAJÓW HANDLOWYCH. NIE GWARANTUJEMY, ŻE INTERFEJSY LUB FUNKCJE BĘDĄ NIEPRZERWANE, WOLNE OD BŁĘDÓW, BEZPIECZNE LUB WOLNE OD WIRUSÓW ANI ŻE JAKIEKOLWIEK TREŚCI LUB DANE BĘDĄ DOKŁADNE LUB WIARYGODNE.

## Ograniczenie odpowiedzialności

W MAKSYMALNYM ZAKRESIE DOZWOLONYM PRAWEM: (A) {{siteNameUpper}} ANI JEGO DOSTAWCY USŁUG W ŻADNYM WYPADKU NIE BĘDĄ ODPOWIADAĆ ZA JAKIEKOLWIEK SZKODY POŚREDNIE, PRZYPADKOWE, SZCZEGÓLNE, WTÓRNE, PRZYKŁADOWE LUB KARNE ANI ZA UTRATĘ ZYSKÓW, PRZYCHODÓW, RENOMY, DANYCH LUB INNYCH STRAT NIEMATERIALNYCH, NAWET JEŚLI POINFORMOWANO ICH O MOŻLIWOŚCI TAKICH SZKÓD; ORAZ (B) ŁĄCZNA ODPOWIEDZIALNOŚĆ {{siteNameUpper}} ZA WSZYSTKIE ROSZCZENIA ZWIĄZANE Z INTERFEJSAMI LUB FUNKCJAMI NIE PRZEKROCZY 100 USD. OGRANICZENIA TE STOSUJE SIĘ DO WSZYSTKICH PODSTAW ROSZCZEŃ, NIEZALEŻNIE OD TEGO, CZY SĄ UMOWNE, DELIKTOWE (W TYM Z TYTUŁU ZANIEDBANIA), OPARTE NA ODPOWIEDZIALNOŚCI OBIEKTYWNEJ, CZY INNE.

Niektóre jurysdykcje nie zezwalają na określone wyłączenia lub ograniczenia odpowiedzialności; w takich przypadkach powyższe postanowienia stosuje się w maksymalnym zakresie dozwolonym przez obowiązujące prawo.

## Prawo właściwe; rozstrzyganie sporów; zrzeczenie się pozwów zbiorowych

- **Prawo właściwe.** Niniejsze Warunki oraz wszelkie spory lub roszczenia z nich wynikające albo związane z nimi, Interfejsami lub Funkcjami podlegają prawu jurysdykcji, w której {{siteName}} jest zorganizowany lub prowadzi główną działalność, bez uwzględniania norm kolizyjnych.
- **Rozwiązanie nieformalne.** Przed rozpoczęciem arbitrażu lub postępowania sądowego poszkodowana strona musi wysłać pisemne zawiadomienie opisujące roszczenie i żądane zadośćuczynienie. Strony podejmą w dobrej wierze próbę rozwiązania sporu w ciągu 45 dni od zawiadomienia.
- **Obowiązkowy arbitraż.** Każdy spór, roszczenie lub kontrowersja, której nie rozwiązano nieformalnie, zostanie ostatecznie rozstrzygnięta w wiążącym arbitrażu przed jednym arbitrem, administrowanym przez renomowaną instytucję arbitrażową w jurysdykcji właściwej zgodnie z jej zasadami obowiązującymi w chwili wniesienia roszczenia. Każda strona może zwrócić się do właściwego sądu o środki tymczasowe wspierające arbitraż. Użytkownik i {{siteName}} zrzekają się prawa do procesu z udziałem ławy przysięgłych.
- **Zrzeczenie się pozwów zbiorowych.** Wszystkie postępowania muszą być prowadzone przez strony indywidualnie, a nie jako powód lub członek rzekomego pozwu zbiorowego, grupowego, skonsolidowanego lub przedstawicielskiego. Arbiter nie może łączyć roszczeń ani prowadzić żadnego postępowania zbiorowego lub przedstawicielskiego.

Jeżeli sąd uzna zrzeczenie się pozwów zbiorowych za niewykonalne, cała umowa arbitrażowa będzie nieważna, a spór zostanie rozstrzygnięty w sądzie.

## Podatki

Użytkownik ponosi wyłączną odpowiedzialność za ustalenie i wypełnienie wszelkich obowiązków podatkowych wynikających z jego działalności za pośrednictwem Interfejsów lub Funkcji oraz za przestrzeganie obowiązujących przepisów podatkowych i wymogów sprawozdawczych.

## Rozwiązanie

Możemy w dowolnym momencie i z dowolnego powodu zawiesić lub zakończyć dostęp użytkownika do części lub wszystkich Interfejsów lub Funkcji, w tym jeśli uznamy, że naruszył niniejsze Warunki lub obowiązujące prawo. Po zakończeniu prawo do korzystania z Interfejsów lub Funkcji wygasa natychmiast. Postanowienia, które z założenia mają obowiązywać po zakończeniu (w tym Własność, Zwolnienie z odpowiedzialności, Wyłączenia gwarancji, Ograniczenie odpowiedzialności, Prawo właściwe lub Rozstrzyganie sporów i Warunki ogólne), zachowują moc.

## Warunki ogólne

- **Całość umowy.** Niniejsze Warunki (w tym dokumenty włączone przez odesłanie) stanowią całość umowy między użytkownikiem a {{siteName}} w odniesieniu do ich przedmiotu i zastępują wszelkie wcześniejsze lub równoczesne ustalenia.
- **Brak przedstawicielstwa.** Żadne z postanowień niniejszych Warunków nie tworzy między użytkownikiem a {{siteName}} spółki, wspólnego przedsięwzięcia, stosunku pracy ani agencji.
- **Przeniesienie.** Użytkownik nie może przenieść ani scedować niniejszych Warunków ani żadnych praw z nimi związanych bez naszej uprzedniej pisemnej zgody. Możemy przenieść lub scedować niniejsze Warunki bez ograniczeń.
- **Rozdzielność; zrzeczenie.** Jeśli którekolwiek postanowienie zostanie uznane za nieważne lub niewykonalne, pozostałe postanowienia zachowają pełną moc. Brak egzekwowania przez nas postanowienia nie oznacza zrzeczenia się prawa do egzekwowania go w późniejszym terminie.
- **Środki prawne.** Nasze prawa i środki prawne mają charakter kumulatywny i uzupełniają wszelkie prawa i środki dostępne na mocy prawa lub zasad słuszności.
- **Kontakt.** Pytania, skargi lub roszczenia dotyczące Interfejsów lub Funkcji należy kierować za pośrednictwem metody kontaktu podanej w Interfejsie.
$tos_pl$),
  ('ko', $tos_ko$
# {{siteName}} 이용약관

본 이용약관(이하 “약관”)은 {{siteName}}이 제공하는 인터페이스와 기능에 대한 귀하의 접근 및 이용을 규율합니다.

## 소개

본 이용약관(이하 “약관”)은 귀하가 개인 자격으로 또는 단체를 대표하여 {{siteUrl}}를 통해 제공되는 인터페이스, 웹사이트, 애플리케이션 및 관련 기능에 접근하고 이용하거나 기타 방식으로 상호작용할 수 있는 방법을 규정합니다. 약관에는 본 약관을 명시적으로 참조하여 포함하는 정책 또는 문서와 당사의 개인정보 처리방침(통칭하여 “계약”)이 포함됩니다. {{siteName}}이 제공하는 인터페이스, 웹사이트 또는 기능(통칭하여 “인터페이스” 및 “기능”)에 접근하거나 이를 이용하면 귀하는 본 계약에 구속되는 데 동의하는 것입니다.

**고지: 본 약관을 주의 깊게 읽으십시오. 인터페이스 또는 기능(자체 보관형 지갑 연결 또는 식별자 생성 포함)에 접근하거나 이를 이용함으로써 귀하는 구속력 있는 계약을 체결할 수 있고, 아래의 구속력 있는 중재 및 집단소송 포기를 포함한 본 약관을 읽고 이해했으며 이에 동의한다는 것을 진술합니다. 동의하지 않는 경우 인터페이스 또는 기능에 접근하거나 이를 이용하지 마십시오.**

## 인터페이스 및 기능의 범위와 설명

- **콘텐츠 기능(선택 사항):** 일부 인터페이스는 시장, 이벤트 또는 기타 주제에 대한 정보 콘텐츠, 데이터 또는 의견(“콘텐츠 기능”)을 제공할 수 있습니다. 이러한 정보는 일반적인 정보 제공 목적으로만 제공되며 금융, 법률, 세무 또는 기타 전문적인 조언을 구성하지 않습니다.
- **기술 기능:** 일부 인터페이스는 귀하가 자체 보관형 암호화폐 지갑(“지갑”)을 연결하여 지원되는 블록체인 네트워크로 거래를 전송하고 이벤트 기반 계약 또는 이와 유사한 온체인 메커니즘(“계약”)과 비수탁 방식으로 상호작용할 수 있도록 할 수 있습니다(관련 사용자 인터페이스 구성 요소와 함께 “기술 기능”).

귀하는 {{siteName}}이 중앙화 거래소를 운영하지 않고, 거래 실행 또는 청산 서비스를 제공하지 않으며, 귀하의 자산을 점유하거나 보관하지 않고, 귀하를 대신하여 행동하지 않는다는 점을 인정합니다. 인터페이스를 통해 표시되는 가격 또는 시장 데이터는 정보 제공용이며 제안, 권유, 추천 또는 조언이 아닙니다.

지갑 연결을 선택하는 경우 귀하는 다음 사항을 이해하고 동의합니다.

- 귀하는 자신의 지갑을 통제하며 개인 키, 시드 문구, 비밀번호 및 보안 설정을 보호할 전적인 책임이 있습니다.
- {{siteName}}은 귀하의 개인 키에 접근하거나 거래를 되돌릴 수 없으며, 귀하가 시작한 거래의 성공 또는 결과를 통제, 보장 또는 확보할 수 없습니다.
- 거래에는 환불되지 않는 네트워크 수수료가 필요할 수 있으며, 이는 전적으로 귀하의 책임입니다.
- 귀하가 상호작용하는 블록체인 네트워크와 모든 계약 또는 프로토콜은 제3자가 운영합니다. {{siteName}}은 이를 소유하거나 통제하지 않으며 가용성, 보안 또는 성능에 대해 약속하지 않습니다.

## 자격; 제재; 제한된 관할권

귀하는 만 18세 이상(또는 귀하의 관할권에서 성년이 되는 연령 이상)이고 본 계약을 체결할 권한이 있음을 진술하고 보증합니다. 또한 귀하는 다음에 해당하지 않음을 진술하고 보증합니다.

- 경제 또는 무역 제재의 대상이며, 적용되는 자금세탁방지 및 테러자금조달방지 법률을 준수하는 사람;
- 해당 활동이 금지된 관할권(“제한된 관할권”)에서 기술 기능(계약 거래 포함)에 접근하거나 이를 이용하거나 이용하려고 하는 사람. 앞의 내용을 제한하지 않고, 적용 법률이 이러한 이용을 금지하는 관할권에 거주하거나 소재하거나 설립되었거나 등록 사무소 또는 주된 사업장을 둔 개인 또는 단체는 거래를 위해 기술 기능을 이용할 수 없습니다.

귀하는 또한 지리적 차단 또는 기타 접근 통제를 우회하기 위해 VPN이나 유사한 도구를 사용하지 않을 것임을 진술하고 보증합니다.

위 내용 중 어느 하나라도 더 이상 사실이 아니게 되면 귀하는 즉시 기술 기능에 대한 접근을 중단해야 합니다.

## 귀하의 확인 사항; 위험

- **정보 제공만 해당.** 콘텐츠 기능은 정보 제공 목적으로만 제공되므로, 정보에 의존하기 전에 독립적으로 확인해야 합니다.
- **조언 또는 수탁 의무 없음.** 인터페이스 또는 기능의 어떠한 내용도 투자, 법률, 세무, 회계 또는 기타 전문적인 조언을 구성하지 않으며, 인터페이스 또는 기능의 이용으로 수탁 의무가 발생하지 않습니다. 결정을 내리기 전에 독립적인 전문 조언을 구하십시오.
- **실험적이거나 위험한 기술.** 블록체인 기술과 상호작용하는 데에는 스마트 계약 취약점, UI 또는 UX 버그, 해킹, 피싱, 사회공학 공격, 변동성 및 되돌릴 수 없는 거래를 포함한 상당한 위험이 있습니다. 계약과 관련하여 사용하는 자산의 일부 또는 전부를 잃을 수 있습니다.
- **제3자 인프라.** {{siteName}}은 블록체인 네트워크, 검증자, 오라클, 브리지, 인덱서, RPC 제공자 또는 기타 제3자 서비스를 통제하지 않습니다. 장애, 혼잡, 재구성, 포크 또는 기타 문제로 가용성이나 기능이 영향을 받을 수 있습니다.
- **계약의 해결.** 계약의 해결(해당하는 경우)은 관련 시장 약관에 언급된 시장별 규칙과 제3자 오라클 또는 분쟁 메커니즘에 따라서만 이루어집니다. {{siteName}}은 해결 결과나 시장 참여자 간의 분쟁에 대해 책임지지 않습니다.

## 약관 및 인터페이스 또는 기능의 변경

당사는 통지 여부와 관계없이 재량에 따라 본 약관을 업데이트하고 인터페이스 또는 기능의 전부 또는 일부를 변경, 중단 또는 종료할 수 있으며, 여기에는 접근 제한(예: 기능을 청산 전용 모드로 전환)이 포함됩니다. 변경 사항의 효력이 발생한 후에도 계속 이용하면 업데이트된 약관을 수락한 것으로 봅니다. 동의하지 않는 경우 인터페이스와 기능의 이용을 중단해야 합니다.

## 귀하의 책임 및 금지된 행위

귀하는 인터페이스와 기능을 합법적이고 적절하게 이용하는 데 동의합니다. 제한 없이 귀하는 다음을 해서는 안 됩니다.

- 적용되는 법률, 규정 또는 명령을 위반하는 행위;
- 제한된 관할권에서 또는 제한된 사람을 위해 또는 그를 대신하여 기술 기능을 이용하는 행위;
- 지리적 차단 또는 접근 통제를 우회하기 위해 VPN이나 유사한 도구를 이용하는 행위;
- 허위이거나 부정확하거나 오해를 일으키는 정보를 제공하는 행위;
- 인터페이스 또는 기능을 방해하거나 중단시키거나 악성코드를 도입하거나 무단 접근을 시도하는 행위;
- 명시적으로 허용된 경우를 제외하고 스크래핑, 수집 또는 자동화 도구(봇이나 크롤러 포함)를 사용하여 데이터를 추출하는 행위;
- 적용 법률상 제한적으로 요구되는 경우를 제외하고 소프트웨어를 리버스 엔지니어링하거나 디컴파일하는 행위;
- 명시적으로 허용된 경우를 제외하고 인터페이스 또는 기능을 재허가하거나 판매하거나 상업적으로 이용하는 행위;
- 스푸핑, 레이어링, 워시 트레이딩, 사전 합의 거래, 시장 장악 또는 기타 기만적이거나 방해적인 행위를 포함한 남용적 또는 조작적인 시장 행위;
- 누구의 지식재산권 또는 기타 권리든 침해하거나 부당하게 사용하거나 빼앗는 행위.

당사는 위반이 의심되는 행위를 조사하고 접근 정지 또는 종료, 법 집행기관과의 협조를 포함하여 적절하다고 판단하는 조치를 취할 수 있습니다.

## 추가 정보; 확인

당사 또는 당사를 대신하여 활동하는 규정 준수 서비스 제공자는 귀하의 자격(예: 제한된 사람이 아님)을 확인하기 위한 정보를 요청할 수 있습니다. 충분한 정보를 제공하지 않으면 일부 또는 모든 기능에 대한 접근이 거부되거나 상실될 수 있습니다.

## 소유권; 라이선스; 귀하의 피드백 및 콘텐츠

- **소유권.** 귀하에게 명시적으로 부여된 권리를 제외하고 {{siteName}} 및 그 라이선스 제공자는 관련 지식재산권을 포함하여 인터페이스와 기능에 대한 모든 권리, 권원 및 이익을 보유합니다.
- **귀하에 대한 제한적 라이선스.** 본 약관에 따라 {{siteName}}은 귀하에게 제공된 인터페이스와 기능에 접근하고 이용할 수 있는 개인적이고 철회 가능하며 비독점적이고 양도 불가능하며 재허가할 수 없는 라이선스를 부여합니다.
- **귀하의 피드백 및 콘텐츠.** 귀하가 피드백, 제안, 지원 요청 또는 콘텐츠(“피드백/콘텐츠”)를 제출하는 경우, 귀하는 {{siteName}}에 해당 피드백/콘텐츠를 사업 목적(인터페이스와 기능의 제공 및 개선 포함)으로 사용, 호스팅, 복제, 수정, 각색, 게시, 표시, 2차적 저작물 작성 및 기타 방식으로 이용할 수 있는 전 세계적이고 로열티가 없으며 양도 가능하고 재허가 가능하며 철회 불가능하고 영구적인 라이선스를 부여합니다. 귀하는 이 라이선스를 부여하는 데 필요한 권리를 소유하거나 통제하며 귀하의 피드백/콘텐츠가 타인의 권리를 침해하지 않음을 진술하고 보증합니다.

## 제3자 서비스 및 링크

인터페이스와 기능은 제3자의 사이트, 애플리케이션, 서비스, 프로토콜 또는 콘텐츠(“제3자 서비스”)와 통합되거나 이에 연결될 수 있습니다. 제3자 서비스의 이용은 전적으로 귀하의 위험 부담이며 해당 서비스의 약관과 개인정보 처리방침이 적용됩니다. {{siteName}}은 제3자 서비스를 통제하거나 보증하거나 책임지지 않으며, 귀하의 이용으로 발생한 손해에 대해 책임지지 않습니다.

## 면책 및 배상

귀하는 {{siteName}}, 그 라이선스 제공자 및 각 임원, 이사, 직원과 대표자(통칭하여 “보호 대상 당사자”)를 다음에서 발생하거나 이와 관련된 모든 청구, 요구, 소송, 조사, 손해, 손실, 책임, 비용 및 지출(합리적인 변호사 비용 포함)으로부터 방어하고 배상하며 면책하는 데 동의합니다: (i) 귀하의 인터페이스 또는 기능 이용 또는 오용; (ii) 본 약관 또는 적용 법률 위반; (iii) 제3자와의 분쟁; (iv) 제3자의 권리 침해 또는 부당한 사용에 대한 실제 또는 주장된 행위; 또는 (v) 귀하의 피드백/콘텐츠. 위와 관련된 소환장이나 강제 명령을 당사가 받으면 귀하는 이에 대응하는 데 발생한 합리적인 시간, 자재 및 법률 비용을 상환해야 합니다.

## 보증의 부인

인터페이스와 기능은 “있는 그대로” 및 “이용 가능한 상태로” 제공됩니다. 법률이 허용하는 최대 범위에서 {{siteNameUpper}} 및 그 라이선스 제공자는 상품성, 특정 목적에의 적합성, 비침해, 정확성, 평온한 사용 및 거래 과정이나 상관습에서 발생하는 보증을 포함하여 명시적 또는 묵시적인 모든 보증을 부인합니다. 인터페이스 또는 기능이 중단 없이 제공되거나 오류가 없거나 안전하거나 바이러스가 없다는 점, 또는 어떠한 콘텐츠나 데이터가 정확하거나 신뢰할 수 있다는 점을 보증하지 않습니다.

## 책임의 제한

법률이 허용하는 최대 범위에서 (A){{siteNameUpper}} 또는 그 서비스 제공자는 어떠한 경우에도 간접적, 부수적, 특별, 결과적, 예시적 또는 징벌적 손해, 또는 이익, 수익, 영업권, 데이터 또는 기타 무형 손실에 대해, 그러한 손해 가능성을 통지받았더라도 책임지지 않으며, (B)인터페이스 또는 기능과 관련된 모든 청구에 대한 {{siteNameUpper}}의 총 책임은 미화 100달러를 초과하지 않습니다. 이러한 제한은 계약, 불법행위(과실 포함), 엄격 책임 또는 기타 원인인지와 관계없이 모든 청구 원인에 적용됩니다.

일부 관할권에서는 특정 책임의 배제 또는 제한을 허용하지 않을 수 있으며, 이 경우 위 내용은 적용 법률이 허용하는 최대 범위에서 적용됩니다.

## 준거법; 분쟁 해결; 집단소송 포기

- **준거법.** 본 약관 및 본 약관이나 인터페이스 또는 기능에서 발생하거나 이와 관련된 모든 분쟁 또는 청구는 {{siteName}}이 설립되었거나 주로 사업을 수행하는 관할권의 법률에 따라 규율되며 법률 충돌 규칙은 고려하지 않습니다.
- **비공식 해결.** 중재 또는 소송을 시작하기 전에 피해를 입은 당사자는 청구 내용과 원하는 구제 수단을 설명하는 서면 통지를 보내야 합니다. 당사자들은 통지 후 45일 이내에 성실하게 분쟁을 해결하도록 노력합니다.
- **의무적 중재.** 비공식적으로 해결되지 않은 모든 분쟁, 청구 또는 논쟁은 청구가 제기될 당시 유효한 규칙에 따라 준거 관할권의 평판이 좋은 중재기관이 관리하는 단일 중재인에 의한 구속력 있는 중재로 최종 해결됩니다. 어느 당사자든 관할권 있는 법원에 중재를 지원하는 잠정 구제를 신청할 수 있습니다. 귀하와 {{siteName}}은 배심 재판을 받을 권리를 포기합니다.
- **집단소송 포기.** 모든 절차는 당사자의 개인 자격으로 제기되어야 하며, 주장되는 집단, 공동, 통합 또는 대표 소송의 원고나 구성원 자격으로 제기할 수 없습니다. 중재인은 청구를 병합하거나 어떠한 형태의 집단 또는 대표 절차를 주재할 수 없습니다.

법원이 집단소송 포기를 집행할 수 없다고 판단하면 중재 합의 전체가 무효가 되고 분쟁은 법원에서 진행됩니다.

## 세금

귀하는 인터페이스 또는 기능을 통한 활동에서 발생하는 모든 세금 의무를 판단하고 이행하며 적용되는 세법과 신고 요건을 준수할 전적인 책임이 있습니다.

## 종료

당사는 귀하가 본 약관 또는 적용 법률을 위반했다고 판단하는 경우를 포함하여 어떠한 이유로든 언제든지 일부 또는 모든 인터페이스 또는 기능에 대한 귀하의 접근을 중지하거나 종료할 수 있습니다. 종료되면 인터페이스 또는 기능을 이용할 권리는 즉시 종료됩니다. 존속이 예정된 조항(소유권, 면책 및 배상, 보증의 부인, 책임의 제한, 준거법 또는 분쟁 해결 및 일반 약관 포함)은 종료 후에도 존속합니다.

## 일반 약관

- **완전한 합의.** 본 약관(참조로 포함된 문서 포함)은 그 주제에 관하여 귀하와 {{siteName}} 사이의 완전한 합의를 구성하며 이전 또는 동시의 모든 이해를 대체합니다.
- **대리관계 없음.** 본 약관의 어떠한 내용도 귀하와 {{siteName}} 사이에 파트너십, 합작투자, 고용 또는 대리 관계를 만들지 않습니다.
- **양도.** 당사의 사전 서면 동의 없이 귀하는 본 약관 또는 그에 따른 권리를 양도하거나 이전할 수 없습니다. 당사는 제한 없이 본 약관을 양도하거나 이전할 수 있습니다.
- **분리 가능성; 권리 포기.** 어떠한 조항이 무효 또는 집행 불가능하다고 판단되어도 나머지 조항은 완전한 효력을 유지합니다. 당사가 어떤 조항을 집행하지 않았다고 해서 나중에 집행할 권리를 포기한 것은 아닙니다.
- **구제 수단.** 당사의 권리와 구제 수단은 누적적이며 법률 또는 형평법상 이용 가능한 모든 권리와 구제 수단에 추가됩니다.
- **연락처.** 인터페이스 또는 기능에 관한 질문, 불만 또는 청구는 인터페이스 내에 제공된 연락 방법을 통해 전달해야 합니다.
$tos_ko$)
ON CONFLICT (locale) DO UPDATE SET
  content = EXCLUDED.content,
  updated_at = NOW();

DELETE FROM settings
WHERE "group" = 'general'
  AND key = 'tos_pdf_path';

DO
$$
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'storage'
        AND table_name = 'buckets'
    ) THEN
      UPDATE storage.buckets
      SET allowed_mime_types = ARRAY(
        SELECT allowed_mime
        FROM unnest(COALESCE(allowed_mime_types, ARRAY[]::text[])) AS allowed(allowed_mime)
        WHERE allowed_mime <> 'application/pdf'
      )
      WHERE id = 'kuest-assets';
    END IF;
  END
$$;
