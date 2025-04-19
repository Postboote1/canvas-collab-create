import React from 'react';

const TermsPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-lg shadow-md dark:bg-zinc-800 dark:border dark:border-zinc-700">
      <h1 className="text-2xl font-bold mb-4">Terms of Service</h1>
      <p>
        By using CanvasCollab, you agree to the following terms and conditions. Please read these Terms of Service ("Terms", "Terms of Service") carefully before using the CanvasCollab website and services.
      </p>
      <h2 className="text-xl font-semibold mt-6 mb-2">1. Acceptance of Terms</h2>
      <p>
        By accessing or using CanvasCollab, you agree to be bound by these Terms. If you disagree with any part of the terms, you may not access the service.
      </p>
      <h2 className="text-xl font-semibold mt-6 mb-2">2. Use of Service</h2>
      <ul className="list-disc ml-6">
        <li>You must be at least 13 years old to use this service.</li>
        <li>You are responsible for your account and any activity that occurs under your account.</li>
        <li>You agree not to use the service for any unlawful or prohibited activities.</li>
      </ul>
      <h2 className="text-xl font-semibold mt-6 mb-2">3. User Content</h2>
      <ul className="list-disc ml-6">
        <li>You retain ownership of any content you submit, post, or display on or through CanvasCollab.</li>
        <li>By submitting content, you grant CanvasCollab a non-exclusive, royalty-free license to use, display, and distribute your content as part of the service.</li>
        <li>You are responsible for ensuring that your content does not violate any laws or third-party rights.</li>
      </ul>
      <h2 className="text-xl font-semibold mt-6 mb-2">4. Termination</h2>
      <p>
        We reserve the right to suspend or terminate your access to the service at any time, without notice, for conduct that we believe violates these Terms or is harmful to other users of the service.
      </p>
      <h2 className="text-xl font-semibold mt-6 mb-2">5. Disclaimer</h2>
      <p>
        The service is provided "as is" and "as available" without warranties of any kind. CanvasCollab does not guarantee that the service will be uninterrupted or error-free.
      </p>
      <h2 className="text-xl font-semibold mt-6 mb-2">6. Limitation of Liability</h2>
      <p>
        In no event shall CanvasCollab, its owners, or affiliates be liable for any indirect, incidental, special, consequential or punitive damages arising out of your use of the service.
      </p>
      <h2 className="text-xl font-semibold mt-6 mb-2">7. Changes to Terms</h2>
      <p>
        We reserve the right to modify or replace these Terms at any time. Changes will be effective upon posting to this page. Your continued use of the service after any changes constitutes acceptance of those changes.
      </p>
      <h2 className="text-xl font-semibold mt-6 mb-2">8. Contact</h2>
      <p>
        If you have any questions about these Terms, please contact us at support@canvascollab.com.
      </p>
    </div>
  );
};

export default TermsPage;
