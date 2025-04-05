
import React from 'react';
import Layout from '@/components/layout/Layout';
import CanvasJoin from '@/components/canvas/CanvasJoin';

const JoinPage: React.FC = () => {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto my-12 px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Join a Canvas</h1>
          <p className="text-gray-600 mt-2">
            Enter a code to join an existing canvas and collaborate in real-time
          </p>
        </div>
        
        <CanvasJoin />
        
        <div className="mt-12">
          <div className="bg-gray-50 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">How to Join</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="text-canvas-blue mb-2">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-semibold mb-1">Get a Join Code</h3>
                <p className="text-sm text-gray-600">
                  Ask for the 6-digit join code from the canvas creator.
                </p>
              </div>
              
              <div>
                <div className="text-canvas-blue mb-2">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                </div>
                <h3 className="font-semibold mb-1">Enter the Code</h3>
                <p className="text-sm text-gray-600">
                  Type the code into the field above and click "Join Canvas".
                </p>
              </div>
              
              <div>
                <div className="text-canvas-blue mb-2">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                  </svg>
                </div>
                <h3 className="font-semibold mb-1">Start Collaborating</h3>
                <p className="text-sm text-gray-600">
                  You'll be connected to the canvas and can collaborate in real-time.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default JoinPage;
