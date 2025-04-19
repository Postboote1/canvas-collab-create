import React from 'react';

const ImpressumPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-lg shadow-md dark:bg-zinc-800 dark:border dark:border-zinc-700">
      <h1 className="text-2xl font-bold mb-4">Impressum</h1>
      <p>
        <strong>Name:</strong> Stößel Matthias
      </p>
      <p>
        <strong>Adresse:</strong> Deutschland, Demlin 85098, Hauptstraße 22b
      </p>
      <p>
        <strong>Kontakt:</strong> <a href="mailto:support@canvascollab.de" className="text-blue-500">support@canvascollab.de</a>
      </p>
    </div>
  );
};

export default ImpressumPage;
