import React from 'react';
import Layout from '@/components/layout/Layout';
import CanvasJoin from '@/components/canvas/CanvasJoin';

const JoinPage: React.FC = () => {
  return (
   
      <div className="max-w-4xl mx-auto my-12 px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Join a Canvas</h1>
          <p className="text-gray-600 mt-2">
            Enter a code to join an existing canvas and collaborate in real-time
          </p>
        </div>
        <CanvasJoin />
      </div>
    
  );
};

export default JoinPage;
