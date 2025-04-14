import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { pb } from '@/services/pocketbaseService';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle } from 'lucide-react';

const VerifyEmailPage: React.FC = () => {
  const [isVerifying, setIsVerifying] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  useEffect(() => {
    async function verifyEmail() {
      if (!token) {
        setError('Invalid verification token');
        setIsVerifying(false);
        return;
      }
      
      try {
        await pb.client.collection('users').confirmVerification(token);
        setIsSuccess(true);
      } catch (err) {
        console.error('Verification error:', err);
        setError('Failed to verify email. The token may be invalid or expired.');
      } finally {
        setIsVerifying(false);
      }
    }
    
    verifyEmail();
  }, [token]);
  
  return (
    
      <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-lg shadow-md text-center">
        {isVerifying ? (
          <div>
            <h1 className="text-2xl font-bold mb-4">Verifying Your Email</h1>
            <p className="text-gray-600 mb-4">Please wait while we verify your email address...</p>
            <div className="animate-pulse flex justify-center">
              <div className="h-8 w-8 bg-blue-400 rounded-full"></div>
            </div>
          </div>
        ) : isSuccess ? (
          <div>
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-4">Email Verified!</h1>
            <p className="text-gray-600 mb-6">Your email has been successfully verified.</p>
            <Button onClick={() => navigate('/login')}>Log In</Button>
          </div>
        ) : (
          <div>
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-4">Verification Failed</h1>
            <p className="text-red-500 mb-6">{error}</p>
            <Button variant="outline" onClick={() => navigate('/login')}>Return to Login</Button>
          </div>
        )}
      </div>
    
  );
};

export default VerifyEmailPage;