import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  return (
    <footer className="border-t bg-white py-6 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-lg font-semibold mb-4">CanvasCollab</h3>
            <p className="text-gray-600">
              A collaborative canvas platform for teams to create, share and present ideas visually.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4">Links</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-gray-600 hover:text-canvas-blue transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/join" className="text-gray-600 hover:text-canvas-blue transition-colors">
                  Join Canvas
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="text-gray-600 hover:text-canvas-blue transition-colors">
                  My Canvases
                </Link>
              </li>
              <li>
                <Link to="/impressum" className="text-gray-600 hover:text-canvas-blue transition-colors">
                  Impressum
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-gray-600 hover:text-canvas-blue transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/agb" className="text-gray-600 hover:text-canvas-blue transition-colors">
                  AGBs
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4">Create</h3>
            <p className="text-gray-600 mb-2">
              Start collaborating with your team today!
            </p>
            <Link 
              to="/create" 
              className="inline-block bg-canvas-blue text-white px-4 py-2 rounded hover:bg-canvas-highlight transition-colors"
            >
              Create Canvas
            </Link>
          </div>
        </div>
        
        <div className="mt-8 pt-4 border-t border-gray-200 text-center text-gray-600">
          <p>&copy; {new Date().getFullYear()} Stoessel Matthias. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
