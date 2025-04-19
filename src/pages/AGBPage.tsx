import React from 'react';

const AGBPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-lg shadow-md dark:bg-zinc-800 dark:border dark:border-zinc-700">
      <h1 className="text-2xl font-bold mb-4">Allgemeine Geschäftsbedingungen (AGB)</h1>
      <p>
        Die folgenden Allgemeinen Geschäftsbedingungen (AGB) regeln das Vertragsverhältnis zwischen Ihnen und CanvasCollab. Bitte lesen Sie diese Bedingungen sorgfältig durch.
      </p>
      <h2 className="text-xl font-semibold mt-6 mb-2">1. Geltungsbereich</h2>
      <p>
        Diese AGB gelten für die Nutzung der Website und der Dienste von CanvasCollab.
      </p>
      <h2 className="text-xl font-semibold mt-6 mb-2">2. Nutzungsvoraussetzungen</h2>
      <ul className="list-disc ml-6">
        <li>Die Nutzung ist nur Personen ab 13 Jahren gestattet.</li>
        <li>Sie sind für die Sicherheit Ihres Kontos und aller Aktivitäten, die darüber erfolgen, verantwortlich.</li>
        <li>Die Nutzung der Dienste zu rechtswidrigen oder missbräuchlichen Zwecken ist untersagt.</li>
      </ul>
      <h2 className="text-xl font-semibold mt-6 mb-2">3. Nutzerinhalte</h2>
      <ul className="list-disc ml-6">
        <li>Sie behalten das Eigentum an Inhalten, die Sie auf CanvasCollab einstellen.</li>
        <li>Mit dem Einstellen von Inhalten räumen Sie CanvasCollab ein nicht-exklusives, gebührenfreies Nutzungsrecht zur Darstellung und Verbreitung der Inhalte im Rahmen des Dienstes ein.</li>
        <li>Sie sind dafür verantwortlich, dass Ihre Inhalte keine Rechte Dritter verletzen oder gegen geltendes Recht verstoßen.</li>
      </ul>
      <h2 className="text-xl font-semibold mt-6 mb-2">4. Beendigung</h2>
      <p>
        CanvasCollab behält sich das Recht vor, Ihren Zugang zum Dienst jederzeit und ohne Angabe von Gründen zu sperren oder zu beenden, insbesondere bei Verstößen gegen diese AGB.
      </p>
      <h2 className="text-xl font-semibold mt-6 mb-2">5. Haftungsausschluss</h2>
      <p>
        Die Nutzung des Dienstes erfolgt auf eigenes Risiko. CanvasCollab übernimmt keine Gewähr für die ständige Verfügbarkeit oder Fehlerfreiheit des Dienstes.
      </p>
      <h2 className="text-xl font-semibold mt-6 mb-2">6. Haftungsbeschränkung</h2>
      <p>
        CanvasCollab haftet nicht für indirekte, zufällige oder Folgeschäden, die aus der Nutzung des Dienstes entstehen.
      </p>
      <h2 className="text-xl font-semibold mt-6 mb-2">7. Änderungen der AGB</h2>
      <p>
        CanvasCollab behält sich das Recht vor, diese AGB jederzeit zu ändern. Änderungen werden auf dieser Seite veröffentlicht. Die fortgesetzte Nutzung des Dienstes gilt als Zustimmung zu den geänderten Bedingungen.
      </p>
      <h2 className="text-xl font-semibold mt-6 mb-2">8. Kontakt</h2>
      <p>
        Bei Fragen zu diesen AGB kontaktieren Sie uns bitte unter support@canvascollab.com.
      </p>
    </div>
  );
};

export default AGBPage;
